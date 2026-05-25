// src/routes/peppol/index.js
// Peppol Management Routes

import { authMiddleware } from '../../middleware/auth.js';
import {
  testConnection,
  lookupReceiver,
  registerSender,
  getPeppolStatus,
} from '../../services/peppolService.js';
import { db } from '../../config/database.js';

export async function peppolRoutes(fastify) {

  // ── TEST VERBINDUNG ───────────────────────────────────────
  fastify.get('/test', { preHandler: authMiddleware }, async (req) => {
    const result = await testConnection();
    return result;
  });

  // ── EMPFÄNGER SUCHEN ──────────────────────────────────────
  fastify.get('/lookup', { preHandler: authMiddleware }, async (req, reply) => {
    const { vat_id, country } = req.query;
    if (!vat_id) return reply.code(400).send({ error: 'vat_id fehlt' });

    const result = await lookupReceiver(vat_id, country || 'DE');
    return result || { found: false, message: 'Nicht im Peppol-Netzwerk gefunden' };
  });

  // ── SENDER REGISTRIEREN ───────────────────────────────────
  fastify.post('/register', { preHandler: authMiddleware }, async (req, reply) => {
    const { org } = req;
    if (!org.vat_id) return reply.code(400).send({ error: 'USt-IdNr. fehlt — bitte in Einstellungen eintragen' });

    try {
      const result = await registerSender(org);
      await db.updateOrg(org.id, { peppol_legal_entity_id: result.legal_entity_id });
      return {
        success: true,
        legal_entity_id: result.legal_entity_id,
        peppol_id: result.peppol_id,
        message: `${org.name} ist jetzt im Peppol-Netzwerk registriert`,
      };
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // ── VERSAND STATUS ────────────────────────────────────────
  fastify.get('/status/:guid', { preHandler: authMiddleware }, async (req, reply) => {
    const status = await getPeppolStatus(req.params.guid);
    if (!status) return reply.code(404).send({ error: 'Status nicht gefunden' });
    return status;
  });

  // ── PEPPOL INFO ───────────────────────────────────────────
  fastify.get('/info', async () => {
    return {
      provider: 'Storecove',
      network: 'Peppol BIS Billing 3.0',
      countries_supported: 31,
      formats: ['UBL 2.1', 'CII', 'XRechnung'],
      certified: true,
      sandbox_url: 'https://api.storecove.com',
      docs: 'https://www.storecove.com/docs/',
    };
  });
}
