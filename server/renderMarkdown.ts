/// <reference types="bun-types" />
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

/**
 * Render Markdown → sanitized HTML.
 *
 * Called on save (not on render): admin POSTs body_md, we render it and
 * cache the result in `posts.body_html` / `projects.body_html`. Reads
 * never go through this function, so the markdown library can be as
 * "heavy" as we like without affecting page latency.
 *
 * The site has one author (Bart) so trust is not really the threat model,
 * but sanitization is still cheap insurance against a paste-from-Word
 * incident, a leaked admin password, or a future me forgetting context.
 *
 * Markdown features turned on:
 *  - GitHub-flavoured: tables, strikethrough, autolinks (marked default).
 *  - Header IDs (`gfm: true` does this implicitly via `marked` defaults).
 */

marked.setOptions({
  gfm: true,
  breaks: false,        // single newline = soft break in source, but we
                        // want explicit paragraph breaks for blog posts.
});

export async function renderMarkdown(md: string): Promise<string> {
  const raw = await marked.parse(md);
  // Allow the standard subset; explicitly disallow everything that could
  // execute (script, on*, javascript: URLs). isomorphic-dompurify defaults
  // are sane — we just lock down the protocol list and forbid `iframe`
  // since this is a personal blog, not an embed wall.
  const clean = DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel"],
    FORBID_TAGS: ["iframe", "object", "embed", "form"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/)/i,
  });
  return clean;
}

/**
 * Cheap excerpt: strip tags, take first 240 chars on a word boundary.
 * Used when a post doesn't have a hand-written excerpt.
 */
export function autoExcerpt(html: string, max = 240): string {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + "…";
}
