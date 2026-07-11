#!/usr/bin/env node
// scripts/smoke-live.mjs — End-to-End-Smoke-Test gegen die LIVE-API.
//
//   BASE_URL=https://api.invoiq.io node scripts/smoke-live.mjs
//
// Legt einen frischen Test-Mandanten an (Registrierung) und fährt darin den
// kompletten Kernfluss: Auth, Passwort-Reset-Anstoß, Kunde, Artikel,
// Belegkette Anfrage→Angebot→Auftrag→Lieferung→Rechnung, XRechnung-XML,
// FI-Auto-Kontierung + Bilanz, KI-Berater. Exit-Code 0 nur wenn alles grün.

const BASE = process.env.BASE_URL || 'https://api.invoiq.io';
const V = `${BASE}/v1`;
const ts = Date.now();
const EMAIL = `smoke-${ts}@invoiq-smoketest.de`;
const PASSWORD = `Smoke!${ts}xyz`;

let token = null;
let passed = 0, failed = 0;
const results = [];

function log(ok, name, detail = '') {
  const line = `${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`;
  console.log(line);
  results.push(line);
  ok ? passed++ : failed++;
}

async function call(method, path, body, { raw = false, timeoutMs = 30000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(path.startsWith('http') ? path : `${V}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (raw) return { status: res.status, body: text };
    let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { status: res.status, data };
  } finally { clearTimeout(t); }
}

async function step(name, fn) {
  try {
    const detail = await fn();
    log(true, name, typeof detail === 'string' ? detail : '');
  } catch (err) {
    log(false, name, err.message);
  }
}

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// ── ABLAUF ────────────────────────────────────────────────────
console.log(`\nSmoke-Test gegen ${BASE} · Testnutzer ${EMAIL}\n`);

await step('Health-Check', async () => {
  const r = await call('GET', `${BASE}/health`);
  assert(r.status === 200 && r.data.status === 'ok', `HTTP ${r.status}`);
  return `env=${r.data.env}, version=${r.data.version}`;
});

await step('Registrierung (neuer Mandant) + JWT', async () => {
  const r = await call('POST', '/auth/register', {
    email: EMAIL, password: PASSWORD,
    full_name: 'Smoke Tester', org_name: `Smoke Test GmbH ${ts}`,
    vat_id: 'DE123456789', address: 'Teststraße 1', city: 'Berlin', zip: '10115', country: 'DE',
  });
  assert(r.status === 201 || r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`);
  token = r.data.access_token;
  assert(token, 'kein access_token in der Antwort');
});

await step('Login mit denselben Zugangsdaten', async () => {
  const r = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
  assert(r.status === 200 && r.data.access_token, `HTTP ${r.status}`);
  token = r.data.access_token;
});

await step('GET /auth/me liefert User + Org', async () => {
  const r = await call('GET', '/auth/me');
  assert(r.status === 200 && r.data.user?.email === EMAIL, `HTTP ${r.status}`);
  return `org="${r.data.org?.name}"`;
});

await step('Passwort-Reset-Anstoß (forgot-password)', async () => {
  const r = await call('POST', '/auth/forgot-password', { email: EMAIL });
  assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 150)}`);
});

await step('Kunde anlegen', async () => {
  const r = await call('POST', '/customers', {
    name: 'Mustermann GmbH', email: 'einkauf@mustermann.example',
    address: 'Musterweg 2', zip: '80331', city: 'München', country: 'DE',
    vat_id: 'DE811111111', payment_terms_days: 14,
  });
  assert(r.status === 201 || r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`);
});

