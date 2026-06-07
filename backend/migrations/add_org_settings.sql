-- Migration: Org-Einstellungen erweitern
-- Ausführen in: Supabase SQL Editor

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS address          TEXT,
  ADD COLUMN IF NOT EXISTS city             TEXT,
  ADD COLUMN IF NOT EXISTS zip              TEXT,
  ADD COLUMN IF NOT EXISTS country          TEXT DEFAULT 'DE',
  ADD COLUMN IF NOT EXISTS phone            TEXT,
  ADD COLUMN IF NOT EXISTS bic              TEXT,
  ADD COLUMN IF NOT EXISTS default_format   TEXT DEFAULT 'xrechnung',
  ADD COLUMN IF NOT EXISTS default_delivery TEXT DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS auto_archive     BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS en16931_strict   BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS peppol_enabled   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vida_reporting   BOOLEAN DEFAULT false;

-- Demo-Daten löschen (ALLE Dokumente — demo@invoiq.io User bleibt)
-- Erst alle Dokumente der Demo-Org finden und löschen
DO $$
DECLARE
  demo_org_id UUID;
BEGIN
  -- Demo User finden
  SELECT org_id INTO demo_org_id
  FROM users WHERE email = 'demo@invoiq.io' LIMIT 1;

  IF demo_org_id IS NOT NULL THEN
    DELETE FROM inbound_invoices WHERE org_id = demo_org_id;
    DELETE FROM archive_entries   WHERE org_id = demo_org_id;
    DELETE FROM audit_logs        WHERE org_id = demo_org_id;
    DELETE FROM invoices          WHERE org_id = demo_org_id;
    RAISE NOTICE 'Demo-Daten gelöscht für org_id: %', demo_org_id;
  ELSE
    RAISE NOTICE 'Kein demo@invoiq.io User gefunden';
  END IF;
END $$;

-- Mailgun Route für Foto-Scanner
-- In Mailgun: neue Route anlegen
-- Expression: match_recipient("scanner@invoiq.io")
-- Action: forward("https://api.invoiq.io/v1/scanner/from-email")
-- (Hinweis: nur als Kommentar, kein SQL)
