// services/accountingEngine.js — FI Stufe 1: Kontenplan, doppelte Buchführung,
// automatische Kontierung, DATEV-EXTF-Buchungsstapel, Bilanz/GuV.
//
// Prinzipien (wie taxEngine): deterministisch, code-versioniert, unit-testbar.
// Der Kontenplan ist ein kuratierter Katalog der praxisrelevanten Konten in
// BEIDEN Standardkontenrahmen (SKR03 = Prozessgliederung, SKR04 = Abschluss-
// gliederung). Jede Buchung ist ein Journal-Eintrag mit Soll/Haben-Zeilen;
// Summe Soll = Summe Haben ist eine harte Invariante (validateEntry).
// GoBD: Einträge sind unveränderlich — Korrektur nur per Stornobuchung.

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// ── KONTENPLAN (SKR03 / SKR04) ────────────────────────────────
// type: aktiv | passiv | ertrag | aufwand  (Bilanz-/GuV-Zuordnung)
export const CHART_OF_ACCOUNTS = [
  // Anlagevermögen
  { key: 'KONZESSIONEN_SOFTWARE', skr03: '0027', skr04: '0135', type: 'aktiv',  label: 'EDV-Software / Lizenzen' },
  { key: 'GRUNDSTUECKE',          skr03: '0085', skr04: '0235', type: 'aktiv',  label: 'Grundstücke und Bauten' },
  { key: 'MASCHINEN',             skr03: '0210', skr04: '0440', type: 'aktiv',  label: 'Maschinen' },
  { key: 'PKW',                   skr03: '0320', skr04: '0520', type: 'aktiv',  label: 'PKW' },
  { key: 'BGA',                   skr03: '0420', skr04: '0650', type: 'aktiv',  label: 'Betriebs- und Geschäftsausstattung' },
  { key: 'GWG',                   skr03: '0480', skr04: '0670', type: 'aktiv',  label: 'Geringwertige Wirtschaftsgüter' },
  // Finanz- / Umlaufvermögen
  { key: 'KASSE',                 skr03: '1000', skr04: '1600', type: 'aktiv',  label: 'Kasse' },
  { key: 'BANK',                  skr03: '1200', skr04: '1800', type: 'aktiv',  label: 'Bank' },
  { key: 'FORDERUNGEN',           skr03: '1400', skr04: '1200', type: 'aktiv',  label: 'Forderungen aus Lieferungen und Leistungen' },
  { key: 'VORSTEUER_7',           skr03: '1571', skr04: '1401', type: 'aktiv',  label: 'Abziehbare Vorsteuer 7 %' },
  { key: 'VORSTEUER_19',          skr03: '1576', skr04: '1406', type: 'aktiv',  label: 'Abziehbare Vorsteuer 19 %' },
  { key: 'VORRAETE',              skr03: '3980', skr04: '1140', type: 'aktiv',  label: 'Bestand Waren' },
  // Eigenkapital / Privat
  { key: 'EIGENKAPITAL',          skr03: '0800', skr04: '2900', type: 'passiv', label: 'Gezeichnetes Kapital / Eigenkapital' },
  { key: 'GEWINNVORTRAG',         skr03: '0860', skr04: '2970', type: 'passiv', label: 'Gewinnvortrag vor Verwendung' },
  { key: 'PRIVATENTNAHME',        skr03: '1800', skr04: '2100', type: 'passiv', label: 'Privatentnahmen allgemein' },
  { key: 'PRIVATEINLAGE',         skr03: '1890', skr04: '2180', type: 'passiv', label: 'Privateinlagen' },
  // Verbindlichkeiten / Steuern
  { key: 'VERBINDLICHKEITEN',     skr03: '1600', skr04: '3300', type: 'passiv', label: 'Verbindlichkeiten aus Lieferungen und Leistungen' },
  { key: 'DARLEHEN',              skr03: '0630', skr04: '3150', type: 'passiv', label: 'Verbindlichkeiten gegenüber Kreditinstituten' },
  { key: 'UST_7',                 skr03: '1771', skr04: '3801', type: 'passiv', label: 'Umsatzsteuer 7 %' },
  { key: 'UST_19',                skr03: '1776', skr04: '3806', type: 'passiv', label: 'Umsatzsteuer 19 %' },
  { key: 'UST_VORAUSZAHLUNG',     skr03: '1780', skr04: '3820', type: 'passiv', label: 'Umsatzsteuer-Vorauszahlungen' },
  { key: 'LOHNVERBINDLICHKEIT',   skr03: '1740', skr04: '3720', type: 'passiv', label: 'Verbindlichkeiten aus Lohn und Gehalt' },
  // Erlöse
  { key: 'ERLOES_19',             skr03: '8400', skr04: '4400', type: 'ertrag', label: 'Erlöse 19 % USt' },
  { key: 'ERLOES_7',              skr03: '8300', skr04: '4300', type: 'ertrag', label: 'Erlöse 7 % USt' },
  { key: 'ERLOES_STFREI',         skr03: '8120', skr04: '4120', type: 'ertrag', label: 'Steuerfreie Umsätze § 4 UStG' },
  { key: 'ERLOES_IG',             skr03: '8125', skr04: '4125', type: 'ertrag', label: 'Steuerfreie innergem. Lieferungen § 4 Nr. 1b UStG' },
  { key: 'ERLOES_RC13B',          skr03: '8337', skr04: '4337', type: 'ertrag', label: 'Erlöse § 13b UStG (Reverse-Charge)' },
  { key: 'SONST_ERTRAG',          skr03: '8600', skr04: '4830', type: 'ertrag', label: 'Sonstige Erträge' },
  { key: 'ZINSERTRAG',            skr03: '2650', skr04: '7100', type: 'ertrag', label: 'Zinserträge' },
  // Materialaufwand
  { key: 'WARENEINGANG_19',       skr03: '3400', skr04: '5400', type: 'aufwand', label: 'Wareneingang 19 % Vorsteuer' },
  { key: 'WARENEINGANG_7',        skr03: '3300', skr04: '5300', type: 'aufwand', label: 'Wareneingang 7 % Vorsteuer' },
  { key: 'FREMDLEISTUNGEN',       skr03: '3100', skr04: '5900', type: 'aufwand', label: 'Fremdleistungen' },
  // Personalaufwand
  { key: 'LOEHNE',                skr03: '4110', skr04: '6010', type: 'aufwand', label: 'Löhne' },
  { key: 'GEHAELTER',             skr03: '4120', skr04: '6020', type: 'aufwand', label: 'Gehälter' },
  { key: 'SOZIALE_ABGABEN',       skr03: '4130', skr04: '6110', type: 'aufwand', label: 'Gesetzliche soziale Aufwendungen' },
  // Sachaufwand
  { key: 'MIETE',                 skr03: '4210', skr04: '6310', type: 'aufwand', label: 'Miete' },
  { key: 'NEBENKOSTEN_RAUM',      skr03: '4240', skr04: '6325', type: 'aufwand', label: 'Gas, Strom, Wasser' },
  { key: 'VERSICHERUNGEN',        skr03: '4360', skr04: '6400', type: 'aufwand', label: 'Versicherungen' },
  { key: 'BEITRAEGE',             skr03: '4380', skr04: '6420', type: 'aufwand', label: 'Beiträge' },
  { key: 'KFZ_KOSTEN',            skr03: '4530', skr04: '6530', type: 'aufwand', label: 'Laufende KFZ-Betriebskosten' },
  { key: 'WERBEKOSTEN',           skr03: '4600', skr04: '6600', type: 'aufwand', label: 'Werbekosten' },
  { key: 'BEWIRTUNG',             skr03: '4650', skr04: '6640', type: 'aufwand', label: 'Bewirtungskosten' },
  { key: 'REISEKOSTEN',           skr03: '4670', skr04: '6670', type: 'aufwand', label: 'Reisekosten Unternehmer' },
  { key: 'PORTO',                 skr03: '4910', skr04: '6800', type: 'aufwand', label: 'Porto' },
  { key: 'TELEFON',               skr03: '4920', skr04: '6805', type: 'aufwand', label: 'Telefon / Internet' },
  { key: 'BUEROBEDARF',           skr03: '4930', skr04: '6815', type: 'aufwand', label: 'Bürobedarf' },
  { key: 'FORTBILDUNG',           skr03: '4945', skr04: '6821', type: 'aufwand', label: 'Fortbildungskosten' },
  { key: 'RECHTSBERATUNG',        skr03: '4950', skr04: '6825', type: 'aufwand', label: 'Rechts- und Beratungskosten' },
  { key: 'BUCHFUEHRUNG',          skr03: '4955', skr04: '6830', type: 'aufwand', label: 'Buchführungskosten' },
  { key: 'NEBENKOSTEN_GELD',      skr03: '4970', skr04: '6855', type: 'aufwand', label: 'Nebenkosten des Geldverkehrs' },
  { key: 'AFA_SACHANLAGEN',       skr03: '4830', skr04: '6220', type: 'aufwand', label: 'Abschreibungen auf Sachanlagen' },
  { key: 'GWG_SOFORT',            skr03: '4855', skr04: '6260', type: 'aufwand', label: 'Sofortabschreibung GWG' },
  { key: 'ZINSAUFWAND',           skr03: '2100', skr04: '7300', type: 'aufwand', label: 'Zinsaufwand' },
  { key: 'SONST_AUFWAND',         skr03: '4900', skr04: '6300', type: 'aufwand', label: 'Sonstige betriebliche Aufwendungen' },
];

