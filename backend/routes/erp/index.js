// routes/erp/index.js — Generische CRUD-API für die ERP-Module
// (MM, PP, CO, HCM, CRM, PM, QM, DMS)
//
// Eine Registry beschreibt je Ressource Tabelle, erlaubte Felder und
// Suchfelder. Die vier generischen Endpunkte decken die Grundstruktur
// aller Module ab; fachliche Sonderlogik (Lagerbewegung, Mindestbestand,
// Soll/Ist, LODAS) hat eigene Endpunkte darunter.
//
//   GET    /v1/erp/:resource            Liste (?search, ?limit, ?offset)
//   POST   /v1/erp/:resource            Anlegen (Feld-Whitelist)
//   PATCH  /v1/erp/:resource/:id        Ändern  (Feld-Whitelist)
//   DELETE /v1/erp/:resource/:id        Deaktivieren (active=false) bzw. Löschen
//
// Tenancy: jede Query filtert org_id — wie überall im Backend.

import { authMiddleware } from '../../middleware/auth.js';
import { supabase } from '../../config/database.js';

export const ERP_RESOURCES = {
  // MM — Materialwirtschaft
  materials: {
    table: 'mm_materials',
    fields: ['material_number', 'name', 'description', 'unit', 'purchase_price', 'sales_price', 'stock_qty', 'min_stock', 'location', 'active'],
    search: ['name', 'material_number'], softDelete: true, order: 'name',
  },
  'purchase-orders': {
    table: 'mm_purchase_orders',
    fields: ['order_number', 'supplier_name', 'status', 'order_date', 'expected_date', 'total_net', 'notes'],
    search: ['order_number', 'supplier_name'], order: 'created_at.desc',
  },
  'purchase-order-items': {
    table: 'mm_purchase_order_items',
    fields: ['po_id', 'material_id', 'description', 'quantity', 'unit_price', 'received_qty'],
    parent: 'po_id',
  },
  'stock-movements': {
    table: 'mm_stock_movements',
    fields: [], // nur über den fachlichen Endpoint /mm/stock-movement beschreibbar
    search: ['reference'], order: 'moved_at.desc', readonly: true,
  },
  // PP — Produktion
  boms: {
    table: 'pp_boms',
    fields: ['name', 'material_id', 'version', 'active'],
    search: ['name'], softDelete: true, order: 'name',
  },
  'bom-items': {
    table: 'pp_bom_items',
    fields: ['bom_id', 'material_id', 'description', 'quantity', 'unit'],
    parent: 'bom_id',
  },
  'production-orders': {
    table: 'pp_production_orders',
    fields: ['order_number', 'bom_id', 'description', 'quantity', 'status', 'workcenter', 'start_date', 'end_date', 'notes'],
    search: ['order_number', 'description'], order: 'created_at.desc',
  },
  // CO — Controlling
  'cost-objects': {
    table: 'co_cost_objects',
    fields: ['code', 'name', 'active'],
    search: ['code', 'name'], softDelete: true, order: 'code',
  },
  budgets: {
    table: 'co_budgets',
    fields: ['cost_center_id', 'year', 'amount', 'note'],
    order: 'year.desc',
  },
  allocations: {
    table: 'co_allocations',
    fields: ['from_cost_center_id', 'to_cost_center_id', 'amount', 'period', 'note'],
    order: 'created_at.desc',
  },
  // HCM — Personal
  departments: {
    table: 'hcm_departments',
    fields: ['name', 'parent_id', 'head_name'],
    search: ['name'], order: 'name',
  },
  employees: {
    table: 'hcm_employees',
    fields: ['employee_number', 'first_name', 'last_name', 'email', 'department_id', 'position', 'hire_date', 'salary', 'weekly_hours', 'vacation_days', 'active'],
    search: ['first_name', 'last_name', 'employee_number'], softDelete: true, order: 'last_name',
  },
  'leave-requests': {
    table: 'hcm_leave_requests',
    fields: ['employee_id', 'leave_type', 'from_date', 'to_date', 'days', 'status', 'note'],
    order: 'from_date.desc',
  },
  'payroll-runs': {
    table: 'hcm_payroll_runs',
    fields: ['period', 'status', 'total_gross', 'employee_count'],
    order: 'period.desc',
  },
  // CRM
  opportunities: {
    table: 'crm_opportunities',
    fields: ['customer_id', 'name', 'stage', 'value', 'probability', 'expected_close', 'owner', 'notes'],
    search: ['name', 'owner'], order: 'created_at.desc',
  },
  activities: {
    table: 'crm_activities',
    fields: ['customer_id', 'opportunity_id', 'activity_type', 'subject', 'content', 'activity_date'],
    search: ['subject'], order: 'activity_date.desc',
  },
  // PM — Projekte
  projects: {
    table: 'pm_projects',
    fields: ['project_number', 'name', 'customer_id', 'cost_center_id', 'status', 'budget', 'start_date', 'end_date', 'notes'],
    search: ['name', 'project_number'], order: 'created_at.desc',
  },
  milestones: {
    table: 'pm_milestones',
    fields: ['project_id', 'name', 'due_date', 'status'],
    parent: 'project_id', order: 'due_date',
  },
  'time-entries': {
    table: 'pm_time_entries',
    fields: ['project_id', 'employee_id', 'entry_date', 'hours', 'description', 'billable'],
    parent: 'project_id', order: 'entry_date.desc',
  },
  // QM — Qualität
  'inspection-plans': {
    table: 'qm_inspection_plans',
    fields: ['name', 'material_id', 'criteria', 'active'],
    search: ['name'], softDelete: true, order: 'name',
  },
  complaints: {
    table: 'qm_complaints',
    fields: ['complaint_number', 'source', 'reference', 'description', 'severity', 'status', 'resolution'],
    search: ['complaint_number', 'description'], order: 'created_at.desc',
  },
  // DMS
  documents: {
    table: 'dms_documents',
    fields: ['title', 'category', 'filename', 'mime_type', 'size_bytes', 'content_data', 'version', 'parent_document_id', 'tags'],
    search: ['title', 'filename', 'tags'], order: 'created_at.desc',
    validate: (body) => {
      if (body.content_data && body.content_data.length > 2_800_000) {
        return 'Datei zu groß — maximal 2 MB (größere Dateien: Roadmap S3-Anbindung).';
      }
      return null;
    },
  },
};

