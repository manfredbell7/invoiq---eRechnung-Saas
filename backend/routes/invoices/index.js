// src/routes/invoices/index.js
import { db } from '../../config/db.js';
import { supabase } from '../../config/database.js';
import { authMiddleware, checkDocLimit } from '../../middleware/auth.js';
import { generateXML, validateEN16931, hashXML, parseInboundXML } from '../../services/xmlEngine.js';
import { archiveService } from '../../services/archiveService.js';
import { deliveryService } from '../../services/deliveryService.js';

export async function invoiceRoutes(fastify) {

  // ── LIST INVOICES ────────────────────────────────────────────
  fastify.get('/', { preHandler: authMiddleware }, async (req) => {
    const { direction, status, limit = 50, offset = 0, search } = req.query;
    const result = await db.findInvoices(req.org.id, {
      direction, status,
      limit: parseInt(limit),
      offset: parseInt(offset),
      search
    });
    return {
      invoices: result.invoices.map(sanitizeInvoice),
      total: result.total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };
  });

  // ── GET STATS ────────────────────────────────────────────────
  fastify.get('/stats', { preHandler: authMiddleware }, async (req) => {
    const stats = await db.getStats(req.org.id);
    const org = req.org;
    return {
      ...stats,
      plan: {
        name: org.plan,
        limit: org.plan_doc_limit,
        used: org.plan_doc_used,
        remaining: Math.max(0, org.plan_doc_limit - org.plan_doc_used),
      }
    };
  });

  // ── CASHFLOW STATS ───────────────────────────────────────────
  // GET /v1/invoices/cashflow-stats
  // Liefert: offene Forderungen, Verbindlichkeiten, 30-Tage-Prognose
  fastify.get('/cashflow-stats', { preHandler: authMiddleware }, async (req) => {
    const orgId = req.org.id;
    // supabase direkt verfügbar via import

    // Offene Forderungen (Ausgang, nicht bezahlt)
    const { data: outbound } = await supabase
      .from('invoices')
      .select('amount_gross, due_date, status')
      .eq('org_id', orgId)
      .not('status', 'eq', 'paid')
      .not('status', 'eq', 'archived');

    // Offene Verbindlichkeiten (Eingang, nicht bezahlt)
    const { data: inbound } = await supabase
      .from('inbound_invoices')
      .select('amount, due_date, status')
      .eq('org_id', orgId)
      .neq('status', 'bezahlt');

    const open_receivables  = (outbound||[]).reduce((s,i)=>s+(parseFloat(i.amount_gross)||0),0);
    const open_payables     = (inbound||[]).reduce((s,i)=>s+(parseFloat(i.amount)||0),0);

    // Fällig diese Woche
    const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate()+7);
    const due_this_week_in  = (outbound||[]).filter(i=>i.due_date&&new Date(i.due_date)<=weekEnd).reduce((s,i)=>s+(parseFloat(i.amount_gross)||0),0);
    const due_this_week_out = (inbound||[]).filter(i=>i.due_date&&new Date(i.due_date)<=weekEnd).reduce((s,i)=>s+(parseFloat(i.amount)||0),0);

    // 30-Tage Prognose: tagesweise Cashflow
    const forecast = [];
    let runningBalance = 0;
    for(let d=0; d<30; d++){
      const date = new Date(); date.setDate(date.getDate()+d);
      const dateStr = date.toISOString().slice(0,10);
      const dayIn  = (outbound||[]).filter(i=>i.due_date?.slice(0,10)===dateStr).reduce((s,i)=>s+(parseFloat(i.amount_gross)||0),0);
      const dayOut = (inbound||[]).filter(i=>i.due_date?.slice(0,10)===dateStr).reduce((s,i)=>s+(parseFloat(i.amount)||0),0);
      runningBalance += dayIn - dayOut;
      forecast.push({ date: dateStr, in: dayIn, out: dayOut, balance: runningBalance });
    }

    // Format-Verteilung aus Ausgangsrechnungen
    const allFormats = (outbound||[]).map(i=>i.format).filter(Boolean);
    const total = allFormats.length || 1;
    const fmtCount = allFormats.reduce((acc,f)=>({...acc,[f]:(acc[f]||0)+1}),{});
    const format_breakdown = [
      ['XRechnung', Math.round((fmtCount['xrechnung']||0)/total*100), null],
      ['ZUGFeRD',   Math.round((fmtCount['zugferd']||0)/total*100),   null],
      ['Peppol',    Math.round((fmtCount['peppol']||0)/total*100),    null],
    ];

    return { open_receivables, open_payables, due_this_week_in, due_this_week_out, forecast, format_breakdown };
  });

  // ── GET SINGLE INVOICE ───────────────────────────────────────
  fastify.get('/:id', { preHandler: authMiddleware }, async (req, reply) => {
    const invoice = await db.findInvoiceById(req.params.id, req.org.id);
    if (!invoice) return reply.code(404).send({ error: 'Rechnung nicht gefunden' });

    await db.createAuditLog({ org_id: req.org.id, user_id: req.user?.id, invoice_id: invoice.id, action: 'viewed', details: {} });
    return sanitizeInvoice(invoice);
  });

  // ── CREATE & GENERATE INVOICE ────────────────────────────────
  fastify.post('/', {
    preHandler: [authMiddleware, checkDocLimit],
    schema: {
      body: {
        type: 'object',
        required: ['invoice_number', 'invoice_date', 'buyer_name', 'line_items'],
        properties: {
          invoice_number: { type: 'string' },
          invoice_date: { type: 'string' },
          due_date: { type: 'string' },
          direction: { type: 'string', enum: ['outbound', 'inbound'], default: 'outbound' },
          format: { type: 'string', enum: ['xrechnung', 'zugferd', 'peppol', 'facturx'], default: 'xrechnung' },
          delivery_method: { type: 'string', enum: ['email', 'peppol', 'sftp', 'api', 'manual'], default: 'email' },
          seller_name: { type: 'string' },
          seller_vat_id: { type: 'string' },
          seller_address: { type: 'string' },
          seller_city: { type: 'string' },
          seller_country: { type: 'string', default: 'DE' },
          seller_iban: { type: 'string' },
          buyer_name: { type: 'string' },
          buyer_vat_id: { type: 'string' },
          buyer_address: { type: 'string' },
          buyer_city: { type: 'string' },
          buyer_country: { type: 'string', default: 'DE' },
          buyer_email: { type: 'string' },
          buyer_peppol_id: { type: 'string' },
          currency: { type: 'string', default: 'EUR' },
          line_items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['description', 'quantity', 'unit_price'],
              properties: {
                description: { type: 'string' },
                quantity: { type: 'number', minimum: 0 },
                unit_price: { type: 'number' },
                vat_rate: { type: 'number', default: 19 },
                unit: { type: 'string', default: 'C62' },
              }
            }
          },
          notes: { type: 'string' },
          reference: { type: 'string' },
        }
      }
    }
  }, async (req, reply) => {
    const body = req.body;
    const org  = req.org;

    // Org-Daten als Absender-Fallback wenn Felder leer
    const seller_name    = body.seller_name    || org.name    || '';
    const seller_vat_id  = body.seller_vat_id  || org.vat_id  || '';
    const seller_address = body.seller_address || org.address || '';
    const seller_city    = body.seller_city    || org.city    || '';
    const seller_iban    = body.seller_iban    || org.iban    || '';

    if (!seller_name) {
      return reply.code(400).send({
        error: 'Firmenname fehlt. Bitte unter Einstellungen → Unternehmen Ihren Firmennamen eintragen.',
      });
    }
    if (!body.buyer_name) {
      return reply.code(400).send({
        error: 'Empfänger fehlt. Bitte das Feld "Firma" beim Empfänger ausfüllen.',
      });
    }

    // Calculate amounts
    const net    = (body.line_items || []).reduce((s, i) => s + (i.quantity * i.unit_price), 0);
    const vatAmt = (body.line_items || []).reduce((s, i) => s + (i.quantity * i.unit_price * ((i.vat_rate || 19) / 100)), 0);
    const gross  = net + vatAmt;

    if (gross <= 0) {
      return reply.code(400).send({ error: 'Betrag muss größer als 0 sein.' });
    }

    const invoiceData = {
      ...body,
      seller_name,
      seller_vat_id,
      seller_address,
      seller_city,
      seller_iban,
      org_id:       org.id,
      amount_net:   parseFloat(net.toFixed(2)),
      amount_vat:   parseFloat(vatAmt.toFixed(2)),
      amount_gross: parseFloat(gross.toFixed(2)),
      status:       'draft',
      direction:    body.direction || 'outbound',
      created_by:   req.user?.id,
    };

    // EN 16931 Validation
    const validation = validateEN16931(invoiceData);
    invoiceData.validation_result = validation;
    invoiceData.validation_passed = validation.passed;

    if (!validation.passed) {
      return reply.code(422).send({
        error: 'EN 16931 Validierung fehlgeschlagen',
        validation,
      });
    }

    // Generate XML
    const xml = generateXML(invoiceData);
    const xmlHash = hashXML(xml);
    invoiceData.xml_content = xml;
    invoiceData.xml_hash = xmlHash;
    invoiceData.status = 'validated';

    // Save to DB
    const invoice = await db.createInvoice(invoiceData);

    // Audit log
    await db.createAuditLog({
      org_id: req.org.id,
      user_id: req.user?.id,
      invoice_id: invoice.id,
      action: 'created',
      details: { format: invoice.format, amount_gross: gross, validation_passed: true }
    });

    return reply.code(201).send({
      ...sanitizeInvoice(invoice),
      xml_preview: xml.substring(0, 500) + '...',
      validation,
    });
  });

  // ── GET XML ──────────────────────────────────────────────────
  fastify.get('/:id/xml', { preHandler: authMiddleware }, async (req, reply) => {
    const invoice = await db.findInvoiceById(req.params.id, req.org.id);
    if (!invoice) return reply.code(404).send({ error: 'Rechnung nicht gefunden' });
    if (!invoice.xml_content) return reply.code(404).send({ error: 'XML noch nicht generiert' });

    reply.header('Content-Type', 'application/xml');
    reply.header('Content-Disposition', `attachment; filename="${invoice.invoice_number}.xml"`);
    return invoice.xml_content;
  });

  // ── VALIDATE ─────────────────────────────────────────────────
  fastify.post('/:id/validate', { preHandler: authMiddleware }, async (req, reply) => {
    const invoice = await db.findInvoiceById(req.params.id, req.org.id);
    if (!invoice) return reply.code(404).send({ error: 'Rechnung nicht gefunden' });

    const validation = validateEN16931(invoice);
    await db.updateInvoice(invoice.id, {
      validation_result: validation,
      validation_passed: validation.passed,
      status: validation.passed ? 'validated' : invoice.status,
    });

    return { invoice_id: invoice.id, ...validation };
  });

  // ── SEND INVOICE ─────────────────────────────────────────────
  fastify.post('/:id/send', { preHandler: authMiddleware }, async (req, reply) => {
    const invoice = await db.findInvoiceById(req.params.id, req.org.id);
    if (!invoice) return reply.code(404).send({ error: 'Rechnung nicht gefunden' });
    if (!invoice.xml_content) return reply.code(422).send({ error: 'XML fehlt. Bitte zuerst Rechnung erstellen.' });
    if (!invoice.validation_passed) return reply.code(422).send({ error: 'Rechnung hat Validierungsfehler' });

    // Override delivery method if provided
    const deliveryMethod = req.body?.delivery_method || invoice.delivery_method || 'email';
    const invoiceToSend = { ...invoice, delivery_method: deliveryMethod };

    const result = await deliveryService.deliver(invoiceToSend, invoice.xml_content, req.org);

    await db.updateInvoice(invoice.id, {
      status: 'sent',
      delivery_attempts: (invoice.delivery_attempts || 0) + 1,
      peppol_document_id: result.peppol_document_id || invoice.peppol_document_id,
    });

    return {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      delivery: result,
      status: 'sent',
    };
  });

  // ── ARCHIVE ──────────────────────────────────────────────────
  fastify.post('/:id/archive', { preHandler: authMiddleware }, async (req, reply) => {
    const invoice = await db.findInvoiceById(req.params.id, req.org.id);
    if (!invoice) return reply.code(404).send({ error: 'Rechnung nicht gefunden' });
    if (invoice.archived) return reply.code(409).send({ error: 'Rechnung bereits archiviert' });
    if (!invoice.xml_content) return reply.code(422).send({ error: 'XML fehlt — Rechnung kann nicht archiviert werden' });

    const archiveResult = await archiveService.archiveDocument({
      orgId: req.org.id,
      invoiceId: invoice.id,
      xml: invoice.xml_content,
      format: invoice.format,
      invoiceNumber: invoice.invoice_number,
    });

    await db.updateInvoice(invoice.id, {
      archived: true,
      archived_at: archiveResult.archived_at,
      archive_path: archiveResult.s3_key,
      archive_hash: archiveResult.file_hash,
      status: 'archived',
    });

    return {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      ...archiveResult,
      gobd_compliant: true,
      retention_years: 10,
    };
  });

  // ── INBOUND: PARSE UPLOADED XML ───────────────────────────────
  fastify.post('/inbound', { preHandler: authMiddleware }, async (req, reply) => {
    const { xml_content, filename } = req.body || {};
    if (!xml_content) return reply.code(400).send({ error: 'XML-Inhalt fehlt' });

    const parsed = parseInboundXML(xml_content);
    if (!parsed?.success) return reply.code(422).send({ error: parsed?.error || 'XML-Parsing fehlgeschlagen' });

    const validation = validateEN16931({ ...parsed.data, line_items: [] });

    const invoice = await db.createInvoice({
      org_id: req.org.id,
      ...parsed.data,
      direction: 'inbound',
      format: parsed.format,
      xml_content,
      xml_hash: hashXML(xml_content),
      validation_result: validation,
      validation_passed: validation.passed,
      status: 'validated',
      line_items: [],
      created_by: req.user?.id,
    });

    await db.createAuditLog({
      org_id: req.org.id,
      user_id: req.user?.id,
      invoice_id: invoice.id,
      action: 'inbound_received',
      details: { filename, format: parsed.format }
    });

    return reply.code(201).send({ ...sanitizeInvoice(invoice), validation });
  });

  // ── GET AUDIT LOG ────────────────────────────────────────────
  fastify.get('/:id/audit', { preHandler: authMiddleware }, async (req, reply) => {
    const invoice = await db.findInvoiceById(req.params.id, req.org.id);
    if (!invoice) return reply.code(404).send({ error: 'Rechnung nicht gefunden' });
    const logs = await db.getAuditLogs(req.org.id, invoice.id);
    return { invoice_id: invoice.id, logs };
  });

  // ── DELETE (only drafts) ─────────────────────────────────────
  fastify.delete('/:id', { preHandler: authMiddleware }, async (req, reply) => {
    const invoice = await db.findInvoiceById(req.params.id, req.org.id);
    if (!invoice) return reply.code(404).send({ error: 'Rechnung nicht gefunden' });
    if (invoice.status !== 'draft') {
      return reply.code(409).send({ error: 'Nur Entwürfe können gelöscht werden' });
    }
    await db.updateInvoice(invoice.id, { status: 'deleted', active: false });
    return { message: 'Entwurf gelöscht', invoice_id: invoice.id };
  });

  // ── SEND INVOICE VIA EMAIL ───────────────────────────────────
  fastify.post('/:id/send-email', { preHandler: authMiddleware }, async (req, reply) => {
    const { recipient_email, message } = req.body || {};
    if (!recipient_email) return reply.code(400).send({ error: 'Empfänger-E-Mail fehlt' });

    const invoice = await db.findInvoiceById(req.params.id, req.org.id);
    if (!invoice) return reply.code(404).send({ error: 'Rechnung nicht gefunden' });

    // Get XML
    const { data: xmlRow } = await import('../../config/database.js').then(m =>
      m.supabase.from('invoices').select('xml_content').eq('id', invoice.id).single()
    );
    const xmlContent = xmlRow?.xml_content || generateXML(invoice, invoice.format || 'xrechnung');
    const xmlBuffer = Buffer.from(xmlContent, 'utf-8');

    // Send via Resend
    const { sendInvoiceEmail } = await import('../../services/email.js');
    await sendInvoiceEmail({
      to: recipient_email,
      invoice: {
        invoice_number: invoice.invoice_number,
        customer_name: invoice.buyer_name,
        total_amount: invoice.amount_gross,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        custom_message: message,
      },
      xmlBuffer,
    });

    // Update status
    await db.updateInvoice(invoice.id, { status: 'delivered', delivery_method: 'email', recipient_email });
    await db.createAuditLog({
      org_id: req.org.id,
      user_id: req.user?.id,
      invoice_id: invoice.id,
      action: 'sent_email',
      details: { recipient_email },
    });

    return { success: true, message: `Rechnung an ${recipient_email} gesendet` };
  });

  // ── DATEV EXPORT (single invoice) ────────────────────────────
  fastify.get('/:id/datev', { preHandler: authMiddleware }, async (req, reply) => {
    const invoice = await db.findInvoiceById(req.params.id, req.org.id);
    if (!invoice) return reply.code(404).send({ error: 'Rechnung nicht gefunden' });
    const csv = buildDatevRow(invoice);
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="DATEV_${invoice.invoice_number}.csv"`);
    return reply.send(DATEV_HEADER + csv);
  });


// ── SANITIZE (remove sensitive internal fields) ───────────────
function sanitizeInvoice(inv) {
  const { xml_content, ...rest } = inv;
  return {
    ...rest,
    has_xml: !!xml_content,
    xml_size_bytes: xml_content ? xml_content.length : 0,
  };
}

  // ── SEND VIA PEPPOL (PeppolSoft) ─────────────────────────────
  fastify.post('/:id/send-peppol', { preHandler: authMiddleware }, async (req, reply) => {
    const { peppol_id } = req.body || {};
    if (!peppol_id) return reply.code(400).send({ error: 'Peppol-ID fehlt (Format: 0190:DE123456789)' });

    const invoice = await db.findInvoiceById(req.params.id, req.org.id);
    if (!invoice) return reply.code(404).send({ error: 'Rechnung nicht gefunden' });

    // Get XML content
    const { data: xmlRow } = await import('../../config/database.js').then(m =>
      m.supabase.from('invoices').select('xml_content').eq('id', invoice.id).single()
    );
    const xmlContent = xmlRow?.xml_content || generateXML(invoice, 'xrechnung');

    // Lookup Peppol-ID first
    const { sendViaPeppol, lookupPeppolId } = await import('../../services/peppolSoftService.js');
    const lookup = await lookupPeppolId(peppol_id);
    if (!lookup.found && !lookup.demo) {
      return reply.code(404).send({ error: `Peppol-ID ${peppol_id} nicht im Netzwerk gefunden` });
    }

    const result = await sendViaPeppol({
      xmlContent,
      receiverPeppolId: peppol_id,
      invoiceNumber: invoice.invoice_number,
    });

    // Update status
    await db.updateInvoice(invoice.id, {
      status: 'delivered',
      delivery_method: 'peppol',
      peppol_transmission_id: result.transmission_id,
    });

    await db.createAuditLog({
      org_id: req.org.id, user_id: req.user?.id, invoice_id: invoice.id,
      action: 'sent_peppol',
      details: { peppol_id, transmission_id: result.transmission_id, demo: result.demo },
    });

    return { success: true, ...result };
  });

  // ── PEPPOL-ID LOOKUP ─────────────────────────────────────────
  fastify.get('/peppol/lookup', { preHandler: authMiddleware }, async (req, reply) => {
    const { peppol_id } = req.query;
    if (!peppol_id) return reply.code(400).send({ error: 'peppol_id Query-Parameter fehlt' });
    const { lookupPeppolId } = await import('../../services/peppolSoftService.js');
    return lookupPeppolId(peppol_id);
  });

  // ── DATEV EXPORT (alle Rechnungen einer Org) ──────────────────
  fastify.get('/datev-export', { preHandler: authMiddleware }, async (req, reply) => {
    const { from, to } = req.query;
    let q = import('../../config/database.js').then(m =>
      m.supabase.from('invoices').select('*')
        .eq('org_id', req.org.id)
        .neq('status', 'deleted')
        .order('created_at', { ascending: true })
    );
    const { data } = await (await q);
    const filtered = (data || []).filter(inv => {
      if (from && inv.invoice_date < from) return false;
      if (to && inv.invoice_date > to) return false;
      return true;
    });
    const HEADER = 'Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;Kurs;Basis-Umsatz;WKZ Basis-Umsatz;Konto;Gegenkonto (ohne BU-Schlüssel);BU-Schlüssel;Belegdatum;Belegfeld 1;Buchungstext\n';
    const rows = filtered.map(buildDatevRow).join('\n');
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="DATEV_${new Date().toISOString().slice(0,10)}.csv"`);
    return reply.send(HEADER + rows);
  });
}

// ── DATEV HELPERS ─────────────────────────────────────────────
const DATEV_HEADER = 'Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;Kurs;Basis-Umsatz;WKZ Basis-Umsatz;Konto;Gegenkonto (ohne BU-Schlüssel);BU-Schlüssel;Belegdatum;Belegfeld 1;Buchungstext\n';

function buildDatevRow(inv) {
  const date = new Date(inv.invoice_date);
  const belegdatum = `${String(date.getDate()).padStart(2,'0')}${String(date.getMonth()+1).padStart(2,'0')}`;
  const sh = inv.direction === 'inbound' ? 'H' : 'S';
  const konto = inv.direction === 'inbound' ? '1600' : '8400';
  const amount = String(parseFloat(inv.amount_gross || 0).toFixed(2)).replace('.', ',');
  const text = `${inv.direction === 'inbound' ? inv.seller_name : inv.buyer_name} ${inv.invoice_number}`.slice(0, 60);
  return `${amount};${sh};EUR;;;${konto};1200;;${belegdatum};${inv.invoice_number};${text}\n`;
}
