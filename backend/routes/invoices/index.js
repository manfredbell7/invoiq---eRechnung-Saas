// src/routes/invoices/index.js
import { db } from '../../config/database.js';
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
        required: ['invoice_number', 'invoice_date', 'seller_name', 'buyer_name', 'line_items'],
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

    // Calculate amounts
    const net = (body.line_items || []).reduce((s, i) => s + (i.quantity * i.unit_price), 0);
    const vatAmt = (body.line_items || []).reduce((s, i) => s + (i.quantity * i.unit_price * ((i.vat_rate || 19) / 100)), 0);
    const gross = net + vatAmt;

    const invoiceData = {
      ...body,
      org_id: req.org.id,
      amount_net: parseFloat(net.toFixed(2)),
      amount_vat: parseFloat(vatAmt.toFixed(2)),
      amount_gross: parseFloat(gross.toFixed(2)),
      status: 'draft',
      direction: body.direction || 'outbound',
      created_by: req.user?.id,
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
}

// ── SANITIZE (remove sensitive internal fields) ───────────────
function sanitizeInvoice(inv) {
  const { xml_content, ...rest } = inv;
  return {
    ...rest,
    has_xml: !!xml_content,
    xml_size_bytes: xml_content ? xml_content.length : 0,
  };
}
