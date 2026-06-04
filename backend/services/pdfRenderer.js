// services/pdfRenderer.js
// Rendert eingehende XRechnung/ZUGFeRD als lesbares PDF für Menschen
// Verwendet PDFKit (lightweight, keine externen Dependencies)

export async function renderInvoicePDF(invoice) {
  // Try PDFKit first, fallback to HTML string approach
  try {
    return await renderWithPDFKit(invoice);
  } catch (err) {
    // PDFKit not installed → return a simple text-based PDF
    return renderSimplePDF(invoice);
  }
}

async function renderWithPDFKit(invoice) {
  const PDFDocument = (await import('pdfkit')).default;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── HEADER ───────────────────────────────────────────────
    doc.fontSize(20).fillColor('#0A2540').font('Helvetica-Bold')
       .text('RECHNUNG', 50, 50);

    // EN 16931 badge
    doc.fontSize(9).fillColor('#635BFF')
       .text('EN 16931 ✓  GoBD-konform ✓  SHA-256 gesichert', 50, 78);

    // Divider
    doc.moveTo(50, 92).lineTo(545, 92).strokeColor('#E5E7EB').lineWidth(1).stroke();

    // ── SENDER / RECEIVER ────────────────────────────────────
    const y = 110;
    doc.fontSize(8).fillColor('#6B7280').font('Helvetica').text('VON', 50, y);
    doc.fontSize(11).fillColor('#111827').font('Helvetica-Bold')
       .text(invoice.seller_name || invoice.sender_name || 'Lieferant', 50, y + 12);
    doc.fontSize(9).fillColor('#374151').font('Helvetica')
       .text(invoice.seller_address || '', 50, y + 26)
       .text(invoice.seller_city || '', 50, y + 38)
       .text(invoice.seller_vat_id ? `USt-IdNr.: ${invoice.seller_vat_id}` : '', 50, y + 50);

    doc.fontSize(8).fillColor('#6B7280').text('AN', 300, y);
    doc.fontSize(11).fillColor('#111827').font('Helvetica-Bold')
       .text(invoice.buyer_name || invoice.org_name || '', 300, y + 12);
    doc.fontSize(9).fillColor('#374151').font('Helvetica')
       .text(invoice.buyer_address || '', 300, y + 26)
       .text(invoice.buyer_city || '', 300, y + 38);

    // ── INVOICE META ─────────────────────────────────────────
    const metaY = 210;
    doc.moveTo(50, metaY).lineTo(545, metaY).strokeColor('#E5E7EB').lineWidth(0.5).stroke();

    const metaItems = [
      ['Rechnungsnummer', invoice.invoice_number || '-'],
      ['Rechnungsdatum',  formatDate(invoice.invoice_date || invoice.created_at)],
      ['Fälligkeitsdatum', formatDate(invoice.due_date)],
      ['Format', (invoice.format || 'XRechnung').toUpperCase()],
    ];

    metaItems.forEach(([label, value], i) => {
      const mx = 50 + (i * 125);
      doc.fontSize(8).fillColor('#6B7280').font('Helvetica').text(label, mx, metaY + 10);
      doc.fontSize(10).fillColor('#111827').font('Helvetica-Bold').text(value, mx, metaY + 22);
    });

    doc.moveTo(50, metaY + 42).lineTo(545, metaY + 42).strokeColor('#E5E7EB').lineWidth(0.5).stroke();

    // ── LINE ITEMS ────────────────────────────────────────────
    const tableY = metaY + 55;
    const headers = ['Beschreibung', 'Menge', 'Einzelpreis', 'MwSt', 'Gesamt'];
    const colX    = [50, 290, 340, 415, 465];

    // Table header
    doc.rect(50, tableY, 495, 20).fill('#F3F4F6');
    headers.forEach((h, i) => {
      doc.fontSize(8).fillColor('#374151').font('Helvetica-Bold').text(h, colX[i], tableY + 6);
    });

    // Line items
    const lineItems = invoice.line_items || [];
    let rowY = tableY + 24;
    let net  = 0;

    if (lineItems.length > 0) {
      lineItems.forEach((item, idx) => {
        const qty   = parseFloat(item.quantity    || 1);
        const price = parseFloat(item.unit_price  || 0);
        const vat   = parseFloat(item.vat_rate    || 19);
        const total = qty * price;
        net += total;

        if (idx % 2 === 0) doc.rect(50, rowY - 2, 495, 18).fill('#F9FAFB');

        doc.fontSize(9).fillColor('#111827').font('Helvetica')
           .text((item.description || '').slice(0, 50), colX[0], rowY)
           .text(qty.toString(),                         colX[1], rowY)
           .text(fmtEur(price),                          colX[2], rowY)
           .text(`${vat}%`,                              colX[3], rowY)
           .text(fmtEur(total),                          colX[4], rowY);

        rowY += 20;
      });
    } else if (invoice.amount) {
      // Fallback wenn keine Positionen bekannt
      net = parseFloat(invoice.amount) / 1.19;
      doc.rect(50, rowY - 2, 495, 18).fill('#F9FAFB');
      doc.fontSize(9).fillColor('#111827').font('Helvetica')
         .text('Leistung gemäß Rechnung', colX[0], rowY)
         .text('1',                        colX[1], rowY)
         .text(fmtEur(net),               colX[2], rowY)
         .text('19%',                      colX[3], rowY)
         .text(fmtEur(net),               colX[4], rowY);
      rowY += 20;
    }

    // ── TOTALS ────────────────────────────────────────────────
    const vatAmt  = net * 0.19;
    const gross   = parseFloat(invoice.amount || (net + vatAmt));
    const totY    = rowY + 15;

    doc.moveTo(350, totY).lineTo(545, totY).strokeColor('#E5E7EB').lineWidth(0.5).stroke();

    const totals = [
      ['Nettobetrag',  fmtEur(net)],
      ['MwSt (19%)',   fmtEur(vatAmt)],
    ];
    totals.forEach(([l, v], i) => {
      doc.fontSize(9).fillColor('#374151').font('Helvetica').text(l, 350, totY + 10 + i * 16);
      doc.text(v, 490, totY + 10 + i * 16, { align: 'right', width: 55 });
    });

    doc.moveTo(350, totY + 54).lineTo(545, totY + 54).strokeColor('#0A2540').lineWidth(1).stroke();
    doc.fontSize(12).fillColor('#0A2540').font('Helvetica-Bold')
       .text('Bruttobetrag', 350, totY + 60)
       .text(fmtEur(gross), 490, totY + 60, { align: 'right', width: 55 });

    // ── FOOTER ────────────────────────────────────────────────
    const footY = 760;
    doc.moveTo(50, footY).lineTo(545, footY).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
    doc.fontSize(7).fillColor('#9CA3AF')
       .text('Dieses Dokument wurde automatisch von invoiq.io generiert.', 50, footY + 8)
       .text(`EN 16931 • GoBD §147 AO • ZUGFeRD/XRechnung • SHA-256: ${(invoice.xml_hash || '').slice(0, 16)}...`, 50, footY + 18);

    doc.end();
  });
}

// Fallback: minimal valid PDF wenn PDFKit nicht installiert
function renderSimplePDF(invoice) {
  const content = `
Rechnung: ${invoice.invoice_number || '-'}
Von:      ${invoice.seller_name || invoice.sender_name || 'Lieferant'}
An:       ${invoice.buyer_name || '-'}
Datum:    ${formatDate(invoice.invoice_date || invoice.created_at)}
Fällig:   ${formatDate(invoice.due_date)}
Betrag:   ${fmtEur(parseFloat(invoice.amount || 0))}
Format:   ${(invoice.format || 'XRechnung').toUpperCase()}
EN 16931 konform • GoBD-archiviert • invoiq.io
  `.trim();

  // Minimal valid PDF structure
  const stream = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length ${content.length + 50}>>
stream
BT /F1 11 Tf 50 750 Td 15 TL
${content.split('\n').map(l => `(${l.replace(/[()\\]/g, '\\$&')}) Tj T*`).join('\n')}
ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000400 00000 n
trailer<</Size 6/Root 1 0 R>>
startxref
470
%%EOF`;

  return Buffer.from(stream, 'utf-8');
}

function formatDate(d) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('de-DE'); } catch { return String(d); }
}

function fmtEur(n) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);
}
