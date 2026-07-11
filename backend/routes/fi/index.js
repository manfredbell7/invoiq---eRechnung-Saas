// routes/fi/index.js — FI Stufe 1 (Finanzbuchhaltung)
//
// GET  /v1/fi/accounts                 Kontenplan (SKR03/SKR04)
// GET  /v1/fi/journal                  Buchungsjournal (mit Zeilen)
// POST /v1/fi/journal                  Manuelle Buchung (Soll=Haben erzwungen)
// POST /v1/fi/journal/:id/storno       Stornobuchung (GoBD-Korrektur)
// POST /v1/fi/post-invoice/:id         Auto-Kontierung Ausgangsrechnung (idempotent)
// POST /v1/fi/post-inbound/:id         Auto-Kontierung Eingangsrechnung (idempotent)
// GET  /v1/fi/reports                  Bilanz + GuV (Zeitraumfilter)
// GET  /v1/fi/datev-buchungsstapel     DATEV-EXTF-Export des Journals
// GET/POST /v1/fi/cost-centers         Kostenstellen (CO-Basis)

import { authMiddleware } from '../../middleware/auth.js';
import { supabase } from '../../config/database.js';
import { db } from '../../config/db.js';
import { computeTotals } from '../../services/taxEngine.js';
import {
  ACCOUNT_FRAMES, accountsForFrame, validateEntry, buildReports, buildDatevExtf,
  postingForOutboundInvoice, postingForInboundInvoice, reversalOf,
} from '../../services/accountingEngine.js';

const frameOf = (req) => ACCOUNT_FRAMES.includes(req.query?.frame) ? req.query.frame : 'skr03';

async function nextEntryNo(orgId) {
  const { data } = await supabase.from('fi_journal_entries')
    .select('entry_no').eq('org_id', orgId)
    .order('entry_no', { ascending: false }).limit(1);
  return (data?.[0]?.entry_no || 0) + 1;
}

// Persistiert einen (bereits validierten) Buchungssatz atomar genug für
// Stufe 1: Entry zuerst, Zeilen danach; bei Zeilenfehler wird der Entry
// wieder entfernt (kein halber Buchungssatz im Journal).
async function insertEntry(orgId, userId, frame, posting) {
  const v = validateEntry(posting.lines);
  if (!v.ok) return { error: v.errors };

  const entry_no = await nextEntryNo(orgId);
  const { data: entry, error: e1 } = await supabase.from('fi_journal_entries').insert({
    org_id: orgId, entry_no,
    entry_date: posting.entry_date,
    description: posting.description || null,
    doc_ref: posting.doc_ref || null,
    source_type: posting.source_type || 'manual',
    source_id: posting.source_id || null,
    storno_of: posting.storno_of || null,
    account_frame: frame,
    created_by: userId || null,
  }).select().single();
  if (e1) return { error: [e1.message] };

  const lines = posting.lines.map((l, i) => ({
    entry_id: entry.id, org_id: orgId, line_no: i + 1,
    account: String(l.account), contra_account: l.contra_account || null,
    debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0,
    tax_code: l.tax_code || null, cost_center_id: l.cost_center_id || null,
    label: l.label || null,
  }));
  const { error: e2 } = await supabase.from('fi_journal_lines').insert(lines);
  if (e2) {
    await supabase.from('fi_journal_entries').delete().eq('id', entry.id);
    return { error: [e2.message] };
  }
  return { entry: { ...entry, lines } };
}

async function loadEntry(orgId, id) {
  const { data: entry } = await supabase.from('fi_journal_entries')
    .select('*').eq('id', id).eq('org_id', orgId).single();
  if (!entry) return null;
  const { data: lines } = await supabase.from('fi_journal_lines')
    .select('*').eq('entry_id', id).order('line_no');
  return { ...entry, lines: lines || [] };
}

