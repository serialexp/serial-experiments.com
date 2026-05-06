/// <reference types="bun-types" />
import * as posts from "./posts";
import * as projects from "./projects";
import * as uploads from "./uploads";
import { search } from "./search";
import {
  checkCsrf,
  clearSessionCookie,
  createSession,
  destroySession,
  isSecureRequest,
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

  // GET /api/tags — every tag with at least one published post
  if (pathname === "/api/tags" && method === "GET") {
    return Response.json({ items: posts.listAllTags() });
  }

  // GET /api/tags/:slug — published posts under one tag
  const tagMatch = /^\/api\/tags\/([^/]+)$/.exec(pathname);
  if (tagMatch && method === "GET") {
    const slug = tagMatch[1];
    const items = posts.listByTag(slug);
    return Response.json({ slug, items });
  }

  // GET /api/projects — all published projects, gallery summary
  if (pathname === "/api/projects" && method === "GET") {
    return Response.json({ items: projects.listPublished() });
  }

  // GET /api/projects/:slug — single published project
  const projectMatch = /^\/api\/projects\/([^/]+)$/.exec(pathname);
  if (projectMatch && method === "GET") {
    const project = projects.getBySlug(projectMatch[1]);
    if (!project) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ project });
  }

  // GET /api/search?q=... — FTS5-backed search over posts
  if (pathname === "/api/search" && method === "GET") {
    const q = (url.searchParams.get("q") ?? "").trim();
    if (!q) return Response.json({ q: "", items: [] });
    const limit = clampInt(url.searchParams.get("limit"), 1, 100, 25);
    try {
      return Response.json({ q, items: search(q, limit) });
    } catch (err) {
      // FTS5 can still throw if the cleaned query is empty after our filter
      // pass (or if a future change leaks bad syntax). Treat as zero hits
      // instead of leaking a 500 to clients.
      console.warn("[search] query failed:", (err as Error).message);
      return Response.json({ q, items: [] });
    }
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
        headers: { "set-cookie": makeSessionCookie(sid, isSecureRequest(req)) },
      },
    );
  }

  // POST /api/logout
  if (pathname === "/api/logout" && method === "POST") {
    const sid = readSessionCookie(req.headers.get("cookie") ?? "");
    destroySession(sid);
    return Response.json(
      { ok: true },
      { headers: { "set-cookie": clearSessionCookie(isSecureRequest(req)) } },
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
  if (pathname.startsWith("/api/admin/projects") && user) {
    return handleAdminProjects(req, url, user, method);
  }
  if (pathname.startsWith("/api/admin/uploads") && user) {
    return handleAdminUploads(req, url, user, method);
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

async function handleAdminProjects(
  req: Request,
  url: URL,
  user: User,
  method: string,
): Promise<Response | null> {
  const pathname = url.pathname;

  if (pathname === "/api/admin/projects" && method === "GET") {
    return Response.json({ items: projects.listAll() });
  }

  if (pathname === "/api/admin/projects" && method === "POST") {
    if (!checkCsrf(req, user)) return csrfError();
    const body = await readJson(req);
    if (!body) return badRequest("invalid json");
    const input = parseProjectInput(body);
    if (typeof input === "string") return badRequest(input);
    try {
      const project = await projects.create(input);
      return Response.json({ project }, { status: 201 });
    } catch (err) {
      return badRequest(`create failed: ${(err as Error).message}`);
    }
  }

  const idMatch = /^\/api\/admin\/projects\/(\d+)$/.exec(pathname);
  if (idMatch) {
    const id = Number(idMatch[1]);
    const existing = projects.getById(id);
    if (!existing) return Response.json({ error: "not found" }, { status: 404 });

    if (method === "GET") {
      return Response.json({ project: existing });
    }

    if (method === "PATCH") {
      if (!checkCsrf(req, user)) return csrfError();
      const body = await readJson(req);
      if (!body) return badRequest("invalid json");
      const input = parseProjectInput(body);
      if (typeof input === "string") return badRequest(input);
      try {
        const project = await projects.update(id, input);
        return Response.json({ project });
      } catch (err) {
        return badRequest(`update failed: ${(err as Error).message}`);
      }
    }

    if (method === "DELETE") {
      if (!checkCsrf(req, user)) return csrfError();
      projects.remove(id);
      return new Response(null, { status: 204 });
    }
  }

  return null;
}

async function handleAdminUploads(
  req: Request,
  url: URL,
  user: User,
  method: string,
): Promise<Response | null> {
  const pathname = url.pathname;

  // GET /api/admin/uploads — library
  if (pathname === "/api/admin/uploads" && method === "GET") {
    return Response.json({ items: uploads.listAll() });
  }

  // POST /api/admin/uploads — multipart, accepts one or many `file` fields
  if (pathname === "/api/admin/uploads" && method === "POST") {
    if (!checkCsrf(req, user)) return csrfError();
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return badRequest("invalid multipart body");
    }
    const files = form.getAll("file").filter((f): f is File => f instanceof File);
    if (files.length === 0) return badRequest("no files");

    const saved: uploads.Upload[] = [];
    const failed: { name: string; error: string }[] = [];
    for (const file of files) {
      try {
        saved.push(await uploads.saveFile(file));
      } catch (err) {
        failed.push({
          name: file.name,
          error: err instanceof uploads.UploadError ? err.message : (err as Error).message,
        });
      }
    }
    return Response.json({ saved, failed }, { status: failed.length && !saved.length ? 400 : 201 });
  }

  // DELETE /api/admin/uploads/:id
  const idMatch = /^\/api\/admin\/uploads\/(\d+)$/.exec(pathname);
  if (idMatch && method === "DELETE") {
    if (!checkCsrf(req, user)) return csrfError();
    const id = Number(idMatch[1]);
    uploads.removeById(id);
    return new Response(null, { status: 204 });
  }

  return null;
}

function parseProjectInput(body: Record<string, unknown>): projects.ProjectInput | string {
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";

  if (!slug) return "slug is required";
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return "slug must be lowercase letters/numbers/hyphens";
  if (!title) return "title is required";
  if (!summary) return "summary is required";

  const body_md = typeof body.body_md === "string" && body.body_md.trim() ? body.body_md : null;
  const image_path = typeof body.image_path === "string" && body.image_path.trim() ? body.image_path.trim() : null;
  const link_url = typeof body.link_url === "string" && body.link_url.trim() ? body.link_url.trim() : null;
  const sort_order = typeof body.sort_order === "number" && Number.isFinite(body.sort_order)
    ? Math.trunc(body.sort_order)
    : 0;
  const published = body.published === true || body.published === 1 || body.published === "1" || body.published === "true";

  // Reject obviously bad URLs to keep the data clean — we don't sanitize at
  // render time because templates render this attribute literally.
  if (link_url && !/^https?:\/\//i.test(link_url)) return "link_url must start with http(s)://";
  if (image_path && !image_path.startsWith("/uploads/")) return "image_path must point at /uploads/...";

  return { slug, title, summary, body_md, image_path, link_url, sort_order, published };
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
