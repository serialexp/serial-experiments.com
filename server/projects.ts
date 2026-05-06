/// <reference types="bun-types" />
import { getAll, getOne, run, db } from "./db";
import { renderMarkdown } from "./renderMarkdown";

/**
 * Projects repository.
 *
 * Differences from posts:
 *  - Always has a `summary` (one-liner shown in the gallery card).
 *  - `body_md` / `body_html` are optional — many projects are just a card
 *    with a summary + image + external link, no detail page.
 *  - `published` is a boolean flag (not a publish date).
 *  - `sort_order` lets the admin pin specific projects to the top of the
 *    gallery; ties broken by id (most-recently-created first).
 */

export interface Project {
  id: number;
  slug: string;
  title: string;
  summary: string;
  body_md: string | null;
  body_html: string | null;
  image_path: string | null;
  link_url: string | null;
  sort_order: number;
  published: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectSummary {
  id: number;
  slug: string;
  title: string;
  summary: string;
  image_path: string | null;
  link_url: string | null;
  sort_order: number;
  published: number;
  has_body: number;
  created_at: string;
}

export interface ProjectInput {
  slug: string;
  title: string;
  summary: string;
  body_md?: string | null;
  image_path?: string | null;
  link_url?: string | null;
  sort_order?: number;
  published?: boolean;
}

const SUMMARY_COLS = `id, slug, title, summary, image_path, link_url, sort_order, published,
                      (CASE WHEN body_md IS NOT NULL AND length(body_md) > 0 THEN 1 ELSE 0 END) AS has_body,
                      created_at`;

export function listPublished(): ProjectSummary[] {
  return getAll<ProjectSummary>(
    `SELECT ${SUMMARY_COLS}
       FROM projects
      WHERE published = 1
      ORDER BY sort_order DESC, id DESC`,
  );
}

export function listAll(): ProjectSummary[] {
  return getAll<ProjectSummary>(
    `SELECT ${SUMMARY_COLS}
       FROM projects
      ORDER BY sort_order DESC, id DESC`,
  );
}

export function listFeatured(limit = 3): ProjectSummary[] {
  return getAll<ProjectSummary>(
    `SELECT ${SUMMARY_COLS}
       FROM projects
      WHERE published = 1
      ORDER BY sort_order DESC, id DESC
      LIMIT ?`,
    limit,
  );
}

export function getBySlug(slug: string): Project | null {
  return getOne<Project>(
    `SELECT * FROM projects WHERE slug = ? AND published = 1`,
    slug,
  );
}

export function getById(id: number): Project | null {
  return getOne<Project>(`SELECT * FROM projects WHERE id = ?`, id);
}

export async function create(input: ProjectInput): Promise<Project> {
  const html = input.body_md ? await renderMarkdown(input.body_md) : null;
  const tx = db.transaction(() => {
    const r = run(
      `INSERT INTO projects (slug, title, summary, body_md, body_html, image_path, link_url, sort_order, published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.slug,
      input.title,
      input.summary,
      input.body_md ?? null,
      html,
      input.image_path ?? null,
      input.link_url ?? null,
      input.sort_order ?? 0,
      input.published ? 1 : 0,
    );
    return Number(r.lastInsertRowid);
  });
  return getById(tx())!;
}

export async function update(id: number, input: ProjectInput): Promise<Project> {
  const html = input.body_md ? await renderMarkdown(input.body_md) : null;
  run(
    `UPDATE projects
        SET slug = ?,
            title = ?,
            summary = ?,
            body_md = ?,
            body_html = ?,
            image_path = ?,
            link_url = ?,
            sort_order = ?,
            published = ?,
            updated_at = datetime('now')
      WHERE id = ?`,
    input.slug,
    input.title,
    input.summary,
    input.body_md ?? null,
    html,
    input.image_path ?? null,
    input.link_url ?? null,
    input.sort_order ?? 0,
    input.published ? 1 : 0,
    id,
  );
  return getById(id)!;
}

export function remove(id: number): void {
  run(`DELETE FROM projects WHERE id = ?`, id);
}
