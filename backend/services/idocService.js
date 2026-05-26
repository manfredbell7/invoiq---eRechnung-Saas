// src/services/idocService.js
// SAP IDoc Empfänger und Parser für invoiq
// Unterstützt: INVOIC02 (Ausgangsrechnung), INVOIC01 (Legacy)

// ── IDOC PARSER ────────────────────────────────────────────────
export function parseIDoc(idocXML) {
  // IDoc kann als XML oder als flaches SAP-Format kommen
  // Wir unterstützen beide Formate

  if (idocXML.includes('<INVOIC02>') || idocXML.includes('<INVOIC01>')) {
    return parseXMLIDoc(idocXML);
  }

  // Flat IDoc Format (klassisch)
  return parseFlatIDoc(idocXML);
}

// ── XML IDOC (modernes Format) ─────────────────────────────────
function parseXMLIDoc(xml) {
  const extract = (tag) => {
    const match = xml.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`));
    return match ? match[1].trim() : null;
  };

  const extractAll = (tag) => {
    const matches = [];
    const regex = new RegExp(`<${tag}>([\s\S]*?)<\/${tag}>`, 'g');
    let match;
    while ((match = regex.exec(xml)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  };

  // ── Kopfdaten ─────────────────────────────────────────────────
  const invoice_number = extract('BELNR') || extract('INVNO');
  const invoice_date   = formatSAPDate(extract('BLDAT') || extract('INVDT'));
  const due_date       = formatSAPDate(extract('ZFDAT') || extract('DUEDT'));
  const currency       = extract('CURCY') || extract('WAERS') || 'EUR';

  // ── Beträge ───────────────────────────────────────────────────
  const amount_net   = parseFloat(extract('NETWR') || extract('NTGEW') || '0');
  const amount_vat   = parseFloat(extract('MWSBP') || '0');
  const amount_gross = parseFloat(extract('BRUTTO') || extract('BRGEW') || '0') || amount_net + amount_vat;

  // ── Verkäufer (AG = Auftraggeber / Lieferant) ─────────────────
  const sellerBlock  = xml.match(/<E1EDKA1>[\s\S]*?PARVW>AG[\s\S]*?<\/E1EDKA1>/)?.[0] || '';
  const seller_name  = extractFrom(sellerBlock, 'NAME1') || extract('SNDPRN');
  const seller_vat   = extractFrom(sellerBlock, 'STCD1') || extract('VATNO');

  // ── Käufer (RE = Rechnungsempfänger) ──────────────────────────
  const buyerBlock   = xml.match(/<E1EDKA1>[\s\S]*?PARVW>RE[\s\S]*?<\/E1EDKA1>/)?.[0] || '';
  const buyer_name   = extractFrom(buyerBlock, 'NAME1');
  const buyer_street = extractFrom(buyerBlock, 'STRAS');
  const buyer_city   = extractFrom(buyerBlock, 'ORT01');
  const buyer_zip    = extractFrom(buyerBlock, 'PSTLZ');
  const buyer_email  = extractFrom(buyerBlock, 'SMTP_ADDR');
  const buyer_vat    = extractFrom(buyerBlock, 'STCD1');

  // ── Positionen ────────────────────────────────────────────────
  const positionBlocks = extractAll('E1EDP01');
  const line_items = positionBlocks.map((block, idx) => ({
    description: extractFrom(block, 'ARKTX') || extractFrom(block, 'MAKTX') || `Position ${idx + 1}`,
    quantity:    parseFloat(extractFrom(block, 'MENGE') || '1'),
    unit_price:  parseFloat(extractFrom(block, 'PREIS') || extractFrom(block, 'BPREI') || '0'),
    vat_rate:    parseFloat(extractFrom(block, 'MWSKZ') || '19'),
    unit:        extractFrom(block, 'MENEI') || 'C62',
  }));

  // ── Referenzen ────────────────────────────────────────────────
  const reference     = extract('IHREZ') || extract('BSTNK');
  const payment_terms = extract('ZTERM');

  return {
    // Pflichtfelder EN 16931
    invoice_number:  invoice_number || `SAP-${Date.now()}`,
    invoice_date:    invoice_date   || new Date().toISOString().split('T')[0],
    due_date,
    currency,

    // Beträge
    amount_net:   parseFloat(amount_net.toFixed(2)),
    amount_vat:   parseFloat(amount_vat.toFixed(2)),
    amount_gross: parseFloat(amount_gross.toFixed(2)),

    // Parteien
    seller_name:    seller_name  || '',
    seller_vat_id:  seller_vat   || '',
    seller_country: 'DE',

    buyer_name:     buyer_name   || '',
    buyer_address:  buyer_street || '',
    buyer_city:     buyer_city   || '',
    buyer_zip:      buyer_zip    || '',
    buyer_country:  'DE',
    buyer_email:    buyer_email  || '',
    buyer_vat_id:   buyer_vat    || '',

    // Positionen
    line_items: line_items.length > 0 ? line_items : [{
      description: 'SAP Faktura Position',
      quantity: 1,
      unit_price: amount_net,
      vat_rate: 19,
    }],

    // Metadaten
    reference,
    payment_terms,
    source: 'sap_idoc',
    raw_idoc_type: xml.includes('INVOIC02') ? 'INVOIC02' : 'INVOIC01',
  };
}

// ── FLAT IDOC FORMAT (klassisch) ──────────────────────────────
function parseFlatIDoc(flat) {
  const lines = flat.split('\n').filter(Boolean);
  const segments = {};

  lines.forEach(line => {
    const segmentType = line.substring(0, 8).trim();
    const content     = line.substring(8);
    if (!segments[segmentType]) segments[segmentType] = [];
    segments[segmentType].push(content);
  });

  const getField = (segment, start, length) => {
    const seg = segments[segment]?.[0];
    if (!seg) return null;
    return seg.substring(start, start + length).trim() || null;
  };

  return {
    invoice_number: getField('E1EDK01', 0, 16)   || `FLAT-${Date.now()}`,
    invoice_date:   formatSAPDate(getField('E1EDK01', 16, 8)),
    seller_name:    getField('E1EDKA1', 10, 35)  || '',
    buyer_name:     getField('E1EDKA1', 45, 35)  || '',
    amount_gross:   parseFloat(getField('E1EDK01', 80, 15) || '0'),
    currency:       getField('E1EDK01', 95, 5)   || 'EUR',
    line_items: [{
      description: 'IDoc Position',
      quantity: 1,
      unit_price: parseFloat(getField('E1EDK01', 80, 15) || '0') / 1.19,
      vat_rate: 19,
    }],
    source: 'sap_idoc_flat',
  };
}

// ── HELPERS ────────────────────────────────────────────────────
function extractFrom(block, tag) {
  if (!block) return null;
  const match = block.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`));
  return match ? match[1].trim() : null;
}

