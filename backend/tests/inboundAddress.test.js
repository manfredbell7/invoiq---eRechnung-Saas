// tests/inboundAddress.test.js — personalisierte e-Rechnungs-Adressen
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugifyCompanyName, generateInboundEmailSlug, buildInboundAddress, isUniqueViolation, INBOUND_DOMAIN } from '../lib/inboundAddress.js';

test('Firmenname wird E-Mail-sicher normalisiert', () => {
  assert.equal(slugifyCompanyName('Test GmbH'), 'test-gmbh');
  assert.equal(slugifyCompanyName('Müller & Söhne KG'), 'mueller-soehne-kg');
  assert.equal(slugifyCompanyName('Straußenhof Größenwahn'), 'straussenhof-groessenwahn');
  assert.equal(slugifyCompanyName('  --Weird__Name!!  '), 'weird-name');
});

test('Slug wird auf 30 Zeichen begrenzt, ohne Randbindestriche', () => {
  const slug = slugifyCompanyName('Sehr Lange Firmenbezeichnung Und Noch Länger GmbH & Co. KG');
  assert.ok(slug.length <= 30);
  assert.ok(!slug.startsWith('-') && !slug.endsWith('-'));
});

test('Leerer/unbrauchbarer Name fällt auf "firma" zurück', () => {
  assert.equal(slugifyCompanyName(''), 'firma');
  assert.equal(slugifyCompanyName('!!!'), 'firma');
  assert.equal(slugifyCompanyName(null), 'firma');
});

test('generierter Slug hat Format firmenname-uniqueID', () => {
  const slug = generateInboundEmailSlug('Test GmbH');
  assert.match(slug, /^test-gmbh-[0-9a-f]{6}$/);
});

test('jeder Kunde bekommt eine einzigartige Adresse — auch bei gleichem Firmennamen', () => {
  const slugs = new Set(Array.from({ length: 50 }, () => generateInboundEmailSlug('Test GmbH')));
  assert.equal(slugs.size, 50);
});

test('vollständige Adresse nutzt die Inbound-Domain', () => {
  assert.equal(buildInboundAddress('test-gmbh-48235b'), `test-gmbh-48235b@${INBOUND_DOMAIN}`);
  assert.equal(buildInboundAddress(null), null);
  assert.equal(buildInboundAddress(''), null);
});

test('Unique-Verletzungen werden erkannt', () => {
  assert.equal(isUniqueViolation(new Error('duplicate key value violates unique constraint "organizations_inbound_email_slug_idx"')), true);
  assert.equal(isUniqueViolation(new Error('[db/createOrg] duplicate key value')), true);
  assert.equal(isUniqueViolation(new Error('connection refused')), false);
  assert.equal(isUniqueViolation(null), false);
});
