// services/peppolSoftService.js
// Peppol-Versand via PeppolSoft API — $0.10/Dokument, kein Abo
// https://peppolsoft.com

export async function sendViaPeppol({ xmlContent, receiverPeppolId, invoiceNumber }) {
  const apiKey = process.env.PEPPOLSOFT_API_KEY;

  if (!apiKey) {
    // Demo mode
    console.log(`[PeppolSoft] Demo: würde senden an ${receiverPeppolId}`);
    return {
      success: true,
      demo: true,
      message: 'Demo-Modus — PEPPOLSOFT_API_KEY in Railway setzen',
      transmission_id: `DEMO-${Date.now()}`,
    };
  }

  // Detect scheme from Peppol-ID format: 0190:DE123456789 → scheme=0190
  const peppolMatch = receiverPeppolId.match(/^(\d+):(.+)$/);
  const scheme  = peppolMatch?.[1] || '0190';
  const identifier = peppolMatch?.[2] || receiverPeppolId;

  try {
    const response = await fetch('https://app.peppolsoft.com/api/v1/documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        receiver: {
          id: identifier,
          scheme: scheme,
        },
        document_type: 'invoice',
        format: 'ubl',
        content: xmlContent,
        reference: invoiceNumber,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `PeppolSoft API Fehler ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      transmission_id: data.id || data.transmission_id,
      status: data.status || 'queued',
    };

  } catch (err) {
    console.error('[PeppolSoft] Versand fehlgeschlagen:', err.message);
    throw err;
  }
}

export async function checkPeppolStatus(transmissionId) {
  const apiKey = process.env.PEPPOLSOFT_API_KEY;
  if (!apiKey) return { status: 'demo' };

  const response = await fetch(`https://app.peppolsoft.com/api/v1/documents/${transmissionId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!response.ok) throw new Error(`Status-Abfrage fehlgeschlagen: ${response.status}`);
  return response.json();
}

// Validate if a Peppol-ID exists in the network
export async function lookupPeppolId(peppolId) {
  const apiKey = process.env.PEPPOLSOFT_API_KEY;
  if (!apiKey) return { found: true, demo: true };

  try {
    const peppolMatch = peppolId.match(/^(\d+):(.+)$/);
    const scheme     = peppolMatch?.[1] || '0190';
    const identifier = peppolMatch?.[2] || peppolId;

    const response = await fetch(
      `https://app.peppolsoft.com/api/v1/lookup?scheme=${scheme}&id=${encodeURIComponent(identifier)}`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    );
    if (!response.ok) return { found: false };
    const data = await response.json();
    return { found: !!data.found, name: data.name };
  } catch {
    return { found: false };
  }
}
