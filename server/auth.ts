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
 * On startup, if the users table is empty and the seed env vars are set,
 * create the admin user. The hash MUST be pre-computed (we never accept
 * a plaintext password from the environment).
 *
 *   ADMIN_USERNAME=bart
 *   ADMIN_PASSWORD_HASH='<output of `bun --eval "console.log(await Bun.password.hash(\"...\"))"`>'
 */
export function seedAdminFromEnv(): void {
  const existing = getOne<{ n: number }>(`SELECT COUNT(*) AS n FROM users`)!;
  if (existing.n > 0) return;
  const username = process.env.ADMIN_USERNAME;
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!username || !hash) {
    console.warn(
      "[auth] no users in DB and ADMIN_USERNAME/ADMIN_PASSWORD_HASH not set — admin login disabled",
    );
    return;
  }
  const csrf = randomBytes(32).toString("hex");
  run(
    `INSERT INTO users (username, password_hash, csrf_token) VALUES (?, ?, ?)`,
    username,
    hash,
    csrf,
  );
  console.log(`[auth] seeded admin user '${username}'`);
}

export function isProductionRequest(req: Request): boolean {
  // Trust the proxy; in dev curl over http://localhost we don't want Secure
  // flags that would prevent the cookie from being stored.
  const proto = req.headers.get("x-forwarded-proto");
  return proto === "https" || process.env.NODE_ENV === "production";
}
