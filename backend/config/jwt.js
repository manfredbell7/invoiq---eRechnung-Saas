// config/jwt.js — Zentrale, stabile JWT-Secret-Quelle.
// WICHTIG: Sign und Verify MÜSSEN dasselbe Secret nutzen.
// Ein fester Fallback (statt zufällig) sorgt dafür, dass Tokens auch
// dann gültig bleiben, wenn JWT_SECRET in der Umgebung (noch) fehlt —
// so überlebt eine Session auch einen Redeploy ohne gesetzte Variable.

const FALLBACK = 'invoiq-stable-fallback-secret-min-32-chars-do-not-change';

export const JWT_SECRET = process.env.JWT_SECRET || FALLBACK;

// Sichtbare Warnung im Log, falls die Variable fehlt (aber kein Crash)
if (!process.env.JWT_SECRET) {
  console.warn('[jwt] WARNUNG: JWT_SECRET nicht gesetzt — nutze stabilen Fallback. Bitte JWT_SECRET in Railway setzen!');
}
