-- 013: ERP-Modul-Grundstruktur (SAP-nah)
-- MM Materialwirtschaft · PP Produktion · CO Controlling · HCM Personal ·
-- CRM · PM Projekte · QM Qualität · DMS Dokumente
-- Konventionen: org_id-Pflicht, RLS deny-all (Zugriff nur via Service-Role,
-- Tenancy in der App-Schicht), paid_at-Nachtrag aus Teil 3.

alter table invoices add column if not exists paid_at timestamptz;

-- ── MM — Materialwirtschaft ──────────────────────────────────
create table if not exists mm_materials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  material_number text,
  name text not null,
  description text,
  unit text default 'ST',
  purchase_price numeric(12,2) default 0,
  sales_price numeric(12,2) default 0,
  stock_qty numeric(12,2) not null default 0,
  min_stock numeric(12,2) default 0,
  location text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, material_number)
);

create table if not exists mm_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  order_number text not null,
  supplier_name text not null,
  status text not null default 'entwurf',  -- entwurf|bestellt|teilgeliefert|geliefert|storniert
  order_date date default current_date,
  expected_date date,
  total_net numeric(12,2) default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (org_id, order_number)
);

create table if not exists mm_purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  po_id uuid not null references mm_purchase_orders(id) on delete cascade,
  material_id uuid references mm_materials(id),
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  received_qty numeric(12,2) not null default 0
);

create table if not exists mm_stock_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  material_id uuid not null references mm_materials(id),
  movement_type text not null,             -- eingang|ausgang|inventur
  quantity numeric(12,2) not null,
  reference text,
  note text,
  moved_at timestamptz not null default now(),
  created_by uuid
);

-- ── PP — Produktionsplanung ──────────────────────────────────
create table if not exists pp_boms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null,
  material_id uuid references mm_materials(id),   -- Endprodukt
  version integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists pp_bom_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  bom_id uuid not null references pp_boms(id) on delete cascade,
  material_id uuid references mm_materials(id),
  description text not null,
  quantity numeric(12,3) not null default 1,
  unit text default 'ST'
);

create table if not exists pp_production_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  order_number text not null,
  bom_id uuid references pp_boms(id),
  description text,
  quantity numeric(12,2) not null default 1,
  status text not null default 'geplant',  -- geplant|freigegeben|in_arbeit|fertig|storniert
  workcenter text,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  unique (org_id, order_number)
);

-- ── CO — Controlling (fi_cost_centers existiert aus 011) ─────
create table if not exists co_cost_objects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  code text not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, code)
);

create table if not exists co_budgets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  cost_center_id uuid not null references fi_cost_centers(id),
  year integer not null,
  amount numeric(14,2) not null default 0,
  note text,
  unique (org_id, cost_center_id, year)
);

create table if not exists co_allocations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  from_cost_center_id uuid not null references fi_cost_centers(id),
  to_cost_center_id uuid not null references fi_cost_centers(id),
  amount numeric(14,2) not null,
  period text,                              -- z.B. 2026-07
  note text,
  created_at timestamptz not null default now()
);

-- ── HCM — Personal ───────────────────────────────────────────
create table if not exists hcm_departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null,
  parent_id uuid references hcm_departments(id),
  head_name text,
  created_at timestamptz not null default now()
);

create table if not exists hcm_employees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  employee_number text,
  first_name text not null,
  last_name text not null,
  email text,
  department_id uuid references hcm_departments(id),
  position text,
  hire_date date,
  salary numeric(12,2),                     -- Brutto-Monatsgehalt (LODAS-Basis)
  weekly_hours numeric(5,2) default 40,
  vacation_days integer default 30,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, employee_number)
);

create table if not exists hcm_leave_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  employee_id uuid not null references hcm_employees(id),
  leave_type text not null default 'urlaub',  -- urlaub|krank|sonderurlaub
  from_date date not null,
  to_date date not null,
  days numeric(4,1) not null,
  status text not null default 'beantragt',   -- beantragt|genehmigt|abgelehnt
  note text,
  created_at timestamptz not null default now()
);