export const ACCOUNT_FRAMES = ['skr03', 'skr04'];

export function accountsForFrame(frame = 'skr03') {
  const f = ACCOUNT_FRAMES.includes(frame) ? frame : 'skr03';
  return CHART_OF_ACCOUNTS.map(a => ({
    key: a.key, number: a[f], label: a.label, type: a.type, frame: f,
  }));
}

export function accountNumber(key, frame = 'skr03') {
  const a = CHART_OF_ACCOUNTS.find(x => x.key === key);
  if (!a) throw new Error(`[accounting] Unbekanntes Konto: ${key}`);
  return a[ACCOUNT_FRAMES.includes(frame) ? frame : 'skr03'];
}

export function accountInfo(number, frame = 'skr03') {
  const f = ACCOUNT_FRAMES.includes(frame) ? frame : 'skr03';
  return CHART_OF_ACCOUNTS.find(a => a[f] === String(number)) || null;
}

// ── KONTIERUNGSREGELN je Steuerkennzeichen ───────────────────
// Ausgangsrechnung: Forderungen (Soll, brutto) an Erlöskonto (Haben, netto)
//                   + USt-Konto (Haben, Steuer)
const REVENUE_RULES = {
  S19: { revenue: 'ERLOES_19',    tax: 'UST_19' },
  S7:  { revenue: 'ERLOES_7',     tax: 'UST_7' },
  E0:  { revenue: 'ERLOES_STFREI', tax: null },
  RC:  { revenue: 'ERLOES_RC13B',  tax: null },
  IG:  { revenue: 'ERLOES_IG',     tax: null },
};