function formatSAPDate(sapDate) {
  if (!sapDate) return null;
  // SAP Format: YYYYMMDD → ISO: YYYY-MM-DD
  if (sapDate.length === 8 && /^\d{8}$/.test(sapDate)) {
    return `${sapDate.slice(0,4)}-${sapDate.slice(4,6)}-${sapDate.slice(6,8)}`;
  }
  return sapDate;
}

// ── IDOC VALIDATOR ─────────────────────────────────────────────
export function validateIDoc(parsed) {
  const errors = [];
  const warnings = [];

  if (!parsed.invoice_number) errors.push('Rechnungsnummer fehlt (BELNR)');
  if (!parsed.invoice_date)   errors.push('Rechnungsdatum fehlt (BLDAT)');
  if (!parsed.buyer_name)     errors.push('Empfänger fehlt (NAME1/RE)');
  if (!parsed.amount_gross || parsed.amount_gross <= 0) errors.push('Betrag fehlt oder ungültig');
  if (!parsed.line_items || parsed.line_items.length === 0) errors.push('Keine Positionen gefunden');
  if (!parsed.seller_name)    warnings.push('Verkäufername fehlt');
  if (!parsed.buyer_email)    warnings.push('Empfänger E-Mail fehlt — kein automatischer Versand möglich');

  return {
    valid:    errors.length === 0,
    errors,
    warnings,
  };
}

// ── STATUS IDOC ZURÜCK AN SAP ─────────────────────────────────
// SAP kann Status-IDocs empfangen (ORDERS, DESADV, etc.)
// invoiq schickt INVOIC_STATUS zurück wenn Rechnung zugestellt wurde
export function generateStatusIDoc({ invoiceNumber, status, timestamp, sapSystemId }) {
  const sapStatus = {
    'delivered': '9',   // Erfolgreich übermittelt
    'error':     '5',   // Fehler
    'validated': '3',   // Empfangen und validiert
  }[status] || '3';

  return `<?xml version="1.0" encoding="UTF-8"?>
<INVOIC_STATUS>
  <EDI_DC40>
    <TABNAM>EDI_DC40</TABNAM>
    <MANDT>100</MANDT>
    <DOCNUM>${Date.now()}</DOCNUM>
    <DOCREL>740</DOCREL>
    <STATUS>30</STATUS>
    <DIRECT>2</DIRECT>
    <OUTMOD>2</OUTMOD>
    <IDOCTYP>STATUS</IDOCTYP>
    <MESTYP>STATUS</MESTYP>
    <SNDPRT>LS</SNDPRT>
    <SNDPRN>INVOIQ_PROD</SNDPRN>
    <RCVPRT>LS</RCVPRT>
    <RCVPRN>${sapSystemId || 'SAPDEV'}</RCVPRN>
    <CREDAT>${new Date().toISOString().split('T')[0].replace(/-/g,'')}</CREDAT>
    <CRETIM>${new Date().toTimeString().slice(0,8).replace(/:/g,'')}</CRETIM>
  </EDI_DC40>
  <E1STATS>
    <TABNAM>E1STATS</TABNAM>
    <STATUS>${sapStatus}</STATUS>
    <REFINT>${invoiceNumber}</REFINT>
    <REFGRP>INVOIC</REFGRP>
    <STAMID>EI</STAMID>
    <STAMNO>001</STAMNO>
    <TIMEST>${timestamp || new Date().toISOString()}</TIMEST>
    <REPID>INVOIQ_STATUS</REPID>
  </E1STATS>
</INVOIC_STATUS>`;
}
