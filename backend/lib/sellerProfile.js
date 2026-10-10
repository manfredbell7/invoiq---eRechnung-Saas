// lib/sellerProfile.js — Verkäuferdaten einer E-Rechnung aus den Firmen-
// Einstellungen ergänzen.
//
// Alle Wege, die eine Rechnung erzeugen (Formular, Belegkette, IDoc,
// Nachgenerierung), rufen withSellerDefaults auf. So landen die XRechnung-
// Pflichtfelder (PLZ, Kontakt, Steuernummer, elektronische Adresse …)
// überall gleich im XML, ohne dass jede Route sie einzeln kennen muss.
import { buildInboundAddress } from './inboundAddress.js';

const filled = (v) => v !== undefined && v !== null && String(v).trim() !== '';

/** Verkäuferfelder (seller_*) aus einer Organisation ableiten. */
export function sellerFieldsFromOrg(org = {}, user = {}) {
  const inbound = buildInboundAddress(org.inbound_email_slug);
  return {
    seller_name:            org.name || '',
    seller_vat_id:          org.vat_id || '',
    seller_tax_number:      org.tax_number || '',
    seller_address:         org.address || '',
    seller_zip:             org.zip || '',
    seller_city:            org.city || '',
    seller_country:         org.country || 'DE',
    seller_iban:            org.iban || '',
    seller_bic:             org.bic || '',
    seller_register_number: org.register_number || '',
    // BT-41/42/43 Verkäufer-Kontakt (BR-DE-5/6/7)
    seller_contact_name:    org.contact_name || user.full_name || '',
    seller_phone:           org.phone || '',
    seller_email:           org.email || inbound || '',
    // BT-34 elektronische Adresse: die persönliche invoiq-Adresse empfängt
    // Antworten und Gutschriften direkt in der Inbox des Mandanten.
    seller_endpoint_email:  inbound || org.email || '',
    seller_peppol_id:       org.peppol_id || '',
  };
}

/**
 * Rechnung um fehlende Verkäuferdaten ergänzen. Werte, die in der Rechnung
 * bereits gesetzt sind, haben Vorrang; leere Werte (null/'') werden aus den
 * Einstellungen gefüllt.
 */
export function withSellerDefaults(invoice = {}, org = {}, user = {}) {
  const defaults = sellerFieldsFromOrg(org, user);
  const out = { ...invoice };
  for (const [key, value] of Object.entries(defaults)) {
    if (!filled(out[key]) && filled(value)) out[key] = value;
  }
  return out;
}