// Eingangsrechnung: Aufwand (Soll, netto) + Vorsteuer (Soll)
//                   an Verbindlichkeiten (Haben, brutto)
const EXPENSE_RULES = {
  19: { expense: 'WARENEINGANG_19', tax: 'VORSTEUER_19' },
  7:  { expense: 'WARENEINGANG_7',  tax: 'VORSTEUER_7' },
  0:  { expense: 'SONST_AUFWAND',   tax: null },
};

/** Harte Invariante der doppelten Buchführung. */
export function validateEntry(lines) {
  const errors = [];
  if (!Array.isArray(lines) || lines.length < 2) {
    errors.push('Eine Buchung braucht mindestens zwei Zeilen (Soll und Haben).');
    return { ok: false, errors, debit: 0, credit: 0 };
  }
  let debit = 0, credit = 0;
  for (const [i, l] of lines.entries()) {
    const d = round2(parseFloat(l.debit) || 0);
    const c = round2(parseFloat(l.credit) || 0);
    if (d < 0 || c < 0) errors.push(`Zeile ${i + 1}: negative Beträge sind unzulässig (Storno per Gegenbuchung).`);
    if (d > 0 && c > 0) errors.push(`Zeile ${i + 1}: eine Zeile bucht entweder Soll oder Haben, nicht beides.`);
    if (d === 0 && c === 0) errors.push(`Zeile ${i + 1}: Betrag fehlt.`);
    if (!l.account) errors.push(`Zeile ${i + 1}: Konto fehlt.`);
    debit = round2(debit + d);
    credit = round2(credit + c);
  }
  if (Math.abs(debit - credit) >= 0.01) {
    errors.push(`Buchung nicht ausgeglichen: Soll ${debit.toFixed(2)} ≠ Haben ${credit.toFixed(2)}.`);
  }
  return { ok: errors.length === 0, errors, debit, credit };
}

/**
 * Automatische Kontierung einer Ausgangsrechnung.
 * Erwartet tax_breakdown aus taxEngine.computeTotals (Gruppen je Kennzeichen).
 */
