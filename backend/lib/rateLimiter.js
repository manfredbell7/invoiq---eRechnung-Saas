// backend/lib/rateLimiter.js
// Zentraler Rate-Limiter — Redis-backed in Production, In-Memory in Dev/Test.
//
// Begründung: In-Memory-Zähler (ein Map() pro Prozess) funktionieren nicht
// korrekt, sobald mehr als eine Server-Instanz läuft (z.B. Railway/Vercel
// Auto-Scaling) — jede Instanz zählt unabhängig, ein Angreifer kann das
// Limit durch Lastverteilung auf mehrere Instanzen einfach umgehen.
// REDIS_URL macht den Zähler instanzübergreifend konsistent.

import Redis from 'ioredis';

let redis = null;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false });
  redis.on('error', (err) => console.error('[rateLimiter] Redis-Fehler:', err.message));
} else if (process.env.NODE_ENV === 'production') {
  console.error('[rateLimiter] FATAL: REDIS_URL ist in production erforderlich für verteiltes Rate-Limiting.');
  process.exit(1);
} else {
  console.warn('[rateLimiter] WARNUNG: REDIS_URL nicht gesetzt — nutze In-Memory Rate-Limiting (nur für dev/test geeignet).');
}

// In-Memory Fallback (dev/test only)
const memoryStore = new Map();

/**
 * Erhöht den Zähler für `key` innerhalb eines Zeitfensters und gibt
 * { count, resetAt } zurück.
 */
export async function incrementCounter(key, windowMs) {
  const now = Date.now();

  if (redis) {
    const redisKey = `ratelimit:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.pexpire(redisKey, windowMs);
    }
    const ttl = await redis.pttl(redisKey);
    return { count, resetAt: now + (ttl > 0 ? ttl : windowMs) };
  }

  const entry = memoryStore.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count++;
  memoryStore.set(key, entry);
  return { count: entry.count, resetAt: entry.resetAt };
}

export async function resetCounter(key) {
  if (redis) {
    await redis.del(`ratelimit:${key}`);
  } else {
    memoryStore.delete(key);
  }
}

export function isUsingRedis() {
  return !!redis;
}
