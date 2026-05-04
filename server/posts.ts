/// <reference types="bun-types" />
import { getAll, getOne, run, db } from "./db";
import { renderMarkdown, autoExcerpt } from "./renderMarkdown";

/**
 * Posts repository. Read paths are sync (bun:sqlite is sync); writes are
 * async because they call the markdown renderer.
 *
 * Tag handling: callers pass a `tags: string[]` of tag *names*. The repo
 * upserts each into `tags` (slug = lowercased, hyphenated name) and
 * (re)links via `post_tags`. Lookup uses the tag slug for URL routes.
 */

export interface Post {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  body_md: string;
  body_html: string;
  excerpt: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostSummary {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  published_at: string | null;
  created_at: string;
}

export interface PostInput {
  slug: string;
  title: string;
  subtitle?: string | null;
  body_md: string;
  excerpt?: string | null;
  published_at?: string | null;
  tags?: string[];
}

export function listPublished(limit = 50, offset = 0): PostSummary[] {
  return getAll<PostSummary>(
    `SELECT id, slug, title, subtitle, excerpt, published_at, created_at
       FROM posts
      WHERE published_at IS NOT NULL
      ORDER BY published_at DESC
      LIMIT ? OFFSET ?`,
    limit,
    offset,
  );
}

export function listAll(limit = 50, offset = 0): PostSummary[] {
  return getAll<PostSummary>(
    `SELECT id, slug, title, subtitle, excerpt, published_at, created_at
       FROM posts
      ORDER BY COALESCE(published_at, created_at) DESC
      LIMIT ? OFFSET ?`,
    limit,
    offset,
  );
}

export function getBySlug(slug: string): Post | null {
  return getOne<Post>(
    `SELECT * FROM posts WHERE slug = ? AND published_at IS NOT NULL`,
    slug,
  );
}

export function getBySlugAdmin(slug: string): Post | null {
  return getOne<Post>(`SELECT * FROM posts WHERE slug = ?`, slug);
}

export function getById(id: number): Post | null {
  return getOne<Post>(`SELECT * FROM posts WHERE id = ?`, id);
}

export function tagsForPost(postId: number): { slug: string; name: string }[] {
  return getAll<{ slug: string; name: string }>(
    `SELECT t.slug, t.name
       FROM tags t
       JOIN post_tags pt ON pt.tag_id = t.id
      WHERE pt.post_id = ?
      ORDER BY t.name`,
    postId,
  );
}

export async function create(input: PostInput): Promise<Post> {
  const html = await renderMarkdown(input.body_md);
  const excerpt = input.excerpt ?? autoExcerpt(html);

  const tx = db.transaction(() => {
    const result = run(
      `INSERT INTO posts (slug, title, subtitle, body_md, body_html, excerpt, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      input.slug,
      input.title,
      input.subtitle ?? null,
      input.body_md,
      html,
      excerpt,
      input.published_at ?? null,
    );
    const id = Number(result.lastInsertRowid);
    syncTags(id, input.tags ?? []);
    return id;
  });
  const id = tx();
  return getById(id)!;
}

export async function update(id: number, input: PostInput): Promise<Post> {
  const html = await renderMarkdown(input.body_md);
  const excerpt = input.excerpt ?? autoExcerpt(html);

  const tx = db.transaction(() => {
    run(
      `UPDATE posts
          SET slug = ?,
              title = ?,
              subtitle = ?,
              body_md = ?,
              body_html = ?,
              excerpt = ?,
              published_at = ?,
              updated_at = datetime('now')
        WHERE id = ?`,
      input.slug,
      input.title,
      input.subtitle ?? null,
      input.body_md,
      html,
      excerpt,
      input.published_at ?? null,
      id,
    );
    syncTags(id, input.tags ?? []);
  });
  tx();
  return getById(id)!;
}

export function remove(id: number): void {
  run(`DELETE FROM posts WHERE id = ?`, id);
}

/**
 * Replace the post's tag set with `names`. Creates any missing tags. Runs
 * inside the caller's transaction.
 */
function syncTags(postId: number, names: string[]) {
  run(`DELETE FROM post_tags WHERE post_id = ?`, postId);
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const slug = slugify(trimmed);
    let tag = getOne<{ id: number }>(`SELECT id FROM tags WHERE slug = ?`, slug);
    if (!tag) {
      const r = run(`INSERT INTO tags (slug, name) VALUES (?, ?)`, slug, trimmed);
      tag = { id: Number(r.lastInsertRowid) };
    }
    run(`INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)`, postId, tag.id);
  }
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function listByTag(tagSlug: string, limit = 50, offset = 0): PostSummary[] {
  return getAll<PostSummary>(
    `SELECT p.id, p.slug, p.title, p.subtitle, p.excerpt, p.published_at, p.created_at
       FROM posts p
       JOIN post_tags pt ON pt.post_id = p.id
       JOIN tags t ON t.id = pt.tag_id
      WHERE t.slug = ?
        AND p.published_at IS NOT NULL
      ORDER BY p.published_at DESC
      LIMIT ? OFFSET ?`,
    tagSlug,
    limit,
    offset,
  );
}

export function listAllTags(): { slug: string; name: string; count: number }[] {
  return getAll<{ slug: string; name: string; count: number }>(
    `SELECT t.slug, t.name, COUNT(pt.post_id) AS count
       FROM tags t
       LEFT JOIN post_tags pt ON pt.tag_id = t.id
       LEFT JOIN posts p ON p.id = pt.post_id AND p.published_at IS NOT NULL
      GROUP BY t.id
     HAVING count > 0
      ORDER BY count DESC, t.name`,
  );
}
