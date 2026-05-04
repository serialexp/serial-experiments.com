import type { Post, PostSummary } from "~server/posts";

/**
 * Thin admin-side fetch wrappers.
 *
 * Read paths (`listAdminPosts`, `getAdminPost`) take an SSR fast path:
 * during server render we call the repository directly so the admin
 * dashboard works without re-fetching its own JSON API. The fetch path
 * is reached on the client (post-hydration navigation, refetch after a
 * mutation), where the browser supplies the session cookie automatically.
 *
 * Mutations are only ever called from a user gesture, so they always go
 * through the API regardless of which side we're on.
 */

export type { Post, PostSummary };

export interface PostFormInput {
  slug: string;
  title: string;
  subtitle?: string | null;
  body_md: string;
  excerpt?: string | null;
  published_at?: string | null;
  tags?: string[];
}

export async function listAdminPosts(): Promise<PostSummary[]> {
  if (import.meta.env.SSR) {
    const m = await import("~server/posts");
    return m.listAll();
  }
  const res = await fetch("/api/admin/posts", { credentials: "include" });
  if (!res.ok) throw new Error(`GET /api/admin/posts -> ${res.status}`);
  const body = (await res.json()) as { items: PostSummary[] };
  return body.items;
}

export async function getAdminPost(
  id: number,
): Promise<{ post: Post; tags: { slug: string; name: string }[] }> {
  if (import.meta.env.SSR) {
    const m = await import("~server/posts");
    const post = m.getById(id);
    if (!post) throw new Error("not found");
    return { post, tags: m.tagsForPost(id) };
  }
  const res = await fetch(`/api/admin/posts/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error(`GET /api/admin/posts/${id} -> ${res.status}`);
  return (await res.json()) as { post: Post; tags: { slug: string; name: string }[] };
}

export async function createPost(csrf: string, input: PostFormInput): Promise<Post> {
  const res = await fetch("/api/admin/posts", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", "x-csrf": csrf },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await errMsg(res));
  return (await res.json() as { post: Post }).post;
}

export async function updatePost(csrf: string, id: number, input: PostFormInput): Promise<Post> {
  const res = await fetch(`/api/admin/posts/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "content-type": "application/json", "x-csrf": csrf },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await errMsg(res));
  return (await res.json() as { post: Post }).post;
}

export async function deletePost(csrf: string, id: number): Promise<void> {
  const res = await fetch(`/api/admin/posts/${id}`, {
    method: "DELETE",
    credentials: "include",
    headers: { "x-csrf": csrf },
  });
  if (!res.ok) throw new Error(await errMsg(res));
}

async function errMsg(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? `${res.status}`;
  } catch {
    return `${res.status}`;
  }
}
