// services/xmlEngine.js
// EN-16931-Engine v2 — Generatoren für alle geforderten Profile:
//   XRechnung 3.0 (UBL 2.1)          → generateXRechnung
//   XRechnung 3.0 (UN/CEFACT CII)    → generateXRechnungCII
//   Peppol BIS Billing 3.0 (UBL)     → generatePeppolBIS
//   ZUGFeRD 2.3 EN16931 (CII)        → generateZUGFeRD
//   Factur-X 1.0 EN16931 (CII, FR)   → generateFacturX
//
// Steuerlogik: UNTDID-5305-Kategorien (S/E/AE/K) kommen aus dem
// taxEngine-Steuerkennzeichen der Position (tax_code); Positionen ohne
// tax_code fallen auf vat_rate zurück (19/7 → S, 0 → E). Befreiungsgründe
// (BT-120) werden je Kategorie ausgewiesen — Pflicht bei E/AE/K.

import { createHash } from 'crypto';
import { TAX_CODES, isValidTaxCode } from './taxEngine.js';

// ── PROFIL-KENNUNGEN ─────────────────────────────────────────
export const PROFILES = {
  XRECHNUNG_UBL: {
    customizationId: 'urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0',
    profileId: 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0',
  },
  PEPPOL_BIS: {
    customizationId: 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0',
    profileId: 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0',
  },
  // ZUGFeRD 2.3 und Factur-X 1.0 sind im Profil EN 16931 technisch identisch
  // (gemeinsamer deutsch-französischer Standard); offizielle Guideline-URN:
  XRECHNUNG_CII: 'urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0',
  ZUGFERD_EN16931: 'urn:cen.eu:en16931:2017',
  FACTURX_EN16931: 'urn:cen.eu:en16931:2017',
};

