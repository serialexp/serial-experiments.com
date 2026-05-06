/// <reference types="bun-types" />
import { randomBytes } from "node:crypto";
import { getOne, run } from "./db";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface User {
  id: number;
  username: string;
  csrf_token: string;
}

interface UserRow extends User {
  password_hash: string;
}

interface SessionRow {
  id: string;
  user_id: number;
  expires_at: string;
}

/**
 * Look up the active session by id and return the matching user, or null
 * if the session is missing/expired. Expired sessions are deleted lazily
 * here — saves a cron job for a tiny amount of state.
 */
export function findSession(sessionId: string): User | null {
  if (!sessionId) return null;
  const s = getOne<SessionRow>(`SELECT * FROM sessions WHERE id = ?`, sessionId);
  if (!s) return null;
  if (new Date(s.expires_at + "Z").getTime() < Date.now()) {
    run(`DELETE FROM sessions WHERE id = ?`, sessionId);
    return null;
  }
  return getOne<User>(`SELECT id, username, csrf_token FROM users WHERE id = ?`, s.user_id);
}

/**
 * Verify a username/password pair. Returns a User on success, null on
 * failure. Always runs the verify (even when the user doesn't exist) to
 * keep the timing relatively constant.
 */
export async function verifyCredentials(username: string, password: string): Promise<User | null> {
  const row = getOne<UserRow>(
    `SELECT id, username, password_hash, csrf_token FROM users WHERE username = ?`,
    username,
  );
  // Run a hash verify against a known-bad hash if user not found, so failure
  // timing matches a wrong-password attempt for an existing user.
  const targetHash =
    row?.password_hash ??
    "$argon2id$v=19$m=65536,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const ok = await Bun.password.verify(password, targetHash);
  if (!ok || !row) return null;
  return { id: row.id, username: row.username, csrf_token: row.csrf_token };
}

/**
 * Issue a new session for the user. Returns the session id (caller stores
 * it as the cookie value).
 */
export function createSession(userId: number): string {
  const id = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_TTL_MS).toISOString().slice(0, 19).replace("T", " ");
  run(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
    id,
    userId,
    expires,
  );
  return id;
}

export function destroySession(sessionId: string): void {
  if (!sessionId) return;
  run(`DELETE FROM sessions WHERE id = ?`, sessionId);
}

/**
 * Parse the `se_session` cookie out of a Cookie header.
 */
export function readSessionCookie(cookieHeader: string): string {
  const m = cookieHeader.match(/(?:^|;\s*)se_session=([^;]+)/);
  return m ? m[1] : "";
}

/** Set-Cookie value that establishes a session. Secure flag in prod only. */
export function makeSessionCookie(sessionId: string, secure = true): string {
  const flags = ["Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`];
  if (secure) flags.push("Secure");
  return `se_session=${sessionId}; ${flags.join("; ")}`;
}

export function clearSessionCookie(secure = true): string {
  const flags = ["Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) flags.push("Secure");
  return `se_session=; ${flags.join("; ")}`;
}

/**
 * Verify the X-CSRF header on a state-changing admin request matches the
 * user's stored token. Defense-in-depth on top of SameSite=Lax cookies.
 */
export function checkCsrf(req: Request, user: User): boolean {
  const header = req.headers.get("x-csrf");
  return !!header && header === user.csrf_token;
}

/**
 * On startup, ensure the admin user exists and (optionally) reset its
 * password from the environment. Two env shapes are accepted:
 *
 *   ADMIN_USERNAME=bart
 *   ADMIN_PASSWORD='plaintext'                 # ergonomic; we hash it here
 *     — or —
 *   ADMIN_PASSWORD_HASH='<output of `bun --eval "console.log(await Bun.password.hash(\"...\"))"`>'
 *
 * If both are set, `ADMIN_PASSWORD` wins. Behavior:
 *
 *   - Username row missing: insert with the provided password.
 *   - Username row exists, `ADMIN_PASSWORD` set: verify the env plaintext
 *     against the stored hash; if it doesn't match, re-hash and UPDATE.
 *     This is how you recover from a forgotten password — set a new
 *     `ADMIN_PASSWORD`, restart, log in.
 *   - Username row exists, only `ADMIN_PASSWORD_HASH` set: no-op (argon2
 *     hashes are non-deterministic; we can't tell intent from the hash
 *     alone, and silently overwriting would surprise hash-rotation
 *     workflows).
 *
 * If the table is empty and no admin env is set, log a warning so the
 * deployer notices admin login is disabled.
 */
export async function seedAdminFromEnv(): Promise<void> {
  const username = process.env.ADMIN_USERNAME;
  const plaintext = process.env.ADMIN_PASSWORD;
  const presetHash = process.env.ADMIN_PASSWORD_HASH;

  const userCount = getOne<{ n: number }>(`SELECT COUNT(*) AS n FROM users`)!.n;

  if (!username) {
    if (userCount === 0) {
      console.warn(
        "[auth] no users in DB and ADMIN_USERNAME not set — admin login disabled",
      );
    }
    return;
  }
  if (!plaintext && !presetHash) {
    if (userCount === 0) {
      console.warn(
        `[auth] ADMIN_USERNAME=${username} but neither ADMIN_PASSWORD nor ADMIN_PASSWORD_HASH set — admin login disabled`,
      );
    }
    return;
  }

  const existing = getOne<UserRow>(
    `SELECT id, username, password_hash, csrf_token FROM users WHERE username = ?`,
    username,
  );

  if (!existing) {
    const hash = plaintext ? await Bun.password.hash(plaintext) : presetHash!;
    const csrf = randomBytes(32).toString("hex");
    run(
      `INSERT INTO users (username, password_hash, csrf_token) VALUES (?, ?, ?)`,
      username,
      hash,
      csrf,
    );
    console.log(`[auth] seeded admin user '${username}'`);
    return;
  }

  // User exists. Update the password only if ADMIN_PASSWORD was supplied
  // and doesn't match the stored hash (cheap recovery path).
  if (plaintext) {
    const stillMatches = await Bun.password.verify(plaintext, existing.password_hash);
    if (!stillMatches) {
      const newHash = await Bun.password.hash(plaintext);
      run(`UPDATE users SET password_hash = ? WHERE id = ?`, newHash, existing.id);
      console.log(`[auth] reset password for '${username}' from ADMIN_PASSWORD env`);
    }
  }
}

/**
 * Whether the inbound request reached us over HTTPS — used to decide the
 * `Secure` flag on Set-Cookie. The flag MUST track the actual transport,
 * not `NODE_ENV`: a `Secure` cookie on a plain-HTTP response is never
 * sent back by the browser, so authenticating in production-but-HTTP
 * (e.g. accessing the box directly via `http://host:3001` while bypassing
 * the TLS-terminating proxy) silently fails to log in.
 *
 * Detection order:
 *  1. `X-Forwarded-Proto: https` — set by Caddy / Traefik / nginx in front.
 *  2. `req.url`'s scheme — Bun.serve gives us the actual connection scheme,
 *     so a direct `https://…` connection without a proxy still works.
 *  3. Otherwise: HTTP.
 */
export function isSecureRequest(req: Request): boolean {
  const xfp = req.headers.get("x-forwarded-proto");
  if (xfp) return xfp.split(",")[0].trim().toLowerCase() === "https";
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}
