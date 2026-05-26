// src/routes/idoc/index.js
// SAP IDoc Empfangs-Endpunkt für invoiq

import { parseIDoc, validateIDoc, generateStatusIDoc } from '../../services/idocService.js';
import { generateXML, hashXML, validateEN16931 } from '../../services/xmlEngine.js';
import { archiveService } from '../../services/archiveService.js';
import { deliveryService } from '../../services/deliveryService.js';
import { db } from '../../config/database.js';

export async function idocRoutes(fastify) {

  // ── HAUPT-ENDPUNKT: IDoc von SAP empfangen ───────────────────
  // SAP SM59 zeigt auf: POST /api/v1/idoc/receive
  // Auth: API-Key im Header X-SAP-API-Key oder Authorization
  fastify.post('/receive', {
    config: { rawBody: true } // Rohen Body für IDoc-Parsing behalten
  }, async (req, reply) => {

    // ── Auth prüfen ─────────────────────────────────────────────
    const apiKey = req.headers['x-sap-api-key'] ||
                   req.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      return reply.code(401).send({
        status: 'ERROR',
        code: 'AUTH_MISSING',
        message: 'API-Key fehlt. Header: X-SAP-API-Key oder Authorization',
      });
    }

    const org = await db.findOrgByApiKey(apiKey);
    if (!org) {
      return reply.code(401).send({
        status: 'ERROR',
        code: 'AUTH_INVALID',
        message: 'Ungültiger API-Key',
      });
    }

    // ── IDoc Body lesen ─────────────────────────────────────────
    const contentType = req.headers['content-type'] || '';
    let idocContent;

    if (contentType.includes('xml')) {
      idocContent = req.body;
    } else if (contentType.includes('json')) {
      // SAP kann auch JSON schicken (modernes Setup)
      idocContent = req.body?.idoc || req.body?.content || JSON.stringify(req.body);
    } else {
      idocContent = req.body?.toString() || '';
    }

    if (!idocContent) {
      return reply.code(400).send({
        status: 'ERROR',
        code: 'EMPTY_BODY',
        message: 'IDoc-Inhalt fehlt',
      });
    }

    // ── IDoc parsen ─────────────────────────────────────────────
    let parsed;
    try {
      parsed = parseIDoc(idocContent);
    } catch(err) {
      await db.createAuditLog({
        org_id: org.id,
        action: 'idoc_parse_error',
        details: { error: err.message, content_type: contentType },
      });
      return reply.code(422).send({
        status: 'ERROR',
        code: 'PARSE_ERROR',
        message: `IDoc-Parsing fehlgeschlagen: ${err.message}`,
      });
    }

    // ── IDoc validieren ─────────────────────────────────────────
    const idocValidation = validateIDoc(parsed);
    if (!idocValidation.valid) {
      return reply.code(422).send({
        status: 'ERROR',
        code: 'VALIDATION_ERROR',
        message: 'IDoc-Validierung fehlgeschlagen',
        errors: idocValidation.errors,
        warnings: idocValidation.warnings,
      });
    }

    // ── Rechnung in DB anlegen ───────────────────────────────────
    const invoiceData = {
      ...parsed,
      org_id:     org.id,
      direction:  'outbound',
      format:     'xrechnung',
      status:     'processing',
      source:     'sap_idoc',
    };

    // EN 16931 validieren
    const en16931 = validateEN16931(invoiceData);
    invoiceData.validation_result = en16931;
    invoiceData.validation_passed = en16931.passed;

    // XML generieren
    if (en16931.passed) {
      const xml = generateXML(invoiceData);
      invoiceData.xml_content = xml;
      invoiceData.xml_hash    = hashXML(xml);
      invoiceData.status      = 'validated';
    }

    const invoice = await db.createInvoice(invoiceData);

    // ── Automatisch archivieren ──────────────────────────────────
    if (invoiceData.xml_content) {
      try {
        const archiveResult = await archiveService.archiveDocument({
          orgId:         org.id,
          invoiceId:     invoice.id,
          xml:           invoiceData.xml_content,
          format:        'xrechnung',
          invoiceNumber: invoice.invoice_number,
        });
        await db.updateInvoice(invoice.id, {
          archived:     true,
          archived_at:  archiveResult.archived_at,
          archive_path: archiveResult.s3_key,
          archive_hash: archiveResult.file_hash,
        });
      } catch(archiveErr) {
        // Archivierungsfehler nicht kritisch — Rechnung trotzdem verarbeiten
        console.error('Archivierungsfehler:', archiveErr.message);
      }
    }

    // ── Automatisch versenden (wenn E-Mail vorhanden) ─────────────
    let deliveryResult = null;
    if (invoice.buyer_email && invoiceData.xml_content) {
      try {
        deliveryResult = await deliveryService.deliver(
          { ...invoice, delivery_method: 'email' },
          invoiceData.xml_content,
          org
        );
        await db.updateInvoice(invoice.id, { status: 'sent' });
      } catch(deliveryErr) {
        console.error('Versandfehler:', deliveryErr.message);
      }
    }

    // ── Audit Log ────────────────────────────────────────────────
    await db.createAuditLog({
      org_id:     org.id,
      invoice_id: invoice.id,
      action:     'idoc_received',
      details: {
        source:       'sap_idoc',
        idoc_type:    parsed.raw_idoc_type,
        invoice_number: invoice.invoice_number,
        en16931_passed: en16931.passed,
        archived:       !!invoiceData.xml_content,
        delivered:      !!deliveryResult,
      },
    });

    // ── Status-IDoc für SAP generieren ───────────────────────────
    const sapSystemId = req.headers['x-sap-system-id'] || org.erp_system;
    const statusIdoc  = generateStatusIDoc({
      invoiceNumber: invoice.invoice_number,
      status:        invoice.status,
      timestamp:     new Date().toISOString(),
      sapSystemId,
    });

    // ── Antwort an SAP ───────────────────────────────────────────
    reply.header('Content-Type', 'application/xml');
    return `<?xml version="1.0" encoding="UTF-8"?>
<INVOIQ_RESPONSE>
  <STATUS>OK</STATUS>
  <INVOICE_ID>${invoice.id}</INVOICE_ID>
  <INVOICE_NUMBER>${invoice.invoice_number}</INVOICE_NUMBER>
  <EN16931_VALID>${en16931.passed}</EN16931_VALID>
  <ARCHIVED>${!!invoiceData.xml_content}</ARCHIVED>
  <DELIVERED>${!!deliveryResult}</DELIVERED>
  <TIMESTAMP>${new Date().toISOString()}</TIMESTAMP>
  ${idocValidation.warnings.length > 0 ? `<WARNINGS>${idocValidation.warnings.map(w=>`<WARNING>${w}</WARNING>`).join('')}</WARNINGS>` : ''}
</INVOIQ_RESPONSE>`;
  });

  // ── TEST-ENDPUNKT: Verbindung prüfen ──────────────────────────
  // SAP kann diese URL zum Testen der RFC-Verbindung nutzen
  fastify.get('/ping', async (req, reply) => {
    const apiKey = req.headers['x-sap-api-key'] ||
                   req.headers['authorization']?.replace('Bearer ', '');

    const org = apiKey ? await db.findOrgByApiKey(apiKey) : null;

    return {
      status:    'OK',
      service:   'invoiq IDoc Receiver',
      version:   '1.0',
      timestamp: new Date().toISOString(),
      auth:      org ? `Authentifiziert als: ${org.name}` : 'Nicht authentifiziert',
      endpoints: {
        receive: 'POST /api/v1/idoc/receive',
        ping:    'GET  /api/v1/idoc/ping',
        status:  'GET  /api/v1/idoc/status/:invoice_number',
      },
    };
  });

  // ── STATUS ABFRAGEN ───────────────────────────────────────────
  // SAP kann hier den Status einer Rechnung abfragen
  fastify.get('/status/:invoice_number', async (req, reply) => {
    const apiKey = req.headers['x-sap-api-key'] ||
                   req.headers['authorization']?.replace('Bearer ', '');

    const org = apiKey ? await db.findOrgByApiKey(apiKey) : null;
    if (!org) return reply.code(401).send({ status: 'ERROR', message: 'Nicht authentifiziert' });

    const { invoices } = await db.findInvoices(org.id, {
      search: req.params.invoice_number,
      limit: 1,
    });

    if (!invoices.length) {
      return reply.code(404).send({
        status:  'NOT_FOUND',
        message: `Rechnung ${req.params.invoice_number} nicht gefunden`,
      });
    }

    const inv = invoices[0];
    return {
      invoice_number: inv.invoice_number,
      status:         inv.status,
      archived:       inv.archived || false,
      archive_hash:   inv.archive_hash || null,
      validation:     inv.validation_passed,
      created_at:     inv.created_at,
    };
  });
}