create table if not exists hcm_payroll_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  period text not null,                     -- YYYY-MM
  status text not null default 'entwurf',   -- entwurf|abgerechnet
  total_gross numeric(14,2) default 0,
  employee_count integer default 0,
  lodas_exported_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, period)
);

-- ── CRM ──────────────────────────────────────────────────────
create table if not exists crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  customer_id uuid references customers(id),
  name text not null,
  stage text not null default 'lead',       -- lead|qualifiziert|angebot|verhandlung|gewonnen|verloren
  value numeric(14,2) default 0,
  probability integer default 20,
  expected_close date,
  owner text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists crm_activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  customer_id uuid references customers(id),
  opportunity_id uuid references crm_opportunities(id),
  activity_type text not null default 'notiz', -- anruf|email|termin|notiz
  subject text not null,
  content text,
  activity_date timestamptz not null default now(),
  created_by uuid
);

-- ── PM — Projekte ────────────────────────────────────────────
create table if not exists pm_projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  project_number text,
  name text not null,
  customer_id uuid references customers(id),
  cost_center_id uuid references fi_cost_centers(id),
  status text not null default 'geplant',   -- geplant|aktiv|pausiert|abgeschlossen
  budget numeric(14,2) default 0,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  unique (org_id, project_number)
);

create table if not exists pm_milestones (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  project_id uuid not null references pm_projects(id) on delete cascade,
  name text not null,
  due_date date,
  status text not null default 'offen',     -- offen|erledigt
  created_at timestamptz not null default now()
);

create table if not exists pm_time_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  project_id uuid not null references pm_projects(id),
  employee_id uuid references hcm_employees(id),
  entry_date date not null default current_date,
  hours numeric(5,2) not null,
  description text,
  billable boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- ── QM — Qualität ────────────────────────────────────────────
create table if not exists qm_inspection_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null,
  material_id uuid references mm_materials(id),
  criteria text,                            -- Prüfkriterien (Freitext/Checkliste)
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists qm_complaints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  complaint_number text,
  source text not null default 'kunde',     -- kunde|lieferant|intern
  reference text,
  description text not null,
  severity text default 'mittel',           -- niedrig|mittel|hoch|kritisch
  status text not null default 'offen',     -- offen|in_bearbeitung|geschlossen
  resolution text,
  created_at timestamptz not null default now(),
  unique (org_id, complaint_number)
);

-- ── DMS — Dokumente ──────────────────────────────────────────
create table if not exists dms_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  title text not null,
  category text default 'allgemein',        -- vertrag|rechnung|personal|technik|allgemein
  filename text,
  mime_type text,
  size_bytes integer default 0,
  content_data text,                        -- Data-URL ≤ 2 MB (Stufe 1; S3 = Roadmap)
  version integer not null default 1,
  parent_document_id uuid references dms_documents(id),
  tags text,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);

-- RLS deny-all auf alle neuen Tabellen
alter table mm_materials           enable row level security;
alter table mm_purchase_orders     enable row level security;
alter table mm_purchase_order_items enable row level security;
alter table mm_stock_movements     enable row level security;
alter table pp_boms                enable row level security;
alter table pp_bom_items           enable row level security;
alter table pp_production_orders   enable row level security;
alter table co_cost_objects        enable row level security;
alter table co_budgets             enable row level security;
alter table co_allocations         enable row level security;
alter table hcm_departments        enable row level security;
alter table hcm_employees          enable row level security;
alter table hcm_leave_requests     enable row level security;
alter table hcm_payroll_runs       enable row level security;
alter table crm_opportunities      enable row level security;
alter table crm_activities         enable row level security;
alter table pm_projects            enable row level security;
alter table pm_milestones          enable row level security;
alter table pm_time_entries        enable row level security;
alter table qm_inspection_plans    enable row level security;
alter table qm_complaints          enable row level security;
alter table dms_documents          enable row level security;
