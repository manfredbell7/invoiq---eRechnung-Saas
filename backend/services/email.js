// src/services/email.js
// Resend Email Service for invoiq.io

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@invoiq.io';
const FROM_NAME = 'invoiq E-Rechnung';

/**
 * Send invoice email with XRechnung XML attachment
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email
 * @param {Object} params.invoice - Invoice data
 * @param {Buffer} params.xmlBuffer - XRechnung XML as buffer
 * @param {Buffer} params.pdfBuffer - Optional PDF attachment
 */
export async function sendInvoiceEmail({ to, invoice, xmlBuffer, pdfBuffer }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('E-Mail-Versand ist nicht konfiguriert (RESEND_API_KEY fehlt).');
  }
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

    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject: `Rechnung ${invoice.invoice_number} - ${invoice.customer_name}`,
      html: invoiceEmailTemplate(invoice),
      attachments,
    });

    if (error) {
      console.error('[Email Service] Error sending invoice:', error);
      throw error;
    }

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
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject: `Zahlungsbestätigung - Rechnung ${invoice.invoice_number}`,
      html: paymentSuccessTemplate(invoice, paymentDetails),
    });

    if (error) throw error;

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
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject: `Zahlungsfehler - Rechnung ${invoice.invoice_number}`,
      html: paymentFailedTemplate(invoice, errorReason),
    });

    if (error) throw error;

    console.log('[Email Service] Payment failed notification sent:', data.id);
    return { success: true, emailId: data.id };
  } catch (error) {
    console.error('[Email Service] Failed to send payment failed email:', error);
    throw error;
  }
}

/**
 * Send test email (for debugging)
 */
export async function sendTestEmail({ to }) {
  try {
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject: 'Test Email - invoiq.io',
      html: '<p>This is a test email from invoiq.io. If you receive this, your Resend integration is working correctly!</p>',
    });

    if (error) throw error;

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
          <p>© 2026 invoiq.io - E-Rechnungslösung</p>
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
