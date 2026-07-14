// services/inboundProcessor.js — gemeinsame Verarbeitung eingehender E-Mails
// Wird vom Mailgun-Altpfad (/v1/inbound/email) und vom Resend-Inbound-Webhook
// (/v1/webhooks/email-inbound) genutzt: Anhänge parsen (XRechnung/ZUGFeRD),
// in inbound_invoices ablegen, Absender als Lieferant anlegen, Audit-Eintrag.

import { supabase } from '../config/database.js';
import { db } from '../config/db.js';
import { parseInboundXML, validateEN16931, hashXML } from './xmlEngine.js';

/**
 * Org anhand der Empfängeradresse(n) auflösen.
 * Unterstützt [slug]@rechnungen.invoiq.io (neu) und rechnungen-[slug]@invoiq.io (alt).
 * @param {string[]|string} recipients
 */
export async function resolveOrgByRecipient(recipients) {
  const list = Array.isArray(recipients) ? recipients : [recipients];
  for (const r of list) {
    const addr = String(r || '');
    const match = addr.match(/([a-z0-9\-]+)@rechnungen\.invoiq\.io/i)
               || addr.match(/rechnungen-([a-z0-9\-]+)@invoiq\.io/i);
    if (!match) continue;
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('inbound_email_slug', match[1].toLowerCase())
      .single();
    if (org) return org;
  }
  return null;
}

/**
 * Eingehende E-Mail verarbeiten und als Eingangsrechnung(en) ablegen.
 * @param {Object} p
 * @param {{id:string,name?:string}} p.org
 * @param {string} p.sender    z.B. "Max Muster <max@firma.de>"
 * @param {string} p.subject
 * @param {{filename:string,buffer:Buffer}[]} p.attachments
 * @param {string} [p.source]  'mailgun' | 'resend'
 * @returns {Promise<{processed:number}>}
 */
export async function processInboundEmail({ org, sender, subject, attachments = [], source = 'unknown' }) {
  let processed = 0;

  for (const att of attachments) {
    const fn = (att.filename || '').toLowerCase();
    let xmlContent = null;
    let format = 'unknown';

    if (fn.endsWith('.xml')) {
      xmlContent = att.buffer.toString('utf-8');
      format = 'xrechnung';
    } else if (fn.endsWith('.pdf')) {
      // ZUGFeRD/Factur-X: eingebettetes XML — sonst KI-Extraktion, sonst Prüfung
      xmlContent = await extractFromPDF(att.buffer);
      format = xmlContent ? 'zugferd' : 'pdf';
    } else {
      continue; // Bilder/Signaturen etc. überspringen
    }

    const parsed     = xmlContent ? parseInboundXML(xmlContent) : null;
    const validation = xmlContent ? validateEN16931(parsed?.data || {}) : { passed: false };

    await supabase.from('inbound_invoices').insert({
      org_id:            org.id,
      sender_email:      sender,
      sender_name:       extractName(sender),
      subject,
      format,
      raw_xml:           xmlContent,
      xml_hash:          xmlContent ? hashXML(xmlContent) : null,
      status:            format === 'pdf' ? 'pruefung' : 'empfangen',
      invoice_number:    parsed?.data?.invoice_number  || null,
      amount:            parsed?.data?.amount_gross    || null,
      amount_net:        parsed?.data?.amount_net      || null,
      due_date:          parsed?.data?.due_date        || null,
      seller_name:       parsed?.data?.seller_name     || extractName(sender),
      seller_vat_id:     parsed?.data?.seller_vat_id   || null,
      seller_iban:       parsed?.data?.seller_iban     || null,
      seller_bic:        parsed?.data?.seller_bic      || null,
      discount_percent:  parsed?.data?.discount_percent || null,
      discount_days:     parsed?.data?.discount_days   || null,
      payment_reference: parsed?.data?.payment_reference || null,
      validation_passed: validation.passed,
      attachment_name:   att.filename || null,
    });
    processed++;

    // Absender als Lieferant anlegen/aktualisieren (nur mit USt-Id eindeutig)
    const vatId = parsed?.data?.seller_vat_id;
    if (vatId) {
      await supabase.from('vendors').upsert({
        org_id: org.id,
        vendor_vat_id: vatId,
        vendor_name: parsed?.data?.seller_name || extractName(sender),
        vendor_iban: parsed?.data?.seller_iban || undefined,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'org_id,vendor_vat_id', ignoreDuplicates: false }).then(() => {}).catch?.(() => {});
    }
  }

  // Mail ohne verwertbaren Anhang: trotzdem als Eingang protokollieren
  if (processed === 0) {
    await supabase.from('inbound_invoices').insert({
      org_id:       org.id,
      sender_email: sender,
      sender_name:  extractName(sender),
      subject,
      format:       'email',
      status:       'pruefung',
      validation_passed: false,
    });
    processed = 1;
  }

  // Benachrichtigung/Verlauf: erscheint im Audit-Log des Mandanten
  await db.createAuditLog({
    org_id: org.id,
    action: 'inbound_received',
    details: { sender, subject: (subject || '').slice(0, 200), attachments: attachments.length, source },
  }).catch?.(() => {});

  return { processed };
}

export function extractName(email) {
  return (String(email || '').match(/^([^<@]+)/)?.[1] || email || '').trim().replace(/"/g, '');
}

export async function extractFromPDF(buffer) {
  // Ohne KI-Key keine Extraktion — das PDF wird trotzdem als Eingang mit
  // Status "pruefung" gespeichert (ehrlicher Zustand statt Fake-XML).
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const base64 = buffer.toString('base64');
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 1200,
        messages: [{ role: 'user', content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: 'Extrahiere alle Rechnungsfelder und gib NUR XRechnung UBL XML zurück. Kein Markdown.' }
        ]}],
      }),
    });
    const data = await response.json();
    return data.content?.[0]?.text?.replace(/```xml|```/g, '').trim() || null;
  } catch (e) {
    return null; // KI-Extraktion fehlgeschlagen → PDF trotzdem als Eingang speichern
  }
}
