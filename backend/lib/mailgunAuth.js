// lib/mailgunAuth.js — Signaturprüfung für Mailgun-Inbound-Webhooks.
//
// Ohne diese Prüfung kann jeder, der eine Webhook-URL kennt, beliebige
// "eingehende Rechnungen" in fremde Organisationen einschleusen (die
// Org wird nur über den öffentlich erratbaren E-Mail-Slug aufgelöst).
//
// Mailgun signiert jede Zustellung mit timestamp + token + HMAC-SHA256
// über den Signing-Key (MAILGUN_SIGNING_KEY, im Mailgun-Dashboard unter
// Settings → API Security → HTTP webhook signing key).

import { createHmac, timingSafeEqual } from 'crypto';

const seenTokens = new Map(); // Replay-Schutz (Token einmalig, 15 Min TTL)

function pruneSeenTokens() {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [token, ts] of seenTokens) {
    if (ts < cutoff) seenTokens.delete(token);
  }
}

/**
 * Prüft die Mailgun-Signatur eines Inbound-Requests.
 * @param {object} parts - geparste Formfelder (timestamp, token, signature)
 * @returns {{ ok: boolean, reason?: string }}
 */
export function verifyMailgunSignature(parts) {
  const signingKey = process.env.MAILGUN_SIGNING_KEY;

  if (!signingKey) {
    // Ohne Key kann nicht verifiziert werden. In Production ablehnen,
    // in dev/test mit Warnung durchlassen (lokales Testen per curl).
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, reason: 'MAILGUN_SIGNING_KEY nicht konfiguriert — Inbound-Webhook abgelehnt' };
    }
    return { ok: true, reason: 'dev-mode: Signaturprüfung übersprungen (MAILGUN_SIGNING_KEY fehlt)' };
  }

  const { timestamp, token, signature } = parts || {};
  if (!timestamp || !token || !signature) {
    return { ok: false, reason: 'Signaturfelder fehlen (timestamp/token/signature)' };
  }

  // Timestamp max. 5 Minuten alt (Replay-Schutz)
  const age = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
  if (!Number.isFinite(age) || age > 300) {
    return { ok: false, reason: 'Timestamp zu alt' };
  }

  pruneSeenTokens();
  if (seenTokens.has(token)) {
    return { ok: false, reason: 'Token bereits verwendet (Replay)' };
  }

  const expected = createHmac('sha256', signingKey).update(timestamp + token).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature), 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'Signatur ungültig' };
  }

  seenTokens.set(token, Date.now());
  return { ok: true };
}
