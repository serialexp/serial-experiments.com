import type { Post, PostSummary } from "~server/posts";
import type { Project, ProjectSummary } from "~server/projects";
import type { SearchHit } from "~server/search";

/**
 * Universal data loader.
 *
 * Routes call `loadXxx()` from inside `createResource` (or `createAsync`).
 * The fetcher dispatches:
 *  - On the server, during SSR: import the server-only module directly and
 *    hit SQLite synchronously. No HTTP round-trip.
 *  - On the client: hit the JSON API. Vite substitutes `import.meta.env.SSR`
 *    with a literal `true`/`false` at build time, so the client build's
 *    branch becomes `if (false) { await import("~server/posts") }` — Rollup's
 *    DCE drops the unreachable dynamic import along with its bun:sqlite
 *    transitive closure.
 */

export type { Post, PostSummary, Project, ProjectSummary, SearchHit };

export async function loadPostsList(): Promise<PostSummary[]> {
  if (import.meta.env.SSR) {
    const m = await import("~server/posts");
    return m.listPublished();
  }
  const res = await fetch("/api/posts", { credentials: "include" });
  if (!res.ok) throw new Error(`GET /api/posts -> ${res.status}`);
  const body = (await res.json()) as { items: PostSummary[] };
  return body.items;
}

export async function loadPost(
  slug: string,
): Promise<{ post: Post; tags: { slug: string; name: string }[] } | null> {
  if (import.meta.env.SSR) {
    const m = await import("~server/posts");
    const post = m.getBySlug(slug);
    if (!post) return null;
    return { post, tags: m.tagsForPost(post.id) };
  }
  const res = await fetch(`/api/posts/${encodeURIComponent(slug)}`, { credentials: "include" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /api/posts/${slug} -> ${res.status}`);
  return (await res.json()) as { post: Post; tags: { slug: string; name: string }[] };
}

export interface TagWithCount {
  slug: string;
  name: string;
  count: number;
}

export async function loadTags(): Promise<TagWithCount[]> {
  if (import.meta.env.SSR) {
    const m = await import("~server/posts");
    return m.listAllTags();
  }
  const res = await fetch("/api/tags", { credentials: "include" });
  if (!res.ok) throw new Error(`GET /api/tags -> ${res.status}`);
  const body = (await res.json()) as { items: TagWithCount[] };
  return body.items;
}

export async function loadPostsByTag(tagSlug: string): Promise<PostSummary[]> {
  if (import.meta.env.SSR) {
    const m = await import("~server/posts");
    return m.listByTag(tagSlug);
  }
  const res = await fetch(`/api/tags/${encodeURIComponent(tagSlug)}`, { credentials: "include" });
  if (!res.ok) throw new Error(`GET /api/tags/${tagSlug} -> ${res.status}`);
  const body = (await res.json()) as { items: PostSummary[] };
  return body.items;
}

export async function loadProjectsList(): Promise<ProjectSummary[]> {
  if (import.meta.env.SSR) {
    const m = await import("~server/projects");
    return m.listPublished();
  }
  const res = await fetch("/api/projects", { credentials: "include" });
  if (!res.ok) throw new Error(`GET /api/projects -> ${res.status}`);
  const body = (await res.json()) as { items: ProjectSummary[] };
  return body.items;
}

export async function loadFeaturedProjects(limit = 3): Promise<ProjectSummary[]> {
  if (import.meta.env.SSR) {
    const m = await import("~server/projects");
    return m.listFeatured(limit);
  }
  // Public API doesn't expose a featured-only filter — list and slice.
  const all = await loadProjectsList();
  return all.slice(0, limit);
}

export async function searchPosts(q: string): Promise<SearchHit[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];
  if (import.meta.env.SSR) {
    const m = await import("~server/search");
    return m.search(trimmed);
  }
  const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`GET /api/search -> ${res.status}`);
  const body = (await res.json()) as { items: SearchHit[] };
  return body.items;
}

export async function loadProject(slug: string): Promise<Project | null> {
  if (import.meta.env.SSR) {
    const m = await import("~server/projects");
    return m.getBySlug(slug);
  }
  const res = await fetch(`/api/projects/${encodeURIComponent(slug)}`, { credentials: "include" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /api/projects/${slug} -> ${res.status}`);
  const body = (await res.json()) as { project: Project };
  return body.project;
}