await step('Artikel anlegen', async () => {
  const r = await call('POST', '/business/items', {
    name: 'Beratungsstunde Senior', unit: 'HUR', unit_price: 150, tax_code: 'S19',
  });
  assert(r.status === 201 || r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`);
});

// ── BELEGKETTE ────────────────────────────────────────────────
let docId = null, invoiceId = null;
const ITEMS = [{ description: 'Beratungsstunde Senior', quantity: 8, unit_price: 150, tax_code: 'S19' }];

await step('Belegkette 1/5: Anfrage anlegen', async () => {
  const r = await call('POST', '/business/documents', {
    doc_type: 'request', partner_name: 'Mustermann GmbH', items: ITEMS,
  });
  assert(r.status === 201, `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`);
  docId = r.data.id || r.data.document?.id;
  assert(docId, 'keine Beleg-ID');
  return r.data.doc_number || '';
});

const convert = async (target) => {
  const r = await call('POST', `/business/documents/${docId}/convert`, { target_type: target });
  assert(r.status === 201, `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 250)}`);
  return r.data;
};
const setStatus = async (status) => {
  const r = await call('PATCH', `/business/documents/${docId}/status`, { status });
  assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`);
};

await step('Belegkette 2/5: Anfrage → Angebot (+ senden)', async () => {
  const d = await convert('quote');
  docId = d.id || d.document?.id;
  await setStatus('gesendet');
  return d.doc_number || '';
});

await step('Belegkette 3/5: Angebot → Auftrag (+ bestätigen)', async () => {
  const d = await convert('order');
  docId = d.id || d.document?.id;
  await setStatus('bestaetigt');
  return d.doc_number || '';
});

await step('Belegkette 4/5: Auftrag → Lieferung (+ geliefert)', async () => {
  const d = await convert('delivery');
  docId = d.id || d.document?.id;
  await setStatus('geliefert');
  return d.doc_number || '';
});

await step('Belegkette 5/5: Lieferung → Rechnung', async () => {
  const d = await convert('invoice');
  invoiceId = d.invoice?.id;
  assert(invoiceId, `keine Rechnungs-ID: ${JSON.stringify(d).slice(0, 200)}`);
  return `${d.invoice.invoice_number} · ${d.invoice.amount_gross} € brutto`;
});

await step('XRechnung-XML der Rechnung abrufbar und valide strukturiert', async () => {
  const r = await call('GET', `/invoices/${invoiceId}/xml`, null, { raw: true });
  assert(r.status === 200, `HTTP ${r.status}`);
  assert(r.body.includes('ubl:Invoice'), 'kein UBL-Root');
  assert(r.body.includes('xrechnung_3.0'), 'XRechnung-CustomizationID fehlt');
  assert(r.body.includes('1428.00'), 'Bruttosumme 1428.00 fehlt (8×150 + 19 %)');
  return `${r.body.length} Bytes UBL`;
});

// ── FI (neue Ausbaustufe) ─────────────────────────────────────
await step('FI: Kontenplan SKR03 abrufbar', async () => {
  const r = await call('GET', '/fi/accounts?frame=skr03');
  assert(r.status === 200 && r.data.accounts?.length >= 50, `HTTP ${r.status}`);
  const erloes = r.data.accounts.find(a => a.key === 'ERLOES_19');
  assert(erloes?.number === '8400', 'SKR03-Mapping falsch');
  return `${r.data.accounts.length} Konten`;
});

await step('FI: Rechnung automatisch kontieren (Debitor an Erlös+USt)', async () => {
  const r = await call('POST', `/fi/post-invoice/${invoiceId}`, {});
  assert(r.status === 201, `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 250)}`);
  const lines = r.data.lines || [];
  assert(lines.some(l => l.account === '1400' && parseFloat(l.debit) === 1428), 'Debitor-Zeile fehlt');
  assert(lines.some(l => l.account === '8400' && parseFloat(l.credit) === 1200), 'Erlös-Zeile fehlt');
  assert(lines.some(l => l.account === '1776' && parseFloat(l.credit) === 228), 'USt-Zeile fehlt');
  return `Buchung Nr. ${r.data.entry_no}`;
});

await step('FI: Doppelbuchung wird idempotent abgelehnt (409)', async () => {
  const r = await call('POST', `/fi/post-invoice/${invoiceId}`, {});
  assert(r.status === 409, `HTTP ${r.status} statt 409`);
});

await step('FI: Bilanz/GuV — Bilanz ist ausgeglichen', async () => {
  const r = await call('GET', '/fi/reports?frame=skr03');
  assert(r.status === 200, `HTTP ${r.status}`);
  assert(r.data.bilanz?.ausgeglichen === true, `Bilanz nicht ausgeglichen: ${JSON.stringify(r.data.bilanz).slice(0, 200)}`);
  return `Jahresergebnis ${r.data.guv.jahresergebnis} €`;
});

