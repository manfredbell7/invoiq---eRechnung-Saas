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
async function findInvoices(orgId, { direction, status, archived, limit = 50, offset = 0, search } = {}) {
  let q = supabase
    .from('invoices')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (direction) q = q.eq('direction', direction);
  if (status) q = q.eq('status', status);
  if (archived === true) q = q.eq('archived', true);
  if (search) {
    // PostgREST-Filtersyntax-Zeichen entfernen — sonst kann ein Suchstring
    // mit Kommas/Klammern den .or()-Filter manipulieren oder Fehler auslösen.
    const safe = String(search).replace(/[,()%]/g, ' ').trim();
    if (safe) q = q.or(`invoice_number.ilike.%${safe}%,buyer_name.ilike.%${safe}%`);
  }

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

// orgId ist erforderlich: verhindert, dass eine Org versehentlich (oder durch
// einen Bug an der Aufrufstelle) Rechnungen einer anderen Org aktualisiert.
// Der Service-Role-Key umgeht RLS — Mandantentrennung MUSS hier erzwungen werden.
async function updateInvoice(id, orgId, patch) {
  if (!orgId) throw new Error('[db/updateInvoice] orgId ist erforderlich (Tenant-Isolation)');
  const res = await supabase
    .from('invoices')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)
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

  // week_data: Dokumente pro Tag der letzten 7 Tage (für Dashboard-MiniChart).
  // Dafür brauchen wir created_at — separater leichter Query.
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const { data: weekRows } = await supabase
    .from('invoices')
    .select('created_at')
    .eq('org_id', orgId)
    .neq('status', 'deleted')
    .gte('created_at', weekAgo.toISOString());
  const week_data = Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date(Date.now() - (6 - i) * 86400000);
    const key = dayStart.toISOString().slice(0, 10);
    return (weekRows || []).filter(r => (r.created_at || '').slice(0, 10) === key).length;
  });

  const outbound = rows.filter(r => r.direction === 'outbound');
  const inbound  = rows.filter(r => r.direction === 'inbound');
  const errors   = rows.filter(r => r.status === 'error' || r.validation_passed === false);
  const validated = rows.filter(r => r.validation_passed === true);
  const compliance_score = rows.length ? Math.round((validated.length / rows.length) * 100) : 100;

  const format_breakdown = (() => {
    const tot = outbound.length || 1;
    const byFmt = f => outbound.filter(r => (r.format || '').toLowerCase().includes(f)).length;
    return [
      ['XRechnung', Math.round(byFmt('xrechnung') / tot * 100), '#635BFF'],
      ['ZUGFeRD',   Math.round((byFmt('zugferd') + byFmt('facturx')) / tot * 100), '#9B8AFB'],
      ['Peppol',    Math.round(byFmt('peppol') / tot * 100), '#1A9C5B'],
    ];
  })();

  return {
    total_invoices: rows.length,
    total_outbound: outbound.length,
    total_inbound: inbound.length,
    // Frontend-Kontrakt (Dashboard-KPIs)
    outbound_total: outbound.length,
    inbound_total: inbound.length,
    errors_total: errors.length,
    compliance_score,
    week_data,
    total_revenue: outbound
      .filter(r => ['sent', 'delivered', 'archived'].includes(r.status))
      .reduce((s, r) => s + (parseFloat(r.amount_gross) || 0), 0),
    invoices_this_month: mRows.length,
    revenue_this_month: mRows
      .filter(r => r.direction === 'outbound')
      .reduce((s, r) => s + (parseFloat(r.amount_gross) || 0), 0),
    pending_count: rows.filter(r => r.status === 'validated').length,
    sent_count: rows.filter(r => r.status === 'sent').length,
    format_breakdown,
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

async function getAuditLogs(orgId, invoiceId, limit = 100) {
  let q = supabase
    .from('audit_logs')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);
  // invoiceId optional — /archive/audit/logs listet alle Org-Aktionen
  if (invoiceId) q = q.eq('invoice_id', invoiceId);
  const { data, error } = await q;
  if (error) throw new Error(`[db/getAuditLogs] ${error.message}`);
  return data ?? [];
}

// ── ORGANISATIONS ──────────────────────────────────────────────────────────
async function findOrgByApiKey(apiKey) {
  const { data, error } = await supabase.from('organizations').select('*').eq('api_key', apiKey).eq('active', true).single();
  if (error && error.code !== 'PGRST116') return null;
  return data ?? null;
}

