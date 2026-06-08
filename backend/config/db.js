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
};
