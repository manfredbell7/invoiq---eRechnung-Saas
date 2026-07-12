-- 012: Firmenstammdaten für professionelle Rechnungs-PDFs
-- Einmal pflegbar in den Einstellungen; das PDF-Layout (Briefkopf, Zahlungs-
-- block, Fußzeile) bedient sich hier. Logo als Data-URL (max ~300 KB, wird
-- in der API begrenzt) — bewusst in der DB statt S3: ein Logo pro Mandant,
-- winzig, und der Renderer braucht es synchron.

alter table organizations add column if not exists bic               text;
alter table organizations add column if not exists bank_name         text;
alter table organizations add column if not exists tax_number        text;   -- Steuernummer (Finanzamt)
alter table organizations add column if not exists register_number   text;   -- z.B. HRB 12345
alter table organizations add column if not exists register_court    text;   -- z.B. Amtsgericht Saarbrücken
alter table organizations add column if not exists managing_director text;   -- Geschäftsführer
alter table organizations add column if not exists logo_data         text;   -- Data-URL (image/png|jpeg)
alter table organizations add column if not exists brand_color       text default '#635BFF';
alter table organizations add column if not exists email             text;
alter table organizations add column if not exists website           text;

-- Farbe kann je Rechnung überschrieben werden
alter table invoices add column if not exists brand_color text;
-- Referenzen für Korrektur-/Stornorechnungen (Teil 3 des Ausbaus)
alter table invoices add column if not exists related_invoice_id uuid references invoices(id);
alter table invoices add column if not exists invoice_kind text default 'standard'; -- standard | correction | cancellation
