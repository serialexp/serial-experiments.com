/// <reference types="bun-types" />
import { getAll } from "./db";

/**
 * Full-text search over posts using the FTS5 table from 0002_fts.sql.
 *
 * Query handling:
 *  - Strip everything except letters/digits/whitespace/quotes — FTS5's
 *    query syntax has operators (`AND`, `OR`, `NEAR`, column filters,
 *    parens) that a free-form search box should not surface to users.
 *    Anything we can't keep verbatim becomes a space.
 *  - Wrap each token as a prefix match (`token*`) so partial typing finds
 *    something. Joined with implicit AND (FTS5 default).
 *  - Use `bm25(posts_fts)` for ranking; lower is better.
 */

export interface SearchHit {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  published_at: string | null;
  snippet: string;
  rank: number;
}

const MAX_TOKENS = 8;
const SNIPPET_TOKENS = 18;

export function search(rawQuery: string, limit = 25): SearchHit[] {
  const fts = buildFtsQuery(rawQuery);
  if (!fts) return [];

  return getAll<SearchHit>(
    `SELECT p.id,
            p.slug,
            p.title,
            p.subtitle,
            p.published_at,
            snippet(posts_fts, 1, '<mark>', '</mark>', '…', ?) AS snippet,
            bm25(posts_fts) AS rank
       FROM posts_fts
       JOIN posts p ON p.id = posts_fts.rowid
      WHERE posts_fts MATCH ?
        AND p.published_at IS NOT NULL
      ORDER BY rank
      LIMIT ?`,
    SNIPPET_TOKENS,
    fts,
    limit,
  );
}

function buildFtsQuery(raw: string): string {
  // Conservative cleanup: keep ASCII alphanumerics + whitespace. Avoid
  // surfacing FTS5 syntax to users — they shouldn't have to know about it,
  // and a stray `"` would crash the query.
  const cleaned = raw.normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ");
  // Lowercase as well: FTS5 treats UPPERCASE `AND`/`OR`/`NEAR` as operators
  // even with a trailing `*`, so a literal "AND" search would error out.
  // Lowercasing both sidesteps that and matches the case-insensitive
  // tokenizer behaviour FTS5 already applies internally.
  const tokens = cleaned
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, MAX_TOKENS);
  if (tokens.length === 0) return "";

  // `token*` is FTS5's prefix operator. AND is implicit between tokens.
  return tokens.map((t) => `${t}*`).join(" ");
}
