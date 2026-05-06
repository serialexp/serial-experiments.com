import { createResource, createSignal, createMemo, createEffect, Show } from "solid-js";
import { Title } from "@solidjs/meta";
import { A, useNavigate, useParams } from "@solidjs/router";
import {
  createProject,
  getAdminProject,
  updateProject,
  type ProjectFormInput,
} from "~/lib/adminApi";
import { useSSRContext } from "~/lib/ssrContext";

/**
 * Single editor for `/admin/projects/new` and `/admin/projects/:id`.
 *
 * Project body is optional — leaving it blank means the gallery card links
 * straight to `link_url` instead of an in-site detail page.
 */
export default function ProjectEdit() {
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const ctx = useSSRContext();

  const id = createMemo(() => (params.id ? Number(params.id) : null));
  const [existing] = createResource(id, async (i) => (i ? await getAdminProject(i) : null));

  const [slug, setSlug] = createSignal("");
  const [title, setTitle] = createSignal("");
  const [summary, setSummary] = createSignal("");
  const [bodyMd, setBodyMd] = createSignal("");
  const [imagePath, setImagePath] = createSignal("");
  const [linkUrl, setLinkUrl] = createSignal("");
  const [sortOrder, setSortOrder] = createSignal(0);
  const [published, setPublished] = createSignal(true);

  const [error, setError] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [hydrated, setHydrated] = createSignal(false);

  // Populate the form once `existing` resolves. `createEffect` re-runs on
  // every resource update, so this works for both the SSR-then-hydrate
  // path (resource is already settled when the effect first runs) and the
  // SPA-navigation path (resource starts loading on the client and the
  // effect re-runs when the value lands). Awaiting `existing()` directly
  // doesn't work — Resource accessors return the current sync value, not
  // a promise, so `await existing()` resolves to `undefined` on the first
  // tick of a fresh client-only mount.
  createEffect(() => {
    const p = existing();
    if (!p) return;
    setSlug(p.slug);
    setTitle(p.title);
    setSummary(p.summary);
    setBodyMd(p.body_md ?? "");
    setImagePath(p.image_path ?? "");
    setLinkUrl(p.link_url ?? "");
    setSortOrder(p.sort_order);
    setPublished(!!p.published);
    setHydrated(true);
  });

  const isNew = createMemo(() => id() == null);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!ctx.csrf) {
      setError("missing csrf token — reload the page");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const input: ProjectFormInput = {
        slug: slug().trim(),
        title: title().trim(),
        summary: summary().trim(),
        body_md: bodyMd().trim() || null,
        image_path: imagePath().trim() || null,
        link_url: linkUrl().trim() || null,
        sort_order: sortOrder(),
        published: published(),
      };
      if (isNew()) {
        await createProject(ctx.csrf, input);
      } else {
        await updateProject(ctx.csrf, id()!, input);
      }
      navigate("/admin/projects");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article class="admin admin-edit">
      <Title>{isNew() ? "new project" : `edit · ${title() || "…"}`} — admin</Title>

      <h1>{isNew() ? "new project" : "edit project"}</h1>

      <Show when={isNew() || hydrated()} fallback={<p class="loading">…loading…</p>}>
        <form onSubmit={submit}>
          <label>
            <span>title</span>
            <input
              type="text"
              required
              value={title()}
              onInput={(e) => {
                setTitle(e.currentTarget.value);
                if (isNew() && !slug()) setSlug(slugify(e.currentTarget.value));
              }}
            />
          </label>

          <label>
            <span>slug</span>
            <input
              type="text"
              required
              pattern="[a-z0-9][a-z0-9-]*"
              value={slug()}
              onInput={(e) => setSlug(e.currentTarget.value)}
            />
          </label>

          <label>
            <span>summary <em>(one line, shown on the gallery card)</em></span>
            <input
              type="text"
              required
              maxLength={240}
              value={summary()}
              onInput={(e) => setSummary(e.currentTarget.value)}
            />
          </label>

          <label>
            <span>image path <em>(optional, e.g. /uploads/foo.png)</em></span>
            <input
              type="text"
              value={imagePath()}
              onInput={(e) => setImagePath(e.currentTarget.value)}
            />
          </label>

          <label>
            <span>external link <em>(optional, https://...)</em></span>
            <input
              type="url"
              value={linkUrl()}
              onInput={(e) => setLinkUrl(e.currentTarget.value)}
            />
          </label>

          <label>
            <span>body <em>(markdown — leave blank to skip the detail page)</em></span>
            <textarea
              rows={16}
              value={bodyMd()}
              onInput={(e) => setBodyMd(e.currentTarget.value)}
            />
          </label>

          <fieldset>
            <legend>placement</legend>
            <label>
              <span>sort order <em>(higher = earlier in the gallery)</em></span>
              <input
                type="number"
                step="1"
                value={sortOrder()}
                onInput={(e) => setSortOrder(Number(e.currentTarget.value) || 0)}
              />
            </label>
            <label class="inline">
              <input
                type="checkbox"
                checked={published()}
                onChange={(e) => setPublished(e.currentTarget.checked)}
              />
              <span>published</span>
            </label>
          </fieldset>

          <Show when={error()}>
            <p class="error" role="alert">{error()}</p>
          </Show>

          <div class="actions">
            <button type="submit" disabled={busy()}>
              {busy() ? "…" : isNew() ? "create" : "save"}
            </button>
            <A href="/admin/projects" class="cancel">cancel</A>
          </div>
        </form>
      </Show>
    </article>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
