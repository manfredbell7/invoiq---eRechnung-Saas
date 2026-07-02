-- Migration 006: Passwort-Reset-Tokens
-- Ausführen in: Supabase SQL Editor
--
-- Einmal-Tokens für den Passwort-Reset-Flow (POST /v1/auth/forgot-password
-- und POST /v1/auth/reset-password). Es wird nur der SHA-256-Hash des
-- Tokens gespeichert — das Klartext-Token existiert nur im Mail-Link.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens(user_id);
