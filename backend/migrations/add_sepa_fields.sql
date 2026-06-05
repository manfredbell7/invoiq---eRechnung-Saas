-- Migration: SEPA Payment & Skonto Felder für inbound_invoices
-- Ausführen in: Supabase SQL Editor

ALTER TABLE inbound_invoices
  ADD COLUMN IF NOT EXISTS seller_iban         TEXT,
  ADD COLUMN IF NOT EXISTS seller_bic          TEXT,
  ADD COLUMN IF NOT EXISTS amount_net          DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS discount_percent    DECIMAL(5,2),   -- z.B. 2.00 für 2% Skonto
  ADD COLUMN IF NOT EXISTS discount_days       INTEGER,         -- z.B. 7 = Skonto wenn innerhalb 7 Tage bezahlt
  ADD COLUMN IF NOT EXISTS discount_amount     DECIMAL(12,2),  -- berechneter Skonto-Betrag in EUR
  ADD COLUMN IF NOT EXISTS payment_reference   TEXT,           -- Verwendungszweck
  ADD COLUMN IF NOT EXISTS sepa_generated_at   TIMESTAMPTZ;    -- wann wurde pain.001 generiert
