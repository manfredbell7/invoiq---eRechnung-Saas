// services/pdfRenderer.js — Professionelles Rechnungs-PDF (DIN-5008-nah)
//
// Aufbau: farbiger Briefkopf mit Logo + Firmenname · Absenderzeile über dem
// Empfänger-Fensterbereich · Info-Block rechts (Nr./Datum/Fälligkeit/USt-IdNr.)
// · Positionstabelle mit Markenfarbe · Summenblock · Zahlungsblock mit
// IBAN/BIC/Bank · dreispaltige Fußzeile (Anschrift | Bank | Register/Steuer)
// auf JEDER Seite inkl. "Seite X von Y".
//
// Seitenlogik: Inhalt fließt — eine neue Seite entsteht NUR, wenn die
// Positionsliste den Platz sprengt (manuelle y-Verwaltung, kein pdfkit-
// Auto-Umbruch; der verursachte früher 3 Seiten für 1 Seite Inhalt).
//
// Farbe: invoice.brand_color (je Rechnung) > org.brand_color (Mandant) > Default.

const PAGE_W = 595.28;   // A4 Punkte
const PAGE_H = 841.89;
const M = 50;            // Seitenrand
const FOOTER_H = 78;     // reservierte Fußzeile
const GRAY = '#6B7280';
const DARK = '#111827';
const LIGHT = '#E5E7EB';

