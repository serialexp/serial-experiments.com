/// <reference types="bun-types" />
/**
 * Serial Experiments — Bun SSR + API + static server.
 *
 * One process does it all because the volume is tiny:
 *  - SSR for every request that doesn't match a more specific handler
 *  - Static assets out of the Vite client build (`dist/client`)
 *  - JSON API at `/api/*` (auth + admin CRUD; added in later steps)
 *  - User-uploaded files at `/uploads/*` (added with the upload step)
 *  - RSS / sitemap (added with the content step)
 *
 * The SSR module is the built `dist/server/entry-server.js`. We read the
 * built `dist/client/index.html` once at startup and use it as the page
 * template — `<!--ssr-head-->` and `<!--ssr-outlet-->` get spliced.
 *
 * Environment:
 *   PORT          — listen port (default 3001)
 *   PUBLIC_ORIGIN — public-facing scheme+host for canonical/og:url (optional;
 *                   falls back to X-Forwarded-* or Host headers)
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyMigrations } from "./server/migrations";
import { handleApi } from "./server/api";
import { findSession, readSessionCookie, seedAdminFromEnv } from "./server/auth";
import { streamUpload } from "./server/uploads";
import { renderAtomFeed, renderFeedStylesheet, renderSitemap } from "./server/feed";

const PORT = Number(process.env.PORT ?? 3001);
const PUBLIC_ORIGIN_ENV = process.env.PUBLIC_ORIGIN ?? "";

const ROOT = import.meta.dir;
const CLIENT_DIR = join(ROOT, "dist/client");
const SERVER_DIR = join(ROOT, "dist/server");

// Apply any pending migrations before the server starts taking requests.
// Safe to run on every boot — `_migrations` table tracks what's applied.
applyMigrations(join(ROOT, "migrations"));

// Seed (or password-reset) the admin user if the env vars are set.
// Awaited at module top-level so the user row is in place before the
// HTTP server starts accepting requests.
await seedAdminFromEnv();

// Lazily import the SSR bundle so dev iteration is fast(er) and so a
// missing build produces a clean error message instead of a stack trace.
let ssrModule: typeof import("./src/entry-server") | null = null;
async function getSsr() {
  if (ssrModule) return ssrModule;
  try {
    ssrModule = (await import(join(SERVER_DIR, "entry-server.js"))) as typeof import("./src/entry-server");
    return ssrModule;
  } catch (err) {
    console.error(`[ssr] failed to import ${SERVER_DIR}/entry-server.js — did you run \`pnpm build\`?`);
    throw err;
  }
}

let template: string;
try {
  template = readFileSync(join(CLIENT_DIR, "index.html"), "utf-8");
} catch (err) {
  console.error(`[ssr] failed to read ${CLIENT_DIR}/index.html — did you run \`pnpm build:client\`?`);
  throw err;
}

console.log(`[serial-experiments] booting on port ${PORT}`);
console.log(`[serial-experiments] client dir: ${CLIENT_DIR}`);
console.log(`[serial-experiments] public origin (env): ${PUBLIC_ORIGIN_ENV || "<derived from headers>"}`);

/**
 * Resolve the public-facing origin for canonical URLs. Prefers the env var
 * (set explicitly in the production compose file), then the Caddy/Traefik
 * X-Forwarded-* pair (so meta tags reflect the user's hostname when the
 * proxy strips the original Host), then the request's Host header.
 */
function publicOrigin(req: Request): string {
  if (PUBLIC_ORIGIN_ENV) return PUBLIC_ORIGIN_ENV;
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  return host ? `${proto}://${host}` : "";
}

/**
 * Try to serve a static file from `dist/client`. Returns null if the file
 * doesn't exist so the caller can fall through to SSR. Bun.file infers the
 * content type from the extension; we add long-cache headers for hashed
 * Vite assets and short-cache for everything else.
 */
async function tryStatic(pathname: string): Promise<Response | null> {
  // Reject path traversal early — Bun.file would reject too but better to
  // 404 deterministically than rely on filesystem behaviour.
  if (pathname.includes("..")) return null;

  const filePath = join(CLIENT_DIR, pathname);
  const file = Bun.file(filePath);
  if (!(await file.exists())) return null;

  const isHashedAsset = pathname.startsWith("/assets/");
  const headers: Record<string, string> = {};
  if (isHashedAsset) {
    headers["cache-control"] = "public, max-age=31536000, immutable";
  } else {
    headers["cache-control"] = "public, max-age=300";
  }
  return new Response(file, { headers });
}

/**
 * Embed an SSR bootstrap blob into the page so the client-side hydration
 * sees the same auth user / public origin the server rendered with.
 *
 * Stored as `<script type="application/json" id="ssr-bootstrap">` to
 * sidestep XSS escaping headaches: JSON.stringify output is HTML-safe as
 * long as we re-encode `</`. Read by `src/entry-client.tsx` at startup.
 */
