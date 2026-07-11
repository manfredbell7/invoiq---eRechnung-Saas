// tests/accountingEngine.test.js — FI-Kern: Kontenplan, Buchungslogik,
// Auto-Kontierung, Bilanz/GuV, DATEV-EXTF (komplett offline)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHART_OF_ACCOUNTS, ACCOUNT_FRAMES, accountsForFrame, accountNumber, accountInfo,
  validateEntry, postingForOutboundInvoice, postingForInboundInvoice,
  reversalOf, buildReports, buildDatevExtf,
} from '../services/accountingEngine.js';
import { computeTotals } from '../services/taxEngine.js';

test('Kontenplan: jedes Konto hat SKR03+SKR04-Nummer, Typ und Label', () => {
  assert.ok(CHART_OF_ACCOUNTS.length >= 50);
  for (const a of CHART_OF_ACCOUNTS) {
    assert.match(a.skr03, /^\d{4}$/, a.key);
    assert.match(a.skr04, /^\d{4}$/, a.key);
    assert.ok(['aktiv', 'passiv', 'ertrag', 'aufwand'].includes(a.type), a.key);
    assert.ok(a.label.length > 2, a.key);
  }
  // Keine doppelten Nummern je Rahmen
  for (const f of ACCOUNT_FRAMES) {
    const nums = CHART_OF_ACCOUNTS.map(a => a[f]);
    assert.equal(new Set(nums).size, nums.length, `Duplikate in ${f}`);
  }
});

test('Kontenplan: klassische SKR-Zuordnungen stimmen', () => {
  assert.equal(accountNumber('ERLOES_19', 'skr03'), '8400');
  assert.equal(accountNumber('ERLOES_19', 'skr04'), '4400');
  assert.equal(accountNumber('BANK', 'skr03'), '1200');
  assert.equal(accountNumber('BANK', 'skr04'), '1800');
  assert.equal(accountNumber('FORDERUNGEN', 'skr03'), '1400');
  assert.equal(accountNumber('UST_19', 'skr03'), '1776');
  assert.equal(accountNumber('VORSTEUER_19', 'skr04'), '1406');
  assert.equal(accountInfo('8400', 'skr03').key, 'ERLOES_19');
  assert.equal(accountsForFrame('skr04').find(a => a.key === 'ERLOES_7').number, '4300');
});

test('validateEntry: Soll=Haben wird erzwungen', () => {
  assert.equal(validateEntry([
    { account: '1400', debit: 119, credit: 0 },
    { account: '8400', debit: 0, credit: 100 },
    { account: '1776', debit: 0, credit: 19 },
  ]).ok, true);

  const bad = validateEntry([
    { account: '1400', debit: 119, credit: 0 },
    { account: '8400', debit: 0, credit: 100 },
  ]);
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some(e => e.includes('nicht ausgeglichen')));

  assert.equal(validateEntry([{ account: '1400', debit: 10, credit: 0 }]).ok, false);       // nur 1 Zeile
  assert.equal(validateEntry([
    { account: '1400', debit: 10, credit: 10 },
    { account: '8400', debit: 0, credit: 0 },
  ]).ok, false);                                                                             // Soll+Haben in einer Zeile / 0-Zeile
});

test('Auto-Kontierung Ausgangsrechnung: Debitor an Erlös + USt, gemischte Sätze', () => {
  const items = [
    { description: 'Beratung', quantity: 10, unit_price: 100, tax_code: 'S19' },
    { description: 'Buch', quantity: 2, unit_price: 25, tax_code: 'S7' },
  ];
  const totals = computeTotals(items);
  const posting = postingForOutboundInvoice(
    { invoice_number: 'RE-1', buyer_name: 'ACME', invoice_date: '2026-07-01' },
    totals.tax_breakdown, 'skr03',
  );
  const v = validateEntry(posting.lines);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  assert.equal(v.debit, totals.amount_gross);                        // 1243.50
  assert.equal(posting.lines[0].account, '1400');                    // Forderungen
  assert.ok(posting.lines.some(l => l.account === '8400' && l.credit === 1000));
  assert.ok(posting.lines.some(l => l.account === '8300' && l.credit === 50));
  assert.ok(posting.lines.some(l => l.account === '1776' && l.credit === 190));
  assert.ok(posting.lines.some(l => l.account === '1771' && l.credit === 3.5));
});