export function postingForOutboundInvoice(invoice, taxBreakdown, frame = 'skr03') {
  const gross = round2(taxBreakdown.reduce((s, g) => s + g.net + g.tax, 0));
  const lines = [{
    account: accountNumber('FORDERUNGEN', frame),
    debit: gross, credit: 0,
    label: `Forderung ${invoice.invoice_number} · ${invoice.buyer_name || ''}`.trim(),
  }];
  for (const g of taxBreakdown) {
    const rule = REVENUE_RULES[g.code] || REVENUE_RULES.S19;
    lines.push({
      account: accountNumber(rule.revenue, frame),
      debit: 0, credit: round2(g.net),
      tax_code: g.code,
      label: `Erlös ${g.label || g.code}`,
    });
    if (rule.tax && g.tax > 0) {
      lines.push({
        account: accountNumber(rule.tax, frame),
        debit: 0, credit: round2(g.tax),
        tax_code: g.code,
        label: `USt ${g.rate} %`,
      });
    }
  }
  return {
    entry_date: invoice.invoice_date || new Date().toISOString().slice(0, 10),
    description: `Ausgangsrechnung ${invoice.invoice_number} — ${invoice.buyer_name || ''}`.trim(),
    doc_ref: invoice.invoice_number,
    source_type: 'invoice_outbound',
    lines,
  };
}

/** Automatische Kontierung einer Eingangsrechnung (Netto + Vorsteuer an Kreditor). */
export function postingForInboundInvoice(inv, frame = 'skr03') {
  const gross = round2(parseFloat(inv.amount_gross ?? inv.amount) || 0);
  const net = round2(parseFloat(inv.amount_net) || 0);
  const tax = round2(gross - net);
  // Steuersatz heuristisch aus dem Verhältnis (Stufe 1: eine Steuergruppe)
  const rate = net > 0 ? Math.round((tax / net) * 100) : 0;
  const rule = EXPENSE_RULES[rate] || EXPENSE_RULES[0];

  const lines = [{
    account: accountNumber(rule.expense, frame),
    debit: net > 0 ? net : gross, credit: 0,
    label: `Aufwand ${inv.invoice_number || ''} · ${inv.seller_name || ''}`.trim(),
  }];
  if (rule.tax && tax > 0.005) {
    lines.push({
      account: accountNumber(rule.tax, frame),
      debit: tax, credit: 0,
      label: `Vorsteuer ${rate} %`,
    });
  }
  lines.push({
    account: accountNumber('VERBINDLICHKEITEN', frame),
    debit: 0, credit: gross,
    label: `Verbindlichkeit ${inv.seller_name || ''}`.trim(),
  });
  return {
    entry_date: inv.invoice_date || new Date().toISOString().slice(0, 10),
    description: `Eingangsrechnung ${inv.invoice_number || ''} — ${inv.seller_name || ''}`.trim(),
    doc_ref: inv.invoice_number || null,
    source_type: 'invoice_inbound',
    lines,
  };
}

/** Stornobuchung: Soll/Haben aller Zeilen tauschen (GoBD-konforme Korrektur). */
export function reversalOf(entry) {
  return {
    entry_date: new Date().toISOString().slice(0, 10),
    description: `STORNO zu Buchung Nr. ${entry.entry_no}: ${entry.description || ''}`.trim(),
    doc_ref: entry.doc_ref,
    source_type: 'storno',
    lines: entry.lines.map(l => ({
      account: l.account, contra_account: l.contra_account || null,
      debit: parseFloat(l.credit) || 0, credit: parseFloat(l.debit) || 0,
      tax_code: l.tax_code || null, cost_center_id: l.cost_center_id || null,
      label: `Storno: ${l.label || ''}`.trim(),
    })),
  };
}

// ── AUSWERTUNG: Bilanz & GuV ─────────────────────────────────
/**
 * Aggregiert Journalzeilen zu Bilanz und GuV.
 * @param lines [{account, debit, credit}] · frame für die Kontenzuordnung
 */
