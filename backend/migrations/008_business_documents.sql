-- Migration 008: SAP-naher Belegfluss (Stufe 1)
-- Ausführen in: Supabase SQL Editor
--
-- Fachmodell (angelehnt an SAP SD, angepasst an invoiq):
--   Anfrage (request) → Angebot (quote) → Auftrag (order)
--   → Lieferung (delivery) → Rechnung (bestehende invoices-Tabelle)
--
-- Designentscheidungen:
-- * EIN Belegkopf business_documents mit doc_type statt vier Tabellen —
--   alle Vorbeleg-Arten teilen Kopf-/Positionsstruktur; Belegfluss und
--   Statuslogik bleiben dadurch einheitlich.
-- * Rechnungen bleiben in invoices (XML/GoBD/Versand hängen dort) und
--   werden über invoices.source_document_id + business_document_flow
--   an die Prozesskette gekoppelt.
-- * Belege sind SNAPSHOTS: Partnerdaten werden beim Anlegen aus den
--   Stammdaten (customers) kopiert — spätere Stammdatenänderungen
--   verändern keine bestehenden Belege (SAP-Prinzip).
-- * Steuerkennzeichen (S19/S7/E0/RC/IG) sind ein Code-Katalog in
--   services/taxEngine.js — deterministisch und unit-testbar.

-- ── ARTIKEL / LEISTUNGEN (Stammdaten) ─────────────────────────
CREATE TABLE IF NOT EXISTS business_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item_number  TEXT,                         -- eigene Artikelnummer (optional)
  name         TEXT NOT NULL,
  description  TEXT,
  unit         TEXT DEFAULT 'C62',           -- UN/ECE Rec 20 (C62 = Stück, HUR = Stunde)
  unit_price   NUMERIC(15,4) DEFAULT 0,
  currency     TEXT DEFAULT 'EUR',
  tax_code     TEXT DEFAULT 'S19',           -- S19 | S7 | E0 | RC | IG (taxEngine)
  external_ref TEXT,                         -- Artikel-Nr. im ERP (SAP MATNR, ...)
  active       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_items_org_idx ON business_items(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS business_items_org_name_unique ON business_items(org_id, LOWER(name));

-- ── BELEGKÖPFE (Anfrage/Angebot/Auftrag/Lieferung) ────────────
CREATE TABLE IF NOT EXISTS business_documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  doc_type           TEXT NOT NULL CHECK (doc_type IN ('request','quote','order','delivery')),
  doc_number         TEXT NOT NULL,          -- ANF-2026-0001 / ANG- / AUF- / LIE-
  status             TEXT NOT NULL DEFAULT 'offen',
  -- request:  offen | beantwortet | abgelehnt | storniert
  -- quote:    entwurf | gesendet | angenommen | abgelehnt | abgelaufen | storniert
  -- order:    offen | bestaetigt | geliefert | fakturiert | storniert
  -- delivery: offen | geliefert | fakturiert | storniert

  -- Partner (Snapshot aus customers)
  partner_id         UUID REFERENCES customers(id),
  partner_name       TEXT,
  partner_vat_id     TEXT,
  partner_email      TEXT,
  partner_address    TEXT,
  partner_zip        TEXT,
  partner_city       TEXT,
  partner_country    TEXT DEFAULT 'DE',

  doc_date           DATE DEFAULT CURRENT_DATE,
  valid_until        DATE,                   -- Angebotsbindefrist
  delivery_date      DATE,                   -- (Wunsch-)Liefertermin
  currency           TEXT DEFAULT 'EUR',
  payment_terms_days INTEGER,

  amount_net         NUMERIC(15,2) DEFAULT 0,
  amount_tax         NUMERIC(15,2) DEFAULT 0,
  amount_gross       NUMERIC(15,2) DEFAULT 0,
  tax_breakdown      JSONB DEFAULT '[]',     -- Summen je Steuerkennzeichen (taxEngine)

  reference          TEXT,                   -- Kundenreferenz / Bestellnummer
  notes              TEXT,
  source_document_id UUID REFERENCES business_documents(id), -- Referenzbeleg
  invoice_id         UUID,                   -- gesetzt sobald fakturiert

  created_by         UUID,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, doc_type, doc_number)
);
CREATE INDEX IF NOT EXISTS business_documents_org_type_idx ON business_documents(org_id, doc_type);
CREATE INDEX IF NOT EXISTS business_documents_source_idx ON business_documents(source_document_id);

-- ── BELEGPOSITIONEN ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_document_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id  UUID NOT NULL REFERENCES business_documents(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL DEFAULT 1,   -- 10er-Schritte wie in SAP wären auch ok — Stufe 1: 1,2,3
  item_id      UUID REFERENCES business_items(id),  -- Stammdaten-Referenz (Herkunft)
  description  TEXT NOT NULL,
  quantity     NUMERIC(12,3) DEFAULT 1,
  unit         TEXT DEFAULT 'C62',
  unit_price   NUMERIC(15,4) DEFAULT 0,
  tax_code     TEXT DEFAULT 'S19',
  net_amount   NUMERIC(15,2) DEFAULT 0,
  tax_amount   NUMERIC(15,2) DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_document_items_doc_idx ON business_document_items(document_id);

-- ── BELEGFLUSS (Document Flow) ────────────────────────────────
-- Jede Verknüpfung Quelle→Ziel wird als Kante dokumentiert. target_type
-- 'invoice' referenziert die invoices-Tabelle.
CREATE TABLE IF NOT EXISTS business_document_flow (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id   UUID NOT NULL,
  source_type TEXT NOT NULL,   -- request | quote | order | delivery
  target_id   UUID NOT NULL,
  target_type TEXT NOT NULL,   -- quote | order | delivery | invoice
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_document_flow_src_idx ON business_document_flow(org_id, source_id);
CREATE INDEX IF NOT EXISTS business_document_flow_tgt_idx ON business_document_flow(org_id, target_id);

-- ── RECHNUNG ↔ URSPRUNGSBELEG ─────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS source_document_id UUID;
CREATE INDEX IF NOT EXISTS invoices_source_doc_idx ON invoices(source_document_id);
