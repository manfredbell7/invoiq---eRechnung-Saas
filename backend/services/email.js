// src/services/email.js
// Resend Email Service for invoiq.de

import { Resend } from 'resend';

// Lazy-Init: der Resend-Konstruktor wirft ohne API-Key — ohne Lazy-Init
// würde allein der Import dieses Moduls den Serverstart verhindern.
let _resend = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

// Absender-Konfiguration — .env.example nutzt EMAIL_FROM/EMAIL_FROM_NAME;
// FROM_EMAIL bleibt als Alt-Alias, damit bestehende Deployments nicht brechen.
// WICHTIG: Die Domain der Absenderadresse MUSS bei Resend verifiziert sein
// (resend.com/domains), sonst lehnt Resend jeden Versand ab.
const FROM_EMAIL = process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'rechnungen@invoiq.de';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'invoiq E-Rechnung';

// Zentraler Versand: einheitlicher Absender + verständliche Fehlermeldungen.
// Resend liefert bei unverifizierter Domain einen kryptischen 403 — wir
// übersetzen das in eine Meldung, mit der der Betreiber etwas anfangen kann.
async function sendMail(payload) {
  if (!process.env.RESEND_API_KEY) {
    const e = new Error('E-Mail-Versand ist nicht konfiguriert (RESEND_API_KEY fehlt).');
    e.statusCode = 503; throw e;
  }
  const { data, error } = await getResend().emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    ...payload,
  });
  if (error) {
    const msg = String(error.message || error.name || error);
    if (/not verified|verify your domain|domain/i.test(msg)) {
      const domain = FROM_EMAIL.split('@')[1] || 'invoiq.de';
      const e = new Error(
        `E-Mail-Versand blockiert: Die Absender-Domain „${domain}" ist bei Resend nicht verifiziert. `
        + `Bitte auf resend.com/domains die Domain anlegen und die angezeigten DNS-Einträge (DKIM, SPF) `
        + `beim DNS-Provider setzen. Bis dahin ist kein E-Mail-Versand möglich.`);
      e.statusCode = 503; throw e;
    }
    if (/api key|unauthorized|invalid/i.test(msg) && /key/i.test(msg)) {
      const e = new Error('E-Mail-Versand nicht möglich: RESEND_API_KEY ist ungültig.');
      e.statusCode = 503; throw e;
    }
    const e = new Error(`E-Mail-Versand fehlgeschlagen: ${msg}`);
    e.statusCode = 502; throw e;
  }
  return data;
}

// Inbound-Domain für die persönlichen e-Rechnungs-Adressen ([slug]@…)
export const INBOUND_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN || 'rechnungen.invoiq.de';

/**
 * Verifikationsstatus der Absender- und Eingangs-Domain bei Resend.
 * Wirft nicht — liefert immer ein Status-Objekt, damit die Einstellungen-
 * Seite grün/rot anzeigen kann statt mit einem Fehler zu brechen.
 */
export async function getEmailDomainStatus() {
  const outboundDomain = FROM_EMAIL.split('@')[1] || 'invoiq.de';
  const base = {
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    outbound: { domain: outboundDomain, status: 'unknown', verified: false },
    inbound:  { domain: INBOUND_DOMAIN, status: 'unknown', verified: false },
  };
  if (!process.env.RESEND_API_KEY) {
    base.outbound.status = base.inbound.status = 'unconfigured';
    base.error = 'RESEND_API_KEY ist nicht gesetzt — E-Mail-Versand und -Empfang sind deaktiviert.';
    return base;
  }
  try {
    const { data, error } = await getResend().domains.list();
    if (error) {
      base.outbound.status = base.inbound.status = 'error';
      base.error = `Resend-Abfrage fehlgeschlagen: ${error.message || error.name || error}`;
      return base;
    }
    const domains = data?.data || (Array.isArray(data) ? data : []);
    for (const key of ['outbound', 'inbound']) {
      const entry = domains.find(d => d.name === base[key].domain);
      if (!entry) { base[key].status = 'missing'; continue; }
      base[key].status = entry.status || 'pending';   // verified | pending | failed | …
      base[key].verified = entry.status === 'verified';
      if (entry.region) base[key].region = entry.region;
    }
    return base;
  } catch (err) {
    base.outbound.status = base.inbound.status = 'error';
    base.error = `Resend-Abfrage fehlgeschlagen: ${err.message}`;
    return base;
  }
}

/**
 * Send invoice email with XRechnung XML attachment
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email
 * @param {Object} params.invoice - Invoice data
 * @param {Buffer} params.xmlBuffer - XRechnung XML as buffer
 * @param {Buffer} params.pdfBuffer - Optional PDF attachment
 */
export async function sendInvoiceEmail({ to, invoice, xmlBuffer, pdfBuffer }) {
  try {
    const attachments = [
      {
        filename: `Rechnung_${invoice.invoice_number}.xml`,
        content: xmlBuffer,
      },
    ];

    if (pdfBuffer) {
      attachments.push({
        filename: `Rechnung_${invoice.invoice_number}.pdf`,
        content: pdfBuffer,
      });
    }

    const data = await sendMail({
      to,
      subject: `Rechnung ${invoice.invoice_number} - ${invoice.customer_name}`,
      html: invoiceEmailTemplate(invoice),
      attachments,
    });

    console.log('[Email Service] Invoice sent successfully:', data.id);
    return { success: true, emailId: data.id };
  } catch (error) {
    console.error('[Email Service] Failed to send invoice:', error);
    throw error;
  }
}

