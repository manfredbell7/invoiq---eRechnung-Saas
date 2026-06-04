// src/middleware/auth.js
import jwt from 'jsonwebtoken';
import { db } from '../config/db.js';
// ── JWT AUTH ──────────────────────────────────────────────────
export async function authMiddleware(request, reply) {
  try {
    const authHeader = request.headers['authorization'];
    if (!authHeader) return reply.code(401).send({ error: 'Kein Authorization-Header' });

    // API Key auth: "Bearer iq_live_..."
    if (authHeader.startsWith('Bearer iq_')) {
      const apiKey = authHeader.replace('Bearer ', '');
      const org = await db.findOrgByApiKey(apiKey);
      if (!org || !org.active) return reply.code(401).send({ error: 'Ungültiger API-Key' });
      request.org = org;
      request.auth_type = 'api_key';
      return;
    }

    // JWT auth
    if (!authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Ungültiges Token-Format' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-min-32-chars-invoiq');

    const user = await db.findUserById(decoded.userId);
    if (!user || !user.active) return reply.code(401).send({ error: 'Benutzer nicht gefunden' });

    const org = await db.findOrgById(user.org_id);
    if (!org || !org.active) return reply.code(401).send({ error: 'Organisation nicht gefunden' });

    request.user = user;
    request.org = org;
    request.auth_type = 'jwt';

  } catch (err) {
    if (err.name === 'TokenExpiredError') return reply.code(401).send({ error: 'Token abgelaufen' });
    if (err.name === 'JsonWebTokenError') return reply.code(401).send({ error: 'Ungültiges Token' });
    return reply.code(401).send({ error: 'Authentifizierung fehlgeschlagen' });
  }
}

// ── ROLE CHECK ────────────────────────────────────────────────
export function requireRole(...roles) {
  return async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Nicht authentifiziert' });
    if (!roles.includes(request.user.role)) {
      return reply.code(403).send({ error: `Unzureichende Berechtigung. Erforderlich: ${roles.join(' oder ')}` });
    }
  };
}

// ── DOC LIMIT CHECK ───────────────────────────────────────────
export async function checkDocLimit(request, reply) {
  const { org } = request;
  if (!org) return reply.code(401).send({ error: 'Organisation nicht gefunden' });

  if (org.plan !== 'enterprise' && org.plan_doc_used >= org.plan_doc_limit) {
    return reply.code(429).send({
      error: 'Dokumentenlimit erreicht',
      message: `Ihr Plan erlaubt ${org.plan_doc_limit} Dokumente/Monat. Bitte upgraden Sie.`,
      current_plan: org.plan,
      limit: org.plan_doc_limit,
      used: org.plan_doc_used,
    });
  }
}
