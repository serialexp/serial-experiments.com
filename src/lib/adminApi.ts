import type { Post, PostSummary } from "~server/posts";
import type { Project, ProjectSummary } from "~server/projects";
import type { Upload } from "~server/uploads";

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

export type { Post, PostSummary, Project, ProjectSummary, Upload };

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

// ---- Projects -------------------------------------------------------------

export interface ProjectFormInput {
  slug: string;
  title: string;
  summary: string;
  body_md?: string | null;
  image_path?: string | null;
  link_url?: string | null;
  sort_order?: number;
  published?: boolean;
}

export async function listAdminProjects(): Promise<ProjectSummary[]> {
  if (import.meta.env.SSR) {
    const m = await import("~server/projects");
    return m.listAll();
  }
  const res = await fetch("/api/admin/projects", { credentials: "include" });
  if (!res.ok) throw new Error(`GET /api/admin/projects -> ${res.status}`);
  const body = (await res.json()) as { items: ProjectSummary[] };
  return body.items;
}

export async function getAdminProject(id: number): Promise<Project> {
  if (import.meta.env.SSR) {
    const m = await import("~server/projects");
    const project = m.getById(id);
    if (!project) throw new Error("not found");
    return project;
  }
  const res = await fetch(`/api/admin/projects/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error(`GET /api/admin/projects/${id} -> ${res.status}`);
  return ((await res.json()) as { project: Project }).project;
}

export async function createProject(csrf: string, input: ProjectFormInput): Promise<Project> {
  const res = await fetch("/api/admin/projects", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", "x-csrf": csrf },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await errMsg(res));
  return ((await res.json()) as { project: Project }).project;
}

export async function updateProject(csrf: string, id: number, input: ProjectFormInput): Promise<Project> {
  const res = await fetch(`/api/admin/projects/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "content-type": "application/json", "x-csrf": csrf },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await errMsg(res));
  return ((await res.json()) as { project: Project }).project;
}

export async function deleteProject(csrf: string, id: number): Promise<void> {
  const res = await fetch(`/api/admin/projects/${id}`, {
    method: "DELETE",
    credentials: "include",
    headers: { "x-csrf": csrf },
  });
  if (!res.ok) throw new Error(await errMsg(res));
}

// ---- Uploads --------------------------------------------------------------

export interface UploadResponse {
  saved: Upload[];
  failed: { name: string; error: string }[];
}

export async function listUploads(): Promise<Upload[]> {
  if (import.meta.env.SSR) {
    const m = await import("~server/uploads");
    return m.listAll();
  }
  const res = await fetch("/api/admin/uploads", { credentials: "include" });
  if (!res.ok) throw new Error(`GET /api/admin/uploads -> ${res.status}`);
  const body = (await res.json()) as { items: Upload[] };
  return body.items;
}

export async function uploadFiles(csrf: string, files: File[]): Promise<UploadResponse> {
  const form = new FormData();
  for (const f of files) form.append("file", f);
  const res = await fetch("/api/admin/uploads", {
    method: "POST",
    credentials: "include",
    headers: { "x-csrf": csrf },
    body: form,
  });
  if (!res.ok && res.status !== 400) throw new Error(await errMsg(res));
  return (await res.json()) as UploadResponse;
}

export async function deleteUpload(csrf: string, id: number): Promise<void> {
  const res = await fetch(`/api/admin/uploads/${id}`, {
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