export async function fiRoutes(fastify) {

  // ── KONTENPLAN ──────────────────────────────────────────────
  fastify.get('/accounts', { preHandler: authMiddleware }, async (req) => ({
    frame: frameOf(req),
    frames: ACCOUNT_FRAMES,
    accounts: accountsForFrame(frameOf(req)),
  }));

  // ── JOURNAL LESEN ───────────────────────────────────────────
  fastify.get('/journal', { preHandler: authMiddleware }, async (req) => {
    const { from, to, limit = 100, offset = 0 } = req.query;
    let q = supabase.from('fi_journal_entries')
      .select('*', { count: 'exact' })
      .eq('org_id', req.org.id)
      .order('entry_no', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + Math.min(parseInt(limit), 200) - 1);
    if (from) q = q.gte('entry_date', from);
    if (to) q = q.lte('entry_date', to);
    const { data: entries, count, error } = await q;
    if (error) throw new Error(`[fi/journal] ${error.message}`);

    const ids = (entries || []).map(e => e.id);
    let linesByEntry = {};
    if (ids.length) {
      const { data: lines } = await supabase.from('fi_journal_lines')
        .select('*').in('entry_id', ids).order('line_no');
      for (const l of lines || []) (linesByEntry[l.entry_id] ||= []).push(l);
    }
    return {
      entries: (entries || []).map(e => ({ ...e, lines: linesByEntry[e.id] || [] })),
      total: count || 0,
    };
  });

  // ── MANUELLE BUCHUNG ────────────────────────────────────────
  fastify.post('/journal', {
    preHandler: authMiddleware,
    schema: {
      body: {
        type: 'object',
        required: ['entry_date', 'lines'],
        properties: {
          entry_date: { type: 'string' },
          description: { type: 'string', maxLength: 300 },
          doc_ref: { type: 'string', maxLength: 60 },
          frame: { type: 'string', enum: ACCOUNT_FRAMES },
          lines: {
            type: 'array', minItems: 2, maxItems: 50,
            items: {
              type: 'object',
              required: ['account'],
              properties: {
                account: { type: 'string' },
                debit: { type: 'number', minimum: 0 },
                credit: { type: 'number', minimum: 0 },
                tax_code: { type: 'string' },
                cost_center_id: { type: 'string' },
                label: { type: 'string', maxLength: 120 },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    const frame = ACCOUNT_FRAMES.includes(req.body.frame) ? req.body.frame : 'skr03';
    const result = await insertEntry(req.org.id, req.user?.id, frame, {
      entry_date: req.body.entry_date,
      description: req.body.description,
      doc_ref: req.body.doc_ref,
      source_type: 'manual',
      lines: req.body.lines,
    });
    if (result.error) return reply.code(422).send({ error: 'Buchung ungültig', details: result.error });
    return reply.code(201).send(result.entry);
  });

  // ── STORNO ──────────────────────────────────────────────────
  fastify.post('/journal/:id/storno', { preHandler: authMiddleware }, async (req, reply) => {
    const entry = await loadEntry(req.org.id, req.params.id);
    if (!entry) return reply.code(404).send({ error: 'Buchung nicht gefunden' });
    if (entry.source_type === 'storno') return reply.code(400).send({ error: 'Ein Storno kann nicht storniert werden.' });

    const { data: existing } = await supabase.from('fi_journal_entries')
      .select('id').eq('org_id', req.org.id).eq('storno_of', entry.id).limit(1);
    if (existing?.length) return reply.code(409).send({ error: 'Buchung wurde bereits storniert.' });

    const posting = { ...reversalOf(entry), storno_of: entry.id };
    const result = await insertEntry(req.org.id, req.user?.id, entry.account_frame, posting);
    if (result.error) return reply.code(422).send({ error: 'Storno fehlgeschlagen', details: result.error });
    return reply.code(201).send(result.entry);
  });

  // ── AUTO-KONTIERUNG: AUSGANGSRECHNUNG ───────────────────────
  fastify.post('/post-invoice/:id', { preHandler: authMiddleware }, async (req, reply) => {
    const frame = frameOf(req);
    const invoice = await db.findInvoiceById(req.params.id, req.org.id);
    if (!invoice) return reply.code(404).send({ error: 'Rechnung nicht gefunden' });

    // Idempotenz: eine Rechnung wird nur einmal gebucht
    const { data: dupe } = await supabase.from('fi_journal_entries')
      .select('id, entry_no').eq('org_id', req.org.id)
      .eq('source_type', 'invoice_outbound').eq('source_id', invoice.id).limit(1);
    if (dupe?.length) return reply.code(409).send({ error: `Rechnung ist bereits gebucht (Buchung Nr. ${dupe[0].entry_no}).` });

    const items = (typeof invoice.line_items === 'string'
      ? JSON.parse(invoice.line_items || '[]') : (invoice.line_items || []))
      .map(it => ({
        ...it,
        tax_code: it.tax_code || (parseFloat(it.vat_rate) === 7 ? 'S7' : parseFloat(it.vat_rate) === 0 ? 'E0' : 'S19'),
      }));
    if (!items.length) return reply.code(422).send({ error: 'Rechnung hat keine Positionen — Kontierung nicht möglich.' });

    const totals = computeTotals(items);
    const posting = postingForOutboundInvoice(invoice, totals.tax_breakdown, frame);
    posting.source_id = invoice.id;

    const result = await insertEntry(req.org.id, req.user?.id, frame, posting);
    if (result.error) return reply.code(422).send({ error: 'Kontierung fehlgeschlagen', details: result.error });

    await db.createAuditLog({
      org_id: req.org.id, user_id: req.user?.id, invoice_id: invoice.id,
      action: 'fi_posted',
      details: { entry_no: result.entry.entry_no, frame, gross: totals.amount_gross },
    }).catch(() => {});
    return reply.code(201).send(result.entry);
  });

  // ── AUTO-KONTIERUNG: EINGANGSRECHNUNG ───────────────────────
  fastify.post('/post-inbound/:id', { preHandler: authMiddleware }, async (req, reply) => {
    const frame = frameOf(req);
    const { data: inv } = await supabase.from('inbound_invoices')
      .select('*').eq('id', req.params.id).eq('org_id', req.org.id).single();
    if (!inv) return reply.code(404).send({ error: 'Eingangsrechnung nicht gefunden' });

    const { data: dupe } = await supabase.from('fi_journal_entries')
      .select('id, entry_no').eq('org_id', req.org.id)
      .eq('source_type', 'invoice_inbound').eq('source_id', inv.id).limit(1);
    if (dupe?.length) return reply.code(409).send({ error: `Eingangsrechnung ist bereits gebucht (Buchung Nr. ${dupe[0].entry_no}).` });

    const posting = postingForInboundInvoice(inv, frame);
    posting.source_id = inv.id;
    const result = await insertEntry(req.org.id, req.user?.id, frame, posting);
    if (result.error) return reply.code(422).send({ error: 'Kontierung fehlgeschlagen', details: result.error });
    return reply.code(201).send(result.entry);
  });

  // ── BILANZ + GUV ────────────────────────────────────────────
  fastify.get('/reports', { preHandler: authMiddleware }, async (req) => {
    const frame = frameOf(req);
    const { from, to } = req.query;
    let q = supabase.from('fi_journal_lines')
      .select('account, debit, credit, fi_journal_entries!inner(entry_date, org_id)')
      .eq('org_id', req.org.id);
    if (from) q = q.gte('fi_journal_entries.entry_date', from);
    if (to) q = q.lte('fi_journal_entries.entry_date', to);
    const { data: lines, error } = await q;
    if (error) throw new Error(`[fi/reports] ${error.message}`);
    return { period: { from: from || null, to: to || null }, ...buildReports(lines || [], frame) };
  });

  // ── DATEV-BUCHUNGSSTAPEL (EXTF) ─────────────────────────────
  fastify.get('/datev-buchungsstapel', { preHandler: authMiddleware }, async (req, reply) => {
    const { from, to } = req.query;
    let q = supabase.from('fi_journal_entries')
      .select('*').eq('org_id', req.org.id).order('entry_no');
    if (from) q = q.gte('entry_date', from);
    if (to) q = q.lte('entry_date', to);
    const { data: entries } = await q;
    const ids = (entries || []).map(e => e.id);
    let linesByEntry = {};
    if (ids.length) {
      const { data: lines } = await supabase.from('fi_journal_lines')
        .select('*').in('entry_id', ids).order('line_no');
      for (const l of lines || []) (linesByEntry[l.entry_id] ||= []).push(l);
    }
    const csv = buildDatevExtf(
      (entries || []).map(e => ({ ...e, lines: linesByEntry[e.id] || [] })),
      { frame: frameOf(req), fromDate: from, toDate: to, orgName: req.org.name || '' },
    );
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="EXTF_Buchungsstapel_${new Date().toISOString().slice(0, 10)}.csv"`);
    return reply.send(csv);
  });

  // ── KOSTENSTELLEN (CO-Basis) ────────────────────────────────
  fastify.get('/cost-centers', { preHandler: authMiddleware }, async (req) => {
    const { data } = await supabase.from('fi_cost_centers')
      .select('*').eq('org_id', req.org.id).order('code');
    return { cost_centers: data || [] };
  });

  fastify.post('/cost-centers', {
    preHandler: authMiddleware,
    schema: {
      body: {
        type: 'object',
        required: ['code', 'name'],
        properties: {
          code: { type: 'string', minLength: 1, maxLength: 20 },
          name: { type: 'string', minLength: 2, maxLength: 100 },
        },
      },
    },
  }, async (req, reply) => {
    const { data, error } = await supabase.from('fi_cost_centers').insert({
      org_id: req.org.id, code: req.body.code.trim(), name: req.body.name.trim(),
    }).select().single();
    if (error) {
      if (error.code === '23505') return reply.code(409).send({ error: 'Kostenstellen-Code existiert bereits.' });
      throw new Error(`[fi/cost-centers] ${error.message}`);
    }
    return reply.code(201).send(data);
  });
}
