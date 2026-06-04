-- ================================================================
-- invoiq — PostgreSQL Schema
-- Multi-tenant, GoBD-compliant, EN 16931
-- ================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ORGANIZATIONS (Mandanten) ──────────────────────────────────
CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(100) UNIQUE NOT NULL,
  vat_id          VARCHAR(50),
  address_street  VARCHAR(255),
  address_city    VARCHAR(100),
  address_zip     VARCHAR(20),
  address_country VARCHAR(2) DEFAULT 'DE',
  erp_system      VARCHAR(50),           -- 'sap_s4', 'sap_ecc', 'datev', 'lexware', 'dynamics', 'api'
  plan            VARCHAR(20) DEFAULT 'starter', -- starter | business | pro | enterprise
  plan_doc_limit  INTEGER DEFAULT 100,
  plan_doc_used   INTEGER DEFAULT 0,
  stripe_customer_id  VARCHAR(100),
  stripe_subscription_id VARCHAR(100),
  is_white_label  BOOLEAN DEFAULT FALSE,
  white_label_brand JSONB,              -- {name, logo_url, primary_color, domain}
  api_key         VARCHAR(64) UNIQUE,
  api_key_created_at TIMESTAMPTZ,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── USERS ─────────────────────────────────────────────────────
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255),
  full_name       VARCHAR(255),
  role            VARCHAR(20) DEFAULT 'member',  -- owner | admin | member | viewer
  avatar_url      VARCHAR(500),
  email_verified  BOOLEAN DEFAULT FALSE,
  last_login_at   TIMESTAMPTZ,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── REFRESH TOKENS ────────────────────────────────────────────
CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── INVOICES ──────────────────────────────────────────────────
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number  VARCHAR(100) NOT NULL,
  direction       VARCHAR(10) NOT NULL CHECK (direction IN ('outbound','inbound')),
  status          VARCHAR(20) DEFAULT 'draft',
  -- draft | validated | sent | delivered | acknowledged | rejected | archived | error

  -- Seller
  seller_name     VARCHAR(255),
  seller_vat_id   VARCHAR(50),
  seller_address  VARCHAR(255),
  seller_city     VARCHAR(100),
  seller_country  VARCHAR(2) DEFAULT 'DE',
  seller_iban     VARCHAR(50),

  -- Buyer
  buyer_name      VARCHAR(255),
  buyer_vat_id    VARCHAR(50),
  buyer_address   VARCHAR(255),
  buyer_city      VARCHAR(100),
  buyer_country   VARCHAR(2) DEFAULT 'DE',
  buyer_email     VARCHAR(255),
  buyer_peppol_id VARCHAR(100),

  -- Amounts
  amount_net      NUMERIC(15,2) DEFAULT 0,
  amount_vat      NUMERIC(15,2) DEFAULT 0,
  amount_gross    NUMERIC(15,2) DEFAULT 0,
  currency        VARCHAR(3) DEFAULT 'EUR',

  -- Dates
  invoice_date    DATE NOT NULL,
  due_date        DATE,
  delivery_date   DATE,

  -- Format & Delivery
  format          VARCHAR(30) DEFAULT 'xrechnung',
  -- xrechnung | zugferd | peppol | facturx | zatca | gstin
  delivery_method VARCHAR(20) DEFAULT 'email',
  -- email | peppol | sftp | api | manual

  -- Metadata
  line_items      JSONB DEFAULT '[]',
  notes           TEXT,
  payment_terms   VARCHAR(255),
  reference       VARCHAR(255),

  -- Processing
  xml_content     TEXT,                 -- Generated XML
  xml_hash        VARCHAR(64),          -- SHA-256 for GoBD integrity
  validation_result JSONB,             -- EN 16931 validation output
  validation_passed BOOLEAN,
  peppol_document_id VARCHAR(255),
  delivery_attempts INTEGER DEFAULT 0,
  last_error      TEXT,

  -- Archive
  archived        BOOLEAN DEFAULT FALSE,
  archived_at     TIMESTAMPTZ,
  archive_path    VARCHAR(500),         -- S3 path
  archive_hash    VARCHAR(64),

  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── INVOICE LINE ITEMS (denormalized in JSONB + normalized) ───
-- JSONB in invoices.line_items for performance
-- Structure: [{id, description, quantity, unit_price, vat_rate, net_amount}]

-- ── AUDIT LOG (GoBD: unveränderlich) ──────────────────────────
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID REFERENCES organizations(id),
  user_id     UUID REFERENCES users(id),
  invoice_id  UUID REFERENCES invoices(id),
  action      VARCHAR(50) NOT NULL,
  -- created | validated | sent | delivered | rejected | archived | viewed | exported
  details     JSONB,
  ip_address  INET,
  user_agent  VARCHAR(500),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
