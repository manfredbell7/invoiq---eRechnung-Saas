// Persönlicher Mandanten-Absender für den E-Mail-Versand
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personalSender, INBOUND_DOMAIN } from '../services/email.js';

test('personalSender baut Adresse aus Slug + Inbound-Domain', () => {
  const s = personalSender({ name: 'Bell Digital UG', inbound_email_slug: 'bell-digital-a1b2c3' });
  assert.equal(s.email, `bell-digital-a1b2c3@${INBOUND_DOMAIN}`);
  assert.equal(s.name, 'Bell Digital UG');
});

test('personalSender ohne Slug → null (Plattform-Absender)', () => {
  assert.equal(personalSender({ name: 'X' }), null);
  assert.equal(personalSender(null), null);
  assert.equal(personalSender(undefined), null);
});

test('personalSender entschärft Anführungszeichen/Winkel im Namen', () => {
  const s = personalSender({ name: 'Böse "GmbH" <hack>', inbound_email_slug: 'x-1' });
  assert.ok(!/["<>]/.test(s.name), 'keine Header-Injection-Zeichen im Anzeigenamen');
});
