-- 011: FI Stufe 1 — Buchungsjournal (doppelte Buchführung) + Kostenstellen
--
-- GoBD: Journal-Einträge sind unveränderlich. Die API bietet kein Update/
-- Delete — Korrekturen erfolgen ausschließlich per Stornobuchung (source_type
-- 'storno'). RLS deny-all wie bei allen Tabellen: Zugriff nur über die
-- Service-Role, Mandantentrennung (org_id) erzwingt die Anwendungsschicht.

create table if not exists fi_cost_centers (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id),
  code       text not null,
  name       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, code)
);

create table if not exists fi_journal_entries (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id),
  entry_no      integer not null,
  entry_date    date not null,
  description   text,
  doc_ref       text,
  source_type   text,             -- invoice_outbound | invoice_inbound | manual | storno
  source_id     uuid,             -- z.B. invoices.id (Idempotenz der Auto-Kontierung)
  storno_of     uuid references fi_journal_entries(id),
  account_frame text not null default 'skr03',
  created_by    uuid,
  created_at    timestamptz not null default now(),
  unique (org_id, entry_no)
);

create table if not exists fi_journal_lines (
  id             uuid primary key default gen_random_uuid(),
  entry_id       uuid not null references fi_journal_entries(id) on delete cascade,
  org_id         uuid not null references organizations(id),
  line_no        integer not null,
  account        text not null,
  contra_account text,
  debit          numeric(14,2) not null default 0,
  credit         numeric(14,2) not null default 0,
  tax_code       text,
  cost_center_id uuid references fi_cost_centers(id),
  label          text,
  check (debit >= 0 and credit >= 0),
  check (not (debit > 0 and credit > 0))
);

create index if not exists idx_fi_entries_org_date on fi_journal_entries (org_id, entry_date);
create index if not exists idx_fi_entries_source   on fi_journal_entries (org_id, source_type, source_id);
create index if not exists idx_fi_lines_org_acct   on fi_journal_lines (org_id, account);
create index if not exists idx_fi_lines_entry      on fi_journal_lines (entry_id);

alter table fi_cost_centers    enable row level security;
alter table fi_journal_entries enable row level security;
alter table fi_journal_lines   enable row level security;
