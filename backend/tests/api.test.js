// tests/api.test.js — invoiq sequential integration tests
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';

// Single test, fully sequential, no subtests
test('invoiq full integration suite', { timeout: 30000 }, async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-min-32-chars-invoiq-test';
  const f = await buildServer();
  await f.ready();

  const req = (opts) => f.inject(opts);
  let token, invoiceId, zugferdId;
  let passed = 0; let failed = 0;

  async function check(name, fn) {
    try { await fn(); passed++; console.log(`  ✅ ${name}`); }
    catch(e) { failed++; console.log(`  ❌ ${name}: ${e.message}`); }
  }

  console.log('\n══════ invoiq API Integration Tests ══════\n');

  // HEALTH
  await check('GET /health → 200', async () => {
    const r = await req({ method:'GET', url:'/health' });
    assert.equal(r.statusCode, 200);
    assert.equal(JSON.parse(r.body).status, 'ok');
  });

  await check('GET /api/v1 → API info', async () => {
    const r = await req({ method:'GET', url:'/api/v1' });
    assert.equal(r.statusCode, 200);
    const b = JSON.parse(r.body);
    assert.ok(b.formats_supported.includes('xrechnung'));
    assert.ok(b.formats_supported.includes('zugferd'));
  });

  // AUTH
  await check('POST /auth/register → 201 + api_key', async () => {
    const r = await req({ method:'POST', url:'/api/v1/auth/register',
      payload: { email:`reg${Date.now()}@test.io`, password:'test12345', full_name:'Test', org_name:'Test GmbH' } });
    assert.equal(r.statusCode, 201);
    assert.match(JSON.parse(r.body).org.api_key, /^iq_live_/);
  });

  await check('POST /auth/login → 200 + token', async () => {
    const r = await req({ method:'POST', url:'/api/v1/auth/login',
      payload: { email:'demo@invoiq.io', password:'demo123' } });
    assert.equal(r.statusCode, 200);
    const b = JSON.parse(r.body);
    assert.ok(b.access_token);
    token = b.access_token; // capture for all subsequent tests
  });

  await check('POST /auth/login → 401 wrong password', async () => {
    const r = await req({ method:'POST', url:'/api/v1/auth/login',
      payload: { email:'demo@invoiq.io', password:'wrong' } });
    assert.equal(r.statusCode, 401);
  });

  await check('GET /auth/me → 200 user+org', async () => {
    const r = await req({ method:'GET', url:'/api/v1/auth/me',
      headers: { authorization:`Bearer ${token}` } });
    assert.equal(r.statusCode, 200);
    assert.equal(JSON.parse(r.body).user.email, 'demo@invoiq.io');
  });

  await check('GET /auth/me → 401 no token', async () => {
    const r = await req({ method:'GET', url:'/api/v1/auth/me' });
    assert.equal(r.statusCode, 401);
  });

  // API KEYS
  await check('API key: valid → 200', async () => {
    const r = await req({ method:'GET', url:'/api/v1/invoices',
      headers: { authorization:'Bearer iq_live_demo_key_001' } });
    assert.equal(r.statusCode, 200);
  });

  await check('API key: invalid → 401', async () => {
    const r = await req({ method:'GET', url:'/api/v1/invoices',
      headers: { authorization:'Bearer iq_live_bad' } });
    assert.equal(r.statusCode, 401);
  });

  // INVOICES
  await check('GET /invoices → list + total > 0', async () => {
    const r = await req({ method:'GET', url:'/api/v1/invoices',
      headers: { authorization:`Bearer ${token}` } });
    assert.equal(r.statusCode, 200);
    const b = JSON.parse(r.body);
    assert.ok(b.total > 0);
    assert.ok(Array.isArray(b.invoices));
  });

  await check('GET /invoices?direction=outbound → filtered', async () => {
    const r = await req({ method:'GET', url:'/api/v1/invoices?direction=outbound',
      headers: { authorization:`Bearer ${token}` } });
    assert.equal(r.statusCode, 200);
    assert.ok(JSON.parse(r.body).invoices.every(i => i.direction === 'outbound'));
  });

  await check('GET /invoices/stats → compliance + plan', async () => {
    const r = await req({ method:'GET', url:'/api/v1/invoices/stats',
      headers: { authorization:`Bearer ${token}` } });
    assert.equal(r.statusCode, 200);
    const b = JSON.parse(r.body);
    assert.ok(b.compliance_score >= 0);
    assert.ok(b.plan?.name);
  });

  await check('POST /invoices → XRechnung EN 16931 validated', async () => {
    const r = await req({ method:'POST', url:'/api/v1/invoices',
      headers: { authorization:`Bearer ${token}` },
      payload: {
        invoice_number:'TEST-2024-001', invoice_date:'2024-01-15', due_date:'2024-02-15',
        format:'xrechnung', delivery_method:'manual',
        seller_name:'Verkäufer GmbH', seller_vat_id:'DE123456789',
        seller_address:'Teststr. 1', seller_city:'Berlin',
        buyer_name:'Käufer AG', buyer_address:'Käuferstr. 5', buyer_city:'München',
        line_items:[
          { description:'SAP Beratungsleistung', quantity:8, unit_price:150, vat_rate:19 },
          { description:'Reisekosten', quantity:1, unit_price:84.5, vat_rate:19 },
        ],
      }
    });
    assert.equal(r.statusCode, 201);
    const b = JSON.parse(r.body);
    assert.equal(b.status, 'validated');
    assert.equal(b.validation.passed, true);
    assert.equal(b.has_xml, true);
    assert.ok(b.amount_gross > 0);
    invoiceId = b.id;
  });

  await check('POST /invoices → 422 missing seller BT-27', async () => {
    const r = await req({ method:'POST', url:'/api/v1/invoices',
      headers: { authorization:`Bearer ${token}` },
      payload: { invoice_number:'BAD', invoice_date:'2024-01-15',
        seller_name:'', buyer_name:'Buyer',
        line_items:[{ description:'x', quantity:1, unit_price:100, vat_rate:19 }] }
    });
    assert.equal(r.statusCode, 422);
    assert.ok(JSON.parse(r.body).validation.errors.some(e => e.code === 'BT-27'));
  });

  await check('POST /invoices → 422 no line items BR-16', async () => {
    const r = await req({ method:'POST', url:'/api/v1/invoices',
      headers: { authorization:`Bearer ${token}` },
      payload: { invoice_number:'BAD2', invoice_date:'2024-01-15',
        seller_name:'Seller', buyer_name:'Buyer', line_items:[] }
    });
    assert.equal(r.statusCode, 422);
    assert.ok(JSON.parse(r.body).validation.errors.some(e => e.code === 'BR-16'));
  });

  await check('GET /invoices/:id → invoice detail', async () => {
    const r = await req({ method:'GET', url:`/api/v1/invoices/${invoiceId}`,
      headers: { authorization:`Bearer ${token}` } });
    assert.equal(r.statusCode, 200);
    assert.equal(JSON.parse(r.body).invoice_number, 'TEST-2024-001');
  });

  await check('GET /invoices/:id/xml → valid XRechnung UBL 2.1', async () => {
    const r = await req({ method:'GET', url:`/api/v1/invoices/${invoiceId}/xml`,
      headers: { authorization:`Bearer ${token}` } });
    assert.equal(r.statusCode, 200);
    assert.ok(r.headers['content-type'].includes('application/xml'));
    assert.ok(r.body.includes('ubl:Invoice'));
    assert.ok(r.body.includes('en16931'));
    assert.ok(r.body.includes('xrechnung'));
    assert.ok(r.body.includes('TEST-2024-001'));
    assert.ok(r.body.includes('Verkäufer GmbH'));
    assert.ok(r.body.includes('SAP Beratungsleistung'));
    assert.ok(r.body.includes('InvoiceTypeCode>380'));
    assert.ok(r.body.includes('TaxTotal'));
    assert.ok(r.body.includes('PayableAmount'));
  });

  await check('POST /invoices (ZUGFeRD) → CII/Factur-X XML', async () => {
    const r = await req({ method:'POST', url:'/api/v1/invoices',
      headers: { authorization:`Bearer ${token}` },
      payload: { invoice_number:'ZUG-001', invoice_date:'2024-01-20',
        format:'zugferd', delivery_method:'manual',
        seller_name:'ZUG Seller GmbH', buyer_name:'ZUG Käufer',
        line_items:[{ description:'Leistung', quantity:2, unit_price:500, vat_rate:19 }] }
    });
    assert.equal(r.statusCode, 201);
    zugferdId = JSON.parse(r.body).id;

    const xr = await req({ method:'GET', url:`/api/v1/invoices/${zugferdId}/xml`,
      headers: { authorization:`Bearer ${token}` } });
    assert.ok(xr.body.includes('CrossIndustryInvoice'));
    assert.ok(xr.body.includes('factur-x'));
    assert.ok(xr.body.includes('ZUG-001'));
  });

  await check('POST /invoices/:id/send → status=sent', async () => {
    const r = await req({ method:'POST', url:`/api/v1/invoices/${invoiceId}/send`,
      headers: { authorization:`Bearer ${token}` },
      payload: { delivery_method:'manual' } });
    assert.equal(r.statusCode, 200);
    assert.equal(JSON.parse(r.body).status, 'sent');
  });

  await check('POST /invoices/:id/archive → GoBD SHA-256 10yr', async () => {
    const r = await req({ method:'POST', url:`/api/v1/invoices/${invoiceId}/archive`,
      headers: { authorization:`Bearer ${token}` } });
    assert.equal(r.statusCode, 200);
    const b = JSON.parse(r.body);
    assert.equal(b.gobd_compliant, true);
    assert.equal(b.retention_years, 10);
    assert.equal(b.file_hash.length, 64);
    assert.ok(b.s3_key.includes(invoiceId));
  });

  await check('POST /invoices/:id/archive → 409 double archive', async () => {
    const r = await req({ method:'POST', url:`/api/v1/invoices/${invoiceId}/archive`,
      headers: { authorization:`Bearer ${token}` } });
    assert.equal(r.statusCode, 409);
  });

  await check('POST /invoices/inbound → parses XRechnung', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>INBOUND-001</cbc:ID><cbc:IssueDate>2024-01-20</cbc:IssueDate>
  <cac:AccountingSupplierParty><cac:Party><cac:PartyName><cbc:Name>Lieferant</cbc:Name></cac:PartyName></cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party><cac:PartyName><cbc:Name>Empfänger</cbc:Name></cac:PartyName></cac:Party></cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="EUR">595.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
</ubl:Invoice>`;
    const r = await req({ method:'POST', url:'/api/v1/invoices/inbound',
      headers: { authorization:`Bearer ${token}` },
      payload: { xml_content: xml } });
    assert.equal(r.statusCode, 201);
    const b = JSON.parse(r.body);
    assert.equal(b.direction, 'inbound');
    assert.equal(b.invoice_number, 'INBOUND-001');
  });

  await check('POST /invoices/inbound → 422 invalid XML', async () => {
    const r = await req({ method:'POST', url:'/api/v1/invoices/inbound',
      headers: { authorization:`Bearer ${token}` },
      payload: { xml_content:'<bad>not an invoice</bad>' } });
    assert.equal(r.statusCode, 422);
  });

  // ARCHIVE
  await check('GET /archive → ≥1 record', async () => {
    const r = await req({ method:'GET', url:'/api/v1/archive',
      headers: { authorization:`Bearer ${token}` } });
    assert.equal(r.statusCode, 200);
    assert.ok(JSON.parse(r.body).total >= 1);
  });

  await check('GET /archive/verify/integrity → 0 failures', async () => {
    const r = await req({ method:'GET', url:'/api/v1/archive/verify/integrity',
      headers: { authorization:`Bearer ${token}` } });
    assert.equal(r.statusCode, 200);
    assert.equal(JSON.parse(r.body).failed, 0);
  });

  await check('GET /archive/audit/logs → audit trail', async () => {
    const r = await req({ method:'GET', url:'/api/v1/archive/audit/logs',
      headers: { authorization:`Bearer ${token}` } });
    assert.equal(r.statusCode, 200);
    assert.ok(JSON.parse(r.body).total > 0);
  });

  // CONNECT
  await check('GET /connect/available → SAP+DATEV+REST', async () => {
    const r = await req({ method:'GET', url:'/api/v1/connect/available' });
    assert.equal(r.statusCode, 200);
    const types = JSON.parse(r.body).connectors.map(c => c.type);
    assert.ok(types.includes('sap_s4'));
    assert.ok(types.includes('sap_ecc'));
    assert.ok(types.includes('datev'));
    assert.ok(types.includes('rest'));
  });

  await check('POST /connect → creates DATEV connection', async () => {
    const r = await req({ method:'POST', url:'/api/v1/connect',
      headers: { authorization:`Bearer ${token}` },
      payload: { type:'datev', name:'DATEV Mandant', config:{ client_id:'abc' } } });
    assert.equal(r.statusCode, 201);
  });

  // WEBHOOKS
  await check('POST /webhooks → 201 + secret', async () => {
    const r = await req({ method:'POST', url:'/api/v1/webhooks',
      headers: { authorization:`Bearer ${token}` },
      payload: { url:'https://example.com/hook', events:['invoice.sent'] } });
    assert.equal(r.statusCode, 201);
    assert.ok(JSON.parse(r.body).secret_shown_once?.length > 20);
  });

  await check('GET /webhooks → secret masked', async () => {
    const r = await req({ method:'GET', url:'/api/v1/webhooks',
      headers: { authorization:`Bearer ${token}` } });
    assert.equal(r.statusCode, 200);
    assert.ok(JSON.parse(r.body).webhooks.every(w => w.secret === '***'));
  });

  await f.close();

  console.log(`\n══════ Results: ${passed} passed / ${failed} failed ══════\n`);
  assert.equal(failed, 0, `${failed} tests failed`);
});
