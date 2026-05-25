// src/config/database.js
// In-memory database for development/demo — replace with PostgreSQL in production
// Production: npm install pg && use Pool from 'pg'

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// ── IN-MEMORY STORE (dev/demo) ────────────────────────────────
class InMemoryDB {
  constructor() {
    this.organizations = new Map();
    this.users = new Map();
    this.invoices = new Map();
    this.auditLogs = new Map();
    this.archiveRecords = new Map();
    this.webhooks = new Map();
    this.refreshTokens = new Map();
    this.erpConnections = new Map();
    this._readyPromise = this._seed();
  }

  async ready() { return this._readyPromise; }

  async _seed() {
    // Demo organization
    const orgId = 'demo-org-001';
    this.organizations.set(orgId, {
      id: orgId,
      name: 'Demo GmbH',
      slug: 'demo-gmbh',
      vat_id: 'DE123456789',
      address_street: 'Musterstraße 1',
      address_city: 'Berlin',
      address_zip: '10115',
      address_country: 'DE',
      erp_system: 'sap_s4',
      plan: 'business',
      plan_doc_limit: 1000,
      plan_doc_used: 41,
      api_key: 'iq_live_demo_key_001',
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Demo user
    const userId = 'demo-user-001';
    const passwordHash = await bcrypt.hash('demo123', 10);
    this.users.set(userId, {
      id: userId,
      org_id: orgId,
      email: 'demo@invoiq.io',
      password_hash: passwordHash,
      full_name: 'Demo User',
      role: 'owner',
      email_verified: true,
      active: true,
      created_at: new Date().toISOString(),
    });

    // Demo invoices
    const demoInvoices = [
      { company: 'Müller GmbH', amount_gross: 4284.00, format: 'xrechnung', status: 'delivered' },
      { company: 'TechVision AG', amount_gross: 12900.00, format: 'zugferd', status: 'validated' },
      { company: 'Bauer & Partner', amount_gross: 780.50, format: 'peppol', status: 'sent' },
      { company: 'Stadtwerke Nord', amount_gross: 22410.00, format: 'xrechnung', status: 'delivered' },
      { company: 'Logistik Express', amount_gross: 1550.00, format: 'zugferd', status: 'error' },
    ];

    demoInvoices.forEach((inv, i) => {
      const id = `demo-inv-00${i + 1}`;
      this.invoices.set(id, {
        id,
        org_id: orgId,
        invoice_number: `INV-2024-00${39 + i}`,
        direction: 'outbound',
        status: inv.status,
        buyer_name: inv.company,
        amount_net: parseFloat((inv.amount_gross / 1.19).toFixed(2)),
        amount_vat: parseFloat((inv.amount_gross - inv.amount_gross / 1.19).toFixed(2)),
        amount_gross: inv.amount_gross,
        currency: 'EUR',
        format: inv.format,
        invoice_date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        line_items: [],
        validation_passed: inv.status !== 'error',
        created_by: userId,
        created_at: new Date(Date.now() - i * 3600000).toISOString(),
        updated_at: new Date().toISOString(),
      });
    });
  }

  // ── ORGANIZATIONS ────────────────────────────────────────────
  async findOrgById(id) {
    return this.organizations.get(id) || null;
  }

  async findOrgBySlug(slug) {
    return [...this.organizations.values()].find(o => o.slug === slug) || null;
  }

  async findOrgByApiKey(key) {
    return [...this.organizations.values()].find(o => o.api_key === key) || null;
  }

  async createOrg(data) {
    const id = uuidv4();
    const org = { id, ...data, plan_doc_used: 0, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    this.organizations.set(id, org);
    return org;
  }

  async updateOrg(id, data) {
    const org = this.organizations.get(id);
    if (!org) return null;
    const updated = { ...org, ...data, updated_at: new Date().toISOString() };
    this.organizations.set(id, updated);
    return updated;
  }

  // ── USERS ────────────────────────────────────────────────────
  async findUserById(id) {
    return this.users.get(id) || null;
  }

  async findUserByEmail(email) {
    return [...this.users.values()].find(u => u.email === email) || null;
  }

  async createUser(data) {
    const id = uuidv4();
    const user = { id, ...data, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id, data) {
    const user = this.users.get(id);
    if (!user) return null;
    const updated = { ...user, ...data, updated_at: new Date().toISOString() };
    this.users.set(id, updated);
    return updated;
  }

  // ── INVOICES ─────────────────────────────────────────────────
  async findInvoiceById(id, orgId) {
    const inv = this.invoices.get(id);
    if (!inv || inv.org_id !== orgId) return null;
    return inv;
  }

  async findInvoices(orgId, { direction, status, limit = 50, offset = 0, search } = {}) {
    let results = [...this.invoices.values()].filter(i => i.org_id === orgId);
    if (direction) results = results.filter(i => i.direction === direction);
    if (status) results = results.filter(i => i.status === status);
    if (search) results = results.filter(i =>
      i.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      i.buyer_name?.toLowerCase().includes(search.toLowerCase()) ||
      i.seller_name?.toLowerCase().includes(search.toLowerCase())
    );
    results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const total = results.length;
    return { invoices: results.slice(offset, offset + limit), total };
  }

  async createInvoice(data) {
    const id = uuidv4();
    const invoice = { id, ...data, delivery_attempts: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    this.invoices.set(id, invoice);
    // Increment doc usage
    const org = this.organizations.get(data.org_id);
    if (org && data.direction === 'outbound') {
      org.plan_doc_used = (org.plan_doc_used || 0) + 1;
    }
    return invoice;
  }

  async updateInvoice(id, data) {
    const inv = this.invoices.get(id);
    if (!inv) return null;
    const updated = { ...inv, ...data, updated_at: new Date().toISOString() };
    this.invoices.set(id, updated);
    return updated;
  }

  // ── STATS ────────────────────────────────────────────────────
  async getStats(orgId) {
    const all = [...this.invoices.values()].filter(i => i.org_id === orgId);
    const outbound = all.filter(i => i.direction === 'outbound');
    const inbound = all.filter(i => i.direction === 'inbound');
    const errors = all.filter(i => i.status === 'error');
    const validated = all.filter(i => i.validation_passed === true);
    const complianceScore = all.length > 0
      ? Math.round((validated.length / all.length) * 100) : 100;

    return {
      outbound_total: outbound.length,
      inbound_total: inbound.length,
      errors_total: errors.length,
      compliance_score: complianceScore,
      total: all.length,
    };
  }

  // ── AUDIT LOG ────────────────────────────────────────────────
  async createAuditLog(data) {
    const id = uuidv4();
    const log = { id, ...data, created_at: new Date().toISOString() };
    this.auditLogs.set(id, log);
    return log;
  }

  async getAuditLogs(orgId, invoiceId, limit = 100) {
    let logs = [...this.auditLogs.values()]
      .filter(l => l.org_id === orgId && (!invoiceId || l.invoice_id === invoiceId));
    logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return logs.slice(0, limit);
  }

  // ── ARCHIVE ──────────────────────────────────────────────────
  async createArchiveRecord(data) {
    const id = uuidv4();
    const record = { id, ...data, created_at: new Date().toISOString() };
    this.archiveRecords.set(id, record);
    return record;
  }

  async findArchiveRecords(orgId, limit = 100) {
    return [...this.archiveRecords.values()]
      .filter(r => r.org_id === orgId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
  }

  // ── WEBHOOKS ─────────────────────────────────────────────────
  async findWebhooks(orgId) {
    return [...this.webhooks.values()].filter(w => w.org_id === orgId);
  }

  async createWebhook(data) {
    const id = uuidv4();
    const wh = { id, ...data, created_at: new Date().toISOString() };
    this.webhooks.set(id, wh);
    return wh;
  }

  async deleteWebhook(id, orgId) {
    const wh = this.webhooks.get(id);
    if (!wh || wh.org_id !== orgId) return false;
    this.webhooks.delete(id);
    return true;
  }

  // ── REFRESH TOKENS ───────────────────────────────────────────
  async saveRefreshToken(userId, tokenHash, expiresAt) {
    const id = uuidv4();
    this.refreshTokens.set(id, { id, user_id: userId, token_hash: tokenHash, expires_at: expiresAt, revoked: false, created_at: new Date().toISOString() });
  }

  async findRefreshToken(tokenHash) {
    return [...this.refreshTokens.values()].find(t => t.token_hash === tokenHash && !t.revoked) || null;
  }

  async revokeRefreshToken(tokenHash) {
    const token = [...this.refreshTokens.values()].find(t => t.token_hash === tokenHash);
    if (token) token.revoked = true;
  }

  async revokeAllUserTokens(userId) {
    for (const token of this.refreshTokens.values()) {
      if (token.user_id === userId) token.revoked = true;
    }
  }
}

// Singleton
export const db = new InMemoryDB();

/*
─── PRODUCTION MIGRATION ─────────────────────────────────────
Replace with:

import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

export const db = {
  query: (text, params) => pool.query(text, params),
  findUserByEmail: async (email) => {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] || null;
  },
  // ... etc
};
*/