async function createOrg(data) {
  const row = { id: uuidv4(), ...data, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const res = await supabase.from('organizations').insert(row).select().single();
  return assertNoError(res, 'createOrg');
}

async function findOrgById(id) {
  const { data, error } = await supabase.from('organizations').select('*').eq('id', id).single();
  if (error && error.code !== 'PGRST116') throw new Error(`[db/findOrgById] ${error.message}`);
  return data ?? null;
}

async function updateOrg(id, patch) {
  const res = await supabase.from('organizations').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  return assertNoError(res, 'updateOrg');
}

// ── USERS ──────────────────────────────────────────────────────────────────
async function findUserByEmail(email) {
  const { data, error } = await supabase.from('users').select('*').ilike('email', email).single();
  if (error && error.code !== 'PGRST116') return null;
  return data ?? null;
}

async function findUserById(id) {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
  if (error && error.code !== 'PGRST116') return null;
  return data ?? null;
}

async function createUser(data) {
  const row = { id: uuidv4(), ...data, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const res = await supabase.from('users').insert(row).select().single();
  return assertNoError(res, 'createUser');
}

async function updateUser(id, patch) {
  const res = await supabase.from('users').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  return assertNoError(res, 'updateUser');
}

// ── REFRESH TOKENS ─────────────────────────────────────────────────────────
async function saveRefreshToken(userId, tokenHash, expiresAt) {
  await supabase.from('refresh_tokens').insert({
    id: uuidv4(), user_id: userId, token_hash: tokenHash,
    expires_at: expiresAt, created_at: new Date().toISOString(),
  });
}

async function findRefreshToken(tokenHash) {
  const { data } = await supabase.from('refresh_tokens').select('*').eq('token_hash', tokenHash).single();
  return data ?? null;
}

async function deleteRefreshToken(tokenHash) {
  await supabase.from('refresh_tokens').delete().eq('token_hash', tokenHash);
}

// Alias für Logout
async function revokeRefreshToken(tokenHash) {
  await supabase.from('refresh_tokens').delete().eq('token_hash', tokenHash);
}

// ── WEBHOOKS ───────────────────────────────────────────────────────────────
async function findWebhooks(orgId) {
  const { data, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`[db/findWebhooks] ${error.message}`);
  return data ?? [];
}

async function createWebhook(data) {
  const row = { id: uuidv4(), ...data, created_at: new Date().toISOString() };
  const res = await supabase.from('webhooks').insert(row).select().single();
  return assertNoError(res, 'createWebhook');
}

async function deleteWebhook(id, orgId) {
  const { data, error } = await supabase
    .from('webhooks')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)
    .select();
  if (error) throw new Error(`[db/deleteWebhook] ${error.message}`);
  return (data ?? []).length > 0;
}

// ── ARCHIVE RECORDS (GoBD, §147 AO) ────────────────────────────────────────
async function createArchiveRecord(data) {
  const row = { id: uuidv4(), ...data, created_at: new Date().toISOString() };
  const res = await supabase.from('archive_records').insert(row).select().single();
  return assertNoError(res, 'createArchiveRecord');
}

async function findArchiveRecords(orgId, limit = 100) {
  const { data, error } = await supabase
    .from('archive_records')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`[db/findArchiveRecords] ${error.message}`);
  return data ?? [];
}

// ── EMAIL SERVICE ──────────────────────────────────────────────────────────
async function sendInvoiceEmail({ to, subject, invoice, xmlBuffer, pdfBuffer }) {
  const { sendInvoiceEmail: send } = await import('../services/email.js');
  return send({ to, subject, invoice, xmlBuffer, pdfBuffer });
}

// ── EXPORT ─────────────────────────────────────────────────────────────────
export const db = {
  // Invoices
  findInvoices,
  findInvoiceById,
  createInvoice,
  updateInvoice,
  getStats,
  // Orgs
  createOrg,
  findOrgById,
  findOrgByApiKey,
  updateOrg,
  // Users
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  // Tokens
  saveRefreshToken,
  findRefreshToken,
  deleteRefreshToken,
  revokeRefreshToken,
  // Email
  sendInvoiceEmail,
  // Audit
  createAuditLog,
  getAuditLogs,
  // Webhooks
  findWebhooks,
  createWebhook,
  deleteWebhook,
  // Archive (GoBD)
  createArchiveRecord,
  findArchiveRecords,
};
