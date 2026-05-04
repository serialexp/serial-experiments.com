import { createResource, createSignal, For, Show, Suspense } from "solid-js";
import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { listAdminPosts, deletePost } from "~/lib/adminApi";
import { useSSRContext } from "~/lib/ssrContext";
import { formatDate } from "~/lib/format";

export default function AdminPosts() {
  const ctx = useSSRContext();
  const [items, { refetch }] = createResource(listAdminPosts);
  const [busyId, setBusyId] = createSignal<number | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  async function onDelete(id: number, slug: string) {
    if (!ctx.csrf) {
      setError("missing csrf token; reload the page");
      return;
    }
    if (!confirm(`Delete '${slug}'? This is permanent.`)) return;
    setBusyId(id);
    setError(null);
    try {
      await deletePost(ctx.csrf, id);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <article class="admin admin-posts">
      <Title>posts — admin</Title>
      <header class="admin-bar">
        <h1>posts</h1>
        <A href="/admin/posts/new" class="cta">+ new post</A>
      </header>

      <Show when={error()}>
        <p class="error" role="alert">{error()}</p>
      </Show>

      <Suspense fallback={<p class="loading">…loading…</p>}>
        <Show when={items()?.length} fallback={<p class="empty">— no posts yet —</p>}>
          <table class="admin-table">
            <thead>
              <tr>
                <th>title</th>
                <th>slug</th>
                <th>published</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <For each={items()}>
                {(p) => (
                  <tr>
                    <td>
                      <A href={`/admin/posts/${p.id}`}>{p.title}</A>
                    </td>
                    <td><code>{p.slug}</code></td>
                    <td>
                      <Show when={p.published_at} fallback={<span class="draft">draft</span>}>
                        {formatDate(p.published_at!)}
                      </Show>
                    </td>
                    <td class="row-actions">
                      <A href={`/posts/${p.slug}`} target="_blank" rel="noreferrer">view</A>
                      {" · "}
                      <button
                        type="button"
                        class="link-btn"
                        disabled={busyId() === p.id}
                        onClick={() => onDelete(p.id, p.slug)}
                      >
                        {busyId() === p.id ? "…" : "delete"}
                      </button>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </Show>
      </Suspense>

      <p class="back"><A href="/admin">← admin home</A></p>
    </article>
  );
}
