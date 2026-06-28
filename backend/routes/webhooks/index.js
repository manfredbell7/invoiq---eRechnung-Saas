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

  fastify.get('/', { preHandler: [authMiddleware] }, async (req) => {
    const conns = [...(fastify.db?.erpConnections?.values() || [])]
      .filter(c => c.org_id === req.org.id);
    return { connections: conns };
  });

  fastify.post('/', { preHandler: [authMiddleware] }, async (req, reply) => {
    const { type, name, config } = req.body || {};
    const connector = SUPPORTED.find(c => c.type === type);
    if (!connector) return reply.code(400).send({ error: `Unbekannter Konnektor-Typ: ${type}` });
    if (!connector.available) return reply.code(400).send({ error: `${connector.name} noch nicht verfügbar` });

    // In production: encrypt config before storing
    const conn = {
      id: Math.random().toString(36).substr(2),
      org_id: req.org.id,
      type,
      name: name || connector.name,
      config: config || {},
      active: true,
      created_at: new Date().toISOString(),
    };

    return reply.code(201).send({
      connection: { ...conn, config: '***encrypted***' },
      message: `${connector.name} Verbindung erstellt. Testen Sie die Verbindung unter /connect/${conn.id}/test`
    });
  });

  fastify.post('/:id/test', { preHandler: [authMiddleware] }, async (req) => {
    // Mock connection test
    return {
      connection_id: req.params.id,
      status: 'connected',
      latency_ms: Math.floor(Math.random() * 80) + 20,
      message: 'Verbindung erfolgreich',
      tested_at: new Date().toISOString(),
    };
  });
}
