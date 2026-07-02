-- Migration 005: Fehlende Spalten & Tabellen, die der Code bereits verwendet
-- Ausführen in: Supabase SQL Editor
--
-- Hintergrund (Audit Juli 2026):
-- 1. auth/settings erlaubt "iban", die Spalte fehlte aber → Speichern mit
--    IBAN schlug mit Supabase-Fehler fehl.
-- 2. Die KI-Review-Strecke (routes/inbound: PATCH /:id, POST /:id/review,
--    GET /quality-stats) nutzt Felder auf inbound_invoices und eine
--    vendors-Tabelle, die nie angelegt wurden.
-- 3. routes/connect persistiert jetzt in erp_connections (war vorher nur
--    im base-Schema definiert, das Live-Projekte evtl. nie eingespielt haben).

-- 1) organizations: IBAN (Absender-Bankverbindung für XRechnung/SEPA)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS iban TEXT;

-- 2) inbound_invoices: KI-Review-Felder
ALTER TABLE inbound_invoices
  ADD COLUMN IF NOT EXISTS attachment_name    TEXT,
  ADD COLUMN IF NOT EXISTS confidence         DECIMAL(4,3),
  ADD COLUMN IF NOT EXISTS corrected_fields   JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS review_status      TEXT DEFAULT 'neu',  -- neu | geprueft | freigegeben | abgelehnt
  ADD COLUMN IF NOT EXISTS reviewed_by        UUID,
  ADD COLUMN IF NOT EXISTS reviewed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suggested_account  TEXT;

-- 3) vendors: gelernte Lieferanten-Defaults (Regeltraining der KI-Strecke)
CREATE TABLE IF NOT EXISTS vendors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_vat_id   TEXT NOT NULL,
  vendor_name     TEXT,
  vendor_iban     TEXT,
  default_account TEXT,
  corrections     INTEGER DEFAULT 0,
  auto_approved   INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, vendor_vat_id)
);
CREATE INDEX IF NOT EXISTS vendors_org_idx ON vendors(org_id);

-- RPC für Korrektur-Zähler (wird von routes/inbound aufgerufen)
CREATE OR REPLACE FUNCTION increment_vendor_corrections(p_org UUID, p_vat TEXT)
RETURNS void AS $$
BEGIN
  UPDATE vendors SET corrections = COALESCE(corrections,0) + 1, updated_at = now()
  WHERE org_id = p_org AND vendor_vat_id = p_vat;
END;
$$ LANGUAGE plpgsql;

-- 4) erp_connections (falls base-Schema nie eingespielt wurde)
CREATE TABLE IF NOT EXISTS erp_connections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type         VARCHAR(30) NOT NULL,
  name         VARCHAR(100),
  config       JSONB,
  active       BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS erp_connections_org_idx ON erp_connections(org_id);

-- 5) Doc-Limit-Trigger sicherstellen (zählt plan_doc_used bei Outbound-Insert)
CREATE OR REPLACE FUNCTION increment_doc_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE organizations SET plan_doc_used = COALESCE(plan_doc_used,0) + 1 WHERE id = NEW.org_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_doc_count ON invoices;
CREATE TRIGGER trg_invoice_doc_count
  AFTER INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.direction = 'outbound')
  EXECUTE FUNCTION increment_doc_usage();
