// XRechnung-Pflichtfelder: XML-Inhalt, Empfänger-Prüfregeln, Verkäuferdaten
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateXML, validateEN16931 } from '../services/xmlEngine.js';
import { withSellerDefaults, sellerFieldsFromOrg } from '../lib/sellerProfile.js';

const org = {
  name: 'Bell Digital UG', address: 'Hauptstraße 5', zip: '01067', city: 'Dresden',
  country: 'DE', vat_id: 'DE317542199', tax_number: '203/113/05688',
  iban: 'DE89 3704 0044 0532 0130 00', bic: 'COBADEFFXXX',
  contact_name: 'Manfred Bell', phone: '+49 351 123456', email: 'buchhaltung@bell.de',
  register_number: 'HRB 44123', inbound_email_slug: 'bell-digital',
};

const base = {
  invoice_number: 'INV-1', invoice_date: '2026-10-10', due_date: '2026-10-24',
  buyer_name: 'Muster GmbH', buyer_address: 'Kundenweg 12', buyer_zip: '10115',
  buyer_city: 'Berlin', buyer_country: 'DE', buyer_email: 'ap@muster.de',
  amount_gross: 119, line_items: [{ description: 'Beratung', quantity: 1, unit_price: 100, vat_rate: 19 }],
};

test('XRechnung UBL enthält alle Verkäufer-/Käufer-Pflichtfelder', () => {
  const xml = generateXML(withSellerDefaults({ ...base, format: 'xrechnung' }, org));
  assert.match(xml, /<cbc:EndpointID schemeID="EM">bell-digital@rechnungen\.invoiq\.de<\/cbc:EndpointID>/, 'BT-34');
  assert.match(xml, /<cbc:EndpointID schemeID="EM">ap@muster\.de<\/cbc:EndpointID>/, 'BT-49');
  assert.match(xml, /<cbc:PostalZone>01067<\/cbc:PostalZone>/, 'BR-DE-4');
  assert.match(xml, /<cbc:PostalZone>10115<\/cbc:PostalZone>/, 'BR-DE-9');
  assert.match(xml, /<cbc:Name>Manfred Bell<\/cbc:Name>/, 'BR-DE-5');
  assert.match(xml, /<cbc:Telephone>\+49 351 123456<\/cbc:Telephone>/, 'BR-DE-6');
  assert.match(xml, /<cbc:ElectronicMail>buchhaltung@bell\.de<\/cbc:ElectronicMail>/, 'BR-DE-7');
  assert.match(xml, /<cbc:CompanyID>203\/113\/05688<\/cbc:CompanyID>\s*<cac:TaxScheme><cbc:ID>FC<\/cbc:ID>/, 'BT-32');
  assert.match(xml, /<cbc:PaymentMeansCode>58<\/cbc:PaymentMeansCode>/, 'BR-DE-1');
});

test('UBL: EndpointID steht als erstes Element in cac:Party (Schema-Reihenfolge)', () => {
  const xml = generateXML(withSellerDefaults({ ...base, format: 'xrechnung' }, org));
  const party = xml.match(/<cac:AccountingSupplierParty>\s*<cac:Party>\s*<([^ >]+)/)[1];
  assert.equal(party, 'cbc:EndpointID');
});

test('Peppol BIS nutzt Peppol-Schema statt E-Mail für Endpunkte', () => {
  const xml = generateXML(withSellerDefaults({ ...base, format: 'peppol', buyer_vat_id: 'DE999999999' }, org));
  assert.match(xml, /<cbc:EndpointID schemeID="9930">DE317542199<\/cbc:EndpointID>/);
  assert.match(xml, /<cbc:EndpointID schemeID="9930">DE999999999<\/cbc:EndpointID>/);
  assert.doesNotMatch(xml, /schemeID="EM"/);
});

test('Explizite Peppol-ID des Käufers (schema:wert) hat Vorrang', () => {
  const xml = generateXML(withSellerDefaults({ ...base, format: 'peppol', buyer_peppol_id: '0204:991-12345-67' }, org));
  assert.match(xml, /<cbc:EndpointID schemeID="0204">991-12345-67<\/cbc:EndpointID>/);
});

test('CII (ZUGFeRD) enthält PLZ, Kontakt, elektronische Adresse, Steuernummer', () => {
  const xml = generateXML(withSellerDefaults({ ...base, format: 'zugferd' }, org));
  assert.match(xml, /<ram:PostcodeCode>01067<\/ram:PostcodeCode>/);
  assert.match(xml, /<ram:PostcodeCode>10115<\/ram:PostcodeCode>/);
  assert.match(xml, /<ram:PersonName>Manfred Bell<\/ram:PersonName>/);
  assert.match(xml, /<ram:CompleteNumber>\+49 351 123456<\/ram:CompleteNumber>/);
  assert.match(xml, /<ram:URIID schemeID="EM">bell-digital@rechnungen\.invoiq\.de<\/ram:URIID>/);
  assert.match(xml, /<ram:ID schemeID="FC">203\/113\/05688<\/ram:ID>/);
});

