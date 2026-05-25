// src/server.js — invoiq Backend
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { db } from './config/database.js';
import { authRoutes } from './routes/auth/index.js';
import { invoiceRoutes } from './routes/invoices/index.js';
import { archiveRoutes } from './routes/archive/index.js';
import { webhookRoutes, connectRoutes } from './routes/webhooks/index.js';

const PORT = process.env.PORT || 3000;
const API = `/api/v1`;


// ── BUILD SERVER ──────────────────────────────────────────────
export async function buildServer() {
  const fastify = Fastify({
    logger: (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : false,
    ajv: { customOptions: { strict: 'log', keywords: ['kind', 'modifier'] } },
  });

  // ── PLUGINS ────────────────────────────────────────────────
  await fastify.register(cors, {
    origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

  // ── HEALTH ─────────────────────────────────────────────────
  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'invoiq-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  }));

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

  // ── WAIT FOR DB SEED ───────────────────────────────────────
  await db.ready();

  // ── ROUTES ─────────────────────────────────────────────────
  fastify.register(authRoutes,    { prefix: `${API}/auth` });
  fastify.register(invoiceRoutes, { prefix: `${API}/invoices` });
  fastify.register(archiveRoutes, { prefix: `${API}/archive` });
  fastify.register(webhookRoutes, { prefix: `${API}/webhooks` });
  fastify.register(connectRoutes, { prefix: `${API}/connect` });

  // ── RATE LIMITING ───────────────────────────────────────────
  fastify.addHook('onRequest', async (req, reply) => {
    // Simple in-memory rate limiting (use Redis in production)
    const key = req.ip;
    if (!fastify._rateLimits) fastify._rateLimits = new Map();
    const now = Date.now();
    const window = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
    const max = parseInt(process.env.RATE_LIMIT_MAX || '200');
    const entry = fastify._rateLimits.get(key) || { count: 0, reset: now + window };
    if (now > entry.reset) { entry.count = 0; entry.reset = now + window; }
    entry.count++;
    fastify._rateLimits.set(key, entry);
    reply.header('X-RateLimit-Limit', max);
    reply.header('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    reply.header('X-RateLimit-Reset', entry.reset);
    if (entry.count > max) return reply.code(429).send({ error: 'Zu viele Anfragen. Bitte warten.' });
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
async function start() {
  const fastify = await buildServer();
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`\n╔═══════════════════════════════════════════╗`);
    console.log(`║   invoiq API v1.0  ·  Port ${PORT}           ║`);
    console.log(`║   http://localhost:${PORT}/api/v1            ║`);
    console.log(`║   Health: http://localhost:${PORT}/health    ║`);
    console.log(`╚═══════════════════════════════════════════╝\n`);
    console.log(`  Demo Login: demo@invoiq.io / demo123`);
    console.log(`  API Key:    iq_live_demo_key_001\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