const pick = (obj, keys) => {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
};

export async function erpRoutes(fastify) {

  const resolve = (req, reply) => {
    const def = ERP_RESOURCES[req.params.resource];
    if (!def) { reply.code(404).send({ error: `Unbekannte Ressource: ${req.params.resource}` }); return null; }
    return def;
  };

  // ── LISTE ────────────────────────────────────────────────────
  fastify.get('/:resource', { preHandler: authMiddleware }, async (req, reply) => {
    const def = resolve(req, reply); if (!def) return;
    const { search, limit = 100, offset = 0, parent } = req.query;
    const [orderCol, orderDir] = (def.order || 'created_at.desc').split('.');

    let q = supabase.from(def.table)
      .select('*', { count: 'exact' })
      .eq('org_id', req.org.id)
      .order(orderCol, { ascending: orderDir !== 'desc' })
      .range(parseInt(offset), parseInt(offset) + Math.min(parseInt(limit), 500) - 1);
    if (search && def.search?.length) {
      q = q.or(def.search.map(f => `${f}.ilike.%${search.replace(/[%,()]/g, '')}%`).join(','));
    }
    if (parent && def.parent) q = q.eq(def.parent, parent);
    const { data, count, error } = await q;
    if (error) throw new Error(`[erp/${req.params.resource}] ${error.message}`);
    // DMS: Dateiinhalt nicht in Listen mitschicken (Payload-Größe)
    const rows = def.table === 'dms_documents'
      ? (data || []).map(({ content_data, ...r }) => ({ ...r, has_file: !!content_data }))
      : (data || []);
    return { items: rows, total: count || 0 };
  });

  // ── ANLEGEN ──────────────────────────────────────────────────
  fastify.post('/:resource', { preHandler: authMiddleware }, async (req, reply) => {
    const def = resolve(req, reply); if (!def) return;
    if (def.readonly) return reply.code(405).send({ error: 'Diese Ressource wird über fachliche Endpunkte gepflegt.' });
    const body = pick(req.body || {}, def.fields);
    if (!Object.keys(body).length) return reply.code(400).send({ error: 'Keine gültigen Felder übergeben.' });
    const vErr = def.validate?.(body);
    if (vErr) return reply.code(400).send({ error: vErr });

    const { data, error } = await supabase.from(def.table)
      .insert({ ...body, org_id: req.org.id })
      .select().single();
    if (error) {
      if (error.code === '23505') return reply.code(409).send({ error: 'Eintrag mit dieser Nummer/diesem Code existiert bereits.' });
      if (error.code === '23503') return reply.code(400).send({ error: 'Referenzierter Datensatz nicht gefunden.' });
      throw new Error(`[erp/${req.params.resource}] ${error.message}`);
    }
    return reply.code(201).send(data);
  });

  // ── ÄNDERN ───────────────────────────────────────────────────
  fastify.patch('/:resource/:id', { preHandler: authMiddleware }, async (req, reply) => {
    const def = resolve(req, reply); if (!def) return;
    if (def.readonly) return reply.code(405).send({ error: 'Diese Ressource wird über fachliche Endpunkte gepflegt.' });
    const body = pick(req.body || {}, def.fields);
    if (!Object.keys(body).length) return reply.code(400).send({ error: 'Keine gültigen Felder übergeben.' });
    const vErr = def.validate?.(body);
    if (vErr) return reply.code(400).send({ error: vErr });

    const { data, error } = await supabase.from(def.table)
      .update(body).eq('id', req.params.id).eq('org_id', req.org.id)
      .select().single();
    if (error || !data) return reply.code(404).send({ error: 'Datensatz nicht gefunden' });
    return data;
  });

  // ── LÖSCHEN / DEAKTIVIEREN ───────────────────────────────────
  fastify.delete('/:resource/:id', { preHandler: authMiddleware }, async (req, reply) => {
    const def = resolve(req, reply); if (!def) return;
    if (def.readonly) return reply.code(405).send({ error: 'Diese Ressource wird über fachliche Endpunkte gepflegt.' });
    if (def.softDelete) {
      const { data } = await supabase.from(def.table)
        .update({ active: false }).eq('id', req.params.id).eq('org_id', req.org.id).select('id');
      if (!data?.length) return reply.code(404).send({ error: 'Datensatz nicht gefunden' });
      return { deactivated: true };
    }
    const { data, error } = await supabase.from(def.table)
      .delete().eq('id', req.params.id).eq('org_id', req.org.id).select('id');
    if (error?.code === '23503') return reply.code(409).send({ error: 'Datensatz wird noch referenziert.' });
    if (!data?.length) return reply.code(404).send({ error: 'Datensatz nicht gefunden' });
    return { deleted: true };
  });

  // ═══ FACHLICHE ENDPUNKTE ═════════════════════════════════════

  // MM: Warenbewegung (Eingang/Ausgang/Inventur) — bucht Bestand fort
  fastify.post('/mm/stock-movement', {
    preHandler: authMiddleware,
    schema: {
      body: {
        type: 'object',
        required: ['material_id', 'movement_type', 'quantity'],
        properties: {
          material_id: { type: 'string' },
          movement_type: { type: 'string', enum: ['eingang', 'ausgang', 'inventur'] },
          quantity: { type: 'number' },
          reference: { type: 'string' },
          note: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { material_id, movement_type, quantity, reference, note } = req.body;
    const { data: mat } = await supabase.from('mm_materials')
      .select('id, stock_qty, name').eq('id', material_id).eq('org_id', req.org.id).single();
    if (!mat) return reply.code(404).send({ error: 'Material nicht gefunden' });

    const current = parseFloat(mat.stock_qty) || 0;
    const qty = Math.abs(parseFloat(quantity) || 0);
    if (qty === 0 && movement_type !== 'inventur') return reply.code(400).send({ error: 'Menge muss größer 0 sein.' });
    const newStock = movement_type === 'eingang' ? current + qty
      : movement_type === 'ausgang' ? current - qty
      : parseFloat(quantity);                       // Inventur: Absolutwert setzen
    if (newStock < 0) return reply.code(409).send({ error: `Bestand würde negativ (aktuell ${current}, Abgang ${qty}).` });

    const { error: e1 } = await supabase.from('mm_stock_movements').insert({
      org_id: req.org.id, material_id, movement_type,
      quantity: movement_type === 'inventur' ? newStock - current : qty,
      reference: reference || null, note: note || null, created_by: req.user?.id || null,
    });
    if (e1) throw new Error(`[erp/stock-movement] ${e1.message}`);
    await supabase.from('mm_materials').update({ stock_qty: newStock }).eq('id', material_id).eq('org_id', req.org.id);
    return reply.code(201).send({ material: mat.name, old_stock: current, new_stock: newStock });
  });

  // MM: Mindestbestand-Warnungen
  fastify.get('/mm/alerts', { preHandler: authMiddleware }, async (req) => {
    const { data } = await supabase.from('mm_materials')
      .select('id, material_number, name, stock_qty, min_stock, unit')
      .eq('org_id', req.org.id).eq('active', true).gt('min_stock', 0);
    const alerts = (data || []).filter(m => parseFloat(m.stock_qty) < parseFloat(m.min_stock));
    return { alerts, count: alerts.length };
  });

  // CO: Soll-/Ist-Vergleich je Kostenstelle (Budget vs. FI-Journal)
  fastify.get('/co/report', { preHandler: authMiddleware }, async (req) => {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const [{ data: centers }, { data: budgets }, { data: lines }] = await Promise.all([
      supabase.from('fi_cost_centers').select('id, code, name').eq('org_id', req.org.id).eq('active', true),
      supabase.from('co_budgets').select('cost_center_id, amount').eq('org_id', req.org.id).eq('year', year),
      supabase.from('fi_journal_lines')
        .select('cost_center_id, debit, credit, fi_journal_entries!inner(entry_date, org_id)')
        .eq('org_id', req.org.id)
        .gte('fi_journal_entries.entry_date', `${year}-01-01`)
        .lte('fi_journal_entries.entry_date', `${year}-12-31`)
        .not('cost_center_id', 'is', null),
    ]);
    const budgetBy = Object.fromEntries((budgets || []).map(b => [b.cost_center_id, parseFloat(b.amount)]));
    const actualBy = {};
    for (const l of lines || []) {
      actualBy[l.cost_center_id] = (actualBy[l.cost_center_id] || 0)
        + (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0);
    }
    return {
      year,
      rows: (centers || []).map(c => {
        const soll = budgetBy[c.id] || 0;
        const ist = Math.round((actualBy[c.id] || 0) * 100) / 100;
        return { ...c, budget: soll, actual: ist, deviation: Math.round((ist - soll) * 100) / 100 };
      }),
    };
  });

  // HCM: LODAS-Export-Struktur (DATEV Lohn) für eine Abrechnungsperiode
  fastify.get('/hcm/lodas-export', { preHandler: authMiddleware }, async (req, reply) => {
    const period = req.query.period || new Date().toISOString().slice(0, 7);
    const { data: employees } = await supabase.from('hcm_employees')
      .select('*').eq('org_id', req.org.id).eq('active', true).order('employee_number');
    if (!employees?.length) return reply.code(404).send({ error: 'Keine aktiven Mitarbeiter vorhanden.' });

    // LODAS-Importdatei (vereinfachte Struktur: Kopf + Personaldaten + Bruttolohn)
    const lines = [
      '[Allgemein]',
      'Ziel=LODAS',
      `Version_SST=1.0`,
      `BeratungsNr=`,
      `MandantenNr=`,
      `Abrechnungszeitraum=${period.replace('-', '/')}`,
      '',
      '[Bruttolohn]',
      'PersonalNr;Nachname;Vorname;Lohnart;Betrag;Stunden',
      ...employees.map(e =>
        `${e.employee_number || ''};${e.last_name};${e.first_name};100;${(parseFloat(e.salary) || 0).toFixed(2).replace('.', ',')};${(parseFloat(e.weekly_hours) || 0) * 4.33}`),
    ];
    const total = employees.reduce((s, e) => s + (parseFloat(e.salary) || 0), 0);

    // Abrechnungslauf dokumentieren (idempotent je Periode)
    await supabase.from('hcm_payroll_runs').upsert({
      org_id: req.org.id, period, status: 'abgerechnet',
      total_gross: total, employee_count: employees.length,
      lodas_exported_at: new Date().toISOString(),
    }, { onConflict: 'org_id,period' });

    reply.header('Content-Type', 'text/plain; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="LODAS_${period}.txt"`);
    return reply.send(lines.join('\r\n') + '\r\n');
  });

  // DMS: Einzeldokument inkl. Dateiinhalt
  fastify.get('/dms/documents/:id/file', { preHandler: authMiddleware }, async (req, reply) => {
    const { data: doc } = await supabase.from('dms_documents')
      .select('*').eq('id', req.params.id).eq('org_id', req.org.id).single();
    if (!doc?.content_data) return reply.code(404).send({ error: 'Keine Datei hinterlegt' });
    const m = doc.content_data.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return reply.code(422).send({ error: 'Ungültiges Dateiformat' });
    reply.header('Content-Type', m[1]);
    reply.header('Content-Disposition', `attachment; filename="${(doc.filename || doc.title).replace(/"/g, '')}"`);
    return reply.send(Buffer.from(m[2], 'base64'));
  });
}
