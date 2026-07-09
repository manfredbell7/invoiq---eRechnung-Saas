-- Migration 007: Kundenstammdaten (SAP-ready Stufe 1)
-- Ausführen in: Supabase SQL Editor
--
-- Geschäftspartner-Stammdaten für die Belegerstellung: Rechnungen greifen
-- auf gepflegte Kundendaten zu statt auf Freitext. Gegenstück zur bereits
-- existierenden vendors-Tabelle (Lieferanten aus dem Eingang).
-- Spätere ERP-Anbindung: external_ref nimmt die Partner-Nr. des
-- Fremdsystems auf (z.B. SAP KUNNR / DATEV-Debitorennummer).

CREATE TABLE IF NOT EXISTS customers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  vat_id         TEXT,
  address        TEXT,
  zip            TEXT,
  city           TEXT,
  country        TEXT DEFAULT 'DE',
  email          TEXT,
  peppol_id      TEXT,
  payment_terms_days INTEGER DEFAULT 30,   -- Zahlungsziel in Tagen
  default_vat_rate   DECIMAL(4,1),         -- Standard-Steuersatz (19/7/0)
  external_ref   TEXT,                      -- Partner-Nr. im ERP (SAP KUNNR, DATEV-Debitor, ...)
  notes          TEXT,
  invoice_count  INTEGER DEFAULT 0,         -- Nutzungszähler (Sortierung nach Relevanz)
  last_invoice_at TIMESTAMPTZ,
  active         BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_org_idx ON customers(org_id);
CREATE INDEX IF NOT EXISTS customers_org_name_idx ON customers(org_id, name);
-- Dublettenschutz: gleicher Name pro Org nur einmal
CREATE UNIQUE INDEX IF NOT EXISTS customers_org_name_unique ON customers(org_id, LOWER(name));
