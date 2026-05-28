// routes/scanner/index.js — Dokumenten-Scanner
// PDF/Bild → Anthropic Claude → Strukturierte Rechnungsfelder
// DSGVO: keine Datei-Speicherung, nur Durchleitung

export async function scannerRoutes(fastify) {

  // POST /api/v1/scanner/extract
  // Multipart: field "file" (PDF or image)
  fastify.post('/scanner/extract', {
    config: { rawBody: true },
    preHandler: async (req, reply) => {
      // Auth check
      const auth = req.headers['authorization'];
      if (!auth?.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
    },
  }, async (req, reply) => {
    let fileBuffer, mimeType, fileName;

    try {
      const data = await req.file();
      if (!data) return reply.code(400).send({ error: 'Keine Datei übermittelt' });

      fileName  = data.filename;
      mimeType  = data.mimetype;
      const chunks = [];
      for await (const chunk of data.file) chunks.push(chunk);
      fileBuffer = Buffer.concat(chunks);

    } catch (err) {
      return reply.code(400).send({ error: 'Datei konnte nicht gelesen werden' });
    }

    // Validate type
    const ALLOWED = ['application/pdf','image/jpeg','image/jpg','image/png','image/webp'];
    if (!ALLOWED.includes(mimeType)) {
      return reply.code(400).send({ error: 'Nur PDF, JPG oder PNG erlaubt' });
    }
    if (fileBuffer.length > 10 * 1024 * 1024) {
      return reply.code(400).send({ error: 'Datei zu groß — max. 10 MB' });
    }

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_KEY) {
      // Demo mode — return realistic mock data
      return reply.send({
        success: true,
        demo: true,
        data: {
          invoice_number:  'RE-2025-00847',
          invoice_date:    '2025-05-15',
          due_date:        '2025-06-14',
          seller_name:     'Mustermann Lieferant GmbH',
          seller_vat_id:   'DE987654321',
          seller_address:  'Lieferantenstraße 42',
          seller_city:     'Hamburg',
          buyer_name:      'Ihr Unternehmen GmbH',
          buyer_address:   'Musterstraße 1',
          buyer_city:      'Berlin',
          buyer_vat_id:    'DE123456789',
          line_items: [
            { description: 'Beratungsleistung Mai 2025', quantity: 8, unit_price: 150.00, vat_rate: 19 },
            { description: 'Reisekosten', quantity: 1, unit_price: 280.00, vat_rate: 19 },
          ],
          currency:    'EUR',
          confidence:  0.91,
          notes:       'Demo-Modus: Kein API-Key gesetzt. Testdaten werden angezeigt.',
        },
      });
    }

    // Real Anthropic call
    try {
      const base64Data = fileBuffer.toString('base64');

      // Build content block
      const contentBlock = mimeType === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } }
        : { type: 'image',    source: { type: 'base64', media_type: mimeType, data: base64Data } };

      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 1200,
          messages: [{
            role: 'user',
            content: [
              contentBlock,
              {
                type: 'text',
                text: `Du bist ein Spezialist für deutsche E-Rechnungen (EN 16931 / XRechnung).
Extrahiere alle Rechnungsfelder aus diesem Dokument.
Antworte NUR mit einem validen JSON-Objekt — kein Markdown, keine Erklärung, kein Präambel.

{
  "invoice_number": "",
  "invoice_date": "YYYY-MM-DD oder leer",
  "due_date": "YYYY-MM-DD oder leer",
  "seller_name": "",
  "seller_vat_id": "DE-Nummer oder leer",
  "seller_address": "Straße Hausnummer",
  "seller_city": "PLZ Stadt",
  "buyer_name": "",
  "buyer_address": "",
  "buyer_city": "",
  "buyer_vat_id": "",
  "line_items": [
    {"description": "", "quantity": 1, "unit_price": 0.00, "vat_rate": 19}
  ],
  "currency": "EUR",
  "confidence": 0.0,
  "notes": "Hinweise zu fehlenden oder unsicheren Feldern"
}

Regeln:
- confidence zwischen 0.0 und 1.0 (wie sicher bist du insgesamt)
- Fehlende Felder als leeren String ""
- Preise als Zahlen ohne Währungssymbol
- vat_rate als Zahl (19, 7, oder 0)
- Datum immer YYYY-MM-DD Format`,
              },
            ],
          }],
        }),
      });

      if (!anthropicRes.ok) {
        const err = await anthropicRes.text();
        fastify.log.error({ status: anthropicRes.status, err }, 'Anthropic API error');
        return reply.code(502).send({ error: 'Erkennungsdienst nicht verfügbar' });
      }

      const anthropicData = await anthropicRes.json();
      const rawText = anthropicData.content?.[0]?.text || '{}';

      let parsed;
      try {
        const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        fastify.log.error({ rawText }, 'JSON parse failed');
        return reply.code(422).send({ error: 'Dokument konnte nicht strukturiert werden — bitte Bildqualität prüfen' });
      }

      return reply.send({ success: true, data: parsed });

    } catch (err) {
      fastify.log.error(err, 'Scanner extract error');
      return reply.code(500).send({ error: 'Interner Fehler bei der Verarbeitung' });
    }
  });
}
