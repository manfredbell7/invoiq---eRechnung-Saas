// services/sepaService.js
// Generiert ISO 20022 pain.001 (SEPA Credit Transfer) XML
// Kompatibel mit allen deutschen Banken (Sparkasse, Volksbank, Deutsche Bank, etc.)

import { createHash } from 'crypto';

/**
 * Generiert pain.001.003.03 XML für SEPA-Überweisung
 * User lädt die Datei in sein Online-Banking → vorausgefüllt, nur noch PIN eingeben
 */
export function generateSEPAPain001({ invoice, payerName, payerIban, payerBic, applyDiscount = false }) {
  const msgId     = `invoiq-${invoice.id.slice(0, 8)}-${Date.now()}`;
  const pmtInfId  = `PMT-${invoice.id.slice(0, 8)}`;
  const endToEndId = `INV-${(invoice.invoice_number || invoice.id).slice(0, 30).replace(/[^a-zA-Z0-9-]/g, '-')}`;
  const createdAt = new Date().toISOString().slice(0, 19); // 2025-06-05T12:00:00
  const execDate  = new Date().toISOString().slice(0, 10); // 2025-06-05

  // Skonto-Logik
  const baseAmount  = parseFloat(invoice.amount || 0);
  const discountAmt = applyDiscount && invoice.discount_percent
    ? parseFloat((baseAmount * invoice.discount_percent / 100).toFixed(2))
    : 0;
  const finalAmount = (baseAmount - discountAmt).toFixed(2);

  const purpose = invoice.payment_reference
    || invoice.invoice_number
    || `Rechnung ${invoice.id.slice(0, 8)}`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document
  xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.003.03"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="urn:iso:std:iso:20022:tech:xsd:pain.001.003.03 pain.001.003.03.xsd">

  <CstmrCdtTrfInitn>

    <!-- Header -->
    <GrpHdr>
      <MsgId>${escXml(msgId)}</MsgId>
      <CreDtTm>${createdAt}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <CtrlSum>${finalAmount}</CtrlSum>
      <InitgPty>
        <Nm>${escXml(payerName || 'invoiq Nutzer')}</Nm>
      </InitgPty>
    </GrpHdr>

    <!-- Zahlung -->
    <PmtInf>
      <PmtInfId>${escXml(pmtInfId)}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>1</NbOfTxs>
      <CtrlSum>${finalAmount}</CtrlSum>

      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
      </PmtTpInf>

      <ReqdExctnDt>${execDate}</ReqdExctnDt>

      <!-- Auftraggeber (Zahler) -->
      <Dbtr>
        <Nm>${escXml(payerName || 'invoiq Nutzer')}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${escXml(cleanIban(payerIban || ''))}</IBAN>
        </Id>
      </DbtrAcct>
      ${payerBic ? `<DbtrAgt>
        <FinInstnId>
          <BIC>${escXml(payerBic)}</BIC>
        </FinInstnId>
      </DbtrAgt>` : ''}

      <!-- Transaktion -->
      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${escXml(endToEndId)}</EndToEndId>
        </PmtId>

        <!-- Betrag -->
        <Amt>
          <InstdAmt Ccy="EUR">${finalAmount}</InstdAmt>
        </Amt>

        <!-- Empfänger Bank -->
        ${invoice.seller_bic ? `<CdtrAgt>
          <FinInstnId>
            <BIC>${escXml(invoice.seller_bic)}</BIC>
          </FinInstnId>
        </CdtrAgt>` : ''}

        <!-- Empfänger (Lieferant) -->
        <Cdtr>
          <Nm>${escXml(invoice.seller_name || 'Lieferant')}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id>
            <IBAN>${escXml(cleanIban(invoice.seller_iban || ''))}</IBAN>
          </Id>
        </CdtrAcct>

        <!-- Verwendungszweck -->
        <RmtInf>
          <Ustrd>${escXml(purpose.slice(0, 140))}</Ustrd>
        </RmtInf>

      </CdtTrfTxInf>
    </PmtInf>

  </CstmrCdtTrfInitn>
</Document>`;

  return {
    xml: xml.trim(),
    filename: `SEPA_${invoice.invoice_number || invoice.id}_${execDate}.xml`,
    amount: parseFloat(finalAmount),
    discountApplied: discountAmt,
    payerIbanMissing: !payerIban,
  };
}

/**
 * Prüft ob Skonto noch aktiv ist
 * Gibt zurück: { active, daysLeft, savingEur, deadline }
 */
export function checkDiscount(invoice) {
  if (!invoice.discount_percent || !invoice.discount_days) {
    return { active: false };
  }

  const receivedAt  = new Date(invoice.created_at);
  const deadline    = new Date(receivedAt);
  deadline.setDate(deadline.getDate() + invoice.discount_days);

  const now      = new Date();
  const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  const active   = daysLeft > 0;
  const savingEur = active
    ? parseFloat(((invoice.amount || 0) * invoice.discount_percent / 100).toFixed(2))
    : 0;

  return {
    active,
    daysLeft: Math.max(0, daysLeft),
    deadline: deadline.toISOString().slice(0, 10),
    savingEur,
    percent: invoice.discount_percent,
  };
}

// ── HELPERS ──────────────────────────────────────────────────
function escXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cleanIban(iban) {
  return iban.replace(/\s/g, '').toUpperCase();
}
