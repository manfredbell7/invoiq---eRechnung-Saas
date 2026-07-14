// lib/svixAuth.js — Verifikation Svix-signierter Webhooks (Resend)
// Resend signiert Webhooks nach dem Svix-Schema: HMAC-SHA256 (base64) über
// "<svix-id>.<svix-timestamp>.<rawBody>" mit dem base64-decodierten Secret
// (whsec_-Prefix). Header: svix-id, svix-timestamp, svix-signature
// (Format "v1,<base64> [v1,<base64> …]", mehrere bei Secret-Rotation).

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * @param {Object} p
 * @param {string} p.id         svix-id Header
 * @param {string} p.timestamp  svix-timestamp Header (Unix-Sekunden)
 * @param {string} p.signature  svix-signature Header
 * @param {Buffer|string} p.rawBody  unveränderter Request-Body
 * @param {string} p.secret     Webhook-Secret (whsec_…)
 * @param {number} [p.toleranceSec=300]
 * @returns {{ok:boolean, reason?:string}}
 */
export function verifySvixSignature({ id, timestamp, signature, rawBody, secret, toleranceSec = 300 }) {
  if (!secret) return { ok: false, reason: 'RESEND_WEBHOOK_SECRET nicht konfiguriert' };
  if (!id || !timestamp || !signature) return { ok: false, reason: 'Svix-Header fehlen' };

  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'Ungültiger Timestamp' };
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSec) {
    return { ok: false, reason: 'Timestamp außerhalb der Toleranz (Replay-Schutz)' };
  }

  let key;
  try {
    key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  } catch {
    return { ok: false, reason: 'Secret nicht dekodierbar' };
  }
  if (!key.length) return { ok: false, reason: 'Secret leer' };

  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : String(rawBody ?? '');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  const expectedBuf = Buffer.from(expected);

  for (const part of String(signature).split(' ')) {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) continue;
    const sigBuf = Buffer.from(sig);
    if (sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: 'Signatur ungültig' };
}
