import { createResource, For, Show, Suspense } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A, useParams } from "@solidjs/router";
import { loadPostsByTag } from "~/lib/data";
import { formatDate } from "~/lib/format";

/**
 * Posts filtered by a single tag. Reuses the post-list shape from /posts so
 * it's visually consistent — only the heading changes.
 */
export default function TagPosts() {
  const params = useParams<{ slug: string }>();
  const [items] = createResource(() => params.slug, loadPostsByTag);

  return (
    <article class="posts-list tag-posts">
      <Title>#{params.slug} — Serial Experiments</Title>
      <Meta name="description" content={`Posts tagged #${params.slug} on Serial Experiments.`} />

      <h1>
        posts tagged <span class="tag">#{params.slug}</span>
      </h1>

      <Suspense fallback={<p class="loading">…loading…</p>}>
        <Show when={items()?.length} fallback={<EmptyTag slug={params.slug} />}>
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

      <p class="back"><A href="/tags">← all tags</A></p>
    </article>
  );
}

function EmptyTag(props: { slug: string }) {
  return (
    <p class="empty">
      — no posts tagged <code>#{props.slug}</code> —
    </p>
  );
}
