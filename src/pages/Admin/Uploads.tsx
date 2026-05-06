import { createResource, createSignal, For, Show, Suspense } from "solid-js";
import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import {
  deleteUpload,
  listUploads,
  uploadFiles,
} from "~/lib/adminApi";
import { useSSRContext } from "~/lib/ssrContext";

/**
 * Upload library — drag-and-drop zone + a grid of existing uploads.
 *
 * Each tile shows the public path so it can be copied straight into a
 * project's `image_path` field or pasted into a post body as
 * `![alt](/uploads/...)`.
 */
export default function AdminUploads() {
  const ctx = useSSRContext();
  const [items, { refetch }] = createResource(listUploads);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [dropping, setDropping] = createSignal(false);
  const [recent, setRecent] = createSignal<{ saved: number; failed: { name: string; error: string }[] } | null>(null);
  const [busyDel, setBusyDel] = createSignal<number | null>(null);

  async function send(files: File[]) {
    if (!ctx.csrf) {
      setError("missing csrf token; reload the page");
      return;
    }
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await uploadFiles(ctx.csrf, files);
      setRecent({ saved: res.saved.length, failed: res.failed });
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onPick(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = "";
    await send(files);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    setDropping(true);
  }
  function onDragLeave() {
    setDropping(false);
  }
  async function onDrop(e: DragEvent) {
    e.preventDefault();
    setDropping(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    await send(files);
  }

  async function onDelete(id: number, filename: string) {
    if (!ctx.csrf) {
      setError("missing csrf token; reload the page");
      return;
    }
    if (!confirm(`Delete '${filename}'? Anything linking to it will break.`)) return;
    setBusyDel(id);
    try {
      await deleteUpload(ctx.csrf, id);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyDel(null);
    }
  }

  async function copyPath(path: string) {
    const full = `/uploads/${path}`;
    try {
      await navigator.clipboard.writeText(full);
    } catch {
      // Older browsers — surface as an error so the user knows to copy manually.
      setError(`copy failed; path is ${full}`);
    }
  }

  return (
    <article class="admin admin-uploads">
      <Title>uploads — admin</Title>
      <header class="admin-bar">
        <h1>uploads</h1>
      </header>

      <div
        class="dropzone"
        classList={{ "is-dragging": dropping() }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <p>drop images here, or</p>
        <label class="cta">
          <input type="file" accept="image/*" multiple onChange={onPick} disabled={busy()} hidden />
          {busy() ? "…uploading" : "choose files"}
        </label>
        <p class="hint">png, jpg, gif, webp, avif · max 10 MB each</p>
      </div>

      <Show when={error()}>
        <p class="error" role="alert">{error()}</p>
      </Show>
      <Show when={recent()}>
        <p class="upload-summary">
          uploaded {recent()!.saved}
          <Show when={recent()!.failed.length}>
            {" · "}
            <span class="error">
              {recent()!.failed.length} failed:&nbsp;
              <For each={recent()!.failed}>
                {(f, i) => (
                  <>
                    <Show when={i() > 0}>{", "}</Show>
                    {f.name} ({f.error})
                  </>
                )}
              </For>
            </span>
          </Show>
        </p>
      </Show>

      <Suspense fallback={<p class="loading">…loading…</p>}>
        <Show when={items()?.length} fallback={<p class="empty">— nothing uploaded yet —</p>}>
          <ul class="upload-grid">
            <For each={items()}>
              {(u) => (
                <li class="upload-tile">
                  <a href={`/uploads/${u.path}`} target="_blank" rel="noreferrer">
                    <img src={`/uploads/${u.path}`} alt={u.filename} loading="lazy" />
                  </a>
                  <div class="meta">
                    <code class="path">/uploads/{u.path}</code>
                    <span class="size">{formatBytes(u.size)}</span>
                  </div>
                  <div class="row-actions">
                    <button type="button" class="link-btn" onClick={() => copyPath(u.path)}>
                      copy path
                    </button>
                    {" · "}
                    <button
                      type="button"
                      class="link-btn"
                      disabled={busyDel() === u.id}
                      onClick={() => onDelete(u.id, u.filename)}
                    >
                      {busyDel() === u.id ? "…" : "delete"}
                    </button>
                  </div>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Suspense>

      <p class="back"><A href="/admin">← admin home</A></p>
    </article>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
