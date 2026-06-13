// services/pdfRenderer.js
// Rendert Rechnungen als lesbares PDF — mit 3 Design-Vorlagen:
//   modern  → Akzent-Balken oben, Akzentfarbe #635BFF
//   classic → klassisch schwarz/weiß, Geschäftsbrief-Stil
//   minimal → reduziert, viel Weißraum, dünne Linien
// Verwendet PDFKit. Fallback: einfaches Text-PDF wenn PDFKit fehlt.

const ACCENT = '#635BFF';
const DARK   = '#0A2540';
const GRAY   = '#6B7280';
const LIGHT  = '#E5E7EB';

export async function renderInvoicePDF(invoice) {
  try {
    return await renderWithPDFKit(invoice);
  } catch (err) {
    return renderSimplePDF(invoice);
  }
}

async function renderWithPDFKit(invoice) {
  const PDFDocument = (await import('pdfkit')).default;
  const template = (invoice.template || 'modern').toLowerCase();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const data = normalize(invoice);
    if (template === 'classic')      renderClassic(doc, data);
    else if (template === 'minimal') renderMinimal(doc, data);
    else                             renderModern(doc, data);

    doc.end();
  });
}

function normalize(invoice) {
  const items = (invoice.line_items || []).map(it => {
    const qty = parseFloat(it.quantity || 1);
    const price = parseFloat(it.unit_price || 0);
    const vat = parseFloat(it.vat_rate || 19);
    return { desc: it.description || '', qty, price, vat, total: qty * price };
  });
  let net = items.reduce((s, i) => s + i.total, 0);
  if (net === 0 && invoice.amount) net = parseFloat(invoice.amount) / 1.19;
  const vatAmt = items.length
    ? items.reduce((s, i) => s + i.total * (i.vat / 100), 0)
    : net * 0.19;
  const gross = parseFloat(invoice.amount || (net + vatAmt));
  return {
    number: invoice.invoice_number || '-',
    date: formatDate(invoice.invoice_date || invoice.created_at),
    due: formatDate(invoice.due_date),
    format: (invoice.format || 'XRechnung').toUpperCase(),
    sellerName: invoice.seller_name || invoice.sender_name || 'Lieferant',
    sellerAddr: invoice.seller_address || '',
    sellerCity: invoice.seller_city || '',
    sellerVat: invoice.seller_vat_id || '',
    sellerIban: invoice.seller_iban || '',
    buyerName: invoice.buyer_name || invoice.org_name || '',
    buyerAddr: invoice.buyer_address || '',
    buyerCity: invoice.buyer_city || '',
    items, net, vatAmt, gross,
    hash: (invoice.xml_hash || '').slice(0, 16),
  };
}

// VORLAGE 1: MODERN
function renderModern(doc, d) {
  doc.rect(0, 0, 595, 8).fill(ACCENT);
  doc.fontSize(22).fillColor(DARK).font('Helvetica-Bold').text('Rechnung', 50, 45);
  doc.fontSize(9).fillColor(ACCENT).font('Helvetica')
     .text('EN 16931 konform  ·  GoBD  ·  SHA-256 gesichert', 50, 74);
  doc.roundedRect(400, 42, 145, 40, 6).fill(ACCENT + '14');
  doc.fontSize(8).fillColor(GRAY).font('Helvetica').text('RECHNUNGSNR.', 412, 50);
  doc.fontSize(13).fillColor(ACCENT).font('Helvetica-Bold').text(d.number, 412, 62);
  partyBlock(doc, d, 110);
  const tableY = metaRow(doc, d, 200);
  const rowEnd = itemsTable(doc, d, tableY, ACCENT, true);
  totalsBlock(doc, d, rowEnd + 15, ACCENT);
  modernFooter(doc, d);
}

// VORLAGE 2: CLASSIC
function renderClassic(doc, d) {
  doc.fontSize(10).fillColor(DARK).font('Helvetica').text(d.sellerName, 50, 45);
  doc.fontSize(8).fillColor(GRAY)
     .text([d.sellerAddr, d.sellerCity].filter(Boolean).join(' · '), 50, 60);
  doc.moveTo(50, 78).lineTo(545, 78).strokeColor(DARK).lineWidth(1.2).stroke();
  doc.fontSize(11).fillColor(DARK).font('Helvetica-Bold').text(d.buyerName, 50, 100);
  doc.fontSize(9).fillColor('#374151').font('Helvetica')
     .text(d.buyerAddr, 50, 116).text(d.buyerCity, 50, 128);
  doc.fontSize(18).fillColor(DARK).font('Helvetica-Bold').text('RECHNUNG', 350, 100);
  doc.fontSize(9).fillColor('#374151').font('Helvetica')
     .text('Nr. ' + d.number, 350, 124)
     .text('Datum: ' + d.date, 350, 137)
     .text('Faellig: ' + d.due, 350, 150);
  const rowEnd = itemsTable(doc, d, 185, DARK, false);
  totalsBlock(doc, d, rowEnd + 15, DARK);
  if (d.sellerIban) {
    doc.fontSize(9).fillColor('#374151').font('Helvetica')
       .text('Zahlbar bis ' + d.due + ' auf IBAN: ' + d.sellerIban, 50, 720);
  }
  classicFooter(doc, d);
}

