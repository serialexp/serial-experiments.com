import { createResource, For, Show, Suspense } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { loadTags } from "~/lib/data";

/**
 * Tag index — every tag that has at least one published post, with a
 * post count next to it. Sorted by usage so the most-used tags surface.
 */
export default function Tags() {
  const [items] = createResource(loadTags);

  return (
    <article class="tags-list">
      <Title>tags — Serial Experiments</Title>
      <Meta name="description" content="All tags used on Serial Experiments." />

      <h1>tags</h1>

      <Suspense fallback={<p class="loading">…loading…</p>}>
        <Show when={items()?.length} fallback={<p class="empty">— no tags yet —</p>}>
          <ul class="tag-cloud">
            <For each={items()}>
              {(t) => (
                <li>
                  <A href={`/tags/${t.slug}`} class="tag">#{t.slug}</A>
                  <span class="count"> ({t.count})</span>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Suspense>
    </article>
  );
}
