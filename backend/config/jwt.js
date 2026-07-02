// config/jwt.js — Zentrale, stabile JWT-Secret-Quelle.
// WICHTIG: Sign und Verify MÜSSEN dasselbe Secret nutzen.
// Es gibt KEINEN Fallback-Secret mehr: ein fester Fallback wäre ein
// Sicherheitsrisiko (jeder, der den Quellcode kennt, könnte gültige
// Tokens fälschen). Ohne JWT_SECRET darf der Prozess nicht starten.

import { randomBytes } from 'crypto';

let secret = process.env.JWT_SECRET;

if (!secret) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[jwt] FATAL: JWT_SECRET ist nicht gesetzt. Bitte JWT_SECRET in der Umgebung (z.B. Railway) konfigurieren.');
    process.exit(1);
  }
  // dev/test: ephemeres Secret, damit die App lokal startbar bleibt.
  // Sessions überleben keinen Neustart — für Entwicklung akzeptabel.
  secret = randomBytes(32).toString('hex');
  console.warn('[jwt] WARNUNG: JWT_SECRET nicht gesetzt — nutze ephemeres Dev-Secret (Tokens verfallen beim Neustart).');
}

export const JWT_SECRET = secret;