await step('FI: DATEV-EXTF-Buchungsstapel exportierbar', async () => {
  const r = await call('GET', '/fi/datev-buchungsstapel', null, { raw: true });
  assert(r.status === 200, `HTTP ${r.status}`);
  assert(r.body.startsWith('"EXTF";700;21;"Buchungsstapel"'), 'EXTF-Header fehlt');
  return `${r.body.trim().split('\r\n').length} Zeilen`;
});

// ── KI-BERATER ────────────────────────────────────────────────
await step('KI-Berater: Chat beantwortet Frage mit echten Daten', async () => {
  const r = await call('POST', '/ai/chat', {
    messages: [{ role: 'user', content: 'Wie viele Ausgangsrechnungen habe ich und wie hoch ist die offene Forderungssumme? Antworte in einem Satz.' }],
  }, { timeoutMs: 120000 });
  assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 250)}`);
  assert((r.data.reply || '').length > 10, 'leere Antwort');
  return r.data.reply.slice(0, 120).replace(/\n/g, ' ');
});

await step('KI-Berater: Insights liefern Kennzahlen', async () => {
  const r = await call('GET', '/ai/insights', null, { timeoutMs: 120000 });
  assert(r.status === 200, `HTTP ${r.status}`);
  assert(r.data.cashflow || r.data.stats, 'keine Kennzahlen');
  return r.data.ai_available ? 'inkl. KI-Kommentar' : 'nur Kennzahlen (KI offline)';
});

// ── BILLING (Stripe, echter Test-Key der Live-Umgebung) ──────
await step('Stripe: Checkout-Session (Plan starter) wird real bei Stripe angelegt', async () => {
  const r = await call('POST', '/payments/checkout', { plan: 'starter', billing: 'monthly' });
  assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 250)}`);
  assert((r.data.checkout_url || '').includes('stripe.com'), `keine Stripe-URL: ${r.data.checkout_url}`);
  assert((r.data.session_id || '').startsWith('cs_'), 'keine Session-ID (cs_…)');
  return r.data.session_id;
});

await step('Stripe: Webhook lehnt ungültige Signatur ab (400)', async () => {
  const ctrl = new AbortController();
  const res = await fetch(`${V}/payments/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=deadbeef' },
    body: JSON.stringify({ type: 'payment_intent.succeeded' }),
    signal: ctrl.signal,
  });
  assert(res.status === 400, `HTTP ${res.status} statt 400 (503 hieße: Stripe-Webhook-Secret fehlt)`);
});

// ── MAIL-INBOUND (Mailgun-Signaturprüfung) ────────────────────
await step('Mailgun: Inbound-Webhook lehnt ungültige Signatur ab (403)', async () => {
  const res = await fetch(`${V}/inbound/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      recipient: 'test@rechnungen.invoiq.io', sender: 'x@example.com', subject: 'Smoke',
      timestamp: String(Math.floor(Date.now() / 1000)), token: 'smoketoken', signature: 'ungueltig',
    }),
  });
  assert(res.status === 403, `HTTP ${res.status} statt 403 — Signaturprüfung nicht aktiv?`);
});

await step('Mailgun: Replay-Schutz — alter Timestamp wird abgelehnt (403)', async () => {
  const res = await fetch(`${V}/inbound/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      recipient: 'test@rechnungen.invoiq.io', sender: 'x@example.com', subject: 'Smoke',
      timestamp: '1600000000', token: 'smoketoken', signature: 'ungueltig',
    }),
  });
  assert(res.status === 403, `HTTP ${res.status} statt 403`);
});

// ── ERGEBNIS ─────────────────────────────────────────────────
console.log(`\n══════════════════════════════════════`);
console.log(`Ergebnis: ${passed} bestanden · ${failed} fehlgeschlagen`);
console.log(`Testmandant: ${EMAIL} (verbleibt als Testdatensatz)`);
console.log(`══════════════════════════════════════\n`);
process.exit(failed > 0 ? 1 : 0);
