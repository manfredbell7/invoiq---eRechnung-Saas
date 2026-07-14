// src/routes/webhooks/index.js
import { randomBytes } from 'crypto';
import { db } from '../../config/db.js';
import { authMiddleware } from '../../middleware/auth.js';
import { verifySvixSignature } from '../../lib/svixAuth.js';
import { processInboundEmail, resolveOrgByRecipient } from '../../services/inboundProcessor.js';

// HINWEIS: Es gab zwei konkurrierende Stripe-Webhook-Implementierungen
// (routes/payments/index.js und routes/webhooks/stripe.js). Letztere war
// nur ein TODO-Stub ohne echte DB-Updates und wurde entfernt — die
// vollständige Implementierung lebt unter POST /v1/payments/webhook.

export async function webhookRoutes(fastify) {

  // JSON-Parser nur in diesem Plugin-Scope überschreiben: Svix signiert den
  // ROHEN Body — wir bewahren ihn als req.rawBody auf und parsen selbst.
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    req.rawBody = body;
    try {
      done(null, body.length ? JSON.parse(body.toString('utf-8')) : {});
    } catch (err) {
      err.statusCode = 400;
      done(err);
    }
  });

  // ── RESEND INBOUND — [slug]@rechnungen.invoiq.de ─────────────
  // Resend Inbound-Route (catch-all *@rechnungen.invoiq.de) sendet das Event
  // "email.received" hierher; Signatur nach Svix-Schema.
  fastify.post('/email-inbound', async (req, reply) => {
    const check = verifySvixSignature({
      id:        req.headers['svix-id'],
      timestamp: req.headers['svix-timestamp'],
      signature: req.headers['svix-signature'],
      rawBody:   req.rawBody,
      secret:    process.env.RESEND_WEBHOOK_SECRET,
    });
    if (!check.ok) {
      fastify.log.warn({ reason: check.reason }, 'webhooks/email-inbound: Signatur abgelehnt');
      return reply.code(check.reason?.includes('konfiguriert') ? 503 : 403)
        .send({ error: `Webhook abgelehnt: ${check.reason}` });
    }

    const event = req.body || {};
    // Nur eingehende Mails verarbeiten — Versand-Events (email.sent etc.) bestätigen
    if (event.type && event.type !== 'email.received' && event.type !== 'inbound.email.received') {
      return { received: true, ignored: event.type };
    }
    const data = event.data || event;

    const recipients = [].concat(data.to || [], data.cc || [], data.recipient || []);
    const org = await resolveOrgByRecipient(recipients);
    // 200 auch bei unbekanntem Empfänger — sonst retried Resend endlos
    if (!org) return { received: true, matched: false };

    const sender  = typeof data.from === 'object' ? (data.from?.email || data.from?.address || '') : (data.from || '');
    const subject = data.subject || '';
    const attachments = await loadResendAttachments(data, fastify.log);

    try {
      const { processed } = await processInboundEmail({ org, sender, subject, attachments, source: 'resend' });
      return { received: true, processed };
    } catch (err) {
      fastify.log.error(err, 'webhooks/email-inbound: Verarbeitung fehlgeschlagen');
      return { received: true, processed: 0 };
    }
  });

  fastify.get('/', { preHandler: authMiddleware }, async (req) => {
    const whs = await db.findWebhooks(req.org.id);
    return { webhooks: whs.map(w => ({ ...w, secret: '***' })) };
  });

  fastify.post('/', { preHandler: authMiddleware }, async (req, reply) => {
    const { url, events } = req.body || {};
    if (!url) return reply.code(400).send({ error: 'URL fehlt' });

    const secret = randomBytes(24).toString('hex');
    const wh = await db.createWebhook({
      org_id: req.org.id,
      url,
      secret,
      events: events || ['invoice.created', 'invoice.sent', 'invoice.delivered', 'invoice.rejected'],
      active: true,
    });

    return reply.code(201).send({ ...wh, secret_shown_once: secret });
  });

  fastify.delete('/:id', { preHandler: authMiddleware }, async (req, reply) => {
    const ok = await db.deleteWebhook(req.params.id, req.org.id);
    if (!ok) return reply.code(404).send({ error: 'Webhook nicht gefunden' });
    return { message: 'Webhook gelöscht' };
  });
}

