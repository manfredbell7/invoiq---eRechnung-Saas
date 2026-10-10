-- 016: Fünf Rechnungsdesigns + XRechnung-Pflichtfelder
--
-- invoice_template: zusätzlich 'elegant' und 'bold' (Check-Constraints neu)
-- organizations.contact_name: Ansprechpartner für den Verkäufer-Kontakt
--   (BG-6, BR-DE-5) — zusammen mit phone (BT-42) und email (BT-43) Pflicht
--   in jeder XRechnung.
-- invoices.buyer_zip: PLZ des Käufers (BR-DE-9) — wurde im Formular erfasst,
--   aber bisher nie gespeichert.

alter table organizations drop constraint if exists organizations_invoice_template_check;
alter table organizations add constraint organizations_invoice_template_check
  check (invoice_template in ('classic', 'modern', 'compact', 'elegant', 'bold'));

alter table invoices drop constraint if exists invoices_invoice_template_check;
alter table invoices add constraint invoices_invoice_template_check
  check (invoice_template is null or invoice_template in ('classic', 'modern', 'compact', 'elegant', 'bold'));

alter table organizations add column if not exists contact_name text;

alter table invoices add column if not exists buyer_zip text;
