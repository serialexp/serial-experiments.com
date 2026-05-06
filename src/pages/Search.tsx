import { createResource, createSignal, For, Show, Suspense } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A, useSearchParams } from "@solidjs/router";
import { searchPosts } from "~/lib/data";
import { formatDate } from "~/lib/format";

/**
 * Posts search.
 *
 * Reads the query from `?q=`. The form `GET`s back to /search so refreshing
 * preserves the search and the URL is shareable. Snippets come from FTS5
 * with `<mark>` highlighting; we render them via `innerHTML` because they
 * are pre-sanitized (only the wrapper tags we asked for) and originate
 * from our own DB.
 */
export default function Search() {
  const [params, setParams] = useSearchParams<{ q?: string }>();
  const initial = params.q ?? "";
  const [draft, setDraft] = createSignal(initial);

  const [hits] = createResource(() => params.q ?? "", searchPosts);

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    setParams({ q: draft().trim() || undefined });
  }

  return (
    <article class="search">
      <Title>{params.q ? `search: ${params.q}` : "search"} — Serial Experiments</Title>
      <Meta name="description" content="Search posts on Serial Experiments." />

      <h1>search</h1>

      <form class="search-form" role="search" onSubmit={onSubmit}>
        <input
          type="search"
          name="q"
          autofocus
          placeholder="search posts…"
          value={draft()}
          onInput={(e) => setDraft(e.currentTarget.value)}
        />
        <button type="submit">go</button>
      </form>

      <Show when={params.q}>
        <Suspense fallback={<p class="loading">…searching…</p>}>
          <Show
            when={hits()?.length}
            fallback={<p class="empty">— nothing matched <code>{params.q}</code> —</p>}
          >
            <p class="search-count">{hits()!.length} result{hits()!.length === 1 ? "" : "s"}</p>
            <ul class="search-results">
              <For each={hits()}>
                {(h) => (
                  <li>
                    <A href={`/posts/${h.slug}`} class="title">{h.title}</A>
                    <Show when={h.published_at}>
                      <span class="meta"> · <time>{formatDate(h.published_at!)}</time></span>
                    </Show>
                    <Show when={h.subtitle}>
                      <p class="subtitle">{h.subtitle}</p>
                    </Show>
                    <p class="snippet" innerHTML={h.snippet} />
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Suspense>
      </Show>
    </article>
  );
}
