// tests/mailgunAuth.test.js — Signaturprüfung für Inbound-Webhooks
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'crypto';
import { verifyMailgunSignature } from '../lib/mailgunAuth.js';

const KEY = 'test-signing-key';

function signedParts(overrides = {}) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const token = `tok-${Math.random().toString(36).slice(2)}`;
  const signature = createHmac('sha256', KEY).update(timestamp + token).digest('hex');
  return { timestamp, token, signature, ...overrides };
}

beforeEach(() => {
  process.env.MAILGUN_SIGNING_KEY = KEY;
  delete process.env.NODE_ENV;
});

test('gültige Signatur wird akzeptiert', () => {
  assert.equal(verifyMailgunSignature(signedParts()).ok, true);
});

test('falsche Signatur wird abgelehnt', () => {
  const parts = signedParts({ signature: 'deadbeef'.repeat(8) });
  assert.equal(verifyMailgunSignature(parts).ok, false);
});

test('fehlende Felder werden abgelehnt', () => {
  assert.equal(verifyMailgunSignature({}).ok, false);
});

test('alter Timestamp wird abgelehnt (Replay-Schutz)', () => {
  const timestamp = String(Math.floor(Date.now() / 1000) - 3600);
  const token = 'tok-old';
  const signature = createHmac('sha256', KEY).update(timestamp + token).digest('hex');
  assert.equal(verifyMailgunSignature({ timestamp, token, signature }).ok, false);
});

test('Token darf nur einmal verwendet werden (Replay-Schutz)', () => {
  const parts = signedParts();
  assert.equal(verifyMailgunSignature(parts).ok, true);
  assert.equal(verifyMailgunSignature(parts).ok, false);
});

test('production ohne Signing-Key lehnt ab', () => {
  delete process.env.MAILGUN_SIGNING_KEY;
  process.env.NODE_ENV = 'production';
  assert.equal(verifyMailgunSignature(signedParts()).ok, false);
  process.env.NODE_ENV = 'test';
});

test('dev ohne Signing-Key lässt mit Warnung durch', () => {
  delete process.env.MAILGUN_SIGNING_KEY;
  process.env.NODE_ENV = 'development';
  assert.equal(verifyMailgunSignature(signedParts()).ok, true);
});