test('Auto-Kontierung: Reverse-Charge ohne USt-Zeile, korrektes Erlöskonto', () => {
  const totals = computeTotals([{ description: 'Bau', quantity: 1, unit_price: 1000, tax_code: 'RC' }]);
  const posting = postingForOutboundInvoice({ invoice_number: 'RE-2' }, totals.tax_breakdown, 'skr04');
  assert.equal(validateEntry(posting.lines).ok, true);
  assert.ok(posting.lines.some(l => l.account === '4337' && l.credit === 1000)); // §13b SKR04
  assert.ok(!posting.lines.some(l => l.account === '3806'));                     // keine USt
});

test('Auto-Kontierung Eingangsrechnung: Aufwand + Vorsteuer an Kreditor', () => {
  const posting = postingForInboundInvoice({
    invoice_number: 'ER-9', seller_name: 'Lieferant', amount_gross: 238, amount_net: 200,
  }, 'skr03');
  const v = validateEntry(posting.lines);
  assert.equal(v.ok, true);
  assert.ok(posting.lines.some(l => l.account === '3400' && l.debit === 200));  // Wareneingang 19%
  assert.ok(posting.lines.some(l => l.account === '1576' && l.debit === 38));   // Vorsteuer
  assert.ok(posting.lines.some(l => l.account === '1600' && l.credit === 238)); // Kreditor
});

test('Storno: tauscht Soll/Haben und bleibt ausgeglichen', () => {
  const entry = {
    entry_no: 7, description: 'Testbuchung', doc_ref: 'RE-1',
    lines: [
      { account: '1400', debit: 119, credit: 0, label: 'F' },
      { account: '8400', debit: 0, credit: 100, label: 'E' },
      { account: '1776', debit: 0, credit: 19, label: 'U' },
    ],
  };
  const storno = reversalOf(entry);
  assert.equal(validateEntry(storno.lines).ok, true);
  assert.equal(storno.lines[0].credit, 119);
  assert.equal(storno.lines[1].debit, 100);
  assert.ok(storno.description.includes('STORNO'));
  assert.equal(storno.source_type, 'storno');
});

test('Bilanz/GuV: Jahresergebnis schließt die Bilanz', () => {
  // Rechnung 119 brutto (100 Erlös, 19 USt) + Aufwand 40 bar bezahlt
  const lines = [
    { account: '1400', debit: 119, credit: 0 },
    { account: '8400', debit: 0, credit: 100 },
    { account: '1776', debit: 0, credit: 19 },
    { account: '4930', debit: 40, credit: 0 },
    { account: '1000', debit: 0, credit: 40 },
  ];
  const r = buildReports(lines, 'skr03');
  assert.equal(r.guv.summe_ertraege, 100);
  assert.equal(r.guv.summe_aufwendungen, 40);
  assert.equal(r.guv.jahresergebnis, 60);
  assert.equal(r.bilanz.summe_aktiva, 79);          // 119 Forderung − 40 Kasse
  assert.equal(r.bilanz.summe_passiva, 79);         // 19 USt + 60 Ergebnis
  assert.equal(r.bilanz.ausgeglichen, true);
});

test('DATEV-EXTF: Header, Spalten und balancierte Stapelzeilen', () => {
  const csv = buildDatevExtf([{
    entry_no: 1, entry_date: '2026-07-01', doc_ref: 'RE-1', description: 'AR RE-1',
    lines: [
      { account: '1400', debit: 119, credit: 0, label: 'Forderung' },
      { account: '8400', debit: 0, credit: 100, label: 'Erlös 19%' },
      { account: '1776', debit: 0, credit: 19, label: 'USt 19%' },
    ],
  }], { frame: 'skr03', fromDate: '2026-07-01', toDate: '2026-07-31', orgName: 'Demo GmbH' });

  const rows = csv.trim().split('\r\n');
  assert.ok(rows[0].startsWith('"EXTF";700;21;"Buchungsstapel"'));
  assert.ok(rows[1].startsWith('Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen'));
  assert.equal(rows.length, 4);                       // Header + Spalten + 2 Zeilen (Anker=Debitor)
  assert.ok(rows[2].includes('100,00'));
  assert.ok(rows[2].includes(';8400;1400;'));         // Konto;Gegenkonto
  assert.ok(rows[2].includes('"H"'));                 // Erlös steht im Haben
  assert.ok(rows[2].includes(';0107;'));              // Belegdatum TTMM
  assert.ok(rows[3].includes('19,00'));
});