test('vollständige Stammdaten → XRechnung-Prüfung bestanden', () => {
  const v = validateEN16931(withSellerDefaults({ ...base, format: 'xrechnung' }, org), { outbound: true });
  assert.equal(v.passed, true, JSON.stringify(v.errors));
});

test('fehlende Telefonnummer blockiert XRechnung (BR-DE-6) mit Hinweis auf Einstellungen', () => {
  const v = validateEN16931(withSellerDefaults({ ...base, format: 'xrechnung' }, { ...org, phone: '' }), { outbound: true });
  assert.equal(v.passed, false);
  const e = v.errors.find(x => x.code === 'BR-DE-6');
  assert.ok(e, 'BR-DE-6 fehlt in errors');
  assert.match(e.msg, /Einstellungen/);
});

test('fehlende Käufer-PLZ blockiert XRechnung (BR-DE-9)', () => {
  const v = validateEN16931(withSellerDefaults({ ...base, buyer_zip: '', format: 'xrechnung' }, org), { outbound: true });
  assert.ok(v.errors.some(x => x.code === 'BR-DE-9'));
});

test('weder USt-IdNr. noch Steuernummer → Fehler; eine davon genügt', () => {
  const none = validateEN16931(withSellerDefaults({ ...base, format: 'xrechnung' }, { ...org, vat_id: '', tax_number: '' }), { outbound: true });
  assert.ok(none.errors.some(x => x.code === 'BT-31/32'));
  const onlyTax = validateEN16931(withSellerDefaults({ ...base, format: 'xrechnung' }, { ...org, vat_id: '' }), { outbound: true });
  assert.ok(!onlyTax.errors.some(x => x.code === 'BT-31/32'));
});

test('ZUGFeRD: BR-DE-Regeln nur als Hinweis, nicht blockierend', () => {
  const v = validateEN16931(withSellerDefaults({ ...base, format: 'zugferd' }, { ...org, phone: '' }), { outbound: true });
  assert.equal(v.passed, true);
  assert.ok(v.warnings.some(x => x.code === 'BR-DE-6'));
});

test('ohne outbound-Option (Eingangsrechnungen) keine Empfänger-Regeln', () => {
  const v = validateEN16931({ ...base, seller_name: 'Lieferant', format: 'xrechnung' });
  assert.ok(!v.errors.some(x => String(x.code).startsWith('BR-DE')));
});

test('withSellerDefaults: Rechnungswerte haben Vorrang, leere werden gefüllt', () => {
  const out = withSellerDefaults({ seller_name: 'Abweichend', seller_zip: '', seller_iban: null }, org);
  assert.equal(out.seller_name, 'Abweichend');
  assert.equal(out.seller_zip, '01067');
  assert.equal(out.seller_iban, org.iban);
});

test('Ansprechpartner fällt auf den Benutzernamen zurück', () => {
  const f = sellerFieldsFromOrg({ ...org, contact_name: '' }, { full_name: 'Jana Nutzer' });
  assert.equal(f.seller_contact_name, 'Jana Nutzer');
});

// Ohne korrekte Spezifikationskennung erkennt der KoSIT-Validator das
// Dokument nicht als XRechnung ("kein Prüfszenario hat gegriffen").
test('XRechnung 3.0 nutzt die gültige CustomizationID (xeinkauf.de)', () => {
  const id = 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0';
  const ubl = generateXML(withSellerDefaults({ ...base, format: 'xrechnung' }, org));
  assert.ok(ubl.includes(`<cbc:CustomizationID>${id}</cbc:CustomizationID>`));
  const cii = generateXML(withSellerDefaults({ ...base, format: 'xrechnung-cii' }, org));
  assert.ok(cii.includes(`<ram:ID>${id}</ram:ID>`));
  assert.doesNotMatch(ubl + cii, /xoev-de/);
});

test('Leistungsdatum BT-72: Lieferdatum, sonst Rechnungsdatum (UBL + CII)', () => {
  const ubl = generateXML(withSellerDefaults({ ...base, format: 'xrechnung' }, org));
  assert.match(ubl, /<cbc:ActualDeliveryDate>2026-10-10<\/cbc:ActualDeliveryDate>/);
  const withDelivery = generateXML(withSellerDefaults({ ...base, format: 'xrechnung', delivery_date: '2026-10-01' }, org));
  assert.match(withDelivery, /<cbc:ActualDeliveryDate>2026-10-01<\/cbc:ActualDeliveryDate>/);
  const cii = generateXML(withSellerDefaults({ ...base, format: 'xrechnung-cii' }, org));
  assert.match(cii, /<ram:ActualDeliverySupplyChainEvent>[\s\S]*20261010/);
});

test('XRechnung-CII enthält den Geschäftsprozess (BT-23); ZUGFeRD nicht zwingend', () => {
  const cii = generateXML(withSellerDefaults({ ...base, format: 'xrechnung-cii' }, org));
  assert.match(cii, /<ram:BusinessProcessSpecifiedDocumentContextParameter>\s*<ram:ID>urn:fdc:peppol\.eu:2017:poacc:billing:01:1\.0<\/ram:ID>/);
  const zf = generateXML(withSellerDefaults({ ...base, format: 'zugferd' }, org));
  assert.doesNotMatch(zf, /BusinessProcessSpecifiedDocumentContextParameter/);
});
