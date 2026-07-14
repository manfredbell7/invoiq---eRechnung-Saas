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
| `RESEND_WEBHOOK_SECRET` | Signatur des Resend-Inbound-Webhooks (E-Mail-Eingang) | Inbound-Mails werden abgelehnt |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `STRIPE_PRICE_*` | Billing | Checkout/Portal liefern 503 |
| `RESEND_API_KEY` | E-Mail-Versand | Versand schlägt mit klarem Fehler fehl |
| `ANTHROPIC_API_KEY` | KI-Extraktion (Scanner/PDF) | Scanner liefert 503, PDFs landen im Status „pruefung" |

Migrationen: `backend/migrations/*.sql` der Reihe nach im Supabase SQL Editor
ausführen — **005 ist Pflicht** (fehlende Spalten für Settings/KI-Review/vendors).

## Feature-Flag: ERP-Module

Die Navigation ist auf E-Rechnung fokussiert. Die ERP-Module
(MM/PP/CO/HCM/CRM/PM/QM/DMS) und die Vertriebs-Gruppe (Belege & Aufträge,
Artikel & Leistungen, Kunden) sind vollständig implementiert, aber per
Feature-Flag ausgeblendet — **kein Code wurde entfernt**.

- Reaktivieren: in Vercel `VITE_ERP_ENABLED=true` setzen und neu deployen
  (siehe `frontend/.env.example`).
- Entwickler-Override ohne Rebuild: in der Browser-Konsole
  `localStorage.setItem("invoiq_feature_erp","1")` und Seite neu laden.

## DNS-Setup (Hostinger) — E-Mail-Versand & -Eingang

Alle Einträge werden bei Hostinger unter **Domains → invoiq.io → DNS / Nameserver**
gepflegt. Die mit `<…>` markierten Werte sind kontospezifisch und stehen im
Resend-Dashboard unter [resend.com/domains](https://resend.com/domains) nach dem
Anlegen der jeweiligen Domain — die Werte dort sind maßgeblich.

### 1. Versand (Outbound) — Domain `invoiq.io` bei Resend anlegen

| Typ | Name/Host | Wert | Priorität | Zweck |
|---|---|---|---|---|
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — | SPF |
| MX | `send` | `feedback-smtp.<region>.amazonses.com` | 10 | Bounce-Feedback |
| TXT | `resend._domainkey` | `p=<DKIM-Public-Key aus dem Resend-Dashboard>` | — | DKIM |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | — | DMARC (Empfehlung) |

Absenderadresse ist `EMAIL_FROM` (Default `rechnungen@invoiq.io`). Solange die
Domain nicht verifiziert ist, lehnt Resend jeden Versand ab — die App zeigt dann
eine klare Fehlermeldung, und der Status ist in **Einstellungen → Unternehmen →
E-Mail-Domain-Status** (grün/rot) sichtbar.

### 2. Eingang (Inbound) — Domain `rechnungen.invoiq.io` bei Resend anlegen

| Typ | Name/Host | Wert | Priorität | Zweck |
|---|---|---|---|---|
| MX | `rechnungen` | `<Inbound-MX-Host aus dem Resend-Dashboard>` | 10 | Mailzustellung an Resend |

Danach in Resend:
1. **Inbound-Route** als Catch-all `*@rechnungen.invoiq.io` anlegen.
2. **Webhook** auf `https://api.invoiq.io/v1/webhooks/email-inbound` für das
   Event `email.received` einrichten.
3. Das angezeigte Signing Secret (`whsec_…`) in Railway als
   `RESEND_WEBHOOK_SECRET` setzen.

Jeder Mandant hat automatisch die Adresse `[slug]@rechnungen.invoiq.io`
(sichtbar auf dem Dashboard und in den Einstellungen). Eingehende
XRechnung-/ZUGFeRD-Anhänge landen geparst im **Eingang**, PDFs ohne XML im
Status „Prüfung"; der Absender wird als Lieferant angelegt.

## Stack
Node.js 22 · Fastify · React 18 · Vite · PostgreSQL (Supabase) · AWS S3 Frankfurt
