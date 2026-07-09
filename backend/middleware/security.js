// backend/middleware/security.js
// DSGVO Art. 32 + OWASP Security Headers + Rate Limiting

import { incrementCounter, resetCounter } from '../lib/rateLimiter.js';

// Security-Headers Hook (OWASP, DSGVO Art. 32)
export function registerSecurityHooks(fastify) {
  fastify.addHook('onSend', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  });

  // Rate Limiting fuer Login (Brute-Force-Schutz gem. DSGVO Art. 32)
  // Redis-backed (siehe lib/rateLimiter.js), damit das Limit auch bei
  // mehreren Server-Instanzen konsistent durchgesetzt wird.
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.url.includes('/auth/login') && request.method === 'POST') {
      // request.ip ist dank trustProxy bereits die echte Client-IP.
      // x-forwarded-for direkt zu lesen wäre durch den Client spoofbar
      // und würde den Brute-Force-Schutz aushebeln.
      const ip = request.ip || 'unknown';
      const windowMs = 15 * 60 * 1000; // 15 Minuten
      const { count, resetAt } = await incrementCounter(`login:${ip}`, windowMs);
      if (count > 10) {
        const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
        reply.header('Retry-After', retryAfter);
        return reply.code(429).send({
          error: 'Zu viele Anmeldeversuche. Bitte 15 Minuten warten.',
          retryAfter,
        });
      }
    }
  });
}

// Nach erfolgreichem Login: Zaehler zuruecksetzen
export async function resetLoginAttempts(ip) {
  await resetCounter(`login:${ip}`);
}
