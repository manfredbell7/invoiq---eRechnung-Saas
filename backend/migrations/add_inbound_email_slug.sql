-- Migration: inbound_email_slug zur organizations Tabelle hinzufügen
-- Ausführen in: Supabase SQL Editor

-- 1. Spalte hinzufügen
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS inbound_email_slug TEXT UNIQUE;

-- 2. Bestehende Orgs backfüllen (slug + zufällige 6 Zeichen)
UPDATE organizations
SET inbound_email_slug = (
  regexp_replace(lower(name), '[^a-z0-9]', '-', 'g')
  || '-' ||
  substr(md5(random()::text), 1, 6)
)
WHERE inbound_email_slug IS NULL;

-- 3. Unique Index sicherstellen
CREATE UNIQUE INDEX IF NOT EXISTS organizations_inbound_email_slug_idx
  ON organizations(inbound_email_slug);
