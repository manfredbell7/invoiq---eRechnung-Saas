# Migrationen

SQL-Dateien sind numeriert (`001_`, `002_`, ...) und werden in dieser
Reihenfolge angewendet. Tracking erfolgt über die Tabelle
`schema_migrations` (Spalten: `name`, `applied_at`).

## Verwendung

```bash
npm run migrate           # offene Migrationen anwenden
npm run migrate:status    # Status anzeigen (angewendet / offen)
```

Voraussetzung: In der Supabase-Datenbank muss eine RPC-Funktion `exec_sql(query text)`
existieren, die beliebiges DDL/SQL ausführen kann (Supabase erlaubt das nicht
direkt über den JS-Client). Falls nicht vorhanden, gibt der Runner die nötige
`CREATE TABLE schema_migrations ...`-Anweisung aus, die einmalig manuell im
Supabase SQL Editor ausgeführt werden muss; danach können einzelne
Migrationen ebenfalls manuell im SQL Editor eingespielt und über
`INSERT INTO schema_migrations (name) VALUES ('00X_....sql')` als angewendet
markiert werden.

## Neue Migration hinzufügen

Nächste freie Nummer verwenden, z.B. `005_meine_aenderung.sql`.
