import { createResource, For, Show, Suspense } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { loadPostsList } from "~/lib/data";
import { formatDate } from "~/lib/format";

export default function Home() {
  const [recent] = createResource(async () => (await loadPostsList()).slice(0, 5));

  return (
    <article class="home">
      <Title>Serial Experiments</Title>
      <Meta name="description" content="A private software development company. Notes, projects, and assorted experiments." />

      <section class="hero">
        <h1>Serial Experiments</h1>
        <p class="lede">
          A private software development company. Providing customers with
          digital solutions since 2009.
        </p>
      </section>

      <section class="latest">
        <h2>Recent posts</h2>
        <Suspense fallback={<p class="loading">…loading…</p>}>
          <Show when={recent()?.length} fallback={<p class="empty">— nothing yet —</p>}>
            <ul class="post-list">
              <For each={recent()}>
                {(p) => (
                  <li>
                    <time>{formatDate(p.published_at ?? p.created_at)}</time>
                    {" · "}
                    <A href={`/posts/${p.slug}`}>{p.title}</A>
                  </li>
                )}
              </For>
            </ul>
            <p class="more">
              <A href="/posts">all posts →</A>
            </p>
          </Show>
        </Suspense>
      </section>

      <section class="featured">
        <h2>Featured projects</h2>
        <p class="empty">— nothing yet —</p>
      </section>
    </article>
  );
}
