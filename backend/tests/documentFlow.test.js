// tests/documentFlow.test.js — Statuslogik & Konvertierungsregeln (offline)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOC_TYPES, DOC_STATUS, INITIAL_STATUS, TRANSITIONS,
  canTransition, canConvert, SOURCE_STATUS_AFTER_CONVERT, CONVERSIONS,
} from '../services/documentFlow.js';

test('Jede Belegart hat Initialstatus aus ihrem Statusraum', () => {
  for (const t of DOC_TYPES) {
    assert.ok(DOC_STATUS[t].includes(INITIAL_STATUS[t]), t);
  }
});

test('Alle Übergangs-Ziele liegen im Statusraum der Belegart', () => {
  for (const t of DOC_TYPES) {
    for (const [from, tos] of Object.entries(TRANSITIONS[t])) {
      assert.ok(DOC_STATUS[t].includes(from), `${t}:${from}`);
      for (const to of tos) assert.ok(DOC_STATUS[t].includes(to), `${t}:${from}->${to}`);
    }
  }
});

test('Zulässige und unzulässige Statusübergänge', () => {
  assert.equal(canTransition('order', 'offen', 'bestaetigt'), true);
  assert.equal(canTransition('order', 'offen', 'fakturiert'), false); // nicht direkt
  assert.equal(canTransition('order', 'fakturiert', 'storniert'), false); // fakturiert ist final
  assert.equal(canTransition('quote', 'entwurf', 'gesendet'), true);
  assert.equal(canTransition('quote', 'abgelehnt', 'angenommen'), false);
  assert.equal(canTransition('quote', 'abgelaufen', 'gesendet'), true); // Nachfassen
  assert.equal(canTransition('request', 'offen', 'beantwortet'), true);
  assert.equal(canTransition('delivery', 'offen', 'geliefert'), true);
});

test('Konvertierungskette: Anfrage→Angebot→Auftrag→Lieferung→Rechnung', () => {
  assert.equal(canConvert('request', 'offen', 'quote').ok, true);
  assert.equal(canConvert('quote', 'gesendet', 'order').ok, true);
  assert.equal(canConvert('quote', 'angenommen', 'order').ok, true);
  assert.equal(canConvert('order', 'bestaetigt', 'delivery').ok, true);
  assert.equal(canConvert('order', 'bestaetigt', 'invoice').ok, true);
  assert.equal(canConvert('delivery', 'geliefert', 'invoice').ok, true);
});

test('Unzulässige Konvertierungen werden mit Begründung abgelehnt', () => {
  // Falsche Reihenfolge
  const r1 = canConvert('request', 'offen', 'order');
  assert.equal(r1.ok, false);
  assert.ok(r1.reason.includes('Anfrage'));
  // Falscher Quellstatus
  const r2 = canConvert('quote', 'entwurf', 'order');
  assert.equal(r2.ok, false);
  assert.ok(r2.reason.includes('entwurf'));
  // Stornierte Quelle
  assert.equal(canConvert('order', 'storniert', 'invoice').ok, false);
  // Doppelfakturierung: fakturiert ist nicht mehr konvertierbar
  assert.equal(canConvert('order', 'fakturiert', 'invoice').ok, false);
  assert.equal(canConvert('delivery', 'fakturiert', 'invoice').ok, false);
});

test('Quellstatus nach Konvertierung ist definiert und gültig', () => {
  for (const [edge, status] of Object.entries(SOURCE_STATUS_AFTER_CONVERT)) {
    const src = edge.split('->')[0];
    assert.ok(DOC_STATUS[src].includes(status), edge);
  }
  // Jede erlaubte Konvertierung hat einen Folge-Status
  for (const [src, targets] of Object.entries(CONVERSIONS)) {
    for (const tgt of targets) {
      assert.ok(SOURCE_STATUS_AFTER_CONVERT[`${src}->${tgt}`], `${src}->${tgt}`);
    }
  }
});