-- NOTE: No UPDATE/DELETE on audit_logs — enforced via policy

-- ── ARCHIVE RECORDS (GoBD: 10 Jahre) ─────────────────────────
CREATE TABLE archive_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id      UUID REFERENCES invoices(id),
  s3_key          VARCHAR(500) NOT NULL,
  s3_bucket       VARCHAR(100) NOT NULL,
  file_hash       VARCHAR(64) NOT NULL,   -- SHA-256
  file_size       INTEGER,
  content_type    VARCHAR(50),
  retention_until DATE NOT NULL,          -- created_at + 10 years (§147 AO)
  immutable       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── WEBHOOKS ──────────────────────────────────────────────────
CREATE TABLE webhooks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  url         VARCHAR(500) NOT NULL,
  secret      VARCHAR(64) NOT NULL,
  events      TEXT[] DEFAULT ARRAY['invoice.created','invoice.sent','invoice.delivered','invoice.rejected'],
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id  UUID REFERENCES webhooks(id) ON DELETE CASCADE,
  event       VARCHAR(50),
  payload     JSONB,
  response_status INTEGER,
  response_body TEXT,
  delivered   BOOLEAN DEFAULT FALSE,
  attempts    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── ERP CONNECTIONS ───────────────────────────────────────────
CREATE TABLE erp_connections (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  type        VARCHAR(30) NOT NULL,  -- sap_s4 | sap_ecc | datev | lexware | dynamics | sftp | rest
  name        VARCHAR(100),
  config      JSONB,                 -- Encrypted connection params
  active      BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ───────────────────────────────────────────────────
CREATE INDEX idx_invoices_org_id      ON invoices(org_id);
CREATE INDEX idx_invoices_status      ON invoices(status);
CREATE INDEX idx_invoices_direction   ON invoices(direction);
CREATE INDEX idx_invoices_created_at  ON invoices(created_at DESC);
CREATE INDEX idx_invoices_number      ON invoices(org_id, invoice_number);
CREATE INDEX idx_audit_logs_org_id    ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_invoice   ON audit_logs(invoice_id);
CREATE INDEX idx_users_email          ON users(email);
CREATE INDEX idx_users_org            ON users(org_id);
CREATE INDEX idx_refresh_tokens_user  ON refresh_tokens(user_id);

-- ── ROW LEVEL SECURITY (Multi-Tenant) ─────────────────────────
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive_records ENABLE ROW LEVEL SECURITY;

-- ── TRIGGERS ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── DOC LIMIT TRIGGER ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_doc_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE organizations
  SET plan_doc_used = plan_doc_used + 1
  WHERE id = NEW.org_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoice_doc_count
  AFTER INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.direction = 'outbound')
  EXECUTE FUNCTION increment_doc_usage();

-- ── INBOUND INVOICES ─────────────────────────────────────────────
-- Eingehende Rechnungen über E-Mail-Eingang (rechnungen-[slug]@invoiq.io)
CREATE TABLE IF NOT EXISTS inbound_invoices (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sender_email       TEXT,
  sender_name        TEXT,
  subject            TEXT,
  format             TEXT DEFAULT 'unknown', -- xrechnung | zugferd | pdf_extracted | unknown
  raw_xml            TEXT,
  xml_hash           TEXT,
  rendered_pdf_url   TEXT,
  status             TEXT DEFAULT 'empfangen', -- empfangen | verarbeitet | bezahlt
  invoice_number     TEXT,
  amount             DECIMAL(12,2),
  due_date           DATE,
  seller_name        TEXT,
  seller_vat_id      TEXT,
  buyer_name         TEXT,
  validation_passed  BOOLEAN DEFAULT false,
  paid_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_invoices_org_id ON inbound_invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_inbound_invoices_status  ON inbound_invoices(status);

-- Inbound E-Mail Slug pro Organisation
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS inbound_email_slug TEXT UNIQUE;

-- Auto-generate slug on org creation (trigger)
CREATE OR REPLACE FUNCTION set_inbound_email_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.inbound_email_slug IS NULL THEN
    NEW.inbound_email_slug := LOWER(REGEXP_REPLACE(NEW.name, '[^a-z0-9]', '-', 'g')) || '-' || SUBSTR(NEW.id::TEXT, 1, 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_inbound_slug ON organizations;
CREATE TRIGGER trg_set_inbound_slug
  BEFORE INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_inbound_email_slug();
