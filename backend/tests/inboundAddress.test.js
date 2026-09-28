// tests/inboundAddress.test.js — personalisierte e-Rechnungs-Adressen
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugifyCompanyName, generateInboundEmailSlug, buildInboundAddress, isUniqueViolation, INBOUND_DOMAIN, RESERVED_SLUGS } from '../lib/inboundAddress.js';

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

test('erster Versuch liefert den sauberen Slug ohne Suffix', () => {
  assert.equal(generateInboundEmailSlug('Apple'), 'apple');
  assert.equal(generateInboundEmailSlug('Test GmbH'), 'test-gmbh');
  assert.equal(generateInboundEmailSlug('Test GmbH', 0), 'test-gmbh');
});

test('Kollisionen werden nummeriert: firma → firma-2 → firma-3 …', () => {
  assert.equal(generateInboundEmailSlug('Apple', 1), 'apple-2');
  assert.equal(generateInboundEmailSlug('Apple', 2), 'apple-3');
  assert.equal(generateInboundEmailSlug('Apple', 8), 'apple-9');
});

test('nach vielen Kollisionen greift ein Zufallssuffix (Registrierung hängt nie)', () => {
  assert.match(generateInboundEmailSlug('Apple', 9), /^apple-[0-9a-f]{6}$/);
  const slugs = new Set(Array.from({ length: 30 }, () => generateInboundEmailSlug('Apple', 20)));
  assert.equal(slugs.size, 30);
});

test('reservierte Namen bekommen nie die suffixlose Adresse', () => {
  for (const bad of ['Postmaster', 'admin', 'INFO', 'noreply', 'invoiq']) {
    const slug = generateInboundEmailSlug(bad, 0);
    assert.ok(!RESERVED_SLUGS.has(slug), `${bad} → ${slug} darf nicht reserviert sein`);
  }
  assert.equal(generateInboundEmailSlug('admin', 0), 'admin-2');
});

test('vollständige Adresse nutzt die Inbound-Domain', () => {
  assert.equal(buildInboundAddress('test-gmbh'), `test-gmbh@${INBOUND_DOMAIN}`);
  assert.equal(buildInboundAddress(null), null);
  assert.equal(buildInboundAddress(''), null);
});

test('Unique-Verletzungen werden erkannt', () => {
  assert.equal(isUniqueViolation(new Error('duplicate key value violates unique constraint "organizations_inbound_email_slug_idx"')), true);
  assert.equal(isUniqueViolation(new Error('[db/createOrg] duplicate key value')), true);
  assert.equal(isUniqueViolation(new Error('connection refused')), false);
  assert.equal(isUniqueViolation(null), false);
});
