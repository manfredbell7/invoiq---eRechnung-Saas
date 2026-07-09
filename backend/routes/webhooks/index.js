// src/routes/webhooks/index.js
import { randomBytes } from 'crypto';
import { db } from '../../config/db.js';
import { authMiddleware } from '../../middleware/auth.js';

// HINWEIS: Es gab zwei konkurrierende Stripe-Webhook-Implementierungen
// (routes/payments/index.js und routes/webhooks/stripe.js). Letztere war
// nur ein TODO-Stub ohne echte DB-Updates und wurde entfernt — die
// vollständige Implementierung lebt unter POST /v1/payments/webhook.

export async function webhookRoutes(fastify) {

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
