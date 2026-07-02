// tests/taxEngine.test.js — Steuerlogik Stufe 1 (offline)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTotals, checkTaxPlausibility, checkInvoiceAgainstSource, TAX_CODES, isValidTaxCode } from '../services/taxEngine.js';

test('Standardfall 19 %: Netto/Steuer/Brutto korrekt', () => {
  const t = computeTotals([{ quantity: 8, unit_price: 150, tax_code: 'S19' }]);
  assert.equal(t.amount_net, 1200);
  assert.equal(t.amount_tax, 228);
  assert.equal(t.amount_gross, 1428);
  assert.equal(t.tax_breakdown.length, 1);
  assert.equal(t.tax_breakdown[0].code, 'S19');
  assert.equal(t.tax_breakdown[0].category, 'S');
});

test('Gemischte Kennzeichen: Summen pro Kennzeichen getrennt', () => {
  const t = computeTotals([
    { quantity: 1, unit_price: 100, tax_code: 'S19' },
    { quantity: 2, unit_price: 50,  tax_code: 'S7'  },
    { quantity: 1, unit_price: 200, tax_code: 'RC'  },
  ]);
  assert.equal(t.amount_net, 400);
  assert.equal(t.amount_tax, 26); // 19 + 7 + 0
  assert.equal(t.amount_gross, 426);
  const byCode = Object.fromEntries(t.tax_breakdown.map(b => [b.code, b]));
  assert.equal(byCode.S19.tax, 19);
  assert.equal(byCode.S7.tax, 7);
  assert.equal(byCode.RC.tax, 0);
  assert.ok(byCode.RC.note.includes('13b'));
  assert.ok(t.notes.some(n => n.includes('Reverse-Charge')));
});

test('Rundung auf Gruppenebene (keine Cent-Drift bei vielen Kleinpositionen)', () => {
  // 3 × 0,333 € netto: Positionsnetto je round2(0.333)=0.33 → Gruppe 0.99,
  // Steuer round2(0.99*0.19)=0.19 (statt 3×round2(0.0633)=0.18)
  const t = computeTotals([
    { quantity: 1, unit_price: 0.333, tax_code: 'S19' },
    { quantity: 1, unit_price: 0.333, tax_code: 'S19' },
    { quantity: 1, unit_price: 0.333, tax_code: 'S19' },
  ]);
  assert.equal(t.amount_net, 0.99);
  assert.equal(t.amount_tax, 0.19);
  assert.equal(t.amount_gross, 1.18);
});

test('Klassischer Rundungsfall: 19 % von 0,05 €', () => {
  const t = computeTotals([{ quantity: 1, unit_price: 0.05, tax_code: 'S19' }]);
  assert.equal(t.amount_tax, 0.01); // 0.0095 → 0.01 (kaufmännisch)
});

test('Ungültiges Kennzeichen fällt auf S19 zurück', () => {
  const t = computeTotals([{ quantity: 1, unit_price: 100, tax_code: 'XX' }]);
  assert.equal(t.items[0].tax_code, 'S19');
  assert.equal(t.amount_tax, 19);
  assert.equal(isValidTaxCode('XX'), false);
});

test('IG ohne USt-IdNr. des Partners → Fehler-Warnung', () => {
  const w = checkTaxPlausibility({
    items: [{ quantity: 1, unit_price: 100, tax_code: 'IG' }],
    partner: { country: 'FR' },
  });
  assert.ok(w.some(x => x.code === 'IG_VATID_MISSING' && x.severity === 'error'));
});

test('IG mit Empfänger in DE → Warnung', () => {
  const w = checkTaxPlausibility({
    items: [{ quantity: 1, unit_price: 100, tax_code: 'IG' }],
    partner: { country: 'DE', vat_id: 'DE123456789' },
  });
  assert.ok(w.some(x => x.code === 'IG_DOMESTIC'));
});

test('IG korrekt (EU-Ausland + USt-IdNr.) → keine IG-Warnungen', () => {
  const w = checkTaxPlausibility({
    items: [{ quantity: 1, unit_price: 100, tax_code: 'IG' }],
    partner: { country: 'AT', vat_id: 'ATU12345678' },
  });
  assert.ok(!w.some(x => x.code.startsWith('IG_')));
});

test('Mischung S19 + RC → Hinweis-Warnung', () => {
  const w = checkTaxPlausibility({
    items: [
      { quantity: 1, unit_price: 100, tax_code: 'S19' },
      { quantity: 1, unit_price: 100, tax_code: 'RC' },
    ],
    partner: { country: 'DE', vat_id: 'DE123' },
  });
  assert.ok(w.some(x => x.code === 'MIXED_CODES'));
});

test('Belegsumme 0 → Fehler', () => {
  const w = checkTaxPlausibility({ items: [], partner: {} });
  assert.ok(w.some(x => x.code === 'ZERO_TOTAL' && x.severity === 'error'));
});

test('Rechnung vs. Auftrag: identisch → null, Abweichung → Warnung/Fehler', () => {
  assert.equal(checkInvoiceAgainstSource(1428, 1428), null);
  const small = checkInvoiceAgainstSource(1450, 1428);
  assert.equal(small.severity, 'warning');
  const big = checkInvoiceAgainstSource(2000, 1428);
  assert.equal(big.severity, 'error');
  assert.ok(big.msg.includes('weicht'));
});

test('Katalog vollständig: alle Codes haben rate/category/label', () => {
  for (const [code, def] of Object.entries(TAX_CODES)) {
    assert.equal(typeof def.rate, 'number', code);
    assert.ok(def.category, code);
    assert.ok(def.label, code);
  }
});