/**
 * Send payment confirmation email
 */
export async function sendPaymentSuccessEmail({ to, invoice, paymentDetails }) {
  try {
    const data = await sendMail({
      to,
      subject: `Zahlungsbestätigung - Rechnung ${invoice.invoice_number}`,
      html: paymentSuccessTemplate(invoice, paymentDetails),
    });

    console.log('[Email Service] Payment confirmation sent:', data.id);
    return { success: true, emailId: data.id };
  } catch (error) {
    console.error('[Email Service] Failed to send payment confirmation:', error);
    throw error;
  }
}

/**
 * Send payment failed notification
 */
export async function sendPaymentFailedEmail({ to, invoice, errorReason }) {
  try {
    const data = await sendMail({
      to,
      subject: `Zahlungsfehler - Rechnung ${invoice.invoice_number}`,
      html: paymentFailedTemplate(invoice, errorReason),
    });

    console.log('[Email Service] Payment failed notification sent:', data.id);
    return { success: true, emailId: data.id };
  } catch (error) {
    console.error('[Email Service] Failed to send payment failed email:', error);
    throw error;
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail({ to, resetUrl, fullName }) {
  const data = await sendMail({
    to,
    subject: 'invoiq — Passwort zurücksetzen',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h2 style="color:#101B3D;">Passwort zurücksetzen</h2>
        <p>Hallo${fullName ? ` ${fullName}` : ''},</p>
        <p>für Ihr invoiq-Konto wurde ein Passwort-Reset angefordert. Klicken Sie auf den Button, um ein neues Passwort zu vergeben:</p>
        <p style="margin: 28px 0;">
          <a href="${resetUrl}" style="background:#6D5BFF;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">Neues Passwort vergeben</a>
        </p>
        <p style="font-size:13px;color:#6b7280;">Der Link ist <strong>1 Stunde</strong> gültig. Falls Sie den Reset nicht angefordert haben, ignorieren Sie diese E-Mail — Ihr Passwort bleibt unverändert.</p>
        <p style="font-size:12px;color:#9ca3af;word-break:break-all;">Falls der Button nicht funktioniert: ${resetUrl}</p>
      </div>
    `,
  });
  return { success: true, emailId: data.id };
}

/**
 * Send test email (for debugging)
 */
export async function sendTestEmail({ to }) {
  try {
    const data = await sendMail({
      to,
      subject: 'Test Email - invoiq.de',
      html: '<p>This is a test email from invoiq.de. If you receive this, your Resend integration is working correctly!</p>',
    });

    return { success: true, emailId: data.id };
  } catch (error) {
    console.error('[Email Service] Test email failed:', error);
    throw error;
  }
}

// --- Email Templates ---

function invoiceEmailTemplate(invoice) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9fafb; }
        .invoice-details { background: white; padding: 15px; margin: 20px 0; border-radius: 8px; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
        .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>invoiq E-Rechnung</h1>
        </div>
        <div class="content">
          <h2>Neue Rechnung</h2>
          <p>Sehr geehrte/r ${invoice.customer_name},</p>
          <p>anbei erhalten Sie Ihre Rechnung im XRechnung-Format (EN16931-konform).</p>
          
          <div class="invoice-details">
            <p><strong>Rechnungsnummer:</strong> ${invoice.invoice_number}</p>
            <p><strong>Datum:</strong> ${new Date(invoice.invoice_date).toLocaleDateString('de-DE')}</p>
            <p><strong>Betrag:</strong> ${invoice.total_amount} EUR</p>
            <p><strong>Fälligkeitsdatum:</strong> ${new Date(invoice.due_date).toLocaleDateString('de-DE')}</p>
          </div>

          <p>Die Rechnung ist als XML-Datei im Anhang verfügbar.</p>
          <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>

          <p>Mit freundlichen Grüßen,<br>
          Ihr invoiq Team</p>
        </div>
        <div class="footer">
          <p>© 2026 invoiq.de - E-Rechnungslösung</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function paymentSuccessTemplate(invoice, paymentDetails) {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #10b981;">✓ Zahlung erfolgreich</h2>
        <p>Die Zahlung für Rechnung <strong>${invoice.invoice_number}</strong> wurde erfolgreich verarbeitet.</p>
        <p><strong>Betrag:</strong> ${paymentDetails.amount} EUR</p>
        <p><strong>Datum:</strong> ${new Date().toLocaleDateString('de-DE')}</p>
        <p>Vielen Dank!</p>
      </div>
    </body>
    </html>
  `;
}

function paymentFailedTemplate(invoice, errorReason) {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #ef4444;">⚠ Zahlungsfehler</h2>
        <p>Die Zahlung für Rechnung <strong>${invoice.invoice_number}</strong> konnte nicht verarbeitet werden.</p>
        <p><strong>Grund:</strong> ${errorReason || 'Unbekannter Fehler'}</p>
        <p>Bitte überprüfen Sie Ihre Zahlungsinformationen und versuchen Sie es erneut.</p>
      </div>
    </body>
    </html>
  `;
}

export default {
  sendInvoiceEmail,
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
  sendTestEmail,
};
