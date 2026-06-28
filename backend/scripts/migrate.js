#!/usr/bin/env node
// backend/scripts/migrate.js
// Einfacher, dependency-freier Migrationsrunner für die SQL-Dateien in
// backend/migrations/. Trackt ausgeführte Migrationen in der Tabelle
// `schema_migrations`, damit jede Datei genau einmal läuft.
//
// Nutzung:
//   node scripts/migrate.js          — offene Migrationen ausführen
//   node scripts/migrate.js status   — Status anzeigen, nichts ausführen

import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { supabase } from '../config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function ensureMigrationsTable() {
  // Supabase JS Client kann kein rohes DDL ausführen — daher RPC `exec_sql`,
  // falls in der DB vorhanden, sonst Anleitung zur manuellen Einmal-Erstellung.
  const { error } = await supabase.rpc('exec_sql', {
    query: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name        TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  });
  if (error) {
    console.warn(
      '[migrate] Konnte schema_migrations nicht automatisch anlegen ' +
      '(RPC exec_sql fehlt vermutlich). Bitte einmalig manuell im ' +
      'Supabase SQL Editor ausführen:\n\n' +
      'CREATE TABLE IF NOT EXISTS schema_migrations (\n' +
      '  name TEXT PRIMARY KEY,\n' +
      '  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()\n' +
      ');\n'
    );
  }
}

async function getAppliedMigrations() {
  const { data, error } = await supabase.from('schema_migrations').select('name');
  if (error) {
    console.warn('[migrate] schema_migrations noch nicht lesbar:', error.message);
    return new Set();
  }
  return new Set((data || []).map(r => r.name));
}

function listMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort(); // Dateinamen sind nummeriert (001_, 002_, ...) → lexikalische Sortierung = richtige Reihenfolge
}

async function applyMigration(name) {
  const sql = readFileSync(path.join(MIGRATIONS_DIR, name), 'utf-8');
  const { error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) {
    throw new Error(`Migration "${name}" fehlgeschlagen: ${error.message}\n` +
      `Bitte den Inhalt der Datei manuell im Supabase SQL Editor ausführen und dann erneut versuchen.`);
  }
  const { error: insertErr } = await supabase.from('schema_migrations').insert({ name });
  if (insertErr) throw new Error(`Konnte Migration "${name}" nicht als angewendet markieren: ${insertErr.message}`);
}

async function main() {
  const mode = process.argv[2] || 'up';
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files = listMigrationFiles();
  const pending = files.filter(f => !applied.has(f));

  if (mode === 'status') {
    console.log('\nMigrationsstatus:');
    for (const f of files) {
      console.log(`  [${applied.has(f) ? 'x' : ' '}] ${f}`);
    }
    console.log(`\n${pending.length} offen, ${applied.size} angewendet.\n`);
    return;
  }

  if (!pending.length) {
    console.log('[migrate] Keine offenen Migrationen.');
    return;
  }

  for (const file of pending) {
    console.log(`[migrate] Wende an: ${file}`);
    await applyMigration(file);
    console.log(`[migrate] OK: ${file}`);
  }
  console.log(`[migrate] Fertig. ${pending.length} Migration(en) angewendet.`);
}

main().catch(err => {
  console.error('[migrate] FEHLER:', err.message);
  process.exit(1);
});
