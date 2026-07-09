// routes/business/index.js — SAP-naher Belegfluss (Stufe 1)
//
// Endpunkte:
//   GET    /v1/business/documents                Liste (type/status/search)
//   POST   /v1/business/documents                Beleg anlegen (Anfrage/Angebot/Auftrag/Lieferung)
//   GET    /v1/business/documents/:id            Kopf + Positionen + Belegfluss
//   PATCH  /v1/business/documents/:id/status     Statusübergang (Statuslogik serverseitig)
//   POST   /v1/business/documents/:id/convert    "Anlegen mit Bezug" (Folgebeleg oder Rechnung)
//     (Rechnung landet in der bestehenden invoices-Tabelle inkl. XML/Validierung)
//   GET    /v1/business/items + POST/PATCH/DELETE  Artikel-/Leistungsstammdaten
//
// Tenancy: jede Query filtert auf org_id (Service-Role-Key umgeht RLS —
// die Isolation MUSS hier auf Anwendungsebene erzwungen werden).

import { authMiddleware, checkDocLimit } from '../../middleware/auth.js';
import { supabase } from '../../config/database.js';
import { db } from '../../config/db.js';
import { computeTotals, checkTaxPlausibility, checkInvoiceAgainstSource, TAX_CODES, isValidTaxCode } from '../../services/taxEngine.js';
import {
  DOC_TYPES, DOC_TYPE_LABELS, DOC_NUMBER_PREFIX, INITIAL_STATUS,
  TRANSITIONS, canTransition, canConvert, SOURCE_STATUS_AFTER_CONVERT, isValidDocType,
} from '../../services/documentFlow.js';
import { generateXML, validateEN16931, hashXML } from '../../services/xmlEngine.js';

const HEADER_FIELDS = 'id, doc_type, doc_number, status, partner_id, partner_name, partner_vat_id, partner_email, partner_address, partner_zip, partner_city, partner_country, doc_date, valid_until, delivery_date, currency, payment_terms_days, amount_net, amount_tax, amount_gross, tax_breakdown, reference, notes, source_document_id, invoice_id, created_at, updated_at';

// ── Belegnummer: PREFIX-JAHR-#### (Zählung pro Org+Typ+Jahr) ──────────────
// Stufe 1: count-basiert; bei parallelem Anlegen theoretisch Kollision →
// UNIQUE-Constraint fängt das ab, Aufrufer bekommt klaren Fehler.
async function nextDocNumber(orgId, docType) {
  const year = new Date().getFullYear();
  const { count } = await supabase.from('business_documents')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId).eq('doc_type', docType)
    .gte('created_at', `${year}-01-01`);
  return `${DOC_NUMBER_PREFIX[docType]}-${year}-${String((count || 0) + 1).padStart(4, '0')}`;
}

async function loadDocument(orgId, id) {
  const { data: doc } = await supabase.from('business_documents')
    .select(HEADER_FIELDS).eq('id', id).eq('org_id', orgId).single();
  if (!doc) return null;
  const { data: items } = await supabase.from('business_document_items')
    .select('id, position, item_id, description, quantity, unit, unit_price, tax_code, net_amount, tax_amount')
    .eq('document_id', id).eq('org_id', orgId).order('position');
  return { ...doc, items: items ?? [] };
}

// Vollständige Prozesskette (vor- und rückwärts) über die Flow-Kanten.
async function loadFlowChain(orgId, docId) {
  const { data: edges } = await supabase.from('business_document_flow')
    .select('source_id, source_type, target_id, target_type, created_at')
    .eq('org_id', orgId);
  const all = edges ?? [];

  // Zusammenhangskomponente um docId sammeln
  const inChain = new Set([docId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const e of all) {
      if (inChain.has(e.source_id) && !inChain.has(e.target_id)) { inChain.add(e.target_id); grew = true; }
      if (inChain.has(e.target_id) && !inChain.has(e.source_id)) { inChain.add(e.source_id); grew = true; }
    }
  }
  const chainEdges = all.filter(e => inChain.has(e.source_id) || inChain.has(e.target_id));

  const docIds = [...inChain];
  const { data: docs } = await supabase.from('business_documents')
    .select('id, doc_type, doc_number, status, amount_gross, doc_date')
    .eq('org_id', orgId).in('id', docIds);
  const { data: invs } = await supabase.from('invoices')
    .select('id, invoice_number, status, amount_gross, invoice_date')
    .eq('org_id', orgId).in('id', docIds);

  const nodes = [
    ...(docs ?? []).map(d => ({ id: d.id, type: d.doc_type, label: DOC_TYPE_LABELS[d.doc_type], number: d.doc_number, status: d.status, amount_gross: d.amount_gross, date: d.doc_date })),
    ...(invs ?? []).map(i => ({ id: i.id, type: 'invoice', label: 'Rechnung', number: i.invoice_number, status: i.status, amount_gross: i.amount_gross, date: i.invoice_date })),
  ];
  return { nodes, edges: chainEdges };
}