const eur = (n) => (parseFloat(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const de = (d) => {
  if (!d) return '—';
  const x = new Date(d);
  return isNaN(x) ? String(d)
    : x.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

function normalize(invoice, org = {}) {
  const items = (typeof invoice.line_items === 'string'
    ? JSON.parse(invoice.line_items || '[]') : (invoice.line_items || []))
    .map(it => {
      const qty = parseFloat(it.quantity ?? 1) || 0;
      const price = parseFloat(it.unit_price ?? 0) || 0;
      const vat = it.vat_rate !== undefined ? parseFloat(it.vat_rate) : 19;
      return { desc: it.description || '', qty, unit: it.unit || '', price, vat, total: qty * price };
    });
  const net = items.reduce((s, i) => s + i.total, 0);
  const vatGroups = {};
  for (const i of items) {
    vatGroups[i.vat] = (vatGroups[i.vat] || 0) + i.total * (i.vat / 100);
  }
  const vatTotal = Object.values(vatGroups).reduce((s, v) => s + v, 0);
  // Konsistenz im Dokument: sobald Positionen da sind, wird der Gesamtbetrag
  // aus ihnen gerechnet — nie aus einem evtl. abweichenden amount_gross.
  const gross = items.length ? net + vatTotal : (parseFloat(invoice.amount_gross) || 0);

  const kind = invoice.invoice_kind || 'standard';
  const title = kind === 'cancellation' ? 'Stornorechnung'
    : kind === 'correction' ? 'Korrekturrechnung' : 'Rechnung';

  return {
    title, kind,
    number: invoice.invoice_number || '—',
    date: de(invoice.invoice_date || invoice.created_at),
    due: invoice.due_date ? de(invoice.due_date) : null,
    reference: invoice.reference || null,
    relatedNumber: invoice.related_invoice_number || null,
    notes: invoice.notes || null,
    buyer: {
      name: invoice.buyer_name || '',
      address: invoice.buyer_address || '',
      city: [invoice.buyer_zip, invoice.buyer_city].filter(Boolean).join(' ') || invoice.buyer_city || '',
      country: invoice.buyer_country && invoice.buyer_country !== 'DE' ? invoice.buyer_country : null,
      vatId: invoice.buyer_vat_id || null,
    },
    seller: {
      name: invoice.seller_name || org.name || '',
      address: invoice.seller_address || org.address || '',
      city: [org.zip, invoice.seller_city || org.city].filter(Boolean).join(' '),
      vatId: invoice.seller_vat_id || org.vat_id || '',
      taxNumber: org.tax_number || '',
      iban: (invoice.seller_iban || org.iban || '').replace(/(.{4})/g, '$1 ').trim(),
      bic: org.bic || '',
      bank: org.bank_name || '',
      registerNumber: org.register_number || '',
      registerCourt: org.register_court || '',
      director: org.managing_director || '',
      email: org.email || '',
      phone: org.phone || '',
      website: org.website || '',
    },
    logo: org.logo_data || null,
    color: invoice.brand_color || org.brand_color || '#635BFF',
    items, net, vatGroups, vatTotal, gross,
  };
}

export async function renderInvoicePDF(invoice, org = {}) {
  try {
    return await renderProfessional(invoice, org, null);
  } catch (err) {
    return renderSimplePDF(invoice);
  }
}

// ZUGFeRD/Factur-X-Hybrid: identisches Layout + eingebettete factur-x.xml
export async function renderHybridPDF(invoice, xmlContent, org = {}) {
  return renderProfessional(invoice, org, {
    data: Buffer.from(xmlContent, 'utf8'),
    name: 'factur-x.xml',
    type: 'text/xml',
    description: 'Factur-X/ZUGFeRD Rechnungsdaten (EN 16931)',
    relationship: 'Alternative',
  });
}

async function renderProfessional(invoice, org, embedFile) {
  const PDFDocument = (await import('pdfkit')).default;
  const d = normalize(invoice, org);

  return new Promise((resolve, reject) => {
    const docOpts = { size: 'A4', margin: 0, bufferPages: true };
    if (embedFile) { docOpts.subset = 'PDF/A-3b'; docOpts.tagged = true; }
    const doc = new PDFDocument(docOpts);
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    if (embedFile) { const { data, ...opts } = embedFile; doc.file(data, opts); }

    const C = d.color;
    const bottomLimit = PAGE_H - FOOTER_H - 20;
    let logoImg = null;
    if (d.logo) {
      try { logoImg = Buffer.from(d.logo.split(',')[1], 'base64'); } catch { /* Logo optional */ }
    }

    // ── Briefkopf (nur Seite 1 groß, Folgeseiten schmal) ─────
    const header = (first) => {
      if (first) {
        doc.rect(0, 0, PAGE_W, 8).fill(C);                       // Farbband
        let x = M;
        if (logoImg) {
          try { doc.image(logoImg, M, 26, { fit: [120, 44] }); x = M + 134; } catch { /* defekt → nur Text */ }
        }
        doc.fillColor(DARK).font('Helvetica-Bold').fontSize(17).text(d.seller.name, x, 32, { width: 300 });
        const contact = [d.seller.email, d.seller.phone, d.seller.website].filter(Boolean).join('  ·  ');
        if (contact) doc.font('Helvetica').fontSize(8.5).fillColor(GRAY).text(contact, x, 54, { width: 340 });
        return 96;
      }
      doc.rect(0, 0, PAGE_W, 6).fill(C);
      doc.fillColor(GRAY).font('Helvetica').fontSize(8)
        .text(`${d.title} ${d.number} · ${d.seller.name}`, M, 22);
      return 48;
    };

    let y = header(true);

    // ── Absenderzeile + Empfänger (Fensterbereich) ───────────
    const senderLine = [d.seller.name, d.seller.address, d.seller.city].filter(Boolean).join(' · ');
    doc.fontSize(7.5).fillColor(GRAY).text(senderLine, M, y + 18, { width: 250 });
    doc.moveTo(M, y + 29).lineTo(M + 220, y + 29).strokeColor(LIGHT).lineWidth(0.5).stroke();

    let ry = y + 38;
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11).text(d.buyer.name, M, ry);
    doc.font('Helvetica').fontSize(10);
    for (const line of [d.buyer.address, d.buyer.city, d.buyer.country].filter(Boolean)) {
      ry = doc.y; doc.text(line, M, ry);
    }

    // ── Info-Block rechts ────────────────────────────────────
    const infoX = 360, infoW = PAGE_W - M - infoX;
    let iy = y + 18;
    const info = [
      ['Rechnungsnummer', d.number],
      ['Rechnungsdatum', d.date],
      ...(d.due ? [['Zahlbar bis', d.due]] : []),
      ...(d.relatedNumber ? [[d.kind === 'cancellation' ? 'Storno zu' : 'Korrektur zu', d.relatedNumber]] : []),
      ...(d.reference ? [['Referenz', d.reference]] : []),
      ...(d.seller.vatId ? [['USt-IdNr.', d.seller.vatId]] : []),
      ...(d.buyer.vatId ? [['USt-IdNr. Kunde', d.buyer.vatId]] : []),
    ];
    doc.fontSize(9);
    for (const [k, v] of info) {
      doc.fillColor(GRAY).font('Helvetica').text(k, infoX, iy, { width: 105 });
      doc.fillColor(DARK).font('Helvetica-Bold').text(String(v), infoX + 108, iy, { width: infoW - 108, align: 'right' });
      iy += 15;
    }

    // ── Titel ────────────────────────────────────────────────
    y = Math.max(doc.y + 30, iy + 26, 268);
    doc.fillColor(C).font('Helvetica-Bold').fontSize(19).text(d.title + (d.kind === 'standard' ? ` ${d.number}` : ''), M, y);
    y += 30;

    // ── Positionstabelle ─────────────────────────────────────
    const cols = [
      { key: 'pos',   label: 'Pos.',        x: M,       w: 28,  align: 'left' },
      { key: 'desc',  label: 'Beschreibung', x: M + 32,  w: 216, align: 'left' },
      { key: 'qty',   label: 'Menge',       x: M + 254, w: 46,  align: 'right' },
      { key: 'price', label: 'Einzelpreis', x: M + 306, w: 70,  align: 'right' },
      { key: 'vat',   label: 'USt.',        x: M + 382, w: 36,  align: 'right' },
      { key: 'total', label: 'Betrag',      x: M + 424, w: PAGE_W - 2 * M - 424, align: 'right' },
    ];
    const tableHead = () => {
      doc.rect(M, y, PAGE_W - 2 * M, 20).fill(C);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
      for (const c of cols) doc.text(c.label, c.x + 4, y + 6, { width: c.w - 8, align: c.align });
      y += 20;
    };
    tableHead();

    doc.font('Helvetica').fontSize(9);
    d.items.forEach((it, idx) => {
      const descH = doc.heightOfString(it.desc || '—', { width: cols[1].w - 8 });
      const rowH = Math.max(18, descH + 8);
      if (y + rowH > bottomLimit) {           // Umbruch NUR wenn nötig
        doc.addPage();
        y = header(false);
        tableHead();
        doc.font('Helvetica').fontSize(9);
      }
      if (idx % 2 === 1) doc.rect(M, y, PAGE_W - 2 * M, rowH).fill('#F8F9FB');
      doc.fillColor(DARK);
      const vals = {
        pos: String(idx + 1),
        desc: it.desc || '—',
        qty: `${it.qty}${it.unit && it.unit !== 'C62' ? ' ' + it.unit : ''}`,
        price: eur(it.price),
        vat: `${it.vat} %`,
        total: eur(it.total),
      };
      for (const c of cols) doc.text(vals[c.key], c.x + 4, y + 5, { width: c.w - 8, align: c.align });
      y += rowH;
    });
    doc.moveTo(M, y).lineTo(PAGE_W - M, y).strokeColor(LIGHT).lineWidth(0.75).stroke();

    // ── Summenblock (bricht als Ganzes um, falls kein Platz) ─
    const sumLines = [
      ['Nettobetrag', eur(d.net)],
      ...Object.entries(d.vatGroups).map(([rate, amt]) => [`zzgl. ${rate} % USt.`, eur(amt)]),
    ];
    const sumH = (sumLines.length + 1) * 17 + 14;
    if (y + sumH > bottomLimit) { doc.addPage(); y = header(false); }
    y += 10;
    const sx = 330, sw = PAGE_W - M - sx;
    doc.fontSize(9.5).font('Helvetica');
    for (const [k, v] of sumLines) {
      doc.fillColor(GRAY).text(k, sx, y, { width: sw - 90 });
      doc.fillColor(DARK).text(v, sx + sw - 88, y, { width: 88, align: 'right' });
      y += 17;
    }
    doc.rect(sx, y, sw, 24).fill(C);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10.5)
      .text('Gesamtbetrag', sx + 8, y + 6, { width: sw - 100 })
      .text(eur(d.gross), sx + sw - 96, y + 6, { width: 88, align: 'right' });
    y += 40;

    // ── Zahlungsblock ────────────────────────────────────────
    const payLines = [];
    if (d.kind === 'cancellation') {
      payLines.push('Diese Stornorechnung gleicht die referenzierte Rechnung aus. Es ist keine Zahlung fällig.');
    } else if (d.seller.iban) {
      payLines.push(`Bitte überweisen Sie den Betrag${d.due ? ` bis zum ${d.due}` : ''} auf folgendes Konto:`);
      payLines.push(`IBAN ${d.seller.iban}${d.seller.bic ? `   ·   BIC ${d.seller.bic}` : ''}${d.seller.bank ? `   ·   ${d.seller.bank}` : ''}`);
      payLines.push(`Verwendungszweck: ${d.number}`);
    }
    if (d.notes) payLines.push('', d.notes);
    if (payLines.length) {
      const payH = payLines.length * 13 + 24;
      if (y + payH > bottomLimit) { doc.addPage(); y = header(false); }
      doc.rect(M, y, PAGE_W - 2 * M, payH).fill('#F8F9FB');
      doc.rect(M, y, 3, payH).fill(C);
      let py = y + 12;
      doc.fontSize(9);
      payLines.forEach((line, i) => {
        doc.fillColor(i === 1 && d.kind !== 'cancellation' ? DARK : GRAY)
          .font(i === 1 && d.kind !== 'cancellation' ? 'Helvetica-Bold' : 'Helvetica')
          .text(line, M + 14, py, { width: PAGE_W - 2 * M - 28 });
        py += 13;
      });
      y += payH;
    }

    // ── Fußzeile auf jeder Seite + Seitenzahlen ──────────────
    const range = doc.bufferedPageRange();
    for (let p = 0; p < range.count; p++) {
      doc.switchToPage(range.start + p);
      const fy = PAGE_H - FOOTER_H;
      doc.moveTo(M, fy).lineTo(PAGE_W - M, fy).strokeColor(LIGHT).lineWidth(0.5).stroke();
      doc.fontSize(7).font('Helvetica').fillColor(GRAY);
      const colW = (PAGE_W - 2 * M) / 3;
      doc.text([d.seller.name, d.seller.address, d.seller.city].filter(Boolean).join('\n'), M, fy + 8, { width: colW - 10 });
      doc.text([
        d.seller.bank && `Bank: ${d.seller.bank}`,
        d.seller.iban && `IBAN: ${d.seller.iban}`,
        d.seller.bic && `BIC: ${d.seller.bic}`,
      ].filter(Boolean).join('\n'), M + colW, fy + 8, { width: colW - 10 });
      doc.text([
        d.seller.vatId && `USt-IdNr.: ${d.seller.vatId}`,
        d.seller.taxNumber && `Steuernummer: ${d.seller.taxNumber}`,
        d.seller.registerNumber && `${d.seller.registerNumber}${d.seller.registerCourt ? ` · ${d.seller.registerCourt}` : ''}`,
        d.seller.director && `Geschäftsführung: ${d.seller.director}`,
      ].filter(Boolean).join('\n'), M + 2 * colW, fy + 8, { width: colW - 10 });
      if (range.count > 1) {
        doc.text(`Seite ${p + 1} von ${range.count}`, M, fy + FOOTER_H - 18, { width: PAGE_W - 2 * M, align: 'center' });
      }
    }

    doc.end();
  });
}

// ── Fallback: minimales Text-PDF (falls PDFKit fehlt/crasht) ──
function renderSimplePDF(invoice) {
  const esc = (s) => String(s || '').replace(/[()\\]/g, '\\$&');
  const lines = [
    `Rechnung ${invoice.invoice_number || ''}`,
    `Datum: ${invoice.invoice_date || ''}`,
    `Von: ${invoice.seller_name || ''}`,
    `An: ${invoice.buyer_name || ''}`,
    `Betrag: ${invoice.amount_gross || 0} EUR`,
  ];
  const content = lines.map((l, i) => `BT /F1 12 Tf 50 ${780 - i * 20} Td (${esc(l)}) Tj ET`).join('\n');
  const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length ${content.length}>>stream
${content}
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`;
  return Buffer.from(pdf);
}
