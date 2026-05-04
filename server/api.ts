/// <reference types="bun-types" />
import * as posts from "./posts";
import {
  checkCsrf,
  clearSessionCookie,
  createSession,
  destroySession,
  isProductionRequest,
  makeSessionCookie,
  readSessionCookie,
  verifyCredentials,
  type User,
} from "./auth";

/**
 * JSON API entrypoint, dispatched from `server.ts` for any `/api/*` path.
 *
 * Returns `null` when the path is unrecognised so the caller can decide
 * how to render the 404 (we want the SSR 404 page in most cases, but for
 * `/api/*` a JSON 404 is friendlier to clients).
 *
 * Layout:
 *  - GET  /api/posts                  list published, summary
 *  - GET  /api/posts/:slug            single published post + tags
 *  - POST /api/login                  body: { username, password }
 *  - POST /api/logout                 clears the session cookie
 *  - admin CRUD endpoints come in later steps
 */
export async function handleApi(req: Request, url: URL, user: User | null): Promise<Response | null> {
  const pathname = url.pathname;
  const method = req.method;

  // GET /api/posts
  if (pathname === "/api/posts" && method === "GET") {
    const limit = clampInt(url.searchParams.get("limit"), 1, 200, 50);
    const offset = clampInt(url.searchParams.get("offset"), 0, 1_000_000, 0);
    return Response.json({ items: posts.listPublished(limit, offset) });
  }

  // GET /api/posts/:slug
  const postMatch = /^\/api\/posts\/([^/]+)$/.exec(pathname);
  if (postMatch && method === "GET") {
    const post = posts.getBySlug(postMatch[1]);
    if (!post) return Response.json({ error: "not found" }, { status: 404 });
    const tags = posts.tagsForPost(post.id);
    return Response.json({ post, tags });
  }

  // POST /api/login
  if (pathname === "/api/login" && method === "POST") {
    let body: { username?: unknown; password?: unknown };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "invalid json" }, { status: 400 });
    }
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) {
      return Response.json({ error: "missing credentials" }, { status: 400 });
    }
    const u = await verifyCredentials(username, password);
    if (!u) {
      return Response.json({ error: "invalid credentials" }, { status: 401 });
    }
    const sid = createSession(u.id);
    return Response.json(
      { user: { id: u.id, username: u.username }, csrf: u.csrf_token },
      {
        status: 200,
        headers: { "set-cookie": makeSessionCookie(sid, isProductionRequest(req)) },
      },
    );
  }

  // POST /api/logout
  if (pathname === "/api/logout" && method === "POST") {
    const sid = readSessionCookie(req.headers.get("cookie") ?? "");
    destroySession(sid);
    return Response.json(
      { ok: true },
      { headers: { "set-cookie": clearSessionCookie(isProductionRequest(req)) } },
    );
  }

  // GET /api/me
  if (pathname === "/api/me" && method === "GET") {
    if (!user) return Response.json({ user: null });
    return Response.json({
      user: { id: user.id, username: user.username },
      csrf: user.csrf_token,
    });
  }

  // ---- Admin: posts ---------------------------------------------------------
  // The /api/admin/* namespace is gated by server.ts (requires session). CSRF
  // is enforced for state-changing methods.
  if (pathname.startsWith("/api/admin/posts") && user) {
    return handleAdminPosts(req, url, user, method);
  }

  return null;
}

async function handleAdminPosts(
  req: Request,
  url: URL,
  user: User,
  method: string,
): Promise<Response | null> {
  const pathname = url.pathname;

  // GET /api/admin/posts — list everything (drafts included)
  if (pathname === "/api/admin/posts" && method === "GET") {
    return Response.json({ items: posts.listAll(200, 0) });
  }

  // POST /api/admin/posts — create
  if (pathname === "/api/admin/posts" && method === "POST") {
    if (!checkCsrf(req, user)) return csrfError();
    const body = await readJson(req);
    if (!body) return badRequest("invalid json");
    const input = parsePostInput(body);
    if (typeof input === "string") return badRequest(input);
    try {
      const post = await posts.create(input);
      return Response.json({ post }, { status: 201 });
    } catch (err) {
      return badRequest(`create failed: ${(err as Error).message}`);
    }
  }

  const idMatch = /^\/api\/admin\/posts\/(\d+)$/.exec(pathname);
  if (idMatch) {
    const id = Number(idMatch[1]);
    const existing = posts.getById(id);
    if (!existing) return Response.json({ error: "not found" }, { status: 404 });

    // GET /api/admin/posts/:id — single post + tags
    if (method === "GET") {
      return Response.json({ post: existing, tags: posts.tagsForPost(id) });
    }

    // PATCH /api/admin/posts/:id — update
    if (method === "PATCH") {
      if (!checkCsrf(req, user)) return csrfError();
      const body = await readJson(req);
      if (!body) return badRequest("invalid json");
      const input = parsePostInput(body);
      if (typeof input === "string") return badRequest(input);
      try {
        const post = await posts.update(id, input);
        return Response.json({ post });
      } catch (err) {
        return badRequest(`update failed: ${(err as Error).message}`);
      }
    }

    // DELETE /api/admin/posts/:id
    if (method === "DELETE") {
      if (!checkCsrf(req, user)) return csrfError();
      posts.remove(id);
      return new Response(null, { status: 204 });
    }
  }

  return null;
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parsePostInput(body: Record<string, unknown>): posts.PostInput | string {
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const body_md = typeof body.body_md === "string" ? body.body_md : "";

  if (!slug) return "slug is required";
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return "slug must be lowercase letters/numbers/hyphens";
  if (!title) return "title is required";
  if (!body_md) return "body_md is required";

  const subtitle = typeof body.subtitle === "string" && body.subtitle.trim() ? body.subtitle.trim() : null;
  const excerpt = typeof body.excerpt === "string" && body.excerpt.trim() ? body.excerpt.trim() : null;
  const published_at =
    typeof body.published_at === "string" && body.published_at.trim() ? body.published_at.trim() : null;
  const tags =
    Array.isArray(body.tags)
      ? body.tags.filter((t): t is string => typeof t === "string")
      : typeof body.tags === "string"
        ? body.tags.split(/[\s,]+/).filter(Boolean)
        : [];

  return { slug, title, subtitle, body_md, excerpt, published_at, tags };
}

function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 });
}
function csrfError(): Response {
  return Response.json({ error: "csrf check failed" }, { status: 403 });
}

function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  if (raw == null) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
