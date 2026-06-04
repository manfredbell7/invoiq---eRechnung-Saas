// backend/config/db.js
// Supabase-backed DB adapter — matches the InMemoryDB interface used by all routes

import { v4 as uuidv4 } from 'uuid';
import { supabase } from './database.js';

// ── Helpers ────────────────────────────────────────────────────────────────
function assertNoError(res, context) {
  if (res.error) throw new Error(`[db/${context}] ${res.error.message}`);
  return res.data;
}

// ── INVOICES ───────────────────────────────────────────────────────────────
async function findInvoices(orgId, { direction, status, limit = 50, offset = 0, search } = {}) {
  let q = supabase
    .from('invoices')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (direction) q = q.eq('direction', direction);
  if (status) q = q.eq('status', status);
  if (search) q = q.or(`invoice_number.ilike.%${search}%,buyer_name.ilike.%${search}%`);

  const { data, error, count } = await q;
  if (error) throw new Error(`[db/findInvoices] ${error.message}`);
  return { invoices: data ?? [], total: count ?? 0 };
}

async function findInvoiceById(id, orgId) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .neq('status', 'deleted')
    .single();
  if (error && error.code !== 'PGRST116') throw new Error(`[db/findInvoiceById] ${error.message}`);
  return data ?? null;
}

async function createInvoice(data) {
  const row = { id: uuidv4(), ...data, created_at: new Date().toISOString() };
  const res = await supabase.from('invoices').insert(row).select().single();
  return assertNoError(res, 'createInvoice');
}

async function updateInvoice(id, patch) {
  const res = await supabase
    .from('invoices')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return assertNoError(res, 'updateInvoice');
}

// ── STATS ──────────────────────────────────────────────────────────────────
async function getStats(orgId) {
  const [totals, monthly] = await Promise.all([
    supabase
      .from('invoices')
      .select('status, amount_gross, direction')
      .eq('org_id', orgId)
      .neq('status', 'deleted'),
    supabase
      .from('invoices')
      .select('amount_gross, direction')
      .eq('org_id', orgId)
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      .neq('status', 'deleted'),
  ]);

  if (totals.error) throw new Error(`[db/getStats] ${totals.error.message}`);
  const rows = totals.data ?? [];
  const mRows = monthly.data ?? [];

  return {
    total_invoices: rows.length,
    total_outbound: rows.filter(r => r.direction === 'outbound').length,
    total_inbound: rows.filter(r => r.direction === 'inbound').length,
    total_revenue: rows
      .filter(r => r.direction === 'outbound' && r.status === 'sent')
      .reduce((s, r) => s + (r.amount_gross || 0), 0),
    invoices_this_month: mRows.length,
    revenue_this_month: mRows
      .filter(r => r.direction === 'outbound')
      .reduce((s, r) => s + (r.amount_gross || 0), 0),
    pending_count: rows.filter(r => r.status === 'validated').length,
    sent_count: rows.filter(r => r.status === 'sent').length,
  };
}

// ── AUDIT LOG ──────────────────────────────────────────────────────────────
async function createAuditLog({ org_id, user_id, invoice_id, action, details = {} }) {
  const res = await supabase.from('audit_logs').insert({
    id: uuidv4(),
    org_id,
    user_id,
    invoice_id,
    action,
    details,
    created_at: new Date().toISOString(),
  });
  if (res.error) console.error('[db/createAuditLog]', res.error.message);
}

async function getAuditLogs(orgId, invoiceId) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('org_id', orgId)
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`[db/getAuditLogs] ${error.message}`);
  return data ?? [];
}

// ── EXPORT ─────────────────────────────────────────────────────────────────
export const db = {
  findInvoices,
  findInvoiceById,
  createInvoice,
  updateInvoice,
  getStats,
  createAuditLog,
  getAuditLogs,
};
