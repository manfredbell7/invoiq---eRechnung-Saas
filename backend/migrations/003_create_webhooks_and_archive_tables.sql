-- Migration: webhooks + archive_records Tabellen
-- Ausführen in: Supabase SQL Editor
-- Hintergrund: routes/webhooks/index.js und services/archiveService.js
-- riefen db.findWebhooks/createWebhook/deleteWebhook bzw.
-- db.createArchiveRecord/findArchiveRecords auf, ohne dass die
-- zugrundeliegenden Tabellen existierten.

CREATE TABLE IF NOT EXISTS webhooks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  secret      TEXT NOT NULL,
  events      JSONB NOT NULL DEFAULT '[]'::jsonb,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhooks_org_id_idx ON webhooks(org_id);

-- GoBD-konforme Archiv-Metadaten (§147 AO, 10 Jahre Aufbewahrung).
-- Die eigentlichen Dokumente liegen in S3 — diese Tabelle hält nur
-- Referenz + Integritäts-Hash für die Prüfung.
CREATE TABLE IF NOT EXISTS archive_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id        UUID NOT NULL,
  s3_key            TEXT NOT NULL,
  s3_bucket         TEXT NOT NULL,
  file_hash         TEXT NOT NULL,
  file_size         INTEGER,
  content_type      TEXT,
  retention_until   DATE NOT NULL,
  immutable         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS archive_records_org_id_idx ON archive_records(org_id);
CREATE INDEX IF NOT EXISTS archive_records_invoice_id_idx ON archive_records(invoice_id);
