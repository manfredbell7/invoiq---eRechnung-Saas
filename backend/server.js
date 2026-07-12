// src/server.js — invoiq Backend v2.0
// Updated: db imports fixed, inbound routes, peppol, datev
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { db } from './config/db.js';
import { authRoutes } from './routes/auth/index.js';
import { adminRoutes } from './routes/admin/index.js';
import { invoiceRoutes } from './routes/invoices/index.js';
import { archiveRoutes } from './routes/archive/index.js';
import { webhookRoutes, connectRoutes } from './routes/webhooks/index.js';
import { peppolRoutes } from './routes/peppol/index.js';
import { idocRoutes }   from './routes/idoc/index.js';
import { scannerRoutes }  from './routes/scanner/index.js';
import { paymentRoutes }  from './routes/payments/index.js';
import { inboundRoutes }  from './routes/inbound/index.js';
import { customerRoutes } from './routes/customers/index.js';
import { businessRoutes } from './routes/business/index.js';
import { aiRoutes } from './routes/ai/index.js';
import { fiRoutes } from './routes/fi/index.js';
import { erpRoutes } from './routes/erp/index.js';

import { registerSecurityHooks } from './middleware/security.js';
import { incrementCounter } from './lib/rateLimiter.js';
const PORT = process.env.PORT || 3000;
const API = `/v1`;  // Changed from /api/v1 — Railway blocks /api/* prefix


// ── BUILD SERVER ──────────────────────────────────────────────
export async function buildServer() {
  const fastify = Fastify({
    logger: (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : false,
    ajv: { customOptions: { strict: 'log', keywords: ['kind', 'modifier'] } },
    trustProxy: true,  // Required for Railway reverse proxy
    ignoreTrailingSlash: true,  // /inbound und /inbound/ identisch behandeln
  });

  // ── PLUGINS ────────────────────────────────────────────────
  registerSecurityHooks(fastify);   await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allowed = [
        // Alle Produktions-Domains (Vercel-Projekt: .io/.de/.fr + www)
        'https://invoiq.io',
        'https://www.invoiq.io',
        'https://invoiq.de',
        'https://www.invoiq.de',
        'https://invoiq.fr',
        'https://www.invoiq.fr',
        process.env.FRONTEND_URL,
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:3001',
      ].filter(Boolean);
      if (
        allowed.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.endsWith('.railway.app')
      ) {
        return cb(null, true);
      }
      fastify.log.warn({ origin }, 'CORS blocked');
      return cb(new Error('CORS not allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

  // ── HEALTH ─────────────────────────────────────────────────
  // Health check on multiple paths for Railway compatibility
  const healthHandler = async () => ({
    status: 'ok',
    service: 'invoiq-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  });

  fastify.get('/health', healthHandler);
  fastify.get(`${API}/health`, healthHandler);
  fastify.get(`${API}/status`, healthHandler);

  // ── API INFO ───────────────────────────────────────────────
  fastify.get(`${API}`, async () => ({
    name: 'invoiq API',
    version: 'v1',
    description: 'E-Invoice Platform — XRechnung · ZUGFeRD · Peppol',
    docs: 'https://docs.invoiq.io',
    endpoints: {
      auth:     `${API}/auth`,
      invoices: `${API}/invoices`,
      archive:  `${API}/archive`,
      webhooks: `${API}/webhooks`,
      connect:  `${API}/connect`,
    },
    formats_supported: ['xrechnung', 'zugferd', 'peppol', 'facturx'],
    standards: ['EN 16931', 'XRechnung 3.0', 'ZUGFeRD 2.4', 'Peppol BIS 3.0'],
    compliance: ['GoBD', 'DSGVO', '§147 AO'],
  }));

  // ── ROUTES — registered BEFORE db.ready() so server accepts traffic immediately
  fastify.register(authRoutes,    { prefix: `${API}/auth` });
  fastify.register(adminRoutes,   { prefix: `${API}/admin` });
  fastify.register(invoiceRoutes, { prefix: `${API}/invoices` });
  fastify.register(archiveRoutes, { prefix: `${API}/archive` });
  fastify.register(webhookRoutes, { prefix: `${API}/webhooks` });
  fastify.register(connectRoutes, { prefix: `${API}/connect` });
  fastify.register(peppolRoutes,  { prefix: `${API}/peppol` });
  fastify.register(idocRoutes,    { prefix: `${API}/idoc` });
  fastify.register(scannerRoutes, { prefix: API });
  fastify.register(paymentRoutes, { prefix: API });
  fastify.register(inboundRoutes,  { prefix: `${API}/inbound` });
  fastify.register(customerRoutes, { prefix: `${API}/customers` });
  fastify.register(businessRoutes, { prefix: `${API}/business` });
  fastify.register(aiRoutes,       { prefix: `${API}/ai` });
  fastify.register(fiRoutes,       { prefix: `${API}/fi` });
  fastify.register(erpRoutes,      { prefix: `${API}/erp` });

  // DB (Supabase client) — no ready() needed, connects on first query

  // ── RATE LIMITING ───────────────────────────────────────────
  // Redis-backed (siehe lib/rateLimiter.js) — in production ohne REDIS_URL
  // bricht der Prozessstart ab, da In-Memory-Zähler bei mehreren Instanzen
  // wirkungslos sind.
  fastify.addHook('onRequest', async (req, reply) => {
    const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
    const max = parseInt(process.env.RATE_LIMIT_MAX || '200');
    const { count, resetAt } = await incrementCounter(`global:${req.ip}`, windowMs);
    reply.header('X-RateLimit-Limit', max);
    reply.header('X-RateLimit-Remaining', Math.max(0, max - count));
    reply.header('X-RateLimit-Reset', resetAt);
    if (count > max) return reply.code(429).send({ error: 'Zu viele Anfragen. Bitte warten.' });
  });

  // ── ERROR HANDLER ───────────────────────────────────────────
  fastify.setErrorHandler((error, req, reply) => {
    fastify.log.error(error);
    if (error.validation) {
      return reply.code(400).send({ error: 'Validierungsfehler', details: error.validation });
    }
    const statusCode = error.statusCode || 500;
    return reply.code(statusCode).send({
      error: statusCode === 500 ? 'Interner Serverfehler' : error.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
    });
  });

  fastify.setNotFoundHandler((req, reply) => {
    reply.code(404).send({ error: `Route nicht gefunden: ${req.method} ${req.url}` });
  });

  return fastify;
}

// ── START ─────────────────────────────────────────────────────
// Nur starten, wenn die Datei direkt ausgeführt wird (node server.js) —
// Tests importieren buildServer() und dürfen keinen Listener öffnen.
const isMain = import.meta.url === `file://${process.argv[1]}`;

async function start() {
  const fastify = await buildServer();
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`\n╔═══════════════════════════════════════════╗`);
    console.log(`║   invoiq API v1.0  ·  Port ${PORT}           ║`);
    console.log(`║   Base:   http://localhost:${PORT}${API}         ║`);
    console.log(`║   Health: http://localhost:${PORT}/health    ║`);
    console.log(`╚═══════════════════════════════════════════╝\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

if (isMain) start();
