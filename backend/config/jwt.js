// config/jwt.js — Zentrale, stabile JWT-Secret-Quelle.
// WICHTIG: Sign und Verify MÜSSEN dasselbe Secret nutzen.
// Es gibt KEINEN Fallback-Secret mehr: ein fester Fallback wäre ein
// Sicherheitsrisiko (jeder, der den Quellcode kennt, könnte gültige
// Tokens fälschen). Ohne JWT_SECRET darf der Prozess nicht starten.

if (!process.env.JWT_SECRET) {
  console.error('[jwt] FATAL: JWT_SECRET ist nicht gesetzt. Bitte JWT_SECRET in der Umgebung (z.B. Railway) konfigurieren.');
  process.exit(1);
}

export const JWT_SECRET = process.env.JWT_SECRET;
