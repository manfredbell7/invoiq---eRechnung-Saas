// tests/xmlEngine.test.js — Unit-Tests für den EN-16931-Kern.
// Laufen komplett offline (keine Supabase/AWS/Stripe nötig).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEN16931, generateXRechnung, generateZUGFeRD, generateFacturX,
  generateXML, hashXML, parseSkonto, parseInboundXML,
} from '../services/xmlEngine.js';

const VALID_INVOICE = {
  invoice_number: 'INV-2026-001',
  invoice_date: '2026-07-01',
  due_date: '2026-07-31',
  format: 'xrechnung',
  currency: 'EUR',
  seller_name: 'Verkäufer GmbH',
  seller_vat_id: 'DE123456789',
  seller_address: 'Teststr. 1',
  seller_city: 'Berlin',
  buyer_name: 'Käufer AG',
  buyer_address: 'Käuferstr. 5',
  buyer_city: 'München',
  amount_gross: 1428,
  line_items: [
    { description: 'Beratung', quantity: 8, unit_price: 150, vat_rate: 19 },
  ],
};

test('validateEN16931: vollständige Rechnung besteht', () => {
  const v = validateEN16931(VALID_INVOICE);
  assert.equal(v.passed, true);
  assert.equal(v.errors.length, 0);
});

test('validateEN16931: fehlender Verkäufer → BT-27', () => {
  const v = validateEN16931({ ...VALID_INVOICE, seller_name: '' });
  assert.equal(v.passed, false);
  assert.ok(v.errors.some(e => e.code === 'BT-27'));
});

test('validateEN16931: keine Positionen → BR-16', () => {
  const v = validateEN16931({ ...VALID_INVOICE, line_items: [] });
  assert.equal(v.passed, false);
  assert.ok(v.errors.some(e => e.code === 'BR-16'));
});

test('validateEN16931: Betrag 0 → BT-112', () => {
  const v = validateEN16931({ ...VALID_INVOICE, amount_gross: 0 });
  assert.ok(v.errors.some(e => e.code === 'BT-112'));
});

test('generateXRechnung: UBL 2.1 mit korrekten Summen', () => {
  const xml = generateXRechnung(VALID_INVOICE);
  assert.ok(xml.includes('ubl:Invoice'));
  assert.ok(xml.includes('xrechnung_3.0'));
  assert.ok(xml.includes('<cbc:ID>INV-2026-001</cbc:ID>'));
  assert.ok(xml.includes('InvoiceTypeCode>380'));
  // 8 × 150 = 1200 netto, 228 MwSt, 1428 brutto
  assert.ok(xml.includes('>1200.00<'));
  assert.ok(xml.includes('>228.00<'));
  assert.ok(xml.includes('>1428.00<'));
});

test('generateXRechnung: XML-Sonderzeichen werden escaped', () => {
  const xml = generateXRechnung({
    ...VALID_INVOICE,
    buyer_name: 'Müller & <Söhne> "KG"',
  });
  assert.ok(xml.includes('Müller &amp; &lt;Söhne&gt; &quot;KG&quot;'));
  assert.ok(!xml.includes('<Söhne>'));
});

test('generateZUGFeRD: CII mit gemischten MwSt-Sätzen', () => {
  const xml = generateZUGFeRD({
    ...VALID_INVOICE,
    line_items: [
      { description: 'Ware A', quantity: 1, unit_price: 100, vat_rate: 19 },
      { description: 'Buch', quantity: 2, unit_price: 50, vat_rate: 7 },
    ],
  });
  assert.ok(xml.includes('CrossIndustryInvoice'));
  assert.ok(xml.includes('<ram:RateApplicablePercent>19</ram:RateApplicablePercent>'));
  assert.ok(xml.includes('<ram:RateApplicablePercent>7</ram:RateApplicablePercent>'));
});

test('generateFacturX: offizielle EN16931-Guideline, kein extended-Profil', () => {
  const xml = generateFacturX(VALID_INVOICE);
  assert.ok(xml.includes('<ram:ID>urn:cen.eu:en16931:2017</ram:ID>'));
  assert.ok(!xml.includes('extended'));
});

test('generateXML: Dispatch nach Format', () => {
  assert.ok(generateXML({ ...VALID_INVOICE, format: 'zugferd' }).includes('CrossIndustryInvoice'));
  assert.ok(generateXML({ ...VALID_INVOICE, format: 'xrechnung' }).includes('ubl:Invoice'));
  assert.ok(generateXML({ ...VALID_INVOICE, format: 'peppol' }).includes('ubl:Invoice'));
  assert.ok(generateXML({ ...VALID_INVOICE, format: 'xrechnung-cii' }).includes('CrossIndustryInvoice'));
});

test('generatePeppolBIS: eigene Peppol-CustomizationID (BIS Billing 3.0)', () => {
  const xml = generateXML({ ...VALID_INVOICE, format: 'peppol' });
  assert.ok(xml.includes('urn:fdc:peppol.eu:2017:poacc:billing:3.0'));
  assert.ok(!xml.includes('xrechnung_3.0'));
});

