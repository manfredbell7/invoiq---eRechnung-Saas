# invoiq — Architektur-Analyse & ERP-Roadmap

Stand: 2026-07-11 · Zielbild: cloud-native, KI-gesteuerte ERP/ECC-Plattform (SAP-ECC-nah, EU-konform)

## 1. Bestandsaufnahme (Ist-Architektur)

```
frontend/  React 18 + Vite (Single-File-App src/App.jsx + theme.js Designsystem)
backend/   Node 22 + Fastify 5, ESM
  config/    database.js (Supabase Service-Role), db.js (Query-Schicht, org_id-Pflicht), jwt.js
  lib/       rateLimiter (Redis/In-Memory), mailgunAuth (HMAC + Replay-Schutz)
  services/  xmlEngine (EN 16931: XRechnung UBL, ZUGFeRD/Factur-X CII, Parser)
             taxEngine (Steuerkennzeichen S19/S7/E0/RC/IG, Gruppenrundung, Plausibilität)
             documentFlow (Belegkette Anfrage→Angebot→Auftrag→Lieferung→Rechnung)
             archiveService (GoBD, S3 Frankfurt, SHA-256-Hashkette)
             pdfRenderer (3 Templates), sepaService (pain.001), peppolService/peppolSoft,
             idocService (SAP-IDoc INVOIC02), deliveryService, email (Resend), connectorService
  routes/    auth (JWT, Reset, API-Key), invoices (CRUD, Stats, Cashflow, DATEV-Export),
             inbound (Mailgun-Webhook, Review-Queue), business (Belege+Konvertierung),
             customers, scanner (Claude-Vision-Extraktion), payments (Stripe),
             peppol, idoc, webhooks, archive, admin
  migrations/ 001–010 (angewendet auf Supabase eu-central-1, RLS deny-all + Service-Role)
Deploy:    Vercel (Frontend, invoiq.io) · Railway (Backend, api.invoiq.io) · Supabase (DB)
```

**Stärken:** Mandantentrennung konsequent in der App-Schicht; Belegfluss mit
Statusmaschine und Partner-Snapshots (SAP-Prinzip); Steuer-Engine deterministisch
und getestet; GoBD-Archiv mit Hashkette; DATEV-CSV-Export und SAP-IDoc vorhanden.

**Lücken zum ERP-Zielbild:** kein Kontenplan/FI, keine Lagerbestände, kein
Bestellwesen (MM-Einkauf), kein Controlling, kein HR/PP; KI bisher nur als
Beleg-Scanner; E-Rechnung ohne CII-XRechnung/Peppol-BIS-Profiltrennung und ohne
Hybrid-PDF; keine echte Preisfindung/Konditionen; Banking nur SEPA-Export.

## 2. Zielarchitektur (KI-gesteuertes ERP)

```
                        ┌────────────────────────────────────┐
   Natural Language ───▶│  AI Core  (/v1/ai)                 │
   "Erstelle Rechnung   │  Claude Opus 4.8 · Tool-Use-Loop   │
    für Mustermann…"    │  Lese-Tools: Stats, Belege, Kunden │
                        │  Schreib-Tools: NUR als Vorschlag  │──▶ Bestätigung durch User
                        └───────────────┬────────────────────┘    (Two-Phase-Commit)
                                        ▼
        ┌── SD (vorhanden) ── Belegkette · Preisfindung* · Konditionen*
        ├── FI (Ausbau)    ── SKR03/04* · DATEV (vorhanden) · Bilanz/GuV*
        ├── MM (Ausbau)    ── Artikel (vorhanden) · Lager* · Bestellwesen*
        ├── CO/HR/PP (*)   ── Kostenstellen · LODAS · Stücklisten
        └── Compliance     ── EN 16931 Engine v2 · Peppol · GoBD · DSGVO-Audit-Trail
                             (* = Roadmap, siehe §4)
```

**Grundsätze:**
1. **KI schlägt vor, Mensch bestätigt** — jede schreibende KI-Aktion durchläuft
   einen Bestätigungsschritt; Ausführung erfolgt deterministisch über dieselben
   Code-Pfade wie die manuelle Bedienung (kein KI-Sonderweg in die DB).
2. **Deterministische Kerne, KI als Schicht darüber** — Steuern, Summen,
   Statusübergänge, XML bleiben regelbasiert und testbar; die KI erklärt,
   prüft, prognostiziert und übersetzt Sprache in strukturierte Aktionen.
3. **org_id überall** — jedes KI-Tool ist serverseitig auf die Organisation
   des angemeldeten Users gescoped; die KI kann den Scope nicht erweitern.

## 3. In dieser Ausbaustufe umgesetzt

