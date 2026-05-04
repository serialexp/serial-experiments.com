/// <reference types="bun-types" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { db, run, getAll } from "./db";

/**
 * Apply migrations from `migrations/*.sql` in numeric order.
 *
 * Each file is one logical migration. The applied list is tracked in a
 * `_migrations` table by filename; re-runs are no-ops. Files must have a
 * sortable prefix (e.g. `0001_init.sql`, `0002_fts.sql`).
 *
 * Each file's contents are executed in a single transaction. SQLite
 * supports DDL inside transactions, so a partial failure rolls back —
 * leaving the schema unchanged and the migration unrecorded so the next
 * boot retries cleanly.
 */
export function applyMigrations(migrationsDir: string = "migrations"): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    getAll<{ filename: string }>("SELECT filename FROM _migrations").map((r) => r.filename),
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    console.log(`[migrate] applying ${file}`);
    db.transaction(() => {
      db.exec(sql);
      run("INSERT INTO _migrations (filename) VALUES (?)", file);
    })();
    count += 1;
  }
  if (count > 0) {
    console.log(`[migrate] applied ${count} migration${count === 1 ? "" : "s"}`);
  } else {
    console.log(`[migrate] up to date (${applied.size} applied)`);
  }
}
