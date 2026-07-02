# invoiq — E-Rechnung SaaS

> E-Rechnung für jedes System. XRechnung · ZUGFeRD · Peppol — in 48 Stunden live.

🌐 **Website:** invoiq.io

## Schnellstart

```bash
# Backend
cd backend && npm install && cp .env.example .env
# SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env eintragen (Pflicht)
npm start            # http://localhost:3000  (API-Basis: /v1)
npm test             # Unit-Tests offline; Integrationstests nur mit Supabase-Env

# Frontend
cd frontend && npm install
npm run dev          # http://localhost:5173 (VITE_API_URL auf lokales Backend setzen)
```

## Production-Checkliste (Pflicht-Env-Variablen)

| Variable | Zweck | Verhalten wenn fehlt (production) |
|---|---|---|
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Datenbank | Prozess startet nicht |
| `JWT_SECRET` | Auth-Tokens | Prozess startet nicht |
| `REDIS_URL` | verteiltes Rate-Limiting | Prozess startet nicht |
| `AWS_*` (4 Variablen) | GoBD-Archiv (S3 Frankfurt) | Prozess startet nicht |
| `MAILGUN_SIGNING_KEY` | Inbound-Webhook-Signatur | Inbound-Mails werden abgelehnt |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `STRIPE_PRICE_*` | Billing | Checkout/Portal liefern 503 |
| `RESEND_API_KEY` | E-Mail-Versand | Versand schlägt mit klarem Fehler fehl |
| `ANTHROPIC_API_KEY` | KI-Extraktion (Scanner/PDF) | Scanner liefert 503, PDFs landen im Status „pruefung" |

Migrationen: `backend/migrations/*.sql` der Reihe nach im Supabase SQL Editor
ausführen — **005 ist Pflicht** (fehlende Spalten für Settings/KI-Review/vendors).

## Stack
Node.js 22 · Fastify · React 18 · Vite · PostgreSQL (Supabase) · AWS S3 Frankfurt