### 3.1 AI Core — KI-Berater & Natural-Language-ERP (`/v1/ai`)
- `POST /v1/ai/chat` — Chat mit Tool-Use-Loop (Claude Opus 4.8, offizielles
  `@anthropic-ai/sdk`). Lese-Tools werden serverseitig ausgeführt
  (Kennzahlen, Rechnungen, Kunden, Artikel, Belege, Cash-Flow-Prognose,
  Steuerkatalog); Schreib-Tools (`create_invoice`, `create_document`,
  `create_customer`) werden **nicht** ausgeführt, sondern als
  `proposed_action` mit vorgerechneten Summen (taxEngine) zurückgegeben.
- `POST /v1/ai/execute-action` — führt eine zuvor vorgeschlagene Aktion nach
  User-Bestätigung deterministisch aus (validiert erneut serverseitig).
- `GET /v1/ai/insights` — deterministische Kennzahlen (offene Forderungen,
  Überfälligkeiten, 30-Tage-Cash-Flow) + KI-Kommentar mit Handlungsempfehlungen.
- `POST /v1/ai/review/:invoiceId` — KI-gestützte Belegprüfung: regelbasierte
  Checks (EN 16931, Steuerplausibilität) + KI-Einschätzung von Anomalien.
- Ohne `ANTHROPIC_API_KEY`: ehrliche 503 (kein Mock); Insights liefern dann
  nur den deterministischen Teil.

### 3.2 E-Rechnungs-Engine v2 (`services/xmlEngine.js`)
- **Profiltrennung:** XRechnung 3.0 UBL · XRechnung 3.0 CII (UN/CEFACT) ·
  Peppol BIS Billing 3.0 (eigene CustomizationID) · ZUGFeRD 2.3 EN16931 ·
  Factur-X 1.0 EN16931 (Frankreich).
- **Steuerkategorien korrekt:** UNTDID-5305-Kategorien (S/E/AE/K) aus dem
  taxEngine-Kennzeichen statt pauschal „S"; Befreiungsgründe (BT-121/BT-120)
  für E/AE/K; Reverse-Charge und innergemeinschaftliche Lieferung im XML.
- **Zahlungsdaten:** PaymentMeans mit IBAN (BT-84), Zahlungsziel, Leitweg-ID
  als BuyerReference (BT-10, XRechnung-Pflicht).
- **ZUGFeRD-Hybrid:** PDF mit eingebetteter `factur-x.xml`
  (AFRelationship=Alternative). Volle PDF/A-3-Zertifizierung (eingebettete
  Fonts, XMP-Konformitätsklausel) ist Roadmap §4.

## 4. Roadmap (nächste Ausbaustufen, priorisiert)

| # | Modul | Inhalt | Aufwand |
|---|---|---|---|
| 1 | **FI Stufe 1** | Kontenplan SKR03/SKR04 als Katalog, automatische Kontierung je Steuerkennzeichen, Buchungsjournal (append-only), erweiterter DATEV-Export (Buchungsstapel EXTF) | M |
| 2 | **Banking** | FinTS/HBCI- bzw. PSD2-Anbindung (z. B. GoCardless/Tink), automatischer Zahlungsabgleich (Matching Rechnung↔Umsatz, KI-gestützt) | M |
| 3 | **MM Stufe 1** | Lagerbestand je Artikel, Wareneingang aus Lieferung, Bestellwesen (Bestellanforderung→Bestellung→Wareneingang→Eingangsrechnung = 3-Way-Match) | L |
| 4 | **ELSTER** | UStVA-Berechnung aus Buchungsjournal, ERiC-Anbindung bzw. Export | M |
| 5 | **SD-Preisfindung** | Konditionstechnik Stufe 1: Preislisten, kundenindividuelle Preise, Staffelrabatte — Reihenfolge wie SAP-Konditionsschema | M |
| 6 | **CO Stufe 1** | Kostenstellen/Kostenträger als Kontierungsobjekte auf Belegposition, Auswertung | S |
| 7 | **PDF/A-3-Zertifizierung** | Eingebettete TTF-Fonts, XMP-Metadaten (Factur-X-Konformitätsklausel), veraPDF-Validierung in CI | S |
| 8 | **Peppol-Produktivbetrieb** | Zertifizierter Access Point (Storecove produktiv), SMP-Registrierung, MLR-Verarbeitung | M |
| 9 | **eIDAS-Signatur** | Qualifizierte Siegel via Vertrauensdienst (z. B. Bundesdruckerei/D-Trust API) für Archiv-Nachweise | M |
| 10 | **HR Basis / PP Basis** | Mitarbeiterstamm + LODAS-Export · Stücklisten + einfacher Fertigungsauftrag | L |
| 11 | **i18n** | DE/EN/FR/PL via Sprachdatei-Extraktion aus App.jsx | M |
| 12 | **Integrationen** | DATEV Unternehmen online (OAuth), Lexware, SAP RFC/BAPI-Connector (vorhandener IDoc-Kern als Basis) | L |

**Nicht verhandelbar bei jedem Ausbau:** org_id-Scoping, RLS deny-all auf neuen
Tabellen, GoBD-Unveränderbarkeit (Storno statt Löschen), Migrations-Nummerierung,
Tests für deterministische Kerne, keine Secrets im Code.
