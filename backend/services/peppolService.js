// src/services/peppolService.js
// Echter Peppol-Versand via Storecove API
// Docs: https://www.storecove.com/docs/

// ── PEPPOL SCHEME CODES ───────────────────────────────────────
// 0088 = GLN (Global Location Number)
// 0106 = Dutch CoC (KvK)
// 0190 = German VAT ID (DE...)
// 0192 = Norwegian org number
// 9930 = German Leitweg-ID (für Behörden)
// 9932 = Austrian UID
const SCHEME_MAP = {
  DE: '0190',  // Deutschland → VAT ID
  AT: '9932',  // Österreich
  NL: '0106',  // Niederlande
  NO: '0192',  // Norwegen
  DEFAULT: '0190',
};

function getScheme(vatId, country) {
  if (vatId?.startsWith('DE')) return '0190';
  if (vatId?.startsWith('AT')) return '9932';
  if (vatId?.startsWith('NL')) return '0106';
  return SCHEME_MAP[country] || SCHEME_MAP.DEFAULT;
}

// ── STORECOVE SENDER REGISTRATION ────────────────────────────
// Muss einmalig pro Organisation aufgerufen werden
export async function registerSender(org) {
  if (!process.env.STORECOVE_API_KEY) throw new Error('STORECOVE_API_KEY fehlt');

  const res = await fetch('https://api.storecove.com/api/v2/legal_entities', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.STORECOVE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      city: org.address_city || 'Berlin',
      country: org.address_country || 'DE',
      line1: org.address_street || '',
      party_name: org.name,
      zip: org.address_zip || '',
      peppol_identifiers: [{
        identifier: org.vat_id,
        scheme: getScheme(org.vat_id, org.address_country || 'DE'),
        superscheme: 'iso6523-actorid-upis',
      }],
      advertisements: ['invoice'],
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Storecove Registrierung fehlgeschlagen: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return {
    legal_entity_id: data.id,
    peppol_id: data.peppol_identifiers?.[0]?.identifier,
    scheme: data.peppol_identifiers?.[0]?.scheme,
  };
}

// ── LOOKUP: Empfänger im Peppol-Netzwerk suchen ───────────────
export async function lookupReceiver(vatId, country = 'DE') {
  if (!process.env.STORECOVE_API_KEY) return null;

  const scheme = getScheme(vatId, country);
  const res = await fetch(
    `https://api.storecove.com/api/v2/peppol/lookup?identifier=${encodeURIComponent(vatId)}&scheme=${scheme}`,
    {
      headers: { 'Authorization': `Bearer ${process.env.STORECOVE_API_KEY}` }
    }
  );

  if (!res.ok) return null;
  const data = await res.json();
  return data.code === 'OK' ? { found: true, scheme, identifier: vatId } : { found: false };
}

// ── HAUPTFUNKTION: Rechnung über Peppol versenden ─────────────
export async function sendViaPeppol(invoice, xmlContent, legalEntityId) {
  if (!process.env.STORECOVE_API_KEY) {
    // Sandbox/Demo Modus
    return {
      success: true,
      simulated: true,
      peppol_document_id: `PEPPOL-DEMO-${Date.now()}`,
      message: 'Peppol-Versand simuliert (kein API Key)',
    };
  }

  // Empfänger-ID bestimmen
  const receiverId = invoice.buyer_peppol_id || invoice.buyer_vat_id;
  const receiverCountry = invoice.buyer_country || 'DE';
  const scheme = getScheme(receiverId, receiverCountry);

  // Payload für Storecove
  const payload = {
    legal_entity_id: legalEntityId || process.env.STORECOVE_LEGAL_ENTITY_ID,
    idempotency_guid: `${invoice.id}-${Date.now()}`,
    routing: {
      eidentifiers: [{
        scheme,
        id: receiverId,
        superscheme: 'iso6523-actorid-upis',
      }],
      emails: invoice.buyer_email ? [invoice.buyer_email] : undefined,
    },
    document: {
      document_type: 'invoice',
      raw_document_data: Buffer.from(xmlContent).toString('base64'),
    },
  };

  const res = await fetch('https://api.storecove.com/api/v2/document_submissions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.STORECOVE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseText = await res.text();

  if (!res.ok) {
    let errMsg;
    try { errMsg = JSON.parse(responseText).detail || responseText; }
    catch { errMsg = responseText; }
    throw new Error(`Peppol-Versand fehlgeschlagen: ${errMsg}`);
  }

  const data = JSON.parse(responseText);
  return {
    success: true,
    peppol_document_id: data.guid,
    method: 'peppol',
    receiver_id: receiverId,
    scheme,
  };
}

// ── STATUS ABFRAGE ────────────────────────────────────────────
export async function getPeppolStatus(guid) {
  if (!process.env.STORECOVE_API_KEY || !guid) return null;

  const res = await fetch(`https://api.storecove.com/api/v2/document_submissions/${guid}`, {
    headers: { 'Authorization': `Bearer ${process.env.STORECOVE_API_KEY}` }
  });

  if (!res.ok) return null;
  const data = await res.json();

  return {
    guid: data.guid,
    status: data.status, // 'queued' | 'processing' | 'ok' | 'error'
    created_at: data.created_at,
    last_updated: data.last_updated,
    error: data.status === 'error' ? data.error_message : null,
  };
}

// ── SANDBOX TEST ──────────────────────────────────────────────
export async function testConnection() {
  if (!process.env.STORECOVE_API_KEY) {
    return { connected: false, message: 'Kein API Key konfiguriert' };
  }

  try {
    const res = await fetch('https://api.storecove.com/api/v2/legal_entities', {
      headers: { 'Authorization': `Bearer ${process.env.STORECOVE_API_KEY}` }
    });

    if (res.ok) {
      const data = await res.json();
      return {
        connected: true,
        message: 'Storecove Verbindung erfolgreich',
        legal_entities: data.length || 0,
      };
    }
    return { connected: false, message: `HTTP ${res.status}` };
  } catch (err) {
    return { connected: false, message: err.message };
  }
}
