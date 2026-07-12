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
    const { direction, status, limit = 50, offset = 0, search, archived } = req.query;
    const result = await db.findInvoices(req.org.id, {
      direction, status,
      archived: archived === 'true' ? true : undefined,
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
          brand_color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
          status: { type: 'string', enum: ['draft'] },
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

    // "Als Entwurf speichern": Entwürfe dürfen unvollständig sein und werden
    // ohne XML gespeichert. Nur der Generieren-Pfad erzwingt die Validierung.
    const wantDraft = body.status === 'draft';

    if (!validation.passed && !wantDraft) {
      return reply.code(422).send({
        error: 'EN 16931 Validierung fehlgeschlagen',
        validation,
      });
    }

    // Generate XML (nur wenn valide)
    if (validation.passed) {
      const xml = generateXML(invoiceData);
      invoiceData.xml_content = xml;
      invoiceData.xml_hash = hashXML(xml);
    }
    invoiceData.status = wantDraft ? 'draft' : 'validated';

    // Save to DB (explizite Spalten-Whitelist — verhindert Supabase-Fehler
    // durch unbekannte Felder). plan_doc_used wird per DB-Trigger
    // (trg_invoice_doc_count) automatisch hochgezählt.
    const invoice = await db.createInvoice({
      org_id: req.org.id,
      invoice_number: invoiceData.invoice_number,
      invoice_date: invoiceData.invoice_date,
      due_date: invoiceData.due_date || null,
      format: invoiceData.format || 'xrechnung',
      direction: 'outbound',
      status: invoiceData.status,
      delivery_method: invoiceData.delivery_method || 'email',
      seller_name: invoiceData.seller_name,
      seller_vat_id: invoiceData.seller_vat_id || null,
      seller_address: invoiceData.seller_address || null,
      seller_city: invoiceData.seller_city || null,
      seller_iban: invoiceData.seller_iban || null,
      buyer_name: invoiceData.buyer_name,
      buyer_vat_id: invoiceData.buyer_vat_id || null,
      buyer_address: invoiceData.buyer_address || null,
      buyer_city: invoiceData.buyer_city || null,
      buyer_country: invoiceData.buyer_country || 'DE',
      buyer_email: invoiceData.buyer_email || null,
      amount_net: invoiceData.amount_net,
      amount_vat: invoiceData.amount_vat,
      amount_gross: invoiceData.amount_gross,
      currency: invoiceData.currency || 'EUR',
      line_items: invoiceData.line_items,
      notes: invoiceData.notes || null,
      reference: invoiceData.reference || null,
      brand_color: invoiceData.brand_color || null,
      xml_content: invoiceData.xml_content || null,
      xml_hash: invoiceData.xml_hash || null,
      validation_result: validation,
      validation_passed: invoiceData.validation_passed,
      created_by: req.user?.id || null,
    });

    // Audit log
    await db.createAuditLog({
      org_id: req.org.id,
      user_id: req.user?.id,
      invoice_id: invoice.id,
      action: 'created',
      details: { format: invoice.format, amount_gross: gross, validation_passed: validation.passed, draft: wantDraft }
    });

    // Stammdaten-Lernen: Empfänger als Kunde speichern/aktualisieren
    // (SAP-ready Stufe 1 — Belege füttern die Geschäftspartner-Stammdaten).
    // Fehler hier dürfen die Rechnungserstellung nie blockieren.
    try {
      const { upsertCustomer } = await import('../customers/index.js');
      await upsertCustomer(req.org.id, {
        name: invoiceData.buyer_name,
        vat_id: invoiceData.buyer_vat_id,
        address: invoiceData.buyer_address,
        city: invoiceData.buyer_city,
        country: invoiceData.buyer_country,
        email: invoiceData.buyer_email,
        peppol_id: invoiceData.buyer_peppol_id,
      }, { countInvoice: !wantDraft });
    } catch (e) {
      req.log?.warn?.(e, 'Kunden-Upsert fehlgeschlagen (nicht kritisch)');
    }

    return reply.code(201).send({
      ...sanitizeInvoice(invoice),
      ...(invoiceData.xml_content ? { xml_preview: invoiceData.xml_content.substring(0, 500) + '...' } : {}),
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

  // ── GET PDF (menschenlesbar, mit gewählter Vorlage) ──────────
  fastify.get('/:id/pdf', { preHandler: authMiddleware }, async (req, reply) => {
    const invoice = await db.findInvoiceById(req.params.id, req.org.id);
    if (!invoice) return reply.code(404).send({ error: 'Rechnung nicht gefunden' });

    const { renderInvoicePDF } = await import('../../services/pdfRenderer.js');
    const pdfBuffer = await renderInvoicePDF(invoice, req.org);

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `inline; filename="${invoice.invoice_number}.pdf"`);
    return reply.send(pdfBuffer);
  });

  // ── GET HYBRID-PDF (ZUGFeRD: PDF mit eingebetteter factur-x.xml) ─
  fastify.get('/:id/hybrid-pdf', { preHandler: authMiddleware }, async (req, reply) => {
    const invoice = await db.findInvoiceById(req.params.id, req.org.id);
    if (!invoice) return reply.code(404).send({ error: 'Rechnung nicht gefunden' });

    const { generateFacturX } = await import('../../services/xmlEngine.js');
    const { renderHybridPDF } = await import('../../services/pdfRenderer.js');
    const inv = typeof invoice.line_items === 'string'
      ? { ...invoice, line_items: JSON.parse(invoice.line_items || '[]') }
      : invoice;
    const xml = generateFacturX(inv);
    const pdfBuffer = await renderHybridPDF(inv, xml, req.org);

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${invoice.invoice_number}-zugferd.pdf"`);
    return reply.send(pdfBuffer);
  });

  // ── LIVE-VORSCHAU (PDF rendern OHNE zu speichern) ─────────────
  // Nimmt Rechnungsdaten wie POST /, rendert das PDF mit den Mandanten-
  // Stammdaten und liefert es inline zurück — für die Browser-Vorschau
  // vor dem Speichern.
  fastify.post('/preview-pdf', { preHandler: authMiddleware }, async (req, reply) => {
    const b = req.body || {};
    const org = req.org;
    const invoice = {
      ...b,
      invoice_number: b.invoice_number || 'ENTWURF',
      invoice_date: b.invoice_date || new Date().toISOString().slice(0, 10),
      seller_name: b.seller_name || org.name || '',
      seller_vat_id: b.seller_vat_id || org.vat_id || '',
      seller_address: b.seller_address || org.address || '',
      seller_city: b.seller_city || org.city || '',
      seller_iban: b.seller_iban || org.iban || '',
      line_items: Array.isArray(b.line_items) ? b.line_items.slice(0, 200) : [],
    };
    const { renderInvoicePDF } = await import('../../services/pdfRenderer.js');
    const pdfBuffer = await renderInvoicePDF(invoice, org);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', 'inline; filename="vorschau.pdf"');
    return reply.send(pdfBuffer);
  });

  // ── VALIDATE ─────────────────────────────────────────────────
  fastify.post('/:id/validate', { preHandler: authMiddleware }, async (req, reply) => {
    const invoice = await db.findInvoiceById(req.params.id, req.org.id);
    if (!invoice) return reply.code(404).send({ error: 'Rechnung nicht gefunden' });

    const validation = validateEN16931(invoice);
    await db.updateInvoice(invoice.id, req.org.id, {
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

    await db.updateInvoice(invoice.id, req.org.id, {
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

    await db.updateInvoice(invoice.id, req.org.id, {
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
    await db.updateInvoice(invoice.id, req.org.id, { status: 'deleted', active: false });
    return { message: 'Entwurf gelöscht', invoice_id: invoice.id };
  });

  // ── SEND INVOICE VIA EMAIL ───────────────────────────────────
  fastify.post('/:id/send-email', { preHandler: authMiddleware }, async (req, reply) => {
    const { recipient_email, message, sender_copy = false } = req.body || {};
    if (!recipient_email) return reply.code(400).send({ error: 'Empfänger-E-Mail fehlt' });

    const invoice = await db.findInvoiceById(req.params.id, req.org.id);
    if (!invoice) return reply.code(404).send({ error: 'Rechnung nicht gefunden' });

    const { data: xmlRow } = await import('../../config/database.js').then(m =>
      m.supabase.from('invoices').select('xml_content').eq('id', invoice.id).single()
    );
    const xmlContent = xmlRow?.xml_content || generateXML(invoice, invoice.format || 'xrechnung');
    const xmlBuffer = Buffer.from(xmlContent, 'utf-8');

    // Menschenlesbares PDF mit gewählter Vorlage (modern/classic/minimal)
    let pdfBuffer = null;
    try {
      const { renderInvoicePDF } = await import('../../services/pdfRenderer.js');
      pdfBuffer = await renderInvoicePDF(invoice, req.org);
    } catch (e) {
      req.log?.warn?.('PDF-Rendering fehlgeschlagen, sende nur XML');
    }

    const { sendInvoiceEmail } = await import('../../services/email.js');

    // Rechnung an Empfänger senden
    await sendInvoiceEmail({
      to: recipient_email,
      invoice: {
        invoice_number: invoice.invoice_number,
        customer_name:  invoice.buyer_name,
        total_amount:   invoice.amount_gross,
        invoice_date:   invoice.invoice_date,
        due_date:       invoice.due_date,
        custom_message: message,
      },
      xmlBuffer,
      pdfBuffer,
    });

    // Kopie an Absender (Org-E-Mail)
    if (sender_copy && req.org) {
      const { data: orgUser } = await supabase
        .from('users').select('email').eq('org_id', req.org.id).eq('role', 'owner').single();
      const copyTo = orgUser?.email || req.user?.email;
      if (copyTo) {
        await sendInvoiceEmail({
          to: copyTo,
          invoice: {
            invoice_number: invoice.invoice_number,
            customer_name:  invoice.buyer_name,
            total_amount:   invoice.amount_gross,
            invoice_date:   invoice.invoice_date,
            due_date:       invoice.due_date,
            custom_message: `[KOPIE] Rechnung wurde an ${recipient_email} gesendet.`,
          },
          xmlBuffer,
          pdfBuffer,
        });
      }
    }

    await db.updateInvoice(invoice.id, req.org.id, {
      status: 'delivered', delivery_method: 'email', recipient_email,
    });
    await db.createAuditLog({
      org_id: req.org.id, user_id: req.user?.id, invoice_id: invoice.id,
      action: 'sent_email', details: { recipient_email, sender_copy },
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
  // Überfällig ist ein abgeleiteter Zustand: gesendet/validiert + Fälligkeit
  // überschritten + nicht bezahlt/storniert. Wird nicht persistiert, damit
  // kein Cron nötig ist und der Zustand immer tagesaktuell stimmt.
  const overdue = ['sent', 'validated'].includes(inv.status)
    && inv.due_date && inv.due_date < new Date().toISOString().slice(0, 10);
  return {
    ...rest,
    has_xml: !!xml_content,
    xml_size_bytes: xml_content ? xml_content.length : 0,
    effective_status: overdue ? 'overdue' : inv.status,
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
    await db.updateInvoice(invoice.id, req.org.id, {
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

  // ── ALS BEZAHLT MARKIEREN ─────────────────────────────────────
  fastify.post('/:id/mark-paid', { preHandler: authMiddleware }, async (req, reply) => {
    const invoice = await db.findInvoiceById(req.params.id, req.org.id);
    if (!invoice) return reply.code(404).send({ error: 'Rechnung nicht gefunden' });
    if (invoice.status === 'cancelled') return reply.code(409).send({ error: 'Stornierte Rechnungen können nicht bezahlt werden.' });
    if (invoice.status === 'paid') return reply.code(409).send({ error: 'Rechnung ist bereits als bezahlt markiert.' });

    await db.updateInvoice(invoice.id, req.org.id, { status: 'paid', paid_at: new Date().toISOString() });
    await db.createAuditLog({ org_id: req.org.id, user_id: req.user?.id, invoice_id: invoice.id, action: 'marked_paid', details: {} });
    return { success: true, status: 'paid' };
  });

  // ── STORNIEREN (Stornorechnung mit Negativbeträgen) ──────────
  // GoBD: die Originalrechnung bleibt unverändert erhalten; der Storno ist
  // ein eigenes Dokument mit Referenz und spiegelverkehrten Beträgen.
  fastify.post('/:id/cancel', { preHandler: authMiddleware }, async (req, reply) => {
    const original = await db.findInvoiceById(req.params.id, req.org.id);
    if (!original) return reply.code(404).send({ error: 'Rechnung nicht gefunden' });
    if (original.status === 'cancelled') return reply.code(409).send({ error: 'Rechnung ist bereits storniert.' });
    if (original.invoice_kind === 'cancellation') return reply.code(409).send({ error: 'Eine Stornorechnung kann nicht storniert werden.' });

    const items = (typeof original.line_items === 'string'
      ? JSON.parse(original.line_items || '[]') : (original.line_items || []))
      .map(it => ({ ...it, quantity: -(parseFloat(it.quantity) || 0) }));

    const storno = await db.createInvoice({
      org_id: req.org.id,
      invoice_number: `STORNO-${original.invoice_number}`,
      invoice_date: new Date().toISOString().slice(0, 10),
      format: original.format || 'xrechnung',
      direction: 'outbound',
      status: 'validated',
      invoice_kind: 'cancellation',
      related_invoice_id: original.id,
      seller_name: original.seller_name, seller_vat_id: original.seller_vat_id,
      seller_address: original.seller_address, seller_city: original.seller_city,
      seller_iban: original.seller_iban,
      buyer_name: original.buyer_name, buyer_vat_id: original.buyer_vat_id,
      buyer_address: original.buyer_address, buyer_city: original.buyer_city,
      buyer_country: original.buyer_country, buyer_email: original.buyer_email,
      amount_net: -(parseFloat(original.amount_net) || 0),
      amount_vat: -(parseFloat(original.amount_vat) || 0),
      amount_gross: -(parseFloat(original.amount_gross) || 0),
      currency: original.currency || 'EUR',
      line_items: items,
      reference: original.invoice_number,
      brand_color: original.brand_color || null,
      notes: `Storno zu Rechnung ${original.invoice_number} vom ${original.invoice_date}.`,
      created_by: req.user?.id || null,
    });

    await db.updateInvoice(original.id, req.org.id, { status: 'cancelled' });
    await db.createAuditLog({
      org_id: req.org.id, user_id: req.user?.id, invoice_id: original.id,
      action: 'cancelled', details: { storno_id: storno.id, storno_number: storno.invoice_number },
    });
    return reply.code(201).send({ success: true, storno: sanitizeInvoice(storno) });
  });

  // ── KORRIGIEREN (Storno + Korrektur-Entwurf mit Referenz) ────
  fastify.post('/:id/correct', { preHandler: authMiddleware }, async (req, reply) => {
    const original = await db.findInvoiceById(req.params.id, req.org.id);
    if (!original) return reply.code(404).send({ error: 'Rechnung nicht gefunden' });
    if (original.invoice_kind === 'cancellation') return reply.code(409).send({ error: 'Stornorechnungen können nicht korrigiert werden.' });
    if (original.status === 'cancelled') return reply.code(409).send({ error: 'Rechnung ist bereits storniert — bitte neue Rechnung erstellen.' });

    // 1) Original per Stornorechnung ausgleichen (gleiche Logik wie /cancel)
    const cancelRes = await fastify.inject({
      method: 'POST', url: `/v1/invoices/${original.id}/cancel`,
      headers: { authorization: req.headers.authorization, 'content-type': 'application/json' },
      payload: {},
    });
    if (cancelRes.statusCode >= 400) {
      return reply.code(cancelRes.statusCode).send(JSON.parse(cancelRes.body));
    }

    // 2) Korrektur-Entwurf mit kopierten Positionen und Referenz anlegen
    const items = typeof original.line_items === 'string'
      ? JSON.parse(original.line_items || '[]') : (original.line_items || []);
    const draft = await db.createInvoice({
      org_id: req.org.id,
      invoice_number: `${original.invoice_number}-K1`,
      invoice_date: new Date().toISOString().slice(0, 10),
      due_date: original.due_date || null,
      format: original.format || 'xrechnung',
      direction: 'outbound',
      status: 'draft',
      invoice_kind: 'correction',
      related_invoice_id: original.id,
      seller_name: original.seller_name, seller_vat_id: original.seller_vat_id,
      seller_address: original.seller_address, seller_city: original.seller_city,
      seller_iban: original.seller_iban,
      buyer_name: original.buyer_name, buyer_vat_id: original.buyer_vat_id,
      buyer_address: original.buyer_address, buyer_city: original.buyer_city,
      buyer_country: original.buyer_country, buyer_email: original.buyer_email,
      amount_net: original.amount_net, amount_vat: original.amount_vat,
      amount_gross: original.amount_gross,
      currency: original.currency || 'EUR',
      line_items: items,
      reference: original.invoice_number,
      brand_color: original.brand_color || null,
      notes: `Korrekturrechnung zu ${original.invoice_number} vom ${original.invoice_date}.`,
      created_by: req.user?.id || null,
    });

    await db.createAuditLog({
      org_id: req.org.id, user_id: req.user?.id, invoice_id: original.id,
      action: 'corrected', details: { draft_id: draft.id, draft_number: draft.invoice_number },
    });
    return reply.code(201).send({ success: true, draft: sanitizeInvoice(draft) });
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
