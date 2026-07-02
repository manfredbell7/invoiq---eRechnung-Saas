// services/taxEngine.js — Steuerlogik Stufe 1 (DE/EU B2B)
//
// Steuerkennzeichen als Code-Katalog (statt DB-Tabelle): deterministisch,
// unit-testbar, versionierbar. Jede Belegposition trägt ein tax_code;
// die Summierung erfolgt SAP-üblich PRO KENNZEICHEN:
//   1. Positionsnetto = round2(Menge × Einzelpreis)
//   2. Gruppierung aller Positionen nach tax_code
//
//   3. Steuer je Gruppe = round2(Gruppennetto × Satz)  ← Rundung auf
//      Gruppenebene, nicht pro Position (vermeidet Cent-Differenzen)
//   4. Brutto = Netto + Summe der Gruppensteuern
//
// EN-16931-Bezug: category entspricht der UNTDID-5305-Steuerkategorie
// (S = Standard, E = Exempt, AE = Reverse Charge, K = innergem. Lieferung).
// Die XML-Generierung nutzt Stufe 1 weiterhin Kategorie S mit Satz —
// die korrekte Kategorie-Abbildung für RC/IG im XML ist als Folgeausbau
// dokumentiert (siehe Bericht / offene Punkte).

export const TAX_CODES = {
  S19: { rate: 19, category: 'S',  label: 'Umsatzsteuer 19 %' },
  S7:  { rate: 7,  category: 'S',  label: 'Umsatzsteuer 7 % (ermäßigt)' },
  E0:  { rate: 0,  category: 'E',  label: 'Steuerfrei (§ 4 UStG)',
         note: 'Steuerfreie Leistung gemäß § 4 UStG.' },
  RC:  { rate: 0,  category: 'AE', label: 'Reverse-Charge (§ 13b UStG)',
         note: 'Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG) — Reverse-Charge. Rechnung ohne Umsatzsteuer.' },
  IG:  { rate: 0,  category: 'K',  label: 'Innergemeinschaftliche Lieferung',
         note: 'Steuerfreie innergemeinschaftliche Lieferung (§ 4 Nr. 1b i. V. m. § 6a UStG).',
         requiresPartnerVatId: true },
};

export const DEFAULT_TAX_CODE = 'S19';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export function isValidTaxCode(code) {
  return Object.prototype.hasOwnProperty.call(TAX_CODES, code);
}

/**
 * Berechnet Positionsbeträge und Belegsummen mit Steuer-Breakdown.
 *
 * @param {Array<{quantity:number, unit_price:number, tax_code?:string}>} items
 * @returns {{
 *   amount_net:number, amount_tax:number, amount_gross:number,
 *   items:Array (mit net_amount/tax_amount je Position),
 *   tax_breakdown:Array<{code,label,rate,category,net,tax,note?}>,
 *   notes:string[]
 * }}
 */
export function computeTotals(items = []) {
  const groups = new Map(); // tax_code → { net }
  const outItems = items.map((it) => {
    const code = isValidTaxCode(it.tax_code) ? it.tax_code : DEFAULT_TAX_CODE;
    const qty = parseFloat(it.quantity) || 0;
    const price = parseFloat(it.unit_price) || 0;
    const net = round2(qty * price);
    const g = groups.get(code) || { net: 0 };
    g.net = round2(g.net + net);
    groups.set(code, g);
    return { ...it, tax_code: code, net_amount: net };
  });

  let amount_net = 0;
  let amount_tax = 0;
  const tax_breakdown = [];
  const notes = [];

  for (const [code, g] of groups) {
    const def = TAX_CODES[code];
    const tax = round2(g.net * (def.rate / 100));
    amount_net = round2(amount_net + g.net);
    amount_tax = round2(amount_tax + tax);
    tax_breakdown.push({
      code, label: def.label, rate: def.rate, category: def.category,
      net: g.net, tax, ...(def.note ? { note: def.note } : {}),
    });
    if (def.note && !notes.includes(def.note)) notes.push(def.note);
  }

  // Positions-Steueranteil informativ (anteilig aus Gruppensteuer nicht nötig —
  // Stufe 1: Positionssteuer = round2(net × rate), rein informativ, die
  // verbindliche Steuer ist die Gruppensumme im Breakdown).
  for (const it of outItems) {
    const def = TAX_CODES[it.tax_code];
    it.tax_amount = round2(it.net_amount * (def.rate / 100));
  }

  return {
    amount_net,
    amount_tax,
    amount_gross: round2(amount_net + amount_tax),
    items: outItems,
    tax_breakdown,
    notes,
  };
}

/**
 * Fachliche Plausibilitätsprüfung eines Belegs (Warnungen, keine Blocker).
 * Nachvollziehbar und regelbasiert — bewusst keine Blackbox.
 */
export function checkTaxPlausibility({ items = [], partner = {}, totals = null }) {
  const warnings = [];
  const t = totals || computeTotals(items);

  const codes = new Set(t.items.map(i => i.tax_code));

  if (codes.has('IG')) {
    if (!partner.vat_id) {
      warnings.push({ code: 'IG_VATID_MISSING', severity: 'error',
        msg: 'Innergemeinschaftliche Lieferung (IG) erfordert die USt-IdNr. des Empfängers — bitte in den Kundenstammdaten ergänzen.' });
    }
    if ((partner.country || 'DE') === 'DE') {
      warnings.push({ code: 'IG_DOMESTIC', severity: 'warning',
        msg: 'IG gewählt, aber Empfängerland ist DE — innergemeinschaftliche Lieferung setzt einen Empfänger im EU-Ausland voraus.' });
    }
  }

  if (codes.has('RC') && (partner.country || 'DE') === 'DE' && !partner.vat_id) {
    warnings.push({ code: 'RC_CHECK', severity: 'warning',
      msg: 'Reverse-Charge (§ 13b) gewählt — bitte prüfen, ob der Leistungsempfänger tatsächlich Steuerschuldner ist (B2B, einschlägige Leistungsart).' });
  }

  if (codes.has('S19') && (codes.has('RC') || codes.has('IG'))) {
    warnings.push({ code: 'MIXED_CODES', severity: 'warning',
      msg: 'Beleg mischt Standardsteuer mit Reverse-Charge/IG — fachlich möglich, aber ungewöhnlich. Bitte Positionen prüfen.' });
  }

  if (t.amount_gross <= 0) {
    warnings.push({ code: 'ZERO_TOTAL', severity: 'error', msg: 'Belegsumme ist 0 — mindestens eine Position mit Menge und Preis erfassen.' });
  }

  return warnings;
}

/**
 * Vergleicht Rechnungssumme mit Ursprungsbeleg (z.B. Auftrag) —
 * "passt Rechnungssumme zum Auftrag?"
 */
export function checkInvoiceAgainstSource(invoiceGross, sourceGross) {
  const diff = round2((parseFloat(invoiceGross) || 0) - (parseFloat(sourceGross) || 0));
  if (Math.abs(diff) < 0.01) return null;
  const pct = sourceGross ? Math.round(Math.abs(diff) / sourceGross * 100) : 100;
  return {
    code: 'AMOUNT_DEVIATION', severity: pct > 10 ? 'error' : 'warning',
    msg: `Rechnungssumme weicht um ${diff > 0 ? '+' : ''}${diff.toFixed(2)} € (${pct} %) vom Referenzbeleg ab.`,
    diff,
  };
}
