// src/routes/auth/index.js
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/db.js';
import { supabase } from '../../config/database.js';
import { authMiddleware } from '../../middleware/auth.js';



function signTokens(userId, orgId, role) {
  const accessToken = jwt.sign({ userId, orgId, role }, process.env.JWT_SECRET || 'dev-secret-min-32-chars-invoiq', { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });
  const refreshToken = randomBytes(40).toString('hex');
  return { accessToken, refreshToken };
}

export async function authRoutes(fastify) {

  // ── REGISTER ────────────────────────────────────────────────
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'full_name', 'org_name'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          full_name: { type: 'string', minLength: 2 },
          org_name: { type: 'string', minLength: 2 },
          vat_id: { type: 'string' },
        }
      }
    }
  }, async (req, reply) => {
    const { email, password, full_name, org_name, vat_id } = req.body;

    const existing = await db.findUserByEmail(email);
    if (existing) return reply.code(409).send({ error: 'E-Mail bereits registriert' });

    // Create org
    const slug = org_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const apiKey = `iq_live_${randomBytes(20).toString('hex')}`;

    const org = await db.createOrg({
      name: org_name,
      slug: `${slug}-${uuidv4().substr(0, 6)}`,
      vat_id: vat_id || '',
      plan: 'starter',
      plan_doc_limit: 100,
      api_key: apiKey,
      api_key_created_at: new Date().toISOString(),
    });

    // Create user
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.createUser({
      org_id: org.id,
      email,
      password_hash: passwordHash,
      full_name,
      role: 'owner',
      email_verified: false,
    });

    const { accessToken, refreshToken } = signTokens(user.id, org.id, user.role);
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    await db.saveRefreshToken(user.id, tokenHash, expiresAt);

    await db.createAuditLog({ org_id: org.id, user_id: user.id, action: 'registered', details: {} });

    return reply.code(201).send({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      token_type: 'Bearer',
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
      org: { id: org.id, name: org.name, slug: org.slug, plan: org.plan, api_key: apiKey },
    });
  });

  // ── LOGIN ────────────────────────────────────────────────────
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        }
      }
    }
  }, async (req, reply) => {
    const { email, password } = req.body;

    const user = await db.findUserByEmail(email);
    if (!user) return reply.code(401).send({ error: 'E-Mail oder Passwort falsch' });
    if (!user.active) return reply.code(401).send({ error: 'Konto deaktiviert' });

    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) return reply.code(401).send({ error: 'E-Mail oder Passwort falsch' });

    const org = await db.findOrgById(user.org_id);
    if (!org) return reply.code(401).send({ error: 'Organisation nicht gefunden' });

    await db.updateUser(user.id, { last_login_at: new Date().toISOString() });

    const { accessToken, refreshToken } = signTokens(user.id, org.id, user.role);
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    await db.saveRefreshToken(user.id, tokenHash, expiresAt);

    await db.createAuditLog({ org_id: org.id, user_id: user.id, action: 'login', details: { ip: req.ip } });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      token_type: 'Bearer',
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
      org: { id: org.id, name: org.name, slug: org.slug, plan: org.plan },
    };
  });

  // ── REFRESH ──────────────────────────────────────────────────
  fastify.post('/refresh', async (req, reply) => {
    const { refresh_token } = req.body || {};
    if (!refresh_token) return reply.code(400).send({ error: 'Refresh Token fehlt' });

    const tokenHash = createHash('sha256').update(refresh_token).digest('hex');
    const stored = await db.findRefreshToken(tokenHash);

    if (!stored || new Date(stored.expires_at) < new Date()) {
      return reply.code(401).send({ error: 'Refresh Token ungültig oder abgelaufen' });
    }

    const user = await db.findUserById(stored.user_id);
    const org = await db.findOrgById(user.org_id);

    const { accessToken, refreshToken: newRefreshToken } = signTokens(user.id, org.id, user.role);
    await db.revokeRefreshToken(tokenHash);
    const newHash = createHash('sha256').update(newRefreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    await db.saveRefreshToken(user.id, newHash, expiresAt);

    return { access_token: accessToken, refresh_token: newRefreshToken, expires_in: 3600 };
  });

  // ── LOGOUT ──────────────────────────────────────────────────
  fastify.post('/logout', { preHandler: authMiddleware }, async (req, reply) => {
    const { refresh_token } = req.body || {};
    if (refresh_token) {
      const hash = createHash('sha256').update(refresh_token).digest('hex');
      await db.revokeRefreshToken(hash);
    }
    if (req.user) await db.createAuditLog({ org_id: req.org.id, user_id: req.user.id, action: 'logout', details: {} });
    return { message: 'Erfolgreich abgemeldet' };
  });

  // ── ME ───────────────────────────────────────────────────────
  fastify.get('/me', { preHandler: authMiddleware }, async (req) => {
    const { user, org } = req;
    return {
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, last_login_at: user.last_login_at },
      org: { id: org.id, name: org.name, slug: org.slug, plan: org.plan, plan_doc_limit: org.plan_doc_limit, plan_doc_used: org.plan_doc_used, api_key: org.api_key, inbound_email_slug: org.inbound_email_slug },
    };
  });

  // ── SETTINGS GET ─────────────────────────────────────────────
  fastify.get('/settings', { preHandler: authMiddleware }, async (req) => {
    const { org } = req;
    return {
      name:             org.name             || '',
      vat_id:           org.vat_id           || '',
      address:          org.address          || '',
      city:             org.city             || '',
      zip:              org.zip              || '',
      country:          org.country          || 'DE',
      iban:             org.iban             || '',
      bic:              org.bic              || '',
      phone:            org.phone            || '',
      default_format:   org.default_format   || 'xrechnung',
      default_delivery: org.default_delivery || 'email',
      auto_archive:     org.auto_archive     !== false,
      en16931_strict:   org.en16931_strict   !== false,
      peppol_enabled:   org.peppol_enabled   || false,
      vida_reporting:   org.vida_reporting   || false,
    };
  });

  // ── SETTINGS POST ────────────────────────────────────────────
  fastify.post('/settings', { preHandler: authMiddleware }, async (req, reply) => {
    const allowed = ['name','vat_id','address','city','zip','country','iban','bic','phone',
                     'default_format','default_delivery','auto_archive','en16931_strict',
                     'peppol_enabled','vida_reporting'];
    const updates = {};
    for(const key of allowed){
      if(req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', req.org.id);
    if(error) {
      fastify.log.error(error, 'Settings update error');
      return reply.code(500).send({ error: `Fehler beim Speichern: ${error.message}` });
    }

    await db.createAuditLog({ org_id: req.org.id, user_id: req.user?.id, action: 'settings_updated', details: { fields: Object.keys(updates) } });
    return { success: true };
  });
}
