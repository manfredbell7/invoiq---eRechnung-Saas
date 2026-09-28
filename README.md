# invoiq — E-Rechnung SaaS

> E-Rechnung für jedes System. XRechnung · ZUGFeRD · Peppol — in 48 Stunden live.

🌐 **Website:** invoiq.de

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

## Preismodell

Free (0 €, 10 Rechnungen/Monat) · Basis 15 € · Plus 23 € · Premium 30 € — jeweils
zzgl. USt., jährlich 12/19/25 €. Interne Plan-Keys bleiben `starter`/`business`/
`enterprise` (Stripe, DB, Checkout). **Nach dem Deploy im Stripe-Dashboard neue
Preise (15/23/30 € bzw. Jahrespreise) anlegen und die `STRIPE_PRICE_*`-Variablen
in Railway auf die neuen Price-IDs umstellen — sonst zahlt der Checkout die alten
Beträge (29/99/299 €), während die Website die neuen bewirbt.**

## Rechnungsdesign & Pflichtfelder

Einstellungen → Unternehmen: Rechnungsdesign (Klassisch/Modern/Kompakt, Migration
014), Logo + Markenfarbe, Leitweg-ID (BT-10) und Standard-Zahlungsziel. Beides
wird automatisch in neue Rechnungen übernommen (Fälligkeit = Rechnungsdatum +
Zahlungsziel; Leitweg-ID als BuyerReference, wenn keine Referenz gesetzt ist) und
vor dem Generieren gegen EN 16931 geprüft. Design pro Rechnung übersteuerbar.

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

Alle Einträge werden bei Hostinger unter **Domains → invoiq.de → DNS / Nameserver**
gepflegt. Die mit `<…>` markierten Werte sind kontospezifisch und stehen im
Resend-Dashboard unter [resend.com/domains](https://resend.com/domains) nach dem
Anlegen der jeweiligen Domain — die Werte dort sind maßgeblich.

### 1. Versand (Outbound) — Domain `invoiq.de` bei Resend anlegen

| Typ | Name/Host | Wert | Priorität | Zweck |
|---|---|---|---|---|
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — | SPF |
| MX | `send` | `feedback-smtp.<region>.amazonses.com` | 10 | Bounce-Feedback |
| TXT | `resend._domainkey` | `p=<DKIM-Public-Key aus dem Resend-Dashboard>` | — | DKIM |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | — | DMARC (Empfehlung) |

Absenderadresse ist `EMAIL_FROM` (Default `rechnungen@invoiq.de`). Solange die
Domain nicht verifiziert ist, lehnt Resend jeden Versand ab — die App zeigt dann
eine klare Fehlermeldung, und der Status ist in **Einstellungen → Unternehmen →
E-Mail-Domain-Status** (grün/rot) sichtbar.

### 2. Kunden-Adressen `[slug]@rechnungen.invoiq.de` — Empfang UND Versand

Die Domain `rechnungen.invoiq.de` bei Resend anlegen. Sie trägt beides: den
Empfang (MX) und den persönlichen Versand jedes Mandanten (SPF/DKIM). Solange
sie nicht versand-verifiziert ist, fällt der Versand automatisch auf
`rechnungen@invoiq.de` zurück — mit der persönlichen Adresse als Reply-To.

| Typ | Name/Host | Wert | Priorität | Zweck |
|---|---|---|---|---|
| MX | `rechnungen` | `<Inbound-MX-Host aus dem Resend-Dashboard>` | 10 | Mailzustellung an Resend |
| TXT | `send.rechnungen` | `v=spf1 include:amazonses.com ~all` | — | SPF (Versand) |
| MX | `send.rechnungen` | `feedback-smtp.<region>.amazonses.com` | 10 | Bounce-Feedback |
| TXT | `resend._domainkey.rechnungen` | `p=<DKIM-Key aus dem Resend-Dashboard>` | — | DKIM (Versand) |

Danach in Resend:
1. **Inbound-Route** als Catch-all `*@rechnungen.invoiq.de` anlegen.
2. **Webhook** auf `https://api.invoiq.de/v1/webhooks/email-inbound` für das
   Event `email.received` einrichten.
3. Das angezeigte Signing Secret (`whsec_…`) in Railway als
   `RESEND_WEBHOOK_SECRET` setzen.

Jeder Mandant hat automatisch die Adresse `[slug]@rechnungen.invoiq.de`
(sichtbar auf dem Dashboard und in den Einstellungen). Eingehende
XRechnung-/ZUGFeRD-Anhänge landen geparst im **Eingang**, PDFs ohne XML im
Status „Prüfung"; der Absender wird als Lieferant angelegt.

## Stack
Node.js 22 · Fastify · React 18 · Vite · PostgreSQL (Supabase) · AWS S3 Frankfurt