export function buildReports(lines, frame = 'skr03') {
  const perAccount = new Map();
  for (const l of lines) {
    const acc = String(l.account);
    const e = perAccount.get(acc) || { debit: 0, credit: 0 };
    e.debit = round2(e.debit + (parseFloat(l.debit) || 0));
    e.credit = round2(e.credit + (parseFloat(l.credit) || 0));
    perAccount.set(acc, e);
  }

  const rows = { aktiv: [], passiv: [], ertrag: [], aufwand: [], unbekannt: [] };
  const sums = { aktiv: 0, passiv: 0, ertrag: 0, aufwand: 0 };

  for (const [acc, e] of perAccount) {
    const info = accountInfo(acc, frame);
    const type = info?.type || 'unbekannt';
    // Saldo in der "natürlichen" Seite des Kontotyps:
    const balance = (type === 'aktiv' || type === 'aufwand')
      ? round2(e.debit - e.credit)   // Aktiv/Aufwand: Sollsaldo positiv
      : round2(e.credit - e.debit);  // Passiv/Ertrag: Habensaldo positiv
    const row = { account: acc, label: info?.label || 'Nicht zugeordnet', balance, debit: e.debit, credit: e.credit };
    rows[type in rows ? type : 'unbekannt'].push(row);
    if (type in sums) sums[type] = round2(sums[type] + balance);
  }
  for (const k of Object.keys(rows)) rows[k].sort((a, b) => a.account.localeCompare(b.account));

  const result = round2(sums.ertrag - sums.aufwand); // Jahresergebnis
  return {
    frame,
    guv: {
      ertraege: rows.ertrag, aufwendungen: rows.aufwand,
      summe_ertraege: sums.ertrag, summe_aufwendungen: sums.aufwand,
      jahresergebnis: result,
    },
    bilanz: {
      aktiva: rows.aktiv, passiva: rows.passiv,
      summe_aktiva: sums.aktiv,
      // Passiva inkl. Jahresergebnis (Gewinn erhöht das Eigenkapital)
      summe_passiva: round2(sums.passiv + result),
      jahresergebnis: result,
      ausgeglichen: Math.abs(sums.aktiv - round2(sums.passiv + result)) < 0.01,
    },
    nicht_zugeordnet: rows.unbekannt,
  };
}

// ── DATEV-BUCHUNGSSTAPEL (EXTF 700) ──────────────────────────
// Kernfelder des DATEV-Format-Standards; Betrag immer positiv, Seite über
// Soll/Haben-Kennzeichen. Eine Journalzeile = eine Stapelzeile gegen das
// Gegenkonto der ersten Zeile (vereinfachtes Splitverfahren Stufe 1).
const dat = (d) => (d || '').replace(/-/g, '');
const ddmm = (d) => { const s = dat(d); return s.length === 8 ? s.slice(6, 8) + s.slice(4, 6) : ''; };
const q = (s) => `"${String(s ?? '').replace(/"/g, '')}"`;
const amt = (n) => (parseFloat(n) || 0).toFixed(2).replace('.', ',');

export function buildDatevExtf(entries, { frame = 'skr03', fromDate, toDate, orgName = '' } = {}) {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 17).padEnd(17, '0');
  const wjBegin = `${(fromDate || now.toISOString()).slice(0, 4)}0101`;

  // Headerzeile nach DATEV-Format-Standard (EXTF, Version 700, Kategorie 21 = Buchungsstapel)
  const header = [
    q('EXTF'), 700, 21, q('Buchungsstapel'), 12,
    ts, '', '', '', '',
    '', '', wjBegin, 4,
    dat(fromDate) || wjBegin, dat(toDate) || dat(now.toISOString().slice(0, 10)),
    q(`invoiq ${orgName}`.trim()), '', 1, 0, 0,
    q('EUR'),
  ].join(';');

  const cols = [
    'Umsatz (ohne Soll/Haben-Kz)', 'Soll/Haben-Kennzeichen', 'WKZ Umsatz', 'Kurs',
    'Basis-Umsatz', 'WKZ Basis-Umsatz', 'Konto', 'Gegenkonto (ohne BU-Schlüssel)',
    'BU-Schlüssel', 'Belegdatum', 'Belegfeld 1', 'Belegfeld 2', 'Skonto', 'Buchungstext',
    'KOST1 - Kostenstelle',
  ].join(';');

  const rows = [];
  for (const entry of entries) {
    const lines = entry.lines || [];
    if (!lines.length) continue;
    // Gegenkonto = Konto der betragsgrößten Zeile (typisch Debitor/Kreditor)
    const anchor = [...lines].sort((a, b) =>
      (Math.max(b.debit || 0, b.credit || 0)) - (Math.max(a.debit || 0, a.credit || 0)))[0];
    for (const l of lines) {
      if (l === anchor) continue;
      const amount = Math.max(parseFloat(l.debit) || 0, parseFloat(l.credit) || 0);
      if (amount === 0) continue;
      // DATEV bucht aus Sicht des Kontos: S wenn das Konto im Soll steht
      const sh = (parseFloat(l.debit) || 0) > 0 ? 'S' : 'H';
      rows.push([
        amt(amount), q(sh), q('EUR'), '', '', '',
        l.account, anchor.account, '',
        ddmm(entry.entry_date), q(entry.doc_ref || entry.entry_no), '',
        '', q((l.label || entry.description || '').slice(0, 60)),
        q(l.cost_center_code || ''),
      ].join(';'));
    }
  }

  return [header, cols, ...rows].join('\r\n') + '\r\n';
}
