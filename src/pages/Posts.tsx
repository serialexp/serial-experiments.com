import { createResource, For, Show, Suspense } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { loadPostsList } from "~/lib/data";
import { formatDate } from "~/lib/format";

/**
 * Posts index. Plain-text list — date · title · subtitle. Maintaining the
 * monospace ASCII feel of the old terminal theme.
 */
export default function Posts() {
  const [items] = createResource(loadPostsList);

  return (
    <article class="posts-list">
      <Title>posts — Serial Experiments</Title>
      <Meta name="description" content="All posts on Serial Experiments." />

      <h1>posts</h1>

      <Suspense fallback={<p class="loading">…loading…</p>}>
        <Show when={items()?.length} fallback={<p class="empty">— nothing yet —</p>}>
          <ul class="post-list">
            <For each={items()}>
              {(p) => (
                <li>
                  <time>{formatDate(p.published_at ?? p.created_at)}</time>
                  {" · "}
                  <A href={`/posts/${p.slug}`}>{p.title}</A>
                  <Show when={p.subtitle}>
                    <span class="subtitle"> — {p.subtitle}</span>
                  </Show>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Suspense>
    </article>
  );
}
