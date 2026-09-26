-- 014: Wählbares Rechnungsdesign + automatische eRechnung-Pflichtfelder
--
-- organizations.invoice_template  Standard-Vorlage des Mandanten
-- organizations.leitweg_id        Standard-Leitweg-ID (B2G, BT-10 Buyer reference)
-- organizations.default_due_days  Zahlungsziel in Tagen — wird beim Erstellen
--                                 automatisch als due_date übernommen, wenn keins gesetzt ist
-- invoices.invoice_template       Abweichende Vorlage je Rechnung (NULL = Org-Default)

alter table organizations
  add column if not exists invoice_template text not null default 'classic'
    check (invoice_template in ('classic', 'modern', 'compact')),
  add column if not exists leitweg_id text,
  add column if not exists default_due_days integer not null default 14
    check (default_due_days between 0 and 365);

alter table invoices
  add column if not exists invoice_template text
    check (invoice_template is null or invoice_template in ('classic', 'modern', 'compact'));
