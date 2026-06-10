// routes/inbound/index.js — E-Mail Eingang via Mailgun Inbound Webhook
// POST /v1/inbound/email       — Mailgun webhook für eingehende E-Mails
// GET  /v1/inbound             — Liste aller eingehenden Rechnungen
// GET  /v1/inbound/:id/pdf     — XRechnung als lesbares PDF
// POST /v1/inbound/:id/forward — Weiterleiten per E-Mail
// POST /v1/inbound/:id/mark-paid
// GET  /v1/inbound/datev-export — DATEV CSV Export

import { authMiddleware } from '../../middleware/auth.js';
import { supabase } from '../../config/database.js';
import { parseInboundXML, validateEN16931, hashXML } from '../../services/xmlEngine.js';
import { renderInvoicePDF } from '../../services/pdfRenderer.js';

export async function inboundRoutes(fastify) {

  // ── MAILGUN WEBHOOK — eingehende E-Mail ───────────────────────
  fastify.post('/email', async (req, reply) => {
    try {
      const parts = {};
      const attachments = [];

      if (req.isMultipart()) {
        for await (const part of req.parts()) {
          if (part.file) {
            const chunks = [];
            for await (const chunk of part.file) chunks.push(chunk);
            attachments.push({ filename: part.filename, mimetype: part.mimetype, buffer: Buffer.concat(chunks) });
          } else {
            parts[part.fieldname] = await part.value;
          }
        }
      } else {
        Object.assign(parts, req.body || {});
      }

      const recipient = parts.recipient || parts.To || '';
      const sender    = parts.sender    || parts.From || '';
      const subject   = parts.subject   || parts.Subject || '';

      // Resolve org: [slug]@rechnungen.invoiq.io (neu) oder rechnungen-[slug]@invoiq.io (alt)
      const match = recipient.match(/([a-z0-9\-]+)@rechnungen\.invoiq\.io/i)
                 || recipient.match(/rechnungen-([a-z0-9\-]+)@invoiq\.io/i);
      if (!match) return reply.send({ received: true });

      const { data: org } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('inbound_email_slug', match[1])
        .single();

      if (!org) return reply.send({ received: true });

      let processed = 0;
      for (const att of attachments) {
        const fn = (att.filename || '').toLowerCase();
        let xmlContent = null;
        let format = 'unknown';

        if (fn.endsWith('.xml')) {
          xmlContent = att.buffer.toString('utf-8');
          format = 'xrechnung';
        } else if (fn.endsWith('.pdf')) {
          xmlContent = await extractFromPDF(att.buffer);
          format = 'pdf_extracted';
        }

        if (!xmlContent) continue;

        const parsed    = parseInboundXML(xmlContent);
        const validation = validateEN16931(parsed?.data || {});

        await supabase.from('inbound_invoices').insert({
          org_id:            org.id,
          sender_email:      sender,
          sender_name:       extractName(sender),
          subject,
          format,
          raw_xml:           xmlContent,
          xml_hash:          hashXML(xmlContent),
          status:            'empfangen',
          invoice_number:    parsed?.data?.invoice_number  || null,
          amount:            parsed?.data?.amount_gross    || null,
          amount_net:        parsed?.data?.amount_net      || null,
          due_date:          parsed?.data?.due_date        || null,
          seller_name:       parsed?.data?.seller_name     || extractName(sender),
          seller_vat_id:     parsed?.data?.seller_vat_id  || null,
          seller_iban:       parsed?.data?.seller_iban     || null,
          seller_bic:        parsed?.data?.seller_bic      || null,
          discount_percent:  parsed?.data?.discount_percent || null,
          discount_days:     parsed?.data?.discount_days   || null,
          payment_reference: parsed?.data?.payment_reference || null,
          validation_passed: validation.passed,
        });

        processed++;
      }

      return reply.send({ received: true, processed });
    } catch (err) {
      fastify.log.error(err, 'Inbound email processing failed');
      return reply.send({ received: true });
    }
  });

  // ── LIST ──────────────────────────────────────────────────────
  fastify.get('/', { preHandler: authMiddleware }, async (req) => {
    const { status, limit = 50, offset = 0 } = req.query;
    let q = supabase
      .from('inbound_invoices')
      .select('*', { count: 'exact' })
      .eq('org_id', req.org.id)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    if (status) q = q.eq('status', status);
    const { data, error, count } = await q;
    if (error) throw new Error(error.message);
    return { invoices: (data || []).map(safeInbound), total: count || 0 };
  });

  // ── GET SINGLE ────────────────────────────────────────────────
  fastify.get('/:id', { preHandler: authMiddleware }, async (req, reply) => {
    const { data } = await supabase
      .from('inbound_invoices').select('*')
      .eq('id', req.params.id).eq('org_id', req.org.id).single();
    if (!data) return reply.code(404).send({ error: 'Nicht gefunden' });
    return safeInbound(data);
  });

  // ── PDF RENDER ────────────────────────────────────────────────
  fastify.get('/:id/pdf', { preHandler: authMiddleware }, async (req, reply) => {
    const { data } = await supabase
      .from('inbound_invoices').select('*')
      .eq('id', req.params.id).eq('org_id', req.org.id).single();
    if (!data) return reply.code(404).send({ error: 'Nicht gefunden' });
    const pdfBuffer = await renderInvoicePDF(data);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `inline; filename="Rechnung_${data.invoice_number || data.id}.pdf"`);
    return reply.send(pdfBuffer);
  });

  // ── SEPA pain.001 DOWNLOAD ────────────────────────────────────
  // GET /v1/inbound/:id/sepa-pain001?discount=true
  fastify.get('/:id/sepa-pain001', { preHandler: authMiddleware }, async (req, reply) => {
    const applyDiscount = req.query.discount === 'true';

    const { data: inv } = await supabase
      .from('inbound_invoices').select('*')
      .eq('id', req.params.id).eq('org_id', req.org.id).single();
    if (!inv) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!inv.seller_iban) return reply.code(400).send({ error: 'Keine IBAN in der Rechnung gefunden' });

    // Org-Daten für Auftraggeber (Zahler)
    const { data: org } = await supabase
      .from('organizations').select('name, iban, bic').eq('id', req.org.id).single();

    const { generateSEPAPain001 } = await import('../../services/sepaService.js');
    const result = generateSEPAPain001({
      invoice:       inv,
      payerName:     org?.name || 'invoiq Nutzer',
      payerIban:     org?.iban || '',
      payerBic:      org?.bic  || '',
      applyDiscount,
    });

    // Timestamp speichern
    await supabase.from('inbound_invoices')
      .update({ sepa_generated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    reply.header('Content-Type', 'application/xml');
    reply.header('Content-Disposition', `attachment; filename="${result.filename}"`);
    return reply.send(result.xml);
  });

  // ── SKONTO CHECK ──────────────────────────────────────────────
  // GET /v1/inbound/:id/discount-check
  fastify.get('/:id/discount-check', { preHandler: authMiddleware }, async (req, reply) => {
    const { data: inv } = await supabase
      .from('inbound_invoices').select('*')
      .eq('id', req.params.id).eq('org_id', req.org.id).single();
    if (!inv) return reply.code(404).send({ error: 'Nicht gefunden' });
    const { checkDiscount } = await import('../../services/sepaService.js');
    return checkDiscount(inv);
  });

  // ── MARK AS PAID ──────────────────────────────────────────────
  fastify.post('/:id/mark-paid', { preHandler: authMiddleware }, async (req, reply) => {
    const { error } = await supabase
      .from('inbound_invoices')
      .update({ status: 'bezahlt', paid_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('org_id', req.org.id);
    if (error) return reply.code(500).send({ error: error.message });
    return { success: true };
  });

  // ── FORWARD VIA EMAIL ─────────────────────────────────────────
  fastify.post('/:id/forward', { preHandler: authMiddleware }, async (req, reply) => {
    const { recipient_email } = req.body || {};
    if (!recipient_email) return reply.code(400).send({ error: 'Empfänger fehlt' });
    const { data } = await supabase
      .from('inbound_invoices').select('*')
      .eq('id', req.params.id).eq('org_id', req.org.id).single();
    if (!data) return reply.code(404).send({ error: 'Nicht gefunden' });
    const { sendInvoiceEmail } = await import('../../services/email.js');
    const xmlBuffer = data.raw_xml ? Buffer.from(data.raw_xml, 'utf-8') : null;
    const pdfBuffer = await renderInvoicePDF(data);
    await sendInvoiceEmail({
      to: recipient_email,
      invoice: {
        invoice_number: data.invoice_number || 'EINGANG',
        customer_name:  data.seller_name    || 'Lieferant',
        total_amount:   data.amount         || 0,
        invoice_date:   data.created_at,
        due_date:       data.due_date,
        custom_message: `Weitergeleitet — Original von: ${data.sender_email}`,
      },
      xmlBuffer,
      pdfBuffer,
    });
    return { success: true, forwarded_to: recipient_email };
  });

  // ── DATEV EXPORT (Kanzlei) ────────────────────────────────────
  fastify.get('/datev-export', { preHandler: authMiddleware }, async (req, reply) => {
    const { from, to, org_id } = req.query;
    const targetOrgId = org_id || req.org.id;
    let q = supabase.from('inbound_invoices').select('*')
      .eq('org_id', targetOrgId).order('created_at', { ascending: true });
    if (from) q = q.gte('created_at', from);
    if (to)   q = q.lte('created_at', to + 'T23:59:59Z');
    const { data } = await q;
    const HEADER = 'Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;Kurs;Basis-Umsatz;WKZ Basis-Umsatz;Konto;Gegenkonto (ohne BU-Schlüssel);BU-Schlüssel;Belegdatum;Belegfeld 1;Buchungstext\n';
    const rows = (data || []).map(inv => {
      const d  = new Date(inv.created_at);
      const bd = `${String(d.getDate()).padStart(2,'0')}${String(d.getMonth()+1).padStart(2,'0')}`;
      const amt = String(parseFloat(inv.amount || 0).toFixed(2)).replace('.', ',');
      const text = `${inv.seller_name || ''} ${inv.invoice_number || ''}`.slice(0, 60);
      return `${amt};H;EUR;;;1600;1200;;${bd};${inv.invoice_number || ''};${text}`;
    }).join('\n');
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="DATEV_Eingang_${new Date().toISOString().slice(0,10)}.csv"`);
    return reply.send(HEADER + rows);
  });
}

// ── HELPERS ───────────────────────────────────────────────────
function extractName(email) {
  return (email.match(/^([^<@]+)/)?.[1] || email).trim().replace(/"/g, '');
}

function safeInbound(row) {
  const { raw_xml, ...rest } = row;
  return { ...rest, has_xml: !!raw_xml };
}

async function extractFromPDF(buffer) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>DEMO-${Date.now()}</cbc:ID>
  <cbc:IssueDate>${new Date().toISOString().split('T')[0]}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
</ubl:Invoice>`;
  }
  const base64 = buffer.toString('base64');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514', max_tokens: 1200,
      messages: [{ role: 'user', content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
        { type: 'text', text: 'Extrahiere alle Rechnungsfelder und gib NUR XRechnung UBL XML zurück. Kein Markdown.' }
      ]}],
    }),
  });
  const data = await response.json();
  return data.content?.[0]?.text?.replace(/```xml|```/g, '').trim() || null;
}