function normalizeItems(rawItems) {
  return (rawItems || [])
    .filter(i => (i.description || '').trim())
    .map((i, idx) => ({
      position: idx + 1,
      item_id: i.item_id || null,
      description: String(i.description).trim(),
      quantity: parseFloat(i.quantity) || 1,
      unit: i.unit || 'C62',
      unit_price: parseFloat(i.unit_price) || 0,
      tax_code: isValidTaxCode(i.tax_code) ? i.tax_code : 'S19',
    }));
}

export async function businessRoutes(fastify) {

  // ════════ BELEGE ══════════════════════════════════════════════

  // ── LISTE ────────────────────────────────────────────────────
  fastify.get('/documents', { preHandler: authMiddleware }, async (req, reply) => {
    const { type, status, search, limit = 50, offset = 0 } = req.query;
    let q = supabase.from('business_documents')
      .select(HEADER_FIELDS, { count: 'exact' })
      .eq('org_id', req.org.id)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    if (type && isValidDocType(type)) q = q.eq('doc_type', type);
    if (status) q = q.eq('status', status);
    if (search) {
      const safe = String(search).replace(/[,()%]/g, ' ').trim();
      if (safe) q = q.or(`doc_number.ilike.%${safe}%,partner_name.ilike.%${safe}%,reference.ilike.%${safe}%`);
    }
    const { data, error, count } = await q;
    if (error) {
      req.log.error(error, 'business documents list failed');
      return reply.code(500).send({ error: 'Belege konnten nicht geladen werden' });
    }
    return { documents: data ?? [], total: count ?? 0 };
  });

  // ── ANLEGEN ──────────────────────────────────────────────────
  fastify.post('/documents', {
    preHandler: authMiddleware,
    schema: {
      body: {
        type: 'object',
        required: ['doc_type'],
        properties: {
          doc_type: { type: 'string', enum: DOC_TYPES },
          partner_id: { type: 'string' },
          partner_name: { type: 'string' },
          doc_date: { type: 'string' },
          valid_until: { type: 'string' },
          delivery_date: { type: 'string' },
          payment_terms_days: { type: 'integer', minimum: 0, maximum: 365 },
          reference: { type: 'string' },
          notes: { type: 'string' },
          items: { type: 'array' },
        },
      },
    },
  }, async (req, reply) => {
    const b = req.body;

    // Partner-Snapshot aus Stammdaten (SAP-Prinzip: Beleg friert Daten ein)
    let partner = {
      name: b.partner_name || '', vat_id: null, email: null,
      address: null, zip: null, city: null, country: 'DE',
    };
    if (b.partner_id) {
      const { data: c } = await supabase.from('customers')
        .select('id, name, vat_id, email, address, zip, city, country, payment_terms_days')
        .eq('id', b.partner_id).eq('org_id', req.org.id).single();
      if (!c) return reply.code(400).send({ error: 'Kunde nicht gefunden' });
      partner = { ...c };
      if (b.payment_terms_days === undefined && c.payment_terms_days) b.payment_terms_days = c.payment_terms_days;
    }
    if (!partner.name || partner.name.length < 2) {
      return reply.code(400).send({ error: 'Geschäftspartner fehlt — bitte Kunden wählen oder Namen angeben.' });
    }

    const items = normalizeItems(b.items);
    if (!items.length) return reply.code(400).send({ error: 'Mindestens eine Position mit Beschreibung erforderlich.' });

    const totals = computeTotals(items);
    const warnings = checkTaxPlausibility({ items, partner, totals });
    if (warnings.some(w => w.severity === 'error')) {
      return reply.code(422).send({ error: 'Fachliche Prüfung fehlgeschlagen', warnings });
    }

    const docNumber = await nextDocNumber(req.org.id, b.doc_type);
    const { data: doc, error } = await supabase.from('business_documents').insert({
      org_id: req.org.id,
      doc_type: b.doc_type,
      doc_number: docNumber,
      status: INITIAL_STATUS[b.doc_type],
      partner_id: b.partner_id || null,
      partner_name: partner.name,
      partner_vat_id: partner.vat_id,
      partner_email: partner.email,
      partner_address: partner.address,
      partner_zip: partner.zip,
      partner_city: partner.city,
      partner_country: partner.country || 'DE',
      doc_date: b.doc_date || new Date().toISOString().slice(0, 10),
      valid_until: b.valid_until || null,
      delivery_date: b.delivery_date || null,
      payment_terms_days: b.payment_terms_days ?? null,
      amount_net: totals.amount_net,
      amount_tax: totals.amount_tax,
      amount_gross: totals.amount_gross,
      tax_breakdown: totals.tax_breakdown,
      reference: b.reference || null,
      notes: b.notes || null,
      created_by: req.user?.id || null,
    }).select(HEADER_FIELDS).single();
    if (error) {
      req.log.error(error, 'business document insert failed');
      return reply.code(500).send({ error: 'Beleg konnte nicht angelegt werden' });
    }

    const { error: itemsErr } = await supabase.from('business_document_items').insert(
      totals.items.map(i => ({
        org_id: req.org.id, document_id: doc.id,
        position: i.position, item_id: i.item_id, description: i.description,
        quantity: i.quantity, unit: i.unit, unit_price: i.unit_price,
        tax_code: i.tax_code, net_amount: i.net_amount, tax_amount: i.tax_amount,
      }))
    );
    if (itemsErr) {
      // Kopf ohne Positionen wäre inkonsistent → aufräumen
      await supabase.from('business_documents').delete().eq('id', doc.id).eq('org_id', req.org.id);
      req.log.error(itemsErr, 'business document items insert failed');
      return reply.code(500).send({ error: 'Belegpositionen konnten nicht gespeichert werden' });
    }

    await db.createAuditLog({ org_id: req.org.id, user_id: req.user?.id, action: `${b.doc_type}_created`, details: { doc_number: docNumber, amount_gross: totals.amount_gross } });
    return reply.code(201).send({ document: { ...doc, items: totals.items }, warnings });
  });

  // ── DETAIL (Kopf + Positionen + Belegfluss) ──────────────────
  fastify.get('/documents/:id', { preHandler: authMiddleware }, async (req, reply) => {
    const doc = await loadDocument(req.org.id, req.params.id);
    if (!doc) return reply.code(404).send({ error: 'Beleg nicht gefunden' });
    const flow = await loadFlowChain(req.org.id, doc.id);
    const nextStatuses = TRANSITIONS[doc.doc_type]?.[doc.status] || [];
    const { CONVERSIONS } = await import('../../services/documentFlow.js');
    const convertTargets = (CONVERSIONS[doc.doc_type] || [])
      .filter(t => canConvert(doc.doc_type, doc.status, t).ok);
    return { document: doc, flow, next_statuses: nextStatuses, convert_targets: convertTargets };
  });

  // ── STATUSÜBERGANG ───────────────────────────────────────────
  fastify.patch('/documents/:id/status', {
    preHandler: authMiddleware,
    schema: { body: { type: 'object', required: ['status'], properties: { status: { type: 'string' } } } },
  }, async (req, reply) => {
    const doc = await loadDocument(req.org.id, req.params.id);
    if (!doc) return reply.code(404).send({ error: 'Beleg nicht gefunden' });
    const to = req.body.status;
    if (!canTransition(doc.doc_type, doc.status, to)) {
      return reply.code(409).send({
        error: `Statusübergang "${doc.status}" → "${to}" ist für ${DOC_TYPE_LABELS[doc.doc_type]} nicht zulässig.`,
        allowed: TRANSITIONS[doc.doc_type]?.[doc.status] || [],
      });
    }
    await supabase.from('business_documents')
      .update({ status: to, updated_at: new Date().toISOString() })
      .eq('id', doc.id).eq('org_id', req.org.id);
    await db.createAuditLog({ org_id: req.org.id, user_id: req.user?.id, action: `${doc.doc_type}_status_changed`, details: { doc_number: doc.doc_number, from: doc.status, to } });
    return { id: doc.id, status: to };
  });

  // ── KONVERTIEREN ("Anlegen mit Bezug") ───────────────────────
  fastify.post('/documents/:id/convert', {
    preHandler: authMiddleware,
    schema: { body: { type: 'object', required: ['target_type'], properties: { target_type: { type: 'string', enum: [...DOC_TYPES, 'invoice'] } } } },
  }, async (req, reply) => {
    const source = await loadDocument(req.org.id, req.params.id);
    if (!source) return reply.code(404).send({ error: 'Beleg nicht gefunden' });
    const target = req.body.target_type;

    const check = canConvert(source.doc_type, source.status, target);
    if (!check.ok) return reply.code(409).send({ error: check.reason });

    // ── Ziel: RECHNUNG (in bestehender invoices-Tabelle) ─────────
    if (target === 'invoice') {
      if (source.doc_type === 'order' || source.doc_type === 'delivery') {
        return createInvoiceFromDocument(req, reply, source);
      }
      return reply.code(409).send({ error: 'Nur Aufträge und Lieferungen können fakturiert werden.' });
    }

    // ── Ziel: FOLGEBELEG ─────────────────────────────────────────
    const docNumber = await nextDocNumber(req.org.id, target);
    const { data: newDoc, error } = await supabase.from('business_documents').insert({
      org_id: req.org.id,
      doc_type: target,
      doc_number: docNumber,
      status: INITIAL_STATUS[target],
      partner_id: source.partner_id,
      partner_name: source.partner_name,
      partner_vat_id: source.partner_vat_id,
      partner_email: source.partner_email,
      partner_address: source.partner_address,
      partner_zip: source.partner_zip,
      partner_city: source.partner_city,
      partner_country: source.partner_country,
      payment_terms_days: source.payment_terms_days,
      amount_net: source.amount_net,
      amount_tax: source.amount_tax,
      amount_gross: source.amount_gross,
      tax_breakdown: source.tax_breakdown,
      reference: source.reference,
      source_document_id: source.id,
      created_by: req.user?.id || null,
    }).select(HEADER_FIELDS).single();
    if (error) {
      req.log.error(error, 'convert insert failed');
      return reply.code(500).send({ error: 'Folgebeleg konnte nicht angelegt werden' });
    }

    // Positionen kopieren
    await supabase.from('business_document_items').insert(
      source.items.map(i => ({
        org_id: req.org.id, document_id: newDoc.id,
        position: i.position, item_id: i.item_id, description: i.description,
        quantity: i.quantity, unit: i.unit, unit_price: i.unit_price,
        tax_code: i.tax_code, net_amount: i.net_amount, tax_amount: i.tax_amount,
      }))
    );

    // Belegfluss-Kante + Quellstatus
    await supabase.from('business_document_flow').insert({
      org_id: req.org.id, source_id: source.id, source_type: source.doc_type,
      target_id: newDoc.id, target_type: target,
    });
    const newSourceStatus = SOURCE_STATUS_AFTER_CONVERT[`${source.doc_type}->${target}`];
    if (newSourceStatus) {
      await supabase.from('business_documents')
        .update({ status: newSourceStatus, updated_at: new Date().toISOString() })
        .eq('id', source.id).eq('org_id', req.org.id);
    }

    await db.createAuditLog({ org_id: req.org.id, user_id: req.user?.id, action: `${target}_created_from_${source.doc_type}`, details: { source: source.doc_number, target: docNumber } });
    return reply.code(201).send({ document: newDoc, source_status: newSourceStatus });
  });

  // ── RECHNUNG AUS AUFTRAG/LIEFERUNG ───────────────────────────
  async function createInvoiceFromDocument(req, reply, source) {
    // Doc-Limit greift wie bei manueller Rechnungserstellung
    const limitReply = await checkDocLimit(req, reply);
    if (reply.sent) return limitReply;

    const org = req.org;
    const totals = computeTotals(source.items);
    const warnings = checkTaxPlausibility({
      items: source.items, totals,
      partner: { vat_id: source.partner_vat_id, country: source.partner_country },
    });
    if (warnings.some(w => w.severity === 'error')) {
      return reply.code(422).send({ error: 'Fachliche Prüfung fehlgeschlagen', warnings });
    }

    // Plausibilität: Rechnungssumme vs. Ursprungsbeleg (sollte identisch sein,
    // schlägt an falls Quellbeleg inkonsistent gespeichert wurde)
    const deviation = checkInvoiceAgainstSource(totals.amount_gross, parseFloat(source.amount_gross));
    if (deviation) warnings.push(deviation);

    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const dueDate = source.payment_terms_days
      ? new Date(Date.now() + source.payment_terms_days * 86400000).toISOString().slice(0, 10)
      : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    // line_items im Format der bestehenden Rechnungs-/XML-Logik
    const lineItems = source.items.map(i => ({
      description: i.description, quantity: parseFloat(i.quantity),
      unit_price: parseFloat(i.unit_price), unit: i.unit,
      vat_rate: TAX_CODES[i.tax_code]?.rate ?? 19, tax_code: i.tax_code,
    }));

    const invoiceData = {
      invoice_number: invoiceNumber,
      invoice_date: new Date().toISOString().slice(0, 10),
      due_date: dueDate,
      format: org.default_format || 'xrechnung',
      currency: source.currency || 'EUR',
      seller_name: org.name, seller_vat_id: org.vat_id || '',
      seller_address: org.address || '', seller_city: org.city || '',
      seller_iban: org.iban || '',
      buyer_name: source.partner_name, buyer_vat_id: source.partner_vat_id || '',
      buyer_address: source.partner_address || '', buyer_city: source.partner_city || '',
      buyer_country: source.partner_country || 'DE', buyer_email: source.partner_email || '',
      line_items: lineItems,
      amount_net: totals.amount_net, amount_vat: totals.amount_tax, amount_gross: totals.amount_gross,
      reference: source.reference || source.doc_number,
      notes: totals.notes.join(' ') || null,
    };

    const validation = validateEN16931(invoiceData);
    if (!validation.passed) {
      return reply.code(422).send({ error: 'EN 16931 Validierung fehlgeschlagen — bitte Firmendaten in den Einstellungen vervollständigen.', validation });
    }
    const xml = generateXML(invoiceData);

    const invoice = await db.createInvoice({
      org_id: org.id,
      invoice_number: invoiceNumber,
      invoice_date: invoiceData.invoice_date,
      due_date: dueDate,
      format: invoiceData.format,
      direction: 'outbound',
      status: 'validated',
      delivery_method: org.default_delivery || 'email',
      seller_name: invoiceData.seller_name, seller_vat_id: invoiceData.seller_vat_id || null,
      seller_address: invoiceData.seller_address || null, seller_city: invoiceData.seller_city || null,
      seller_iban: invoiceData.seller_iban || null,
      buyer_name: invoiceData.buyer_name, buyer_vat_id: invoiceData.buyer_vat_id || null,
      buyer_address: invoiceData.buyer_address || null, buyer_city: invoiceData.buyer_city || null,
      buyer_country: invoiceData.buyer_country, buyer_email: invoiceData.buyer_email || null,
      amount_net: totals.amount_net, amount_vat: totals.amount_tax, amount_gross: totals.amount_gross,
      currency: invoiceData.currency,
      line_items: lineItems,
      notes: invoiceData.notes,
      reference: invoiceData.reference,
      xml_content: xml, xml_hash: hashXML(xml),
      validation_result: validation, validation_passed: true,
      source_document_id: source.id,
      created_by: req.user?.id || null,
    });

    // Belegfluss-Kante + Quellstatus 'fakturiert' + invoice_id am Beleg
    await supabase.from('business_document_flow').insert({
      org_id: req.org.id, source_id: source.id, source_type: source.doc_type,
      target_id: invoice.id, target_type: 'invoice',
    });
    await supabase.from('business_documents')
      .update({ status: 'fakturiert', invoice_id: invoice.id, updated_at: new Date().toISOString() })
      .eq('id', source.id).eq('org_id', req.org.id);

    await db.createAuditLog({
      org_id: req.org.id, user_id: req.user?.id, invoice_id: invoice.id,
      action: `invoice_created_from_${source.doc_type}`,
      details: { source: source.doc_number, invoice_number: invoiceNumber, amount_gross: totals.amount_gross },
    });

    return reply.code(201).send({
      invoice: { id: invoice.id, invoice_number: invoiceNumber, status: 'validated', amount_gross: totals.amount_gross },
      warnings,
      tax_breakdown: totals.tax_breakdown,
    });
  }

  // ════════ ARTIKEL / LEISTUNGEN ════════════════════════════════

  fastify.get('/items', { preHandler: authMiddleware }, async (req, reply) => {
    const { search, limit = 100 } = req.query;
    let q = supabase.from('business_items')
      .select('*', { count: 'exact' })
      .eq('org_id', req.org.id).eq('active', true)
      .order('name').limit(parseInt(limit));
    if (search) {
      const safe = String(search).replace(/[,()%]/g, ' ').trim();
      if (safe) q = q.or(`name.ilike.%${safe}%,item_number.ilike.%${safe}%`);
    }
    const { data, error, count } = await q;
    if (error) return reply.code(500).send({ error: 'Artikel konnten nicht geladen werden' });
    return { items: data ?? [], total: count ?? 0 };
  });

  fastify.post('/items', {
    preHandler: authMiddleware,
    schema: {
      body: {
        type: 'object', required: ['name'],
        properties: {
          name: { type: 'string', minLength: 2 },
          item_number: { type: 'string' },
          description: { type: 'string' },
          unit: { type: 'string' },
          unit_price: { type: 'number', minimum: 0 },
          tax_code: { type: 'string', enum: Object.keys(TAX_CODES) },
          external_ref: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const b = req.body;
    const { data, error } = await supabase.from('business_items').insert({
      org_id: req.org.id, name: b.name.trim(), item_number: b.item_number || null,
      description: b.description || null, unit: b.unit || 'C62',
      unit_price: b.unit_price ?? 0, tax_code: b.tax_code || 'S19',
      external_ref: b.external_ref || null,
    }).select('*').single();
    if (error) {
      if ((error.message || '').includes('business_items_org_name_unique')) {
        return reply.code(409).send({ error: 'Ein Artikel mit diesem Namen existiert bereits.' });
      }
      return reply.code(500).send({ error: 'Artikel konnte nicht gespeichert werden' });
    }
    return reply.code(201).send({ item: data });
  });

  fastify.patch('/items/:id', { preHandler: authMiddleware }, async (req, reply) => {
    const allowed = ['name', 'item_number', 'description', 'unit', 'unit_price', 'tax_code', 'external_ref', 'active'];
    const updates = {};
    for (const k of allowed) if (req.body?.[k] !== undefined) updates[k] = req.body[k];
    if (updates.tax_code && !isValidTaxCode(updates.tax_code)) return reply.code(400).send({ error: 'Ungültiges Steuerkennzeichen' });
    if (!Object.keys(updates).length) return reply.code(400).send({ error: 'Keine Felder' });
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from('business_items')
      .update(updates).eq('id', req.params.id).eq('org_id', req.org.id).select('*').single();
    if (error || !data) return reply.code(404).send({ error: 'Artikel nicht gefunden' });
    return { item: data };
  });

  fastify.delete('/items/:id', { preHandler: authMiddleware }, async (req, reply) => {
    // Soft-Delete — Belegpositionen referenzieren item_id
    const { data, error } = await supabase.from('business_items')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('org_id', req.org.id).select('id');
    if (error || !(data ?? []).length) return reply.code(404).send({ error: 'Artikel nicht gefunden' });
    return { message: 'Artikel deaktiviert' };
  });

  // ── STEUERKENNZEICHEN-KATALOG (für Frontend-Selects) ─────────
  fastify.get('/tax-codes', { preHandler: authMiddleware }, async () => ({
    tax_codes: Object.entries(TAX_CODES).map(([code, def]) => ({
      code, rate: def.rate, category: def.category, label: def.label, note: def.note || null,
    })),
  }));
}
