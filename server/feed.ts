/// <reference types="bun-types" />
import * as posts from "./posts";
import * as projects from "./projects";

/**
 * Feed + sitemap generators.
 *
 * Both endpoints are pure functions of the database — no per-request state
 * besides the public origin. We intentionally do not cache the rendered
 * output: posts.listPublished() against SQLite is sub-millisecond, and
 * skipping the cache means edits show up in feed readers within their
 * normal poll window.
 *
 * Atom (not RSS 2.0): Atom is better-specified, has unambiguous date
 * handling (RFC 3339 instead of RFC 822), and every modern reader supports
 * it. Same `<link rel="alternate">` discovery shape from HTML, just a
 * different `application/atom+xml` content-type.
 *
 * Browsers offered an `application/atom+xml` document download it instead
 * of rendering it. We attach an XSL stylesheet via `<?xml-stylesheet?>` so
 * a human visiting `/feed.xml` directly gets a styled HTML view, while
 * feed readers (which don't apply XSL) still see plain Atom.
 */

const FEED_LIMIT = 20;

export function renderAtomFeed(origin: string): string {
  const items = posts.listPublished(FEED_LIMIT, 0);
  const updated = items[0]?.published_at
    ? toIsoZ(items[0].published_at)
    : new Date().toISOString();

  const entries = items.map((p) => {
    const url = `${origin}/posts/${p.slug}`;
    const published = toIsoZ(p.published_at ?? p.created_at);
    return [
      `  <entry>`,
      `    <title>${esc(p.title)}</title>`,
      `    <link rel="alternate" type="text/html" href="${esc(url)}"/>`,
      `    <id>${esc(url)}</id>`,
      `    <updated>${published}</updated>`,
      `    <published>${published}</published>`,
      p.subtitle ? `    <summary>${esc(p.subtitle)}</summary>` : null,
      p.excerpt ? `    <content type="text">${esc(p.excerpt)}</content>` : null,
      `  </entry>`,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<?xml-stylesheet type="text/xsl" href="/feed.xsl"?>`,
    `<feed xmlns="http://www.w3.org/2005/Atom">`,
    `  <title>Serial Experiments</title>`,
    `  <subtitle>notes, projects, experiments</subtitle>`,
    `  <link rel="alternate" type="text/html" href="${esc(origin)}/"/>`,
    `  <link rel="self" type="application/atom+xml" href="${esc(origin)}/feed.xml"/>`,
    `  <id>${esc(origin)}/</id>`,
    `  <updated>${updated}</updated>`,
    `  <author><name>Bart Riepe</name></author>`,
    ...entries,
    `</feed>`,
    ``,
  ].join("\n");
}

export function renderSitemap(origin: string): string {
  const urls: { loc: string; lastmod?: string }[] = [
    { loc: `${origin}/` },
    { loc: `${origin}/posts` },
    { loc: `${origin}/projects` },
    { loc: `${origin}/tags` },
  ];

  for (const p of posts.listPublished(500, 0)) {
    urls.push({
      loc: `${origin}/posts/${p.slug}`,
      lastmod: toIsoZ(p.published_at ?? p.created_at),
    });
  }

  for (const t of posts.listAllTags()) {
    urls.push({ loc: `${origin}/tags/${t.slug}` });
  }

  for (const project of projects.listPublished()) {
    if (project.has_body) {
      urls.push({
        loc: `${origin}/projects/${project.slug}`,
        lastmod: toIsoZ(project.created_at),
      });
    }
  }

  const lines = urls.map(({ loc, lastmod }) =>
    [
      `  <url>`,
      `    <loc>${esc(loc)}</loc>`,
      lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...lines,
    `</urlset>`,
    ``,
  ].join("\n");
}

/**
 * Convert a SQLite-flavoured timestamp ("YYYY-MM-DD HH:MM:SS", UTC) to RFC
 * 3339 with explicit Z. Tolerates already-ISO inputs.
 */
function toIsoZ(ts: string): string {
  const trimmed = ts.trim();
  if (trimmed.endsWith("Z")) return trimmed;
  if (trimmed.includes("T")) return `${trimmed}Z`;
  return `${trimmed.replace(" ", "T")}Z`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * XSL stylesheet that turns the Atom feed into a styled HTML view when a
 * human opens `/feed.xml` in a browser. Feed readers ignore the
 * `<?xml-stylesheet?>` PI, so they still see raw Atom.
 *
 * Inlines all CSS so the response is fully self-contained — no extra
 * fetch, and the styling survives even if the asset hashes rotate. The
 * palette mirrors the main site: near-black background, slate fg, the
 * logo's blue accent.
 *
 * Note: XSL output method "html" emits HTML5-shaped tags but the doctype
 * shape XSLT 1.0 lets us write is the legacy XHTML one — browsers don't
 * care, treat the result as HTML in practice.
 */
export function renderFeedStylesheet(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <xsl:output method="html" encoding="utf-8" indent="yes"/>
  <xsl:template match="/atom:feed">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <title><xsl:value-of select="atom:title"/> — feed</title>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <style>
          :root {
            --bg: #0a0e1a;
            --fg: #d6deeb;
            --accent: #60b0f4;
            --accent-dim: #5b779a;
            --border: rgba(91, 119, 154, 0.35);
          }
          html { background: var(--bg); color: var(--fg); }
          body {
            font-family: "Source Code Pro", ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 14px;
            line-height: 1.6;
            max-width: 60ch;
            margin: 2rem auto;
            padding: 0 1.25rem;
          }
          a { color: var(--accent); }
          a:hover { text-decoration: underline; }
          h1 {
            font-size: 1.5rem;
            margin: 0 0 0.25rem;
            color: var(--accent);
          }
          .lede { color: var(--accent-dim); margin: 0 0 1.5rem; font-size: 0.9rem; }
          .notice {
            border: 1px solid var(--border);
            padding: 0.75rem 1rem;
            margin: 1.5rem 0;
            background: rgba(91, 119, 154, 0.07);
            font-size: 0.85rem;
          }
          .notice code { color: var(--accent); }
          ul.entries { list-style: none; padding: 0; margin: 0; }
          ul.entries li {
            padding: 0.6rem 0;
            border-bottom: 1px dotted var(--border);
          }
          ul.entries li:last-child { border-bottom: none; }
          time { color: var(--accent-dim); margin-right: 0.5rem; }
          .summary { color: var(--accent-dim); font-size: 0.85rem; margin-top: 0.25rem; }
        </style>
      </head>
      <body>
        <h1><xsl:value-of select="atom:title"/></h1>
        <p class="lede"><xsl:value-of select="atom:subtitle"/></p>

        <div class="notice">
          you're looking at the raw Atom feed, rendered for human eyes.
          point your feed reader at <code>/feed.xml</code> for the real thing,
          or visit <a><xsl:attribute name="href"><xsl:value-of select="atom:link[@rel='alternate']/@href"/></xsl:attribute>the site itself</a>.
        </div>

        <ul class="entries">
          <xsl:for-each select="atom:entry">
            <li>
              <time><xsl:value-of select="substring(atom:published, 1, 10)"/></time>
              <a>
                <xsl:attribute name="href">
                  <xsl:value-of select="atom:link[@rel='alternate']/@href"/>
                </xsl:attribute>
                <xsl:value-of select="atom:title"/>
              </a>
              <xsl:if test="atom:summary">
                <div class="summary"><xsl:value-of select="atom:summary"/></div>
              </xsl:if>
            </li>
          </xsl:for-each>
        </ul>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
`;
}
