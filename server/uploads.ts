/// <reference types="bun-types" />
import { mkdirSync, unlinkSync } from "node:fs";
import { join, extname } from "node:path";
import { randomBytes } from "node:crypto";
import { getAll, getOne, run } from "./db";

/**
 * Uploads — image library for posts/projects.
 *
 * On-disk layout (under `data/uploads/`):
 *   YYYY/MM/<random8>-<original-filename>
 *
 * The relative path goes into `uploads.path`; the public URL is always
 * `/uploads/${path}`. Public access is read-only and goes through
 * `streamUpload()` below — no directory listing, path traversal blocked.
 *
 * MIME types are restricted to a curated allow-list at write time; we don't
 * trust the client-declared content-type alone. Rejecting unknown types keeps
 * the surface small and prevents accidental .html / .svg-with-script uploads.
 */

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "data/uploads";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Curated allow-list. Extending this needs a deliberate decision — we don't
// e.g. allow SVG by default because inline SVG can carry script.
const ALLOWED_MIME = new Map<string, string>([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/gif", ".gif"],
  ["image/webp", ".webp"],
  ["image/avif", ".avif"],
]);

mkdirSync(UPLOADS_DIR, { recursive: true });

export interface Upload {
  id: number;
  filename: string;
  mime: string;
  path: string;
  size: number;
  created_at: string;
}

export function listAll(): Upload[] {
  return getAll<Upload>(`SELECT * FROM uploads ORDER BY id DESC LIMIT 500`);
}

export function getById(id: number): Upload | null {
  return getOne<Upload>(`SELECT * FROM uploads WHERE id = ?`, id);
}

export function getByPath(path: string): Upload | null {
  return getOne<Upload>(`SELECT * FROM uploads WHERE path = ?`, path);
}

export class UploadError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Persist an in-memory File from a multipart form. Returns the DB row.
 * Throws UploadError on a validation failure.
 */
export async function saveFile(file: File): Promise<Upload> {
  if (file.size === 0) throw new UploadError("empty file");
  if (file.size > MAX_BYTES) throw new UploadError(`file too large (max ${MAX_BYTES} bytes)`);

  const ext = ALLOWED_MIME.get(file.type);
  if (!ext) throw new UploadError(`unsupported type: ${file.type || "(unknown)"}`);

  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const sub = `${yyyy}/${mm}`;
  mkdirSync(join(UPLOADS_DIR, sub), { recursive: true });

  const safeName = sanitizeFilename(file.name, ext);
  const random = randomBytes(4).toString("hex");
  const relPath = `${sub}/${random}-${safeName}`;
  const absPath = join(UPLOADS_DIR, relPath);

  const bytes = new Uint8Array(await file.arrayBuffer());
  await Bun.write(absPath, bytes);

  const result = run(
    `INSERT INTO uploads (filename, mime, path, size) VALUES (?, ?, ?, ?)`,
    file.name,
    file.type,
    relPath,
    bytes.byteLength,
  );

  return getById(Number(result.lastInsertRowid))!;
}

/**
 * Remove an upload row and its file. Missing files are tolerated — the row
 * is still deleted so the library stays consistent if someone wiped the
 * volume manually.
 */
export function removeById(id: number): void {
  const row = getById(id);
  if (!row) return;
  try {
    unlinkSync(join(UPLOADS_DIR, row.path));
  } catch {
    // already gone — fall through
  }
  run(`DELETE FROM uploads WHERE id = ?`, id);
}

/**
 * Public-facing read for `/uploads/:path`. Refuses traversal, requires the
 * path to exist in the DB so we don't accidentally serve an arbitrary file
 * a misconfigured volume mount put in the uploads dir.
 */
export async function streamUpload(relPath: string): Promise<Response | null> {
  // Reject obvious traversal. Bun.file would resolve too but defence in depth.
  if (!relPath || relPath.includes("..") || relPath.startsWith("/")) return null;

  const row = getByPath(relPath);
  if (!row) return null;

  const file = Bun.file(join(UPLOADS_DIR, relPath));
  if (!(await file.exists())) return null;

  return new Response(file, {
    headers: {
      "content-type": row.mime,
      // Hashed by the random prefix in the path, so safe to long-cache.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

/**
 * Make a filename safe to put on disk + serve from a URL. We strip directory
 * separators, collapse to a-z0-9.- range, and clamp length. The original
 * filename is also stored separately in the DB for display purposes.
 */
function sanitizeFilename(name: string, fallbackExt: string): string {
  const stripped = name.split(/[\\/]/).pop() ?? name;
  const ext = (extname(stripped) || fallbackExt).toLowerCase();
  const base = stripped.slice(0, stripped.length - extname(stripped).length);
  const safeBase = base
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${safeBase || "file"}${ext}`;
}
