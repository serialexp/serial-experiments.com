/// <reference types="bun-types" />
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * SQLite singleton. The DB file lives under `data/site.db` so it sits next
 * to the uploads dir and shares the same Portainer-mounted volume.
 *
 * PRAGMAs:
 *  - `journal_mode = WAL` — reads don't block writes, writes don't block
 *    reads. Standard for any concurrent server.
 *  - `synchronous = NORMAL` — pairs with WAL; durable enough for a content
 *    site where the cost of losing the last few seconds of edits to a
 *    crash is acceptable.
 *  - `foreign_keys = ON` — bun:sqlite leaves these off by default.
 *  - `busy_timeout = 5000` — give writers 5s to grab the lock before
 *    failing rather than ECONNREFUSED-equivalent immediately.
 */

const DB_PATH = process.env.DB_PATH ?? "data/site.db";

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH, { create: true });
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA synchronous = NORMAL");
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA busy_timeout = 5000");

console.log(`[db] opened ${DB_PATH}`);

/**
 * Convenience for a single-row query that may return null. bun:sqlite's
 * `.get()` returns `unknown` so callers can plug in their own row type.
 */
export function getOne<T>(sql: string, ...params: unknown[]): T | null {
  return db.query(sql).get(...(params as never[])) as T | null;
}

/** All rows. */
export function getAll<T>(sql: string, ...params: unknown[]): T[] {
  return db.query(sql).all(...(params as never[])) as T[];
}

/** No-result statement (INSERT/UPDATE/DELETE). Returns `lastInsertRowid` etc. */
export function run(sql: string, ...params: unknown[]) {
  return db.query(sql).run(...(params as never[]));
}
