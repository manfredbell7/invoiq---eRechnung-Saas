// routes/scanner/index.js — Dokumenten-Scanner
// PDF/Bild → Anthropic Claude → Strukturierte Rechnungsfelder
// DSGVO: keine Datei-Speicherung, nur Durchleitung
// WhatsApp/E-Mail Foto: POST /v1/scanner/from-email (Mailgun Inbound Hook)

import { authMiddleware } from '../../middleware/auth.js';
import { db } from '../../config/db.js';
import { supabase } from '../../config/database.js';

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
  // ── FOTO PER E-MAIL / WHATSAPP ────────────────────────────────
  // POST /v1/scanner/from-email
  // Mailgun Inbound: User schickt Foto/PDF an scanner@invoiq.io
  // → KI extrahiert Felder → als Entwurf in Rechnungen gespeichert
  fastify.post('/scanner/from-email', async (req, reply) => {
    try {
      const body        = req.body || {};
      const sender      = (body.sender || body.from || '').replace(/.*<(.+)>/, '$1').trim();
      const attachments = parseInt(body['attachment-count'] || '0');
      if(attachments === 0) return reply.send({ status: 'ignored', reason: 'no attachments' });

      // supabase direkt verfügbar via import
      const { data: user } = await supabase.from('users').select('id, org_id').ilike('email', sender).single();
      if(!user) return reply.send({ status: 'ignored', reason: 'sender unknown' });

      const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
      if(!ANTHROPIC_KEY) return reply.send({ status: 'ignored', reason: 'no api key' });

      // Attachment von Mailgun holen
      const attachUrl = body['attachment-url-1'];
      if(!attachUrl) return reply.send({ status: 'ignored', reason: 'no url' });

      const imgRes = await fetch(attachUrl);
      if(!imgRes.ok) return reply.send({ status: 'error', reason: 'fetch failed' });

      const imgBuffer   = Buffer.from(await imgRes.arrayBuffer());
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      const base64Data  = imgBuffer.toString('base64');
      const isPdf       = contentType.includes('pdf');

      const contentBlock = isPdf
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } }
        : { type: 'image',    source: { type: 'base64', media_type: contentType,        data: base64Data } };

      const aRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 1200,
          messages: [{ role: 'user', content: [
            contentBlock,
            { type: 'text', text: 'Extrahiere alle Rechnungsfelder. Antworte NUR mit JSON (kein Markdown):\n{"invoice_number":"","invoice_date":"YYYY-MM-DD","due_date":"YYYY-MM-DD","seller_name":"","seller_vat_id":"","seller_iban":"","buyer_name":"","line_items":[{"description":"","quantity":1,"unit_price":0,"vat_rate":19}],"currency":"EUR","discount_percent":null,"discount_days":null,"confidence":0.0}' }
          ]}],
        }),
      });

      const aData   = await aRes.json();
      const rawText = aData.content?.[0]?.text || '{}';
      let parsed;
      try { parsed = JSON.parse(rawText.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim()); }
      catch { return reply.send({ status: 'error', reason: 'parse failed' }); }

      const net = (parsed.line_items||[]).reduce((s,i)=>s+(i.quantity||1)*(i.unit_price||0), 0);
      const vat = (parsed.line_items||[]).reduce((s,i)=>s+(i.quantity||1)*(i.unit_price||0)*((i.vat_rate||19)/100), 0);

      await supabase.from('invoices').insert({
        org_id: user.org_id, invoice_number: parsed.invoice_number||`FOTO-${Date.now()}`,
        invoice_date: parsed.invoice_date||new Date().toISOString().slice(0,10),
        due_date: parsed.due_date||null, seller_name: parsed.seller_name||'',
        buyer_name: parsed.buyer_name||'', line_items: JSON.stringify(parsed.line_items||[]),
        amount_net: net, amount_vat: vat, amount_gross: net+vat, currency: 'EUR',
        format: 'draft_scan', status: 'draft', source: 'email_scan', created_by: user.id,
      });

      fastify.log.info({ sender, org_id: user.org_id }, 'Foto-Rechnung per E-Mail verarbeitet');
      return reply.send({ status: 'ok', invoice_number: parsed.invoice_number });
    } catch(err) {
      fastify.log.error(err, 'from-email error');
      return reply.send({ status: 'error', reason: err.message });
    }
  });

}