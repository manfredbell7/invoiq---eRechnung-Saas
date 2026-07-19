// lib/inboundAddress.js — Personalisierte e-Rechnungs-Adressen
//
// Jeder Kunde bekommt bei der Registrierung eine eigene, einzigartige Adresse
// im Format [firmenname]-[uniqueID]@rechnungen.invoiq.io. Der Firmenname wird
// E-Mail-/URL-sicher normalisiert (a-z, 0-9, Bindestrich, Umlaute
// transliteriert), das zufällige Suffix garantiert Einzigartigkeit auch bei
// gleichnamigen Firmen.
import { randomBytes } from 'crypto';

// Default identisch zu services/email.js — hier dupliziert statt importiert,
// damit dieses Modul (und seine Unit-Tests) ohne Supabase-/Resend-Setup lädt.
export const INBOUND_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN || 'rechnungen.invoiq.io';

export function slugifyCompanyName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/, '') || 'firma';
}

export function generateInboundEmailSlug(orgName) {
  return `${slugifyCompanyName(orgName)}-${randomBytes(3).toString('hex')}`;
}

export function buildInboundAddress(slug) {
  return slug ? `${slug}@${INBOUND_DOMAIN}` : null;
}

export function isUniqueViolation(err) {
  return /duplicate key|23505|unique constraint|already exists/i.test(err?.message || '');
}

/**
 * Stellt sicher, dass eine Organisation eine personalisierte Adresse hat.
 * Bestandskunden ohne inbound_email_slug (z.B. aus der Zeit vor diesem
 * Feature) bekommen beim nächsten Login/Laden lazily eine generiert und
 * persistiert. Mutiert das übergebene org-Objekt und liefert den Slug.
 */
export async function ensureInboundEmailSlug(org) {
  if (!org) return null;
  if (org.inbound_email_slug) return org.inbound_email_slug;
  // Lazy-Import: config/db.js zieht den Supabase-Client, der ohne env vars
  // beim Import wirft — so bleibt dieses Modul auch ohne Setup ladbar.
  const { db } = await import('../config/db.js');
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = generateInboundEmailSlug(org.name);
    try {
      await db.updateOrg(org.id, { inbound_email_slug: slug });
      org.inbound_email_slug = slug;
      return slug;
    } catch (err) {
      // Kollision mit dem Unique-Index → neues Suffix versuchen
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new Error('inbound_email_slug konnte nicht generiert werden (Unique-Kollisionen)');
}
