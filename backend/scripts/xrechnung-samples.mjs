// Erzeugt Beispiel-XRechnungen (UBL + CII) mit vollständigen Stammdaten in
// das übergebene Verzeichnis — Eingabe für den offiziellen KoSIT-Validator
// im Workflow .github/workflows/xrechnung-validate.yml.
//   node scripts/xrechnung-samples.mjs <zielverzeichnis>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateXML, validateEN16931 } from '../services/xmlEngine.js';
import { withSellerDefaults } from '../lib/sellerProfile.js';

const outDir = process.argv[2] || 'xrechnung-samples';
mkdirSync(outDir, { recursive: true });

const org = {
  name: 'Bell Digital UG (haftungsbeschränkt)', address: 'Hauptstraße 5', zip: '01067',
  city: 'Dresden', country: 'DE', vat_id: 'DE317542199', tax_number: '203/113/05688',
  iban: 'DE89370400440532013000', bic: 'COBADEFFXXX', contact_name: 'Manfred Bell',
  phone: '+49 351 123456', email: 'buchhaltung@bell-digital.de',
  register_number: 'HRB 44123', inbound_email_slug: 'bell-digital',
};

const cases = {
  'standard-19': [{ description: 'Beratung E-Rechnungs-Einführung', quantity: 8, unit_price: 120, vat_rate: 19 }],
  'gemischt-19-7': [
    { description: 'Software-Lizenz', quantity: 1, unit_price: 228, vat_rate: 19 },
    { description: 'Fachbuch E-Rechnung', quantity: 2, unit_price: 39.9, vat_rate: 7 },
  ],
  'leitweg-b2g': [{ description: 'Workshop (Pauschale)', quantity: 1, unit_price: 890, vat_rate: 19 }],
};

let failed = 0;
for (const [name, items] of Object.entries(cases)) {
  for (const format of ['xrechnung', 'xrechnung-cii', 'zugferd', 'peppol']) {
    const invoice = withSellerDefaults({
      invoice_number: `TEST-${name}`, invoice_date: '2026-10-10', due_date: '2026-10-24',
      format, currency: 'EUR',
      buyer_name: 'Muster GmbH', buyer_address: 'Kundenweg 12', buyer_zip: '10115',
      buyer_city: 'Berlin', buyer_country: 'DE', buyer_email: 'ap@muster.de',
      buyer_vat_id: 'DE999999999',
      ...(name === 'leitweg-b2g' ? { leitweg_id: '04011000-1234512345-06' } : { reference: 'PO-4711' }),
      line_items: items,
      amount_gross: items.reduce((s, i) => s + i.quantity * i.unit_price * (1 + i.vat_rate / 100), 0),
    }, org);
    const v = validateEN16931(invoice, { outbound: true });
    if (!v.passed) { console.error(`✗ ${name}/${format}: eigene Prüfung`, v.errors); failed++; continue; }
    const ext = { xrechnung: 'ubl', 'xrechnung-cii': 'cii', zugferd: 'zugferd', peppol: 'peppol' }[format];
    const file = join(outDir, `${name}.${ext}.xml`);
    writeFileSync(file, generateXML(invoice));
    console.log(`✓ ${file}`);
  }
}
process.exit(failed ? 1 : 0);
