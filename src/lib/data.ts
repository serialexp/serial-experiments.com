import type { Post, PostSummary } from "~server/posts";

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

export type { Post, PostSummary };

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
