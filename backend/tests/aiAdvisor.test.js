// tests/aiAdvisor.test.js — KI-Berater-Kern (offline, kein API-Key nötig)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  READ_TOOLS, WRITE_TOOLS, ACTION_TARGETS,
  buildProposal, payloadForExecution, buildToolDefinitions, buildSystemPrompt,
} from '../services/aiAdvisor.js';

test('Tool-Definitionen: jedes Tool hat Name, Beschreibung und Schema', () => {
  const defs = buildToolDefinitions();
  assert.equal(defs.length, Object.keys(READ_TOOLS).length + Object.keys(WRITE_TOOLS).length);
  for (const d of defs) {
    assert.ok(d.name && d.description && d.input_schema, d.name);
    assert.equal(d.input_schema.type, 'object');
  }
});

test('Lese-Tools: Pfade sind org-neutral und URL-encodiert', () => {
  assert.equal(READ_TOOLS.get_kennzahlen.path({}), '/v1/invoices/stats');
  const p = READ_TOOLS.list_invoices.path({ search: 'Müller & Söhne', status: 'paid', limit: 99 });
  assert.ok(p.includes('limit=50'));            // Limit gedeckelt
  assert.ok(p.includes('M%C3%BCller'));         // encodiert
  assert.ok(!p.includes('&&'));
});

test('buildProposal: Rechnung — Summen aus taxEngine, kein Direktschreiben', () => {
  const prop = buildProposal('propose_invoice', {
    buyer_name: 'Mustermann GmbH',
    line_items: [
      { description: 'Beratung', quantity: 10, unit_price: 100, tax_code: 'S19' },
      { description: 'Fachbuch', quantity: 1, unit_price: 50, tax_code: 'S7' },
    ],
  });
  assert.equal(prop.type, 'create_invoice');
  assert.ok(prop.id.length > 10);
  assert.equal(prop.totals.net, 1050);
  assert.equal(prop.totals.tax, 193.5);         // 190 + 3.50
  assert.equal(prop.totals.gross, 1243.5);
  assert.ok(prop.summary.includes('Mustermann'));
  assert.ok(prop.summary.includes('1243.50'));
});

test('buildProposal: IG ohne USt-IdNr. erzeugt Fehler-Warnung', () => {
  const prop = buildProposal('propose_invoice', {
    buyer_name: 'Paris SARL', buyer_country: 'FR',
    line_items: [{ description: 'Ware', quantity: 1, unit_price: 500, tax_code: 'IG' }],
  });
  assert.ok(prop.warnings.some(w => w.code === 'IG_VATID_MISSING' && w.severity === 'error'));
});

test('buildProposal: unbekanntes Tool → null', () => {
  assert.equal(buildProposal('delete_everything', {}), null);
});

test('ACTION_TARGETS: Whitelist enthält nur die drei Create-Aktionen', () => {
  assert.deepEqual(Object.keys(ACTION_TARGETS).sort(),
    ['create_customer', 'create_document', 'create_invoice']);
  for (const t of Object.values(ACTION_TARGETS)) assert.equal(t.method, 'POST');
});

test('payloadForExecution: Rechnung — vat_rate aus tax_code, Draft-Status, Defaults', () => {
  const body = payloadForExecution('create_invoice', {
    buyer_name: 'Mustermann GmbH',
    line_items: [{ description: 'Beratung', quantity: 2, unit_price: 100, tax_code: 'S7' }],
  });
  assert.equal(body.status, 'draft');
  assert.equal(body.line_items[0].vat_rate, 7);
  assert.ok(body.invoice_number.startsWith('RE-'));
  assert.match(body.invoice_date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(body.format, 'xrechnung');
});

test('payloadForExecution: ungültiges tax_code fällt auf S19 zurück', () => {
  const body = payloadForExecution('create_invoice', {
    buyer_name: 'X', line_items: [{ description: 'Y', quantity: 1, unit_price: 10, tax_code: 'HACK' }],
  });
  assert.equal(body.line_items[0].tax_code, 'S19');
  assert.equal(body.line_items[0].vat_rate, 19);
});

test('payloadForExecution: Beleg und Kunde werden korrekt gemappt', () => {
  const doc = payloadForExecution('create_document', {
    doc_type: 'quote', partner_name: 'ACME', items: [{ description: 'A', quantity: 1, unit_price: 5 }],
  });
  assert.equal(doc.doc_type, 'quote');
  assert.equal(doc.items.length, 1);

  const cust = payloadForExecution('create_customer', { name: 'Neu GmbH', vat_id: 'DE1', line_items: [] });
  assert.equal(cust.name, 'Neu GmbH');
  assert.ok(!('line_items' in cust));            // fremde Felder entfernt
  assert.equal(payloadForExecution('drop_table', {}), null);
});

test('System-Prompt: enthält Orgkontext und Bestätigungs-Prinzip', () => {
  const sys = buildSystemPrompt({ name: 'Test AG', plan: 'business' });
  assert.ok(sys.includes('Test AG'));
  assert.ok(sys.includes('VORGESCHLAGEN'));
  assert.ok(sys.includes('XRechnung'));
});
