// src/routes/auth/index.js
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/jwt.js';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/db.js';
import { supabase } from '../../config/database.js';
import { authMiddleware } from '../../middleware/auth.js';
import { getEmailDomainStatus } from '../../services/email.js';



function signTokens(userId, orgId, role) {
  const accessToken = jwt.sign({ userId, orgId, role }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });
  const refreshToken = randomBytes(40).toString('hex');
  return { accessToken, refreshToken };
}

export async function authRoutes(fastify) {

  // ── REGISTER ────────────────────────────────────────────────
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        // Nur Name, Firma, E-Mail, Passwort sind Pflicht. Adresse ist empfohlen,
        // aber NICHT erzwungen (SMEs sollen sich in <2 Min. registrieren können).
        // IBAN/SEPA und ERP-Anbindung sind bewusst NICHT Teil der Registrierung —
        // diese werden optional im Onboarding-Wizard oder später in den
        // Einstellungen ergänzt.
        required: ['email', 'password', 'full_name', 'org_name'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          full_name: { type: 'string', minLength: 2 },
          org_name: { type: 'string', minLength: 2 },
          vat_id: { type: 'string' },
          // Adresse — optional bei Registrierung, kann später ergänzt werden
          address: { type: 'string' },
          city: { type: 'string' },
          zip: { type: 'string' },
          country: { type: 'string' },
        }
      }
    }
  }, async (req, reply) => {
    const { email, password, full_name, org_name, vat_id, address, city, zip, country } = req.body;

    const existing = await db.findUserByEmail(email);
    if (existing) return reply.code(409).send({ error: 'E-Mail bereits registriert' });

    // Create org — Slug ist Basis der persönlichen e-Rechnungs-Adresse
    // [slug]@rechnungen.invoiq.io: URL-/E-Mail-sicher (a-z, 0-9, Bindestrich),
    // Umlaute transliteriert, ohne Randbindestriche; Eindeutigkeit über UUID-Suffix.
    const slug = org_name.toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30).replace(/-+$/, '') || 'firma';
    const apiKey = `iq_live_${randomBytes(20).toString('hex')}`;

    const org = await db.createOrg({
      name: org_name,
      slug: `${slug}-${uuidv4().substr(0, 6)}`,
      vat_id: vat_id || '',
      // Adresse optional — kann leer bleiben und später in den Einstellungen ergänzt werden
      address: address || '',
      city: city || '',
      zip: zip || '',
      country: country || 'DE',
      // Neue Konten starten auf Free — bezahlte Pläne werden ausschließlich
      // über den Stripe-Checkout (mit 14-Tage-Trial) aktiviert. Vorher bekam
      // jede Registrierung den bezahlten Starter-Plan geschenkt.
      plan: 'free',
      plan_doc_limit: 10,
      inbound_email_slug: slug + '-' + uuidv4().substr(0, 6),
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
      org: { id: org.id, name: org.name, slug: org.slug, plan: org.plan, inbound_email_slug: org.inbound_email_slug, api_key: apiKey },
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
      org: { id: org.id, name: org.name, slug: org.slug, plan: org.plan, inbound_email_slug: org.inbound_email_slug },
    };
  });

  // ── PASSWORT VERGESSEN ───────────────────────────────────────
  // Antwortet IMMER 200 mit derselben Meldung — sonst ließe sich über die
  // Antwort ausspähen, welche E-Mail-Adressen registriert sind.
  fastify.post('/forgot-password', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: { email: { type: 'string', format: 'email' } },
      },
    },
  }, async (req, reply) => {
    const { email } = req.body;
    const genericResponse = { message: 'Falls ein Konto mit dieser E-Mail existiert, wurde ein Reset-Link gesendet.' };

    // Brute-Force-/Spam-Schutz: max. 3 Anfragen pro E-Mail pro 15 Minuten
    const { incrementCounter } = await import('../../lib/rateLimiter.js');
    const { count } = await incrementCounter(`pwreset:${email.toLowerCase()}`, 15 * 60 * 1000);
    if (count > 3) return reply.send(genericResponse);

    const user = await db.findUserByEmail(email);
    if (!user || !user.active) return reply.send(genericResponse);

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h

    const { error } = await supabase.from('password_reset_tokens').insert({
      user_id: user.id, token_hash: tokenHash, expires_at: expiresAt,
    });
    if (error) {
      fastify.log.error(error, 'password_reset_tokens insert failed');
      return reply.send(genericResponse);
    }

    const resetUrl = `${process.env.FRONTEND_URL || 'https://invoiq.io'}/reset-password?token=${token}`;
    try {
      const { sendPasswordResetEmail } = await import('../../services/email.js');
      await sendPasswordResetEmail({ to: user.email, resetUrl, fullName: user.full_name });
    } catch (err) {
      // Fehler nicht an den Client durchreichen (Enumeration/Infoleck),
      // aber loggen — ohne RESEND_API_KEY kommt die Mail nicht an.
      fastify.log.error(err, 'Passwort-Reset-Mail konnte nicht gesendet werden');
    }

    await db.createAuditLog({ org_id: user.org_id, user_id: user.id, action: 'password_reset_requested', details: {} });
    return reply.send(genericResponse);
  });

  // ── PASSWORT ZURÜCKSETZEN ────────────────────────────────────
  fastify.post('/reset-password', {
    schema: {
      body: {
        type: 'object',
        required: ['token', 'password'],
        properties: {
          token: { type: 'string', minLength: 32 },
          password: { type: 'string', minLength: 8 },
        },
      },
    },
  }, async (req, reply) => {
    const { token, password } = req.body;
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const { data: row } = await supabase
      .from('password_reset_tokens').select('*')
      .eq('token_hash', tokenHash).single();

    if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
      return reply.code(400).send({ error: 'Der Reset-Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.' });
    }

    const user = await db.findUserById(row.user_id);
    if (!user || !user.active) {
      return reply.code(400).send({ error: 'Der Reset-Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db.updateUser(user.id, { password_hash: passwordHash });
    await supabase.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('id', row.id);
    // Alle bestehenden Sessions invalidieren — nach einem Reset (z.B. wegen
    // kompromittiertem Passwort) darf kein alter Refresh-Token weiterleben.
    await supabase.from('refresh_tokens').delete().eq('user_id', user.id);

    await db.createAuditLog({ org_id: user.org_id, user_id: user.id, action: 'password_reset_completed', details: {} });
    return { message: 'Passwort erfolgreich geändert. Bitte melden Sie sich mit dem neuen Passwort an.' };
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
    if (!user || !user.active) {
      await db.revokeRefreshToken(tokenHash);
      return reply.code(401).send({ error: 'Benutzer nicht gefunden oder deaktiviert' });
    }
    const org = await db.findOrgById(user.org_id);
    if (!org || !org.active) {
      await db.revokeRefreshToken(tokenHash);
      return reply.code(401).send({ error: 'Organisation nicht gefunden oder deaktiviert' });
    }

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
    // API-Key nur an Owner/Admin herausgeben — Member/Viewer brauchen ihn nicht.
    const canSeeApiKey = ['owner', 'admin', 'super_admin'].includes(user?.role);
    return {
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, last_login_at: user.last_login_at },
      org: {
        id: org.id, name: org.name, slug: org.slug, plan: org.plan,
        plan_doc_limit: org.plan_doc_limit, plan_doc_used: org.plan_doc_used,
        stripe_customer_id: org.stripe_customer_id ? true : false,
        ...(canSeeApiKey ? { api_key: org.api_key } : {}),
        inbound_email_slug: org.inbound_email_slug || (org.slug ? org.slug : org.name.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').substring(0,30)),
      },
    };
  });

  // ── API-KEY ROTATION (nur Owner/Admin) ───────────────────────
  fastify.post('/rotate-api-key', { preHandler: authMiddleware }, async (req, reply) => {
    if (!['owner', 'admin', 'super_admin'].includes(req.user?.role)) {
      return reply.code(403).send({ error: 'Nur Owner/Admin dürfen den API-Key rotieren' });
    }
    const newKey = `iq_live_${randomBytes(20).toString('hex')}`;
    await db.updateOrg(req.org.id, { api_key: newKey, api_key_created_at: new Date().toISOString() });
    await db.createAuditLog({ org_id: req.org.id, user_id: req.user.id, action: 'api_key_rotated', details: {} });
    return { api_key: newKey };
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
      bank_name:        org.bank_name        || '',
      tax_number:       org.tax_number       || '',
      register_number:  org.register_number  || '',
      register_court:   org.register_court   || '',
      managing_director: org.managing_director || '',
      logo_data:        org.logo_data        || '',
      brand_color:      org.brand_color      || '#635BFF',
      email:            org.email            || '',
      website:          org.website          || '',
      phone:            org.phone            || '',
      default_format:   org.default_format   || 'xrechnung',
      default_delivery: org.default_delivery || 'email',
      auto_archive:     org.auto_archive     !== false,
      en16931_strict:   org.en16931_strict   !== false,
      peppol_enabled:   org.peppol_enabled   || false,
      vida_reporting:   org.vida_reporting   || false,
    };
  });

  // ── E-MAIL-DOMAIN-STATUS (Resend-Verifikation, grün/rot in Einstellungen) ──
  fastify.get('/email-domain-status', { preHandler: authMiddleware }, async () => {
    return getEmailDomainStatus();
  });

  // ── SETTINGS POST ────────────────────────────────────────────
  fastify.post('/settings', { preHandler: authMiddleware }, async (req, reply) => {
    const allowed = ['name','vat_id','address','city','zip','country','iban','bic','phone',
                     'bank_name','tax_number','register_number','register_court',
                     'managing_director','logo_data','brand_color','email','website',
                     'default_format','default_delivery','auto_archive','en16931_strict',
                     'peppol_enabled','vida_reporting'];
    const updates = {};
    for(const key of allowed){
      if(req.body[key] !== undefined) updates[key] = req.body[key];
    }
    // Branding-Validierung: Farbe muss Hex sein, Logo eine Bild-Data-URL ≤ 300 KB
    if (updates.brand_color !== undefined && updates.brand_color !== '' &&
        !/^#[0-9a-fA-F]{6}$/.test(updates.brand_color)) {
      return reply.code(400).send({ error: 'Primärfarbe muss ein Hex-Wert sein (z. B. #635BFF).' });
    }
    if (updates.logo_data !== undefined && updates.logo_data !== '') {
      if (!/^data:image\/(png|jpeg|jpg);base64,/.test(updates.logo_data)) {
        return reply.code(400).send({ error: 'Logo muss eine PNG- oder JPEG-Datei sein.' });
      }
      if (updates.logo_data.length > 400_000) {
        return reply.code(400).send({ error: 'Logo zu groß — bitte maximal 300 KB verwenden.' });
      }
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