test('generateXRechnungCII: CII-Syntax mit XRechnung-Guideline', () => {
  const xml = generateXML({ ...VALID_INVOICE, format: 'xrechnung-cii' });
  assert.ok(xml.includes('CrossIndustryInvoice'));
  assert.ok(xml.includes('xrechnung_3.0'));
});

test('Steuerkennzeichen RC: Kategorie AE mit Befreiungsgrund im XML', () => {
  const inv = {
    ...VALID_INVOICE,
    line_items: [{ description: 'Bauleistung', quantity: 1, unit_price: 1000, tax_code: 'RC' }],
  };
  const ubl = generateXRechnung(inv);
  assert.ok(ubl.includes('<cbc:ID>AE</cbc:ID>'));
  assert.ok(ubl.includes('TaxExemptionReason'));
  assert.ok(ubl.includes('>0.00<')); // keine Steuer
  const cii = generateZUGFeRD(inv);
  assert.ok(cii.includes('<ram:CategoryCode>AE</ram:CategoryCode>'));
  assert.ok(cii.includes('ExemptionReason'));
});

test('Steuerkennzeichen IG: Kategorie K (innergem. Lieferung)', () => {
  const xml = generateXRechnung({
    ...VALID_INVOICE,
    buyer_country: 'FR', buyer_vat_id: 'FR12345678901',
    line_items: [{ description: 'Ware', quantity: 5, unit_price: 20, tax_code: 'IG' }],
  });
  assert.ok(xml.includes('<cbc:ID>K</cbc:ID>'));
});

test('PaymentMeans: IBAN erscheint als SEPA-Überweisung (Code 58)', () => {
  const inv = { ...VALID_INVOICE, seller_iban: 'DE89 3704 0044 0532 0130 00', seller_bic: 'COBADEFFXXX' };
  const ubl = generateXRechnung(inv);
  assert.ok(ubl.includes('<cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>'));
  assert.ok(ubl.includes('DE89370400440532013000'));
  const cii = generateZUGFeRD(inv);
  assert.ok(cii.includes('<ram:IBANID>DE89370400440532013000</ram:IBANID>'));
  assert.ok(cii.includes('COBADEFFXXX'));
});

test('Leitweg-ID wird als BuyerReference (BT-10) übernommen', () => {
  const xml = generateXRechnung({ ...VALID_INVOICE, leitweg_id: '04011000-1234512345-06' });
  assert.ok(xml.includes('<cbc:BuyerReference>04011000-1234512345-06</cbc:BuyerReference>'));
});

test('Gemischte Steuersätze: getrennte TaxSubtotals mit Gruppenrundung', () => {
  const xml = generateXRechnung({
    ...VALID_INVOICE,
    line_items: [
      { description: 'Ware A', quantity: 1, unit_price: 100, tax_code: 'S19' },
      { description: 'Buch',   quantity: 2, unit_price: 50,  tax_code: 'S7' },
    ],
  });
  // 100 netto @19 = 19.00 · 100 netto @7 = 7.00 · brutto 226.00
  assert.ok(xml.includes('>19.00<'));
  assert.ok(xml.includes('>7.00<'));
  assert.ok(xml.includes('>226.00<'));
});

test('hashXML: deterministisch, 64 Hex-Zeichen', () => {
  const h1 = hashXML('<x/>');
  const h2 = hashXML('<x/>');
  assert.equal(h1, h2);
  assert.match(h1, /^[a-f0-9]{64}$/);
  assert.notEqual(hashXML('<y/>'), h1);
});

test('parseSkonto: CIUS-Format und Freitext', () => {
  assert.deepEqual(parseSkonto('#SKONTO#TAGE=7#PROZENT=2.00#'), { days: 7, percent: 2 });
  assert.deepEqual(parseSkonto('2% Skonto innerhalb 7 Tage'), { days: 7, percent: 2 });
  assert.deepEqual(parseSkonto('3,50 % bei Zahlung innerhalb 14 Tagen'), { days: 14, percent: 3.5 });
  assert.equal(parseSkonto('Zahlbar sofort'), null);
  assert.equal(parseSkonto(null), null);
});

test('parseInboundXML: Roundtrip — eigene XRechnung wird korrekt gelesen', () => {
  const xml = generateXRechnung(VALID_INVOICE);
  const parsed = parseInboundXML(xml);
  assert.equal(parsed.success, true);
  assert.equal(parsed.format, 'xrechnung');
  assert.equal(parsed.data.invoice_number, 'INV-2026-001');
  assert.equal(parsed.data.invoice_date, '2026-07-01');
  assert.equal(parsed.data.seller_name, 'Verkäufer GmbH');
  assert.equal(parsed.data.amount_gross, 1428);
});

test('parseInboundXML: unbekanntes Format wird abgelehnt', () => {
  const parsed = parseInboundXML('<bad>not an invoice</bad>');
  assert.equal(parsed.success, false);
});