// VORLAGE 3: MINIMAL
function renderMinimal(doc, d) {
  doc.fontSize(28).fillColor(DARK).font('Helvetica').text('Rechnung', 50, 60);
  doc.fontSize(9).fillColor(GRAY).font('Helvetica').text(d.number, 50, 96);
  doc.fontSize(8).fillColor(GRAY).text('Datum', 400, 64).text('Faellig', 480, 64);
  doc.fontSize(9).fillColor(DARK).text(d.date, 400, 76).text(d.due, 480, 76);
  doc.moveTo(50, 120).lineTo(545, 120).strokeColor(LIGHT).lineWidth(0.5).stroke();
  doc.fontSize(8).fillColor(GRAY).text('Von', 50, 138);
  doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold').text(d.sellerName, 50, 150);
  doc.fontSize(8).fillColor('#374151').font('Helvetica').text(d.sellerCity, 50, 164);
  doc.fontSize(8).fillColor(GRAY).text('An', 300, 138);
  doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold').text(d.buyerName, 300, 150);
  doc.fontSize(8).fillColor('#374151').font('Helvetica').text(d.buyerCity, 300, 164);
  const rowEnd = itemsTableMinimal(doc, d, 210);
  totalsBlock(doc, d, rowEnd + 20, DARK);
  minimalFooter(doc, d);
}

function partyBlock(doc, d, y) {
  doc.fontSize(8).fillColor(GRAY).font('Helvetica').text('VON', 50, y);
  doc.fontSize(11).fillColor('#111827').font('Helvetica-Bold').text(d.sellerName, 50, y + 12);
  doc.fontSize(9).fillColor('#374151').font('Helvetica')
     .text(d.sellerAddr, 50, y + 26).text(d.sellerCity, 50, y + 38)
     .text(d.sellerVat ? 'USt-IdNr.: ' + d.sellerVat : '', 50, y + 50);
  doc.fontSize(8).fillColor(GRAY).text('AN', 300, y);
  doc.fontSize(11).fillColor('#111827').font('Helvetica-Bold').text(d.buyerName, 300, y + 12);
  doc.fontSize(9).fillColor('#374151').font('Helvetica')
     .text(d.buyerAddr, 300, y + 26).text(d.buyerCity, 300, y + 38);
}

function metaRow(doc, d, y) {
  doc.moveTo(50, y).lineTo(545, y).strokeColor(LIGHT).lineWidth(0.5).stroke();
  const meta = [['Rechnungsdatum', d.date], ['Faelligkeitsdatum', d.due], ['Format', d.format]];
  meta.forEach(([l, v], i) => {
    const mx = 50 + i * 165;
    doc.fontSize(8).fillColor(GRAY).font('Helvetica').text(l, mx, y + 10);
    doc.fontSize(10).fillColor('#111827').font('Helvetica-Bold').text(v, mx, y + 22);
  });
  doc.moveTo(50, y + 42).lineTo(545, y + 42).strokeColor(LIGHT).lineWidth(0.5).stroke();
  return y + 55;
}

function itemsTable(doc, d, tableY, headColor, filled) {
  const headers = ['Beschreibung', 'Menge', 'Einzelpreis', 'MwSt', 'Gesamt'];
  const colX = [50, 290, 340, 415, 465];
  if (filled) doc.rect(50, tableY, 495, 20).fill(headColor + '14');
  else doc.moveTo(50, tableY + 18).lineTo(545, tableY + 18).strokeColor(headColor).lineWidth(1).stroke();
  headers.forEach((h, i) => {
    doc.fontSize(8).fillColor(filled ? headColor : DARK).font('Helvetica-Bold').text(h, colX[i], tableY + 6);
  });
  let rowY = tableY + 24;
  const rows = d.items.length ? d.items : [{ desc: 'Leistung gemaess Rechnung', qty: 1, price: d.net, vat: 19, total: d.net }];
  rows.forEach((it, idx) => {
    if (filled && idx % 2 === 0) doc.rect(50, rowY - 2, 495, 18).fill('#F9FAFB');
    doc.fontSize(9).fillColor('#111827').font('Helvetica')
       .text((it.desc || '').slice(0, 50), colX[0], rowY)
       .text(String(it.qty), colX[1], rowY)
       .text(fmtEur(it.price), colX[2], rowY)
       .text(it.vat + '%', colX[3], rowY)
       .text(fmtEur(it.total), colX[4], rowY);
    rowY += 20;
  });
  return rowY;
}

