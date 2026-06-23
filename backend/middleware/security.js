// backend/middleware/security.js
// DSGVO Art. 32 + OWASP Security Headers + Rate Limiting

const loginAttempts = new Map();

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
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.url.includes('/auth/login') && request.method === 'POST') {
      const ip = (request.headers['x-forwarded-for'] || request.ip || 'unknown').split(',')[0].trim();
      const now = Date.now();
      const window = 15 * 60 * 1000; // 15 Minuten
      const attempts = loginAttempts.get(ip) || { count: 0, resetAt: now + window };
      if (now > attempts.resetAt) {
        attempts.count = 0;
        attempts.resetAt = now + window;
      }
      attempts.count++;
      loginAttempts.set(ip, attempts);
      if (attempts.count > 10) {
        reply.header('Retry-After', Math.ceil((attempts.resetAt - now) / 1000));
        return reply.code(429).send({
          error: 'Zu viele Anmeldeversuche. Bitte 15 Minuten warten.',
          retryAfter: Math.ceil((attempts.resetAt - now) / 1000)
        });
      }
    }
  });
}

// Nach erfolgreichem Login: Zaehler zuruecksetzen
export function resetLoginAttempts(ip) {
  loginAttempts.delete(ip);
}
