// src/services/deliveryService.js
// Invoice delivery: Peppol (Storecove), Email (Resend), SFTP, API

import { createHmac } from "crypto";
import { db } from '../config/db.js';

// ── PEPPOL DELIVERY (Storecove) ───────────────────────────────
async function deliverViaPeppol(invoice, xml) {
  // Production: POST to https://api.storecove.com/api/v2/document_submissions
  const payload = {
    receiver: {
      routing: {
        eidentifiers: [
          { scheme: '0106', id: invoice.buyer_peppol_id || invoice.buyer_vat_id }
        ]
      }
    },
    document: {
      document_type: 'invoice',
      invoice: {
        accounting_customer_party: { party: { party_name: invoice.buyer_name } },
        document_currency_code: invoice.currency || 'EUR',
        id: invoice.invoice_number,
      }
    }
  };

  // Mock response in dev
  if (process.env.NODE_ENV !== 'production') {
    const mockId = `PEPPOL-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    return { success: true, peppol_document_id: mockId, method: 'peppol', simulated: true };
  }

  // In production ohne konfigurierten Provider ehrlich fehlschlagen —
  // ein "erfolgreicher" Versand, der nie stattfand, wäre fatal.
  if (!process.env.STORECOVE_API_KEY) {
    throw new Error('Peppol-Versand ist nicht konfiguriert. Bitte E-Mail-Versand nutzen oder Support kontaktieren.');
  }

  const res = await fetch('https://api.storecove.com/api/v2/document_submissions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.STORECOVE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Peppol-Versand fehlgeschlagen: ${err}`);
  }

  const data = await res.json();
  return { success: true, peppol_document_id: data.guid, method: 'peppol' };
}

// ── EMAIL DELIVERY ────────────────────────────────────────────
async function deliverViaEmail(invoice, xml, org) {
  const subject = `Rechnung ${invoice.invoice_number} von ${invoice.seller_name}`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 8px;">
      <div style="background: #1D4ED8; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">invoiq</h1>
        <p style="margin: 4px 0 0; opacity: 0.8; font-size: 14px;">Elektronische Rechnung</p>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #111827;">Rechnung ${invoice.invoice_number}</h2>
        <p style="color: #374151;">Sehr geehrte Damen und Herren,</p>
        <p style="color: #374151;">anbei erhalten Sie die Rechnung <strong>${invoice.invoice_number}</strong> von <strong>${invoice.seller_name}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #F3F4F6;">
            <td style="padding: 10px; font-weight: bold; color: #374151;">Rechnungsnummer</td>
            <td style="padding: 10px; color: #374151;">${invoice.invoice_number}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; color: #374151;">Rechnungsdatum</td>
            <td style="padding: 10px; color: #374151;">${invoice.invoice_date}</td>
          </tr>
          <tr style="background: #F3F4F6;">
            <td style="padding: 10px; font-weight: bold; color: #374151;">Fälligkeitsdatum</td>
            <td style="padding: 10px; color: #374151;">${invoice.due_date || '—'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; color: #374151;">Betrag (Brutto)</td>
            <td style="padding: 10px; font-size: 18px; font-weight: bold; color: #1D4ED8;">
              ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: invoice.currency || 'EUR' }).format(invoice.amount_gross || 0)}
            </td>
          </tr>
          <tr style="background: #F3F4F6;">
            <td style="padding: 10px; font-weight: bold; color: #374151;">Format</td>
            <td style="padding: 10px; color: #374151;">${invoice.format?.toUpperCase()} (EN 16931)</td>
          </tr>
        </table>
        <p style="color: #6B7280; font-size: 13px;">Die strukturierte XML-Rechnung ist als Anhang beigefügt. Diese Rechnung entspricht der EN 16931 und ist GoBD-konform.</p>
        <hr style="border: 1px solid #E5E7EB; margin: 20px 0;">
        <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
          Verarbeitet durch <strong>invoiq</strong> — E-Invoice Platform · invoiq.de
        </p>
      </div>
    </div>`;

  // Mock email in dev
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[EMAIL] Mock send to: ${invoice.buyer_email} | Subject: ${subject}`);
    return { success: true, method: 'email', message_id: `mock-${Date.now()}`, simulated: true };
  }

  // Production: Resend API
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${process.env.EMAIL_FROM_NAME || 'invoiq'} <${process.env.EMAIL_FROM}>`,
      to: [invoice.buyer_email],
      subject,
      html: htmlBody,
      attachments: [{
        filename: `${invoice.invoice_number}.xml`,
        content: Buffer.from(xml).toString('base64'),
        content_type: 'application/xml',
      }]
    })
  });

  if (!res.ok) throw new Error(`E-Mail-Versand fehlgeschlagen: ${await res.text()}`);
  const data = await res.json();
  return { success: true, method: 'email', message_id: data.id };
}

// ── MAIN DELIVER FUNCTION ─────────────────────────────────────
export const deliveryService = {

  async deliver(invoice, xml, org) {
    const method = invoice.delivery_method || 'email';
    let result;

    try {
      switch (method) {
        case 'peppol':
          if (!invoice.buyer_peppol_id && !invoice.buyer_vat_id)
            throw new Error('Peppol-ID oder USt-IdNr. des Empfängers fehlt');
          result = await deliverViaPeppol(invoice, xml);
          break;

        case 'email':
          if (!invoice.buyer_email)
            throw new Error('E-Mail-Adresse des Empfängers fehlt');
          result = await deliverViaEmail(invoice, xml, org);
          break;

        case 'api':
        case 'manual':
          result = { success: true, method, message: 'Bereit zum Download' };
          break;

        default:
          result = { success: true, method: 'manual', message: 'Keine automatische Zustellung' };
      }

      // Audit log
      await db.createAuditLog({
        org_id: invoice.org_id,
        invoice_id: invoice.id,
        action: 'sent',
        details: { method, ...result }
      });

      return result;

    } catch (err) {
      await db.createAuditLog({
        org_id: invoice.org_id,
        invoice_id: invoice.id,
        action: 'delivery_failed',
        details: { method, error: err.message }
      });
      throw err;
    }
  },

  // Webhook delivery
  async deliverWebhook(url, secret, event, payload) {
    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
    const sig = createHmacSignature(body, secret);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[WEBHOOK] Mock delivery to: ${url} | Event: ${event}`);
      return { success: true, simulated: true };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Invoiq-Signature': sig,
        'X-Invoiq-Event': event,
      },
      body,
      signal: AbortSignal.timeout(5000),
    });

    return { success: res.ok, status: res.status };
  }
};

function createHmacSignature(body, secret) {
  
  return createHmac('sha256', secret).update(body).digest('hex');
}