// Anhänge aus dem Resend-Event laden. Resend liefert Inhalte je nach
// API-Version inline (base64 in content) oder als Download-URL — beide
// Varianten werden unterstützt; nicht ladbare Anhänge werden übersprungen.
async function loadResendAttachments(data, log) {
  const out = [];
  for (const att of data.attachments || []) {
    const filename = att.filename || att.name || 'anhang';
    try {
      if (att.content) {
        const buffer = Buffer.isBuffer(att.content)
          ? att.content
          : Buffer.from(String(att.content), 'base64');
        out.push({ filename, buffer });
        continue;
      }
      const url = att.download_url || att.url;
      if (url && /^https:\/\//.test(url)) {
        const headers = url.includes('resend.com')
          ? { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } : {};
        const res = await fetch(url, { headers });
        if (res.ok) {
          out.push({ filename, buffer: Buffer.from(await res.arrayBuffer()) });
          continue;
        }
        log?.warn({ filename, status: res.status }, 'Resend-Anhang nicht ladbar');
      }
    } catch (err) {
      log?.warn({ filename, err: err.message }, 'Resend-Anhang übersprungen');
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// src/routes/connect/index.js — ERP connections
// ─────────────────────────────────────────────────────────────
export async function connectRoutes(fastify) {

  const SUPPORTED = [
    { type: 'sap_s4', name: 'SAP S/4HANA', method: 'RFC / IDoc / REST API', available: true },
    { type: 'sap_ecc', name: 'SAP ECC', method: 'RFC / IDoc Classic', available: true },
    { type: 'datev', name: 'DATEV', method: 'DATEV Connect Online', available: true },
    { type: 'lexware', name: 'Lexware', method: 'XML Export / SFTP', available: true },
    { type: 'dynamics', name: 'Microsoft Dynamics 365', method: 'Dataverse API', available: true },
    { type: 'sage', name: 'Sage', method: 'Sage API v2', available: false, coming_soon: true },
    { type: 'rest', name: 'REST API', method: 'Generic REST Integration', available: true },
    { type: 'sftp', name: 'SFTP / E-Mail', method: 'File-based', available: true },
  ];

  fastify.get('/available', async () => ({ connectors: SUPPORTED }));

  // Persistenz in erp_connections (siehe schema.sql / Migration 005) —
  // die frühere Version las aus einem nie existierenden fastify.db und
  // speicherte POSTs gar nicht.
  fastify.get('/', { preHandler: [authMiddleware] }, async (req, reply) => {
    const { supabase } = await import('../../config/database.js');
    const { data, error } = await supabase
      .from('erp_connections')
      .select('id, type, name, active, last_sync_at, created_at')
      .eq('org_id', req.org.id)
      .order('created_at', { ascending: false });
    if (error) {
      req.log.error(error, 'erp_connections query failed');
      return reply.code(500).send({ error: 'Verbindungen konnten nicht geladen werden' });
    }
    return { connections: data ?? [] };
  });

  fastify.post('/', { preHandler: [authMiddleware] }, async (req, reply) => {
    const { type, name, config } = req.body || {};
    const connector = SUPPORTED.find(c => c.type === type);
    if (!connector) return reply.code(400).send({ error: `Unbekannter Konnektor-Typ: ${type}` });
    if (!connector.available) return reply.code(400).send({ error: `${connector.name} noch nicht verfügbar` });

    const { supabase } = await import('../../config/database.js');
    const { data, error } = await supabase.from('erp_connections').insert({
      org_id: req.org.id,
      type,
      name: name || connector.name,
      config: config || {},
      active: true,
    }).select('id, type, name, active, created_at').single();
    if (error) {
      req.log.error(error, 'erp_connections insert failed');
      return reply.code(500).send({ error: 'Verbindung konnte nicht gespeichert werden' });
    }

    await db.createAuditLog({ org_id: req.org.id, user_id: req.user?.id, action: 'erp_connection_created', details: { type } });
    return reply.code(201).send({ connection: data });
  });

  fastify.delete('/:id', { preHandler: [authMiddleware] }, async (req, reply) => {
    const { supabase } = await import('../../config/database.js');
    const { data, error } = await supabase.from('erp_connections')
      .delete().eq('id', req.params.id).eq('org_id', req.org.id).select('id');
    if (error) return reply.code(500).send({ error: error.message });
    if (!(data ?? []).length) return reply.code(404).send({ error: 'Verbindung nicht gefunden' });
    return { message: 'Verbindung gelöscht' };
  });

  // Konfigurationsprüfung — ehrlich benannt: prüft Pflichtfelder der
  // gespeicherten Verbindung. Ein echter Verbindungstest zum Zielsystem
  // folgt mit den jeweiligen Konnektor-Implementierungen.
  fastify.post('/:id/test', { preHandler: [authMiddleware] }, async (req, reply) => {
    const { supabase } = await import('../../config/database.js');
    const { data: conn } = await supabase.from('erp_connections')
      .select('*').eq('id', req.params.id).eq('org_id', req.org.id).single();
    if (!conn) return reply.code(404).send({ error: 'Verbindung nicht gefunden' });

    const cfg = conn.config || {};
    const missing = [];
    if (['rest', 'sap_s4', 'dynamics'].includes(conn.type) && !cfg.endpoint_url) missing.push('endpoint_url');
    if (['rest', 'datev', 'dynamics', 'sap_s4'].includes(conn.type) && !cfg.api_key && !cfg.client_id) missing.push('api_key/client_id');
    if (conn.type === 'sftp' && !cfg.host) missing.push('host');

    return {
      connection_id: conn.id,
      status: missing.length ? 'config_incomplete' : 'config_ok',
      missing_fields: missing,
      message: missing.length
        ? `Konfiguration unvollständig: ${missing.join(', ')}`
        : 'Konfiguration vollständig. Live-Verbindungstest folgt mit Konnektor-Rollout.',
      tested_at: new Date().toISOString(),
    };
  });
}
