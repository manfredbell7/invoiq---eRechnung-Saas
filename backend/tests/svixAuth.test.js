// tests/svixAuth.test.js — Svix-Signaturprüfung für den Resend-Inbound-Webhook
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'crypto';
import { verifySvixSignature } from '../lib/svixAuth.js';

const RAW_SECRET = Buffer.from('svix-test-secret-32-bytes-long!!');
const SECRET = `whsec_${RAW_SECRET.toString('base64')}`;

function sign({ id = 'msg_1', timestamp = String(Math.floor(Date.now() / 1000)), body = '{"type":"email.received"}' } = {}) {
  const signature = 'v1,' + createHmac('sha256', RAW_SECRET).update(`${id}.${timestamp}.${body}`).digest('base64');
  return { id, timestamp, signature, rawBody: body, secret: SECRET };
}

test('gültige Signatur wird akzeptiert', () => {
  assert.equal(verifySvixSignature(sign()).ok, true);
});

test('rawBody als Buffer wird akzeptiert', () => {
  const p = sign();
  assert.equal(verifySvixSignature({ ...p, rawBody: Buffer.from(p.rawBody) }).ok, true);
});

test('mehrere Signaturen (Secret-Rotation) — eine gültige reicht', () => {
  const p = sign();
  p.signature = `v1,${'x'.repeat(44)} ${p.signature}`;
  assert.equal(verifySvixSignature(p).ok, true);
});

test('manipulierter Body wird abgelehnt', () => {
  const p = sign();
  assert.equal(verifySvixSignature({ ...p, rawBody: '{"type":"email.received","x":1}' }).ok, false);
});

test('falsches Secret wird abgelehnt', () => {
  const p = sign();
  assert.equal(verifySvixSignature({ ...p, secret: `whsec_${Buffer.from('anderes-secret-anderes-secret!!!').toString('base64')}` }).ok, false);
});

test('fehlendes Secret wird abgelehnt (kein Bypass ohne Konfiguration)', () => {
  const p = sign();
  const res = verifySvixSignature({ ...p, secret: '' });
  assert.equal(res.ok, false);
  assert.match(res.reason, /konfiguriert/);
});

test('fehlende Header werden abgelehnt', () => {
  assert.equal(verifySvixSignature({ rawBody: '{}', secret: SECRET }).ok, false);
});

test('alter Timestamp wird abgelehnt (Replay-Schutz)', () => {
  const old = String(Math.floor(Date.now() / 1000) - 3600);
  assert.equal(verifySvixSignature(sign({ timestamp: old })).ok, false);
});

test('Timestamp in der Zukunft wird abgelehnt', () => {
  const future = String(Math.floor(Date.now() / 1000) + 3600);
  assert.equal(verifySvixSignature(sign({ timestamp: future })).ok, false);
});

test('andere svix-id invalidiert die Signatur', () => {
  const p = sign();
  assert.equal(verifySvixSignature({ ...p, id: 'msg_2' }).ok, false);
});
