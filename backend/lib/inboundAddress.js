// lib/inboundAddress.js — Personalisierte e-Rechnungs-Adressen
//
// Jeder Kunde bekommt bei der Registrierung eine eigene, einzigartige Adresse
// im sauberen Format [firmenname]@rechnungen.invoiq.de (z. B. apple@…).
// Der Firmenname wird E-Mail-/URL-sicher normalisiert (a-z, 0-9, Bindestrich,
// Umlaute transliteriert). Nur bei Namenskollision (oder reserviertem Namen)
// wird nummeriert: apple, apple-2, apple-3 … — als letzte Rettung nach vielen
// Kollisionen ein zufälliges Suffix, damit die Registrierung nie hängt.
import { randomBytes } from 'crypto';

// Lokalteile, die Kunden nicht belegen dürfen (Missbrauch/Verwechslung mit
// administrativen Adressen der Catch-all-Domain).
export const RESERVED_SLUGS = new Set([
  'postmaster', 'abuse', 'admin', 'administrator', 'hostmaster', 'webmaster',
  'root', 'info', 'mail', 'noreply', 'no-reply', 'support', 'security',
  'billing', 'rechnung', 'rechnungen', 'invoiq', 'test', 'demo',
]);

// Default identisch zu services/email.js — hier dupliziert statt importiert,
// damit dieses Modul (und seine Unit-Tests) ohne Supabase-/Resend-Setup lädt.
export const INBOUND_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN || 'rechnungen.invoiq.de';

export function slugifyCompanyName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/, '') || 'firma';
}

/**
 * Slug für Versuch `attempt` (0-basiert):
 *   0 → firmenname            (sauber, ohne Suffix)
 *   1 → firmenname-2
 *   2 → firmenname-3 … bis firmenname-9
 *   ab Versuch 9 → firmenname-<zufall> (garantiertes Ende der Schleife)
 * Reservierte Namen überspringen die suffixlose Variante.
 */
export function generateInboundEmailSlug(orgName, attempt = 0) {
  const base = slugifyCompanyName(orgName);
  const a = RESERVED_SLUGS.has(base) ? attempt + 1 : attempt;
  if (a === 0) return base;
  if (a <= 8) return `${base}-${a + 1}`;
  return `${base}-${randomBytes(3).toString('hex')}`;
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
  for (let attempt = 0; attempt < 12; attempt++) {
    const slug = generateInboundEmailSlug(org.name, attempt);
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