function bootstrapScript(payload: unknown): string {
  const json = JSON.stringify(payload).replace(/<\//g, "<\\/");
  return `<script type="application/json" id="ssr-bootstrap">${json}</script>`;
}

Bun.serve({
  port: PORT,

  async fetch(req) {
    const start = performance.now();
    const url = new URL(req.url);
    const pathname = url.pathname;
    let status = 200;

    try {
      // Health check — not strictly needed locally, useful behind Portainer.
      if (pathname === "/healthz") {
        return new Response("ok\n", { headers: { "content-type": "text/plain" } });
      }

      // Static assets first: /assets/*, /favicon.ico, /robots.txt, etc.
      // SSR catches everything else, including unknown extensions, so users
      // can hit /posts/foo without us thinking it's a static file lookup.
      if (
        pathname.startsWith("/assets/") ||
        pathname === "/favicon.ico" ||
        pathname === "/robots.txt" ||
        pathname.startsWith("/favicon-") ||
        pathname.startsWith("/logo")
      ) {
        const res = await tryStatic(pathname);
        if (res) return res;
        // Fall through if missing — typically a 404 SSR page is friendlier
        // than a bare 404 for an icon, but for /assets/* we should 404 fast.
        if (pathname.startsWith("/assets/")) {
          status = 404;
          return new Response("not found\n", { status: 404 });
        }
      }

      // Resolve the active user once per request. Used by the API,
      // SSR render, and the admin redirect gate below.
      const cookie = req.headers.get("cookie") ?? "";
      const user = findSession(readSessionCookie(cookie));

      // JSON API. handleApi returns null when the path is unrecognised so
      // we can fall through to the SSR 404.
      if (pathname.startsWith("/api/")) {
        // Admin-only API endpoints are guarded inside handleApi by passing
        // the resolved user; here we just gate the namespace.
        if (pathname.startsWith("/api/admin/") && !user) {
          status = 401;
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        const res = await handleApi(req, url, user);
        if (res) {
          status = res.status;
          return res;
        }
        status = 404;
        return Response.json({ error: "not found" }, { status: 404 });
      }

      // Gate the admin SSR routes: redirect anonymous visitors to /login
      // with a return URL. Performed in the server (not the client) so a
      // direct curl/share of an admin URL never leaks a flash of the
      // admin shell while the client checks auth.
      if (pathname.startsWith("/admin") && !user) {
        status = 302;
        const redirect = `/login?redirect=${encodeURIComponent(pathname + url.search)}`;
        return new Response(null, { status: 302, headers: { location: redirect } });
      }

      // Uploads — stream from data/uploads/, gated by an existing DB row.
      if (pathname.startsWith("/uploads/")) {
        const rel = pathname.slice("/uploads/".length);
        const res = await streamUpload(rel);
        if (res) {
          status = res.status;
          return res;
        }
        status = 404;
        return new Response("not found\n", { status: 404 });
      }

      // Feed + sitemap. Both are pure functions of the DB; no caching layer
      // here yet (sub-ms to render against SQLite for the volumes involved).
      if (pathname === "/feed.xml") {
        const origin = publicOrigin(req);
        const xml = renderAtomFeed(origin);
        return new Response(xml, {
          headers: {
            // We serve as `application/xml` rather than the technically
            // more correct `application/atom+xml` because Chromium-family
            // browsers refuse to apply `<?xml-stylesheet?>` PIs to
            // `application/atom+xml` documents (they show raw text or
            // download). `application/xml` triggers the in-browser XSL
            // transform, giving humans a styled view at /feed.xml. Real
            // feed readers identify Atom by sniffing the root element,
            // not by MIME, so this is invisible to them.
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        });
      }
      if (pathname === "/feed.xsl") {
        // Stylesheet referenced by the Atom feed's `<?xml-stylesheet?>` PI.
        // Pure function, no DB access — cache aggressively.
        return new Response(renderFeedStylesheet(), {
          headers: {
            "content-type": "text/xsl; charset=utf-8",
            "cache-control": "public, max-age=86400",
          },
        });
      }
      if (pathname === "/sitemap.xml") {
        const origin = publicOrigin(req);
        const xml = renderSitemap(origin);
        return new Response(xml, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        });
      }

      // Everything else: SSR.
      const { render } = await getSsr();
      const origin = publicOrigin(req);

      // Strip the password hash etc.; the SSR context only needs the
      // identity and the CSRF token surfaces only inside admin pages.
      const ssrUser = user ? { id: user.id, username: user.username } : null;

      const { html, headTags } = await render({
        url: pathname + url.search,
        publicOrigin: origin,
        user: ssrUser,
        cookie,
      });

      const bootstrap = {
        user: ssrUser,
        publicOrigin: origin,
        // CSRF token only sent to authenticated visitors; non-authed
        // pages don't need it and shouldn't carry it client-side.
        csrf: user?.csrf_token ?? null,
      };

      const page = template
        .replace("<!--ssr-head-->", headTags + bootstrapScript(bootstrap))
        .replace("<!--ssr-outlet-->", html);

      return new Response(page, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    } catch (err) {
      status = 500;
      console.error("[ssr] render error:", err);
      // Last-resort fallback: serve the SPA shell so the client bundle
      // still has a chance to render something useful.
      return new Response(template, {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    } finally {
      const elapsed = (performance.now() - start).toFixed(1);
      console.log(`${req.method} ${pathname} ${status} ${elapsed}ms`);
    }
  },
});
