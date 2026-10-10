// Rechnungsdesign-Vorlagen: alle drei Templates rendern gültige PDFs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderInvoicePDF, renderHybridPDF, TEMPLATES } from '../services/pdfRenderer.js';

const invoice = {
  invoice_number: 'TPL-001',
  invoice_date: '2026-09-26',
  due_date: '2026-10-10',
  buyer_name: 'Muster GmbH',
  buyer_address: 'Kundenweg 1',
  buyer_city: 'Berlin',
  line_items: [
    { description: 'Beratung', quantity: 2, unit_price: 100, vat_rate: 19 },
    { description: 'Lizenz', quantity: 1, unit_price: 50, vat_rate: 19 },
  ],
};
const org = {
  name: 'Test AG', address: 'Teststraße 5', city: 'Hamburg', zip: '20095',
  vat_id: 'DE123456789', iban: 'DE89370400440532013000', brand_color: '#0EA5E9',
};

test('TEMPLATES enthält genau fünf Vorlagen', () => {
  assert.deepEqual(Object.keys(TEMPLATES).sort(), ['bold', 'classic', 'compact', 'elegant', 'modern']);
});

for (const tpl of ['classic', 'modern', 'compact', 'elegant', 'bold']) {
  test(`Template "${tpl}" rendert ein gültiges PDF`, async () => {
    const buf = await renderInvoicePDF({ ...invoice, invoice_template: tpl }, org);
    assert.ok(Buffer.isBuffer(buf), 'liefert Buffer');
    assert.equal(buf.subarray(0, 5).toString(), '%PDF-', 'beginnt mit PDF-Header');
    assert.ok(buf.length > 1500, `PDF plausibel groß (${buf.length} Bytes)`);
  });
}

test('unbekanntes Template fällt auf classic zurück (kein Crash)', async () => {
  const buf = await renderInvoicePDF({ ...invoice, invoice_template: 'kaputt' }, org);
  assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
});

test('Org-Default greift, wenn Rechnung kein Template setzt', async () => {
  const buf = await renderInvoicePDF(invoice, { ...org, invoice_template: 'modern' });
  assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
});

// renderInvoicePDF fängt Fehler ab und liefert ein Not-PDF — das verdeckt
// Renderfehler einzelner Vorlagen. renderHybridPDF wirft dagegen durch.
for (const tpl of Object.keys(TEMPLATES)) {
  test(`Template "${tpl}" rendert ohne Not-Fallback`, async () => {
    const buf = await renderHybridPDF({ ...invoice, invoice_template: tpl }, '<x/>', org);
    assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
  });
}