// ── HELPERS ───────────────────────────────────────────────────
const esc = (str) => String(str || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const fmt = (n) => (Math.round((parseFloat(n) || 0) * 100) / 100).toFixed(2);
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Steuer-Metadaten einer Position: Kennzeichen hat Vorrang vor vat_rate.
function taxMeta(item) {
  if (item.tax_code && isValidTaxCode(item.tax_code)) {
    const def = TAX_CODES[item.tax_code];
    return { rate: def.rate, category: def.category, note: def.note || null };
  }
  const rate = item.vat_rate !== undefined ? parseFloat(item.vat_rate) : 19;
  if (rate > 0) return { rate, category: 'S', note: null };
  return { rate: 0, category: 'E', note: 'Steuerfreie Leistung.' };
}

// Gruppierung nach Kategorie+Satz (BG-23) mit Rundung auf Gruppenebene.
function buildTaxGroups(items) {
  const groups = new Map();
  let net = 0;
  for (const it of items) {
    const meta = taxMeta(it);
    const lineNet = round2((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0));
    net = round2(net + lineNet);
    const key = `${meta.category}:${meta.rate}`;
    const g = groups.get(key) || { ...meta, taxable: 0 };
    g.taxable = round2(g.taxable + lineNet);
    groups.set(key, g);
  }
  let tax = 0;
  for (const g of groups.values()) {
    g.tax = round2(g.taxable * (g.rate / 100));
    tax = round2(tax + g.tax);
  }
  return { groups: [...groups.values()], net, tax, gross: round2(net + tax) };
}

// ── EN 16931 VALIDATION ───────────────────────────────────────
/**
 * @param {object} invoice
 * @param {{outbound?: boolean}} [opts]  outbound: true → zusätzlich die
 *   Pflichtregeln der Empfängerseite prüfen (XRechnung BR-DE-*, Peppol-
 *   Endpunkte). Für geparste Eingangsrechnungen NICHT setzen.
 */
export function validateEN16931(invoice, opts = {}) {
  const errors = [];
  const warnings = [];

  if (!invoice.invoice_number) errors.push({ code: 'BT-1', msg: 'Rechnungsnummer fehlt (BT-1)' });
  if (!invoice.invoice_date) errors.push({ code: 'BT-2', msg: 'Rechnungsdatum fehlt (BT-2)' });
  if (!invoice.seller_name) errors.push({ code: 'BT-27', msg: 'Name des Verkäufers fehlt (BT-27)' });
  if (!invoice.buyer_name) errors.push({ code: 'BT-44', msg: 'Name des Käufers fehlt (BT-44)' });
  if (!invoice.seller_vat_id) warnings.push({ code: 'BT-31', msg: 'USt-IdNr. des Verkäufers empfohlen (BT-31)' });
  if (!invoice.amount_gross || invoice.amount_gross <= 0)
    errors.push({ code: 'BT-112', msg: 'Rechnungsbetrag ungültig (BT-112)' });
  if (!invoice.line_items || invoice.line_items.length === 0)
    errors.push({ code: 'BR-16', msg: 'Mindestens eine Rechnungsposition erforderlich (BR-16)' });

  (invoice.line_items || []).forEach((item, i) => {
    if (!item.description) errors.push({ code: `BT-153-L${i+1}`, msg: `Position ${i+1}: Beschreibung fehlt` });
    if (!item.quantity || item.quantity <= 0) errors.push({ code: `BT-129-L${i+1}`, msg: `Position ${i+1}: Menge ungültig` });
    if (item.unit_price === undefined) errors.push({ code: `BT-146-L${i+1}`, msg: `Position ${i+1}: Einzelpreis fehlt` });
    if (item.vat_rate === undefined && !item.tax_code)
      warnings.push({ code: `BT-152-L${i+1}`, msg: `Position ${i+1}: MwSt-Satz/Steuerkennzeichen nicht angegeben` });
  });

  if (!invoice.due_date) warnings.push({ code: 'BT-9', msg: 'Fälligkeitsdatum empfohlen (BT-9)' });
  // XRechnung: BT-10 (BuyerReference/Leitweg-ID) ist Pflicht bei öffentlichen
  // Auftraggebern — ohne echte Leitweg-ID nur Warnung.
  if ((invoice.format || 'xrechnung').startsWith('xrechnung') && !invoice.leitweg_id && !invoice.reference)
    warnings.push({ code: 'BT-10', msg: 'Leitweg-ID/BuyerReference empfohlen (XRechnung-Pflicht bei Behörden, BT-10)' });

  if (opts.outbound) checkRecipientRules(invoice, errors, warnings);

  const passed = errors.length === 0;
  return { passed, errors, warnings, standard: 'EN 16931', version: '1.3.4' };
}

// Pflichtangaben, ohne die eine XRechnung vom Empfänger (KoSIT-Validator,
// Behörden-Portale ZRE/OZG-RE) abgelehnt wird. Bei XRechnung blockierend,
// bei ZUGFeRD/Factur-X als Hinweis; bei Peppol blockieren die Endpunkte.
const SETTINGS = 'Einstellungen → Unternehmen';
function checkRecipientRules(inv, errors, warnings) {
  const fmt = String(inv.format || 'xrechnung').toLowerCase();
  const isXR = fmt.startsWith('xrechnung');
  const isPeppol = fmt === 'peppol';
  const has = (v) => v !== undefined && v !== null && String(v).trim() !== '';
  const brDe = isXR ? errors : warnings;
  const endpointList = (isXR || isPeppol) ? errors : warnings;

  const sellerRules = [
    ['BR-DE-3', inv.seller_city, `Ort des Verkäufers fehlt (BR-DE-3) — ${SETTINGS}`],
    ['BR-DE-4', inv.seller_zip, `PLZ des Verkäufers fehlt (BR-DE-4) — ${SETTINGS}`],
    ['BR-DE-5', inv.seller_contact_name, `Ansprechpartner fehlt (BR-DE-5) — ${SETTINGS}`],
    ['BR-DE-6', inv.seller_phone, `Telefonnummer des Verkäufers fehlt (BR-DE-6) — ${SETTINGS}`],
    ['BR-DE-7', inv.seller_email, `E-Mail des Verkäufers fehlt (BR-DE-7) — ${SETTINGS}`],
    ['BT-31/32', has(inv.seller_vat_id) || has(inv.seller_tax_number), `USt-IdNr. oder Steuernummer des Verkäufers fehlt (§ 14 UStG, BT-31/BT-32) — ${SETTINGS}`],
    ['BR-DE-1', inv.seller_iban, `Zahlungsinformationen fehlen: IBAN des Verkäufers (BR-DE-1) — ${SETTINGS}`],
  ];
  for (const [code, val, msg] of sellerRules) {
    const ok = typeof val === 'boolean' ? val : has(val);
    if (!ok) brDe.push({ code, msg });
  }

  const buyerRules = [
    ['BR-DE-8', inv.buyer_city, 'Ort des Rechnungsempfängers fehlt (BR-DE-8)'],
    ['BR-DE-9', inv.buyer_zip, 'PLZ des Rechnungsempfängers fehlt (BR-DE-9)'],
  ];
  for (const [code, val, msg] of buyerRules) if (!has(val)) brDe.push({ code, msg });

  if (!has(inv.seller_endpoint_email) && !has(inv.seller_email) && !has(inv.seller_peppol_id) && !(isPeppol && has(inv.seller_vat_id)))
    endpointList.push({ code: 'BT-34', msg: `Elektronische Adresse des Verkäufers fehlt (BT-34) — ${SETTINGS}` });
  if (!has(inv.buyer_email) && !has(inv.buyer_peppol_id) && !has(inv.buyer_vat_id))
    endpointList.push({ code: 'BT-49', msg: 'E-Mail-Adresse oder USt-IdNr. des Rechnungsempfängers fehlt (elektronische Adresse, BT-49)' });
}


// Elektronische Adresse (BT-34 Verkäufer / BT-49 Käufer) — seit XRechnung 3.0
// Pflicht. XRechnung akzeptiert E-Mail (schemeID "EM"); Peppol BIS verlangt
// ein Peppol-Schema (9930 = DE-USt-IdNr., 0204 = Leitweg-ID) bzw. die
// explizit hinterlegte Peppol-ID "schema:wert".
function endpointFor({ peppolId, vatId, email }, peppol) {
  if (peppolId && /^\d{4}:.+/.test(peppolId)) {
    const [scheme, ...rest] = String(peppolId).split(':');
    return { scheme, id: rest.join(':') };
  }
  if (peppol && vatId) return { scheme: '9930', id: String(vatId).replace(/\s/g, '') };
  if (email) return { scheme: 'EM', id: email };
  if (vatId) return { scheme: '9930', id: String(vatId).replace(/\s/g, '') };
  return null;
}

// ── UBL-GENERATOR (XRechnung UBL / Peppol BIS 3.0) ────────────
function generateUBL(invoice, profile) {
  const cur = invoice.currency || 'EUR';
  const items = invoice.line_items || [];
  const t = buildTaxGroups(items);
  const buyerRef = invoice.leitweg_id || invoice.reference || invoice.buyer_name;
  const notes = [...new Set(t.groups.map(g => g.note).filter(Boolean))];
  const isPeppol = profile === PROFILES.PEPPOL_BIS;
  const sellerEp = endpointFor({ peppolId: invoice.seller_peppol_id, vatId: invoice.seller_vat_id, email: invoice.seller_endpoint_email || invoice.seller_email }, isPeppol);
  const buyerEp  = endpointFor({ peppolId: invoice.buyer_peppol_id,  vatId: invoice.buyer_vat_id,  email: invoice.buyer_email }, isPeppol);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice
  xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">

  <!-- Generated by invoiq — https://invoiq.de · EN 16931 / UBL 2.1 -->

  <cbc:CustomizationID>${profile.customizationId}</cbc:CustomizationID>
  <cbc:ProfileID>${profile.profileId}</cbc:ProfileID>
  <cbc:ID>${esc(invoice.invoice_number)}</cbc:ID>
  <cbc:IssueDate>${invoice.invoice_date}</cbc:IssueDate>
  ${invoice.due_date ? `<cbc:DueDate>${invoice.due_date}</cbc:DueDate>` : ''}
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  ${notes.map(n => `<cbc:Note>${esc(n)}</cbc:Note>`).join('\n  ')}
  <cbc:DocumentCurrencyCode>${cur}</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${esc(buyerRef)}</cbc:BuyerReference>

  <!-- Seller (BG-4) -->
  <cac:AccountingSupplierParty>
    <cac:Party>
      ${sellerEp ? `<cbc:EndpointID schemeID="${sellerEp.scheme}">${esc(sellerEp.id)}</cbc:EndpointID>` : ''}
      <cac:PartyName><cbc:Name>${esc(invoice.seller_name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(invoice.seller_address || '')}</cbc:StreetName>
        <cbc:CityName>${esc(invoice.seller_city || '')}</cbc:CityName>
        ${invoice.seller_zip ? `<cbc:PostalZone>${esc(invoice.seller_zip)}</cbc:PostalZone>` : ''}
        <cac:Country><cbc:IdentificationCode>${invoice.seller_country || 'DE'}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${invoice.seller_vat_id ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(invoice.seller_vat_id)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>` : ''}
      ${invoice.seller_tax_number ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(invoice.seller_tax_number)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>FC</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>` : ''}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(invoice.seller_name)}</cbc:RegistrationName>
        ${invoice.seller_register_number ? `<cbc:CompanyID>${esc(invoice.seller_register_number)}</cbc:CompanyID>` : ''}
      </cac:PartyLegalEntity>
      ${(invoice.seller_contact_name || invoice.seller_phone || invoice.seller_email) ? `
      <cac:Contact>
        ${invoice.seller_contact_name ? `<cbc:Name>${esc(invoice.seller_contact_name)}</cbc:Name>` : ''}
        ${invoice.seller_phone ? `<cbc:Telephone>${esc(invoice.seller_phone)}</cbc:Telephone>` : ''}
        ${invoice.seller_email ? `<cbc:ElectronicMail>${esc(invoice.seller_email)}</cbc:ElectronicMail>` : ''}
      </cac:Contact>` : ''}
    </cac:Party>
  </cac:AccountingSupplierParty>

  <!-- Buyer (BG-7) -->
  <cac:AccountingCustomerParty>
    <cac:Party>
      ${buyerEp ? `<cbc:EndpointID schemeID="${buyerEp.scheme}">${esc(buyerEp.id)}</cbc:EndpointID>` : ''}
      <cac:PartyName><cbc:Name>${esc(invoice.buyer_name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(invoice.buyer_address || '')}</cbc:StreetName>
        <cbc:CityName>${esc(invoice.buyer_city || '')}</cbc:CityName>
        ${invoice.buyer_zip ? `<cbc:PostalZone>${esc(invoice.buyer_zip)}</cbc:PostalZone>` : ''}
        <cac:Country><cbc:IdentificationCode>${invoice.buyer_country || 'DE'}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${invoice.buyer_vat_id ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(invoice.buyer_vat_id)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>` : ''}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(invoice.buyer_name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <!-- PaymentMeans (BG-16): 58 = SEPA-Überweisung -->
  ${invoice.seller_iban ? `
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cbc:PaymentID>${esc(invoice.invoice_number)}</cbc:PaymentID>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${esc(String(invoice.seller_iban).replace(/\s/g, ''))}</cbc:ID>
      <cbc:Name>${esc(invoice.seller_name)}</cbc:Name>
      ${invoice.seller_bic ? `<cac:FinancialInstitutionBranch><cbc:ID>${esc(invoice.seller_bic)}</cbc:ID></cac:FinancialInstitutionBranch>` : ''}
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>` : ''}
  ${invoice.payment_terms ? `
  <cac:PaymentTerms><cbc:Note>${esc(invoice.payment_terms)}</cbc:Note></cac:PaymentTerms>` : ''}

  <!-- VAT Breakdown (BG-23) -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${cur}">${fmt(t.tax)}</cbc:TaxAmount>
    ${t.groups.map(g => `
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${cur}">${fmt(g.taxable)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${cur}">${fmt(g.tax)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${g.category}</cbc:ID>
        <cbc:Percent>${g.rate}</cbc:Percent>
        ${g.category !== 'S' && g.note ? `<cbc:TaxExemptionReason>${esc(g.note)}</cbc:TaxExemptionReason>` : ''}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`).join('')}
  </cac:TaxTotal>

  <!-- Totals (BG-22) -->
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${cur}">${fmt(t.net)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${cur}">${fmt(t.net)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${cur}">${fmt(t.gross)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${cur}">${fmt(t.gross)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  <!-- Line Items (BG-25) -->
  ${items.map((item, idx) => {
    const meta = taxMeta(item);
    const lineNet = round2((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0));
    return `
  <cac:InvoiceLine>
    <cbc:ID>${idx + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${item.unit || 'C62'}">${item.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${cur}">${fmt(lineNet)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>${esc(item.description)}</cbc:Description>
      <cbc:Name>${esc(item.description)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${meta.category}</cbc:ID>
        <cbc:Percent>${meta.rate}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${cur}">${fmt(item.unit_price)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
  }).join('')}

</ubl:Invoice>`;

  return xml.trim();
}

export function generateXRechnung(invoice) {
  return generateUBL(invoice, PROFILES.XRECHNUNG_UBL);
}

export function generatePeppolBIS(invoice) {
  return generateUBL(invoice, PROFILES.PEPPOL_BIS);
}

// ── CII-GENERATOR (ZUGFeRD 2.3 / Factur-X 1.0 / XRechnung-CII) ─
function generateCII(invoice, guidelineId, label) {
  const cur = invoice.currency || 'EUR';
  const items = invoice.line_items || [];
  const t = buildTaxGroups(items);
  const buyerRef = invoice.leitweg_id || invoice.reference || null;
  const dt = (d) => (d || '').replace(/-/g, '');
  const sellerEp = endpointFor({ peppolId: invoice.seller_peppol_id, vatId: invoice.seller_vat_id, email: invoice.seller_endpoint_email || invoice.seller_email }, false);
  const buyerEp  = endpointFor({ peppolId: invoice.buyer_peppol_id,  vatId: invoice.buyer_vat_id,  email: invoice.buyer_email }, false);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">

  <!-- Generated by invoiq — ${label} / EN 16931 -->

  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>${guidelineId}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <rsm:ExchangedDocument>
    <ram:ID>${esc(invoice.invoice_number)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${dt(invoice.invoice_date)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>
    ${items.map((item, idx) => {
      const meta = taxMeta(item);
      const lineNet = round2((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0));
      return `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${idx + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${esc(item.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${fmt(item.unit_price)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${item.unit || 'C62'}">${item.quantity}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${meta.category}</ram:CategoryCode>
          <ram:RateApplicablePercent>${meta.rate}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${fmt(lineNet)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
    }).join('')}

    <ram:ApplicableHeaderTradeAgreement>
      ${buyerRef ? `<ram:BuyerReference>${esc(buyerRef)}</ram:BuyerReference>` : ''}
      <ram:SellerTradeParty>
        <ram:Name>${esc(invoice.seller_name)}</ram:Name>
        ${invoice.seller_register_number ? `
        <ram:SpecifiedLegalOrganization><ram:ID>${esc(invoice.seller_register_number)}</ram:ID></ram:SpecifiedLegalOrganization>` : ''}
        ${(invoice.seller_contact_name || invoice.seller_phone || invoice.seller_email) ? `
        <ram:DefinedTradeContact>
          ${invoice.seller_contact_name ? `<ram:PersonName>${esc(invoice.seller_contact_name)}</ram:PersonName>` : ''}
          ${invoice.seller_phone ? `<ram:TelephoneUniversalCommunication><ram:CompleteNumber>${esc(invoice.seller_phone)}</ram:CompleteNumber></ram:TelephoneUniversalCommunication>` : ''}
          ${invoice.seller_email ? `<ram:EmailURIUniversalCommunication><ram:URIID>${esc(invoice.seller_email)}</ram:URIID></ram:EmailURIUniversalCommunication>` : ''}
        </ram:DefinedTradeContact>` : ''}
        <ram:PostalTradeAddress>
          ${invoice.seller_zip ? `<ram:PostcodeCode>${esc(invoice.seller_zip)}</ram:PostcodeCode>` : ''}
          <ram:LineOne>${esc(invoice.seller_address || '')}</ram:LineOne>
          <ram:CityName>${esc(invoice.seller_city || '')}</ram:CityName>
          <ram:CountryID>${invoice.seller_country || 'DE'}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${sellerEp ? `
        <ram:URIUniversalCommunication><ram:URIID schemeID="${sellerEp.scheme}">${esc(sellerEp.id)}</ram:URIID></ram:URIUniversalCommunication>` : ''}
        ${invoice.seller_tax_number ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="FC">${esc(invoice.seller_tax_number)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
        ${invoice.seller_vat_id ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${esc(invoice.seller_vat_id)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${esc(invoice.buyer_name)}</ram:Name>
        <ram:PostalTradeAddress>
          ${invoice.buyer_zip ? `<ram:PostcodeCode>${esc(invoice.buyer_zip)}</ram:PostcodeCode>` : ''}
          <ram:LineOne>${esc(invoice.buyer_address || '')}</ram:LineOne>
          <ram:CityName>${esc(invoice.buyer_city || '')}</ram:CityName>
          <ram:CountryID>${invoice.buyer_country || 'DE'}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${buyerEp ? `
        <ram:URIUniversalCommunication><ram:URIID schemeID="${buyerEp.scheme}">${esc(buyerEp.id)}</ram:URIID></ram:URIUniversalCommunication>` : ''}
        ${invoice.buyer_vat_id ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${esc(invoice.buyer_vat_id)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery/>

    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${cur}</ram:InvoiceCurrencyCode>
      ${invoice.seller_iban ? `
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${esc(String(invoice.seller_iban).replace(/\s/g, ''))}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
        ${invoice.seller_bic ? `
        <ram:PayeeSpecifiedCreditorFinancialInstitution>
          <ram:BICID>${esc(invoice.seller_bic)}</ram:BICID>
        </ram:PayeeSpecifiedCreditorFinancialInstitution>` : ''}
      </ram:SpecifiedTradeSettlementPaymentMeans>` : ''}
      ${t.groups.map(g => `
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${fmt(g.tax)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        ${g.category !== 'S' && g.note ? `<ram:ExemptionReason>${esc(g.note)}</ram:ExemptionReason>` : ''}
        <ram:BasisAmount>${fmt(g.taxable)}</ram:BasisAmount>
        <ram:CategoryCode>${g.category}</ram:CategoryCode>
        <ram:RateApplicablePercent>${g.rate}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`).join('')}
      ${invoice.due_date ? `
      <ram:SpecifiedTradePaymentTerms>
        ${invoice.payment_terms ? `<ram:Description>${esc(invoice.payment_terms)}</ram:Description>` : ''}
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${dt(invoice.due_date)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>` : ''}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${fmt(t.net)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${fmt(t.net)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${cur}">${fmt(t.tax)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${fmt(t.gross)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${fmt(t.gross)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>

</rsm:CrossIndustryInvoice>`;

  return xml.trim();
}

export function generateZUGFeRD(invoice) {
  return generateCII(invoice, PROFILES.ZUGFERD_EN16931, 'ZUGFeRD 2.3 EN16931');
}

export function generateFacturX(invoice) {
  return generateCII(invoice, PROFILES.FACTURX_EN16931, 'Factur-X 1.0 EN16931');
}

export function generateXRechnungCII(invoice) {
  return generateCII(invoice, PROFILES.XRECHNUNG_CII, 'XRechnung 3.0 CII');
}

// ── DISPATCH ─────────────────────────────────────────────────
export function generateXML(invoice) {
  switch (invoice.format) {
    case 'zugferd':        return generateZUGFeRD(invoice);
    case 'facturx':        return generateFacturX(invoice);
    case 'xrechnung-cii':  return generateXRechnungCII(invoice);
    case 'peppol':         return generatePeppolBIS(invoice);
    case 'xrechnung':
    default:               return generateXRechnung(invoice);
  }
}

// ── HASH (GoBD integrity) ─────────────────────────────────────
export function hashXML(xml) {
  return createHash('sha256').update(xml, 'utf8').digest('hex');
}

// ── SKONTO PARSER ─────────────────────────────────────────────
// Liest Skonto aus XRechnung-Freitext-Note oder ZUGFeRD Description
// Format: "#SKONTO#TAGE=7#PROZENT=2.00#" (CIUS XRechnung DE)
// Oder einfacher Text: "2% Skonto innerhalb 7 Tage"
export function parseSkonto(text) {
  if (!text) return null;
  const ciusMatch = text.match(/#SKONTO#TAGE=(\d+)#PROZENT=([\d.]+)/i);
  if (ciusMatch) {
    return { days: parseInt(ciusMatch[1]), percent: parseFloat(ciusMatch[2]) };
  }
  const freiMatch = text.match(/([\d.,]+)\s*%.*?(\d+)\s*Tag/i);
  if (freiMatch) {
    return {
      days:    parseInt(freiMatch[2]),
      percent: parseFloat(freiMatch[1].replace(',', '.')),
    };
  }
  return null;
}

// ZUGFeRD Datum "20250605" → "2025-06-05"
function formatZugferdDate(str) {
  if (!str || str.length !== 8) return str;
  return `${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}`;
}

// ── PARSE INBOUND XML ─────────────────────────────────────────
export function parseInboundXML(xmlString) {
  try {
    const isZUGFeRD = xmlString.includes('CrossIndustryInvoice');
    const isUBL = xmlString.includes('ubl:Invoice');

    if (!isZUGFeRD && !isUBL) {
      return { success: false, error: 'Unbekanntes XML-Format' };
    }

    const extract = (pattern) => {
      const m = xmlString.match(pattern);
      return m ? m[1].trim() : null;
    };

    if (isUBL) {
      const skonto = parseSkonto(extract(/<cbc:Note>([^<]+)<\/cbc:Note>/));
      const iban = extract(/<cac:PaymentMeans>[\s\S]*?<cbc:ID>([A-Z]{2}[0-9]{2}[A-Z0-9]+)<\/cbc:ID>/)
               || extract(/<cbc:PaymentAccountID>([^<]+)<\/cbc:PaymentAccountID>/);
      const bic  = extract(/<cac:FinancialInstitutionBranch>[\s\S]*?<cbc:ID>([^<]+)<\/cbc:ID>/);
      const amountNet = parseFloat(extract(/<cbc:TaxExclusiveAmount[^>]*>([^<]+)<\/cbc:TaxExclusiveAmount>/) || '0');
      const reference = extract(/<cbc:BuyerReference>([^<]+)<\/cbc:BuyerReference>/)
                     || extract(/<cbc:ID>([^<]+)<\/cbc:ID>/);

      return {
        success: true,
        format: 'xrechnung',
        data: {
          invoice_number:   extract(/<cbc:ID>([^<]+)<\/cbc:ID>/),
          invoice_date:     extract(/<cbc:IssueDate>([^<]+)<\/cbc:IssueDate>/),
          due_date:         extract(/<cbc:DueDate>([^<]+)<\/cbc:DueDate>/),
          seller_name:      extract(/<cac:AccountingSupplierParty>[\s\S]*?<cbc:Name>([^<]+)<\/cbc:Name>/),
          buyer_name:       extract(/<cac:AccountingCustomerParty>[\s\S]*?<cbc:Name>([^<]+)<\/cbc:Name>/),
          seller_vat_id:    extract(/<cac:AccountingSupplierParty>[\s\S]*?<cbc:CompanyID>([^<]+)<\/cbc:CompanyID>/),
          amount_gross:     parseFloat(extract(/<cbc:PayableAmount[^>]*>([^<]+)<\/cbc:PayableAmount>/) || '0'),
          amount_net:       amountNet,
          seller_iban:      iban ? iban.replace(/\s/g, '') : null,
          seller_bic:       bic  || null,
          discount_percent: skonto?.percent || null,
          discount_days:    skonto?.days    || null,
          payment_reference: reference,
        }
      };
    }

    if (isZUGFeRD) {
      const skontoNote = extract(/<ram:SpecifiedTradePaymentTerms>[\s\S]*?<ram:Description>([^<]+)<\/ram:Description>/);
      const skonto = parseSkonto(skontoNote);
      const iban = extract(/<ram:CreditorFinancialAccount>[\s\S]*?<ram:IBANID>([^<]+)<\/ram:IBANID>/)
               || extract(/<ram:IBANID>([^<]+)<\/ram:IBANID>/);
      const bic  = extract(/<ram:CreditorFinancialInstitution>[\s\S]*?<ram:BICID>([^<]+)<\/ram:BICID>/)
               || extract(/<ram:BICID>([^<]+)<\/ram:BICID>/);
      const amountNet = parseFloat(extract(/<ram:TaxBasisTotalAmount>([^<]+)<\/ram:TaxBasisTotalAmount>/) || '0');

      return {
        success: true,
        format: 'zugferd',
        data: {
          invoice_number:   extract(/<ram:ID>([^<]+)<\/ram:ID>/),
          invoice_date:     extract(/<udt:DateTimeString format="102">([^<]+)<\/udt:DateTimeString>/),
          due_date:         formatZugferdDate(extract(/<ram:DueDateDateTime>[\s\S]*?<udt:DateTimeString[^>]*>([^<]+)<\/udt:DateTimeString>/)),
          seller_name:      extract(/<ram:SellerTradeParty>[\s\S]*?<ram:Name>([^<]+)<\/ram:Name>/),
          buyer_name:       extract(/<ram:BuyerTradeParty>[\s\S]*?<ram:Name>([^<]+)<\/ram:Name>/),
          amount_gross:     parseFloat(extract(/<ram:GrandTotalAmount>([^<]+)<\/ram:GrandTotalAmount>/) || '0'),
          amount_net:       amountNet,
          seller_iban:      iban ? iban.replace(/\s/g, '') : null,
          seller_bic:       bic  || null,
          discount_percent: skonto?.percent || null,
          discount_days:    skonto?.days    || null,
          payment_reference: extract(/<ram:ID>([^<]+)<\/ram:ID>/),
        }
      };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}
