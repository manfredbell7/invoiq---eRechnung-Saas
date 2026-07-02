// routes/customers/index.js — Kundenstammdaten (SAP-ready Stufe 1)
//
// Geschäftspartner für die Belegerstellung: GET liefert die Kunden der Org
// (relevanteste zuerst), POST legt an bzw. aktualisiert per Name-Upsert.
// Die Rechnungserstellung ruft upsertFromInvoice auf, damit jeder neue
// Empfänger automatisch als Stammdatensatz entsteht (Stammdatenkonsistenz).

import { authMiddleware } from '../../middleware/auth.js';
import { supabase } from '../../config/database.js';
import { db } from '../../config/db.js';

const FIELDS = 'id, name, vat_id, address, zip, city, country, email, peppol_id, payment_terms_days, default_vat_rate, external_ref, invoice_count, last_invoice_at, active, created_at';

export async function customerRoutes(fastify) {

  // ── LISTE (Suche + Relevanz-Sortierung) ──────────────────────
  fastify.get('/', { preHandler: authMiddleware }, async (req, reply) => {
    const { search, limit = 50, offset = 0 } = req.query;
    let q = supabase.from('customers')
      .select(FIELDS, { count: 'exact' })
      .eq('org_id', req.org.id)
      .eq('active', true)
      .order('invoice_count', { ascending: false })
      .order('name', { ascending: true })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    if (search) {
      const safe = String(search).replace(/[,()%]/g, ' ').trim();
      if (safe) q = q.or(`name.ilike.%${safe}%,vat_id.ilike.%${safe}%,email.ilike.%${safe}%`);
    }
    const { data, error, count } = await q;
    if (error) {
      req.log.error(error, 'customers list failed');
      return reply.code(500).send({ error: 'Kunden konnten nicht geladen werden' });
    }
    return { customers: data ?? [], total: count ?? 0 };
  });

  // ── ANLEGEN / AKTUALISIEREN ──────────────────────────────────
  fastify.post('/', {
    preHandler: authMiddleware,
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 2 },
          vat_id: { type: 'string' },
          address: { type: 'string' },
          zip: { type: 'string' },
          city: { type: 'string' },
          country: { type: 'string' },
          email: { type: 'string' },
          peppol_id: { type: 'string' },
          payment_terms_days: { type: 'integer', minimum: 0, maximum: 365 },
          default_vat_rate: { type: 'number' },
          external_ref: { type: 'string' },
          notes: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const created = await upsertCustomer(req.org.id, req.body);
    if (!created) return reply.code(500).send({ error: 'Kunde konnte nicht gespeichert werden' });
    await db.createAuditLog({ org_id: req.org.id, user_id: req.user?.id, action: 'customer_saved', details: { name: req.body.name } });
    return reply.code(201).send({ customer: created });
  });

  // ── AKTUALISIEREN (per ID) ───────────────────────────────────
  fastify.patch('/:id', { preHandler: authMiddleware }, async (req, reply) => {
    const allowed = ['name','vat_id','address','zip','city','country','email','peppol_id','payment_terms_days','default_vat_rate','external_ref','notes','active'];
    const updates = {};
    for (const k of allowed) if (req.body?.[k] !== undefined) updates[k] = req.body[k];
    if (!Object.keys(updates).length) return reply.code(400).send({ error: 'Keine Felder' });
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('customers')
      .update(updates).eq('id', req.params.id).eq('org_id', req.org.id)
      .select(FIELDS).single();
    if (error || !data) return reply.code(404).send({ error: 'Kunde nicht gefunden' });
    return { customer: data };
  });

  // ── DEAKTIVIEREN (Soft-Delete — Belege referenzieren Stammdaten) ─
  fastify.delete('/:id', { preHandler: authMiddleware }, async (req, reply) => {
    const { data, error } = await supabase.from('customers')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('org_id', req.org.id).select('id');
    if (error || !(data ?? []).length) return reply.code(404).send({ error: 'Kunde nicht gefunden' });
    return { message: 'Kunde deaktiviert' };
  });
}

// Name-basierter Upsert. Wird auch von der Rechnungserstellung genutzt,
// damit jeder neue Empfänger automatisch als Kunde gelernt wird.
export async function upsertCustomer(orgId, data, { countInvoice = false } = {}) {
  const name = (data.name || '').trim();
  if (name.length < 2) return null;

  const { data: existing } = await supabase.from('customers')
    .select('id, invoice_count')
    .eq('org_id', orgId).ilike('name', name).single();

  const patch = {};
  for (const k of ['vat_id','address','zip','city','country','email','peppol_id','payment_terms_days','default_vat_rate','external_ref','notes']) {
    // Nur befüllte Werte übernehmen — leere Eingaben überschreiben keine Stammdaten
    if (data[k] !== undefined && data[k] !== null && data[k] !== '') patch[k] = data[k];
  }

  if (existing) {
    const upd = { ...patch, updated_at: new Date().toISOString() };
    if (countInvoice) {
      upd.invoice_count = (existing.invoice_count || 0) + 1;
      upd.last_invoice_at = new Date().toISOString();
    }
    const { data: row, error } = await supabase.from('customers')
      .update(upd).eq('id', existing.id).select(FIELDS).single();
    if (error) { console.error('[customers/upsert]', error.message); return null; }
    return row;
  }

  const { data: row, error } = await supabase.from('customers')
    .insert({
      org_id: orgId, name, ...patch,
      invoice_count: countInvoice ? 1 : 0,
      last_invoice_at: countInvoice ? new Date().toISOString() : null,
    })
    .select(FIELDS).single();
  if (error) { console.error('[customers/upsert]', error.message); return null; }
  return row;
}
