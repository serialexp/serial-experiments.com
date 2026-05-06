import { createResource, createSignal, For, Show, Suspense } from "solid-js";
import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { listAdminProjects, deleteProject } from "~/lib/adminApi";
import { useSSRContext } from "~/lib/ssrContext";

export default function AdminProjects() {
  const ctx = useSSRContext();
  const [items, { refetch }] = createResource(listAdminProjects);
  const [busyId, setBusyId] = createSignal<number | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  async function onDelete(id: number, slug: string) {
    if (!ctx.csrf) {
      setError("missing csrf token; reload the page");
      return;
    }
    if (!confirm(`Delete project '${slug}'? This is permanent.`)) return;
    setBusyId(id);
    setError(null);
    try {
      await deleteProject(ctx.csrf, id);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <article class="admin admin-projects">
      <Title>projects — admin</Title>
      <header class="admin-bar">
        <h1>projects</h1>
        <A href="/admin/projects/new" class="cta">+ new project</A>
      </header>

      <Show when={error()}>
        <p class="error" role="alert">{error()}</p>
      </Show>

      <Suspense fallback={<p class="loading">…loading…</p>}>
        <Show when={items()?.length} fallback={<p class="empty">— no projects yet —</p>}>
          <table class="admin-table">
            <thead>
              <tr>
                <th>title</th>
                <th>slug</th>
                <th>order</th>
                <th>state</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <For each={items()}>
                {(p) => (
                  <tr>
                    <td>
                      <A href={`/admin/projects/${p.id}`}>{p.title}</A>
                    </td>
                    <td><code>{p.slug}</code></td>
                    <td>{p.sort_order}</td>
                    <td>
                      <Show when={p.published} fallback={<span class="draft">draft</span>}>
                        published
                      </Show>
                    </td>
                    <td class="row-actions">
                      <Show
                        when={p.has_body}
                        fallback={
                          <Show when={p.link_url}>
                            <a href={p.link_url!} target="_blank" rel="noreferrer">link</a>
                          </Show>
                        }
                      >
                        <A href={`/projects/${p.slug}`} target="_blank" rel="noreferrer">view</A>
                      </Show>
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