function itemsTableMinimal(doc, d, tableY) {
  doc.moveTo(50, tableY).lineTo(545, tableY).strokeColor(LIGHT).lineWidth(0.5).stroke();
  let rowY = tableY + 14;
  const rows = d.items.length ? d.items : [{ desc: 'Leistung gemaess Rechnung', qty: 1, price: d.net, vat: 19, total: d.net }];
  rows.forEach(it => {
    doc.fontSize(10).fillColor(DARK).font('Helvetica')
       .text((it.desc || '').slice(0, 55), 50, rowY)
       .text(fmtEur(it.total), 465, rowY, { align: 'right', width: 80 });
    doc.fontSize(8).fillColor(GRAY)
       .text(it.qty + ' x ' + fmtEur(it.price) + ' · ' + it.vat + '% MwSt', 50, rowY + 12);
    rowY += 34;
  });
  doc.moveTo(50, rowY).lineTo(545, rowY).strokeColor(LIGHT).lineWidth(0.5).stroke();
  return rowY;
}

function totalsBlock(doc, d, totY, accent) {
  doc.moveTo(350, totY).lineTo(545, totY).strokeColor(LIGHT).lineWidth(0.5).stroke();
  const totals = [['Nettobetrag', fmtEur(d.net)], ['MwSt', fmtEur(d.vatAmt)]];
  totals.forEach(([l, v], i) => {
    doc.fontSize(9).fillColor('#374151').font('Helvetica').text(l, 350, totY + 10 + i * 16);
    doc.text(v, 490, totY + 10 + i * 16, { align: 'right', width: 55 });
  });
  doc.moveTo(350, totY + 44).lineTo(545, totY + 44).strokeColor(accent).lineWidth(1).stroke();
  doc.fontSize(12).fillColor(accent).font('Helvetica-Bold')
     .text('Bruttobetrag', 350, totY + 52)
     .text(fmtEur(d.gross), 470, totY + 52, { align: 'right', width: 75 });
}

function modernFooter(doc, d) {
  doc.rect(0, 800, 595, 42).fill(ACCENT + '0A');
  doc.fontSize(7).fillColor('#9CA3AF')
     .text('Erstellt mit invoiq.io  ·  EN 16931 · GoBD §147 AO · ZUGFeRD/XRechnung', 50, 812)
     .text('SHA-256: ' + d.hash + '...', 50, 822);
}
function classicFooter(doc, d) {
  doc.moveTo(50, 800).lineTo(545, 800).strokeColor(DARK).lineWidth(0.5).stroke();
  doc.fontSize(7).fillColor(GRAY)
     .text(d.sellerName + '  ·  USt-IdNr.: ' + (d.sellerVat || '—') + '  ·  EN 16931 konform  ·  invoiq.io', 50, 808);
}
function minimalFooter(doc, d) {
  doc.fontSize(7).fillColor('#C0C7D0').text('invoiq.io  ·  EN 16931  ·  GoBD', 50, 815);
}

function renderSimplePDF(invoice) {
  const content = [
    'Rechnung: ' + (invoice.invoice_number || '-'),
    'Von:      ' + (invoice.seller_name || invoice.sender_name || 'Lieferant'),
    'An:       ' + (invoice.buyer_name || '-'),
    'Datum:    ' + formatDate(invoice.invoice_date || invoice.created_at),
    'Betrag:   ' + fmtEur(parseFloat(invoice.amount || 0)),
    'Format:   ' + (invoice.format || 'XRechnung').toUpperCase(),
    'EN 16931 konform - GoBD - invoiq.io'
  ].join('\n');
  const stream = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length ' + (content.length + 50) + '>>\nstream\nBT /F1 11 Tf 50 750 Td 15 TL\n' + content.split('\n').map(l => '(' + l.replace(/[()\\]/g, '\\$&') + ') Tj T*').join('\n') + '\nET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f\ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n470\n%%EOF';
  return Buffer.from(stream, 'utf-8');
}

function formatDate(d) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('de-DE'); } catch { return String(d); }
}
function fmtEur(n) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);
}
