import { createResource, Show, Suspense, For } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A, useParams } from "@solidjs/router";
import { loadPost } from "~/lib/data";
import { formatDate } from "~/lib/format";

/**
 * Single post page. Renders the pre-sanitized `body_html` stored at save
 * time — no client-side markdown processing.
 *
 * `<For>` of tags links each to its tag page.
 */
export default function Post() {
  const params = useParams<{ slug: string }>();
  const [data] = createResource(() => params.slug, loadPost);

  return (
    <Suspense fallback={<p class="loading">…loading…</p>}>
      <Show when={data()} fallback={<NotFoundBlock />}>
        {(d) => (
          <article class="post">
            <Title>{d().post.title} — Serial Experiments</Title>
            <Show when={d().post.excerpt}>
              <Meta name="description" content={d().post.excerpt!} />
            </Show>

            <header>
              <h1>{d().post.title}</h1>
              <Show when={d().post.subtitle}>
                <p class="subtitle">{d().post.subtitle}</p>
              </Show>
              <p class="meta">
                <time>{formatDate(d().post.published_at ?? d().post.created_at)}</time>
                <Show when={d().tags.length}>
                  {" · "}
                  <For each={d().tags}>
                    {(t, i) => (
                      <>
                        <Show when={i() > 0}>{" "}</Show>
                        <A href={`/tags/${t.slug}`} class="tag">#{t.slug}</A>
                      </>
                    )}
                  </For>
                </Show>
              </p>
            </header>

            <div class="post-body" innerHTML={d().post.body_html} />
          </article>
        )}
      </Show>
    </Suspense>
  );
}

function NotFoundBlock() {
  return (
    <article class="not-found">
      <Title>post not found — Serial Experiments</Title>
      <h1>404</h1>
      <p>That post doesn't exist (or hasn't been published).</p>
      <p>
        <A href="/posts">back to all posts</A>
      </p>
    </article>
  );
}
