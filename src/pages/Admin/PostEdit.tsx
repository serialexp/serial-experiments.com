import { createResource, createSignal, createMemo, Show } from "solid-js";
import { Title } from "@solidjs/meta";
import { A, useNavigate, useParams } from "@solidjs/router";
import {
  createPost,
  getAdminPost,
  updatePost,
  type PostFormInput,
} from "~/lib/adminApi";
import { useSSRContext } from "~/lib/ssrContext";

/**
 * Single editor used for both `/admin/posts/new` and `/admin/posts/:id`.
 * `params.id` distinguishes the two; when missing we render an empty form
 * and POST on submit, when present we hydrate the form from
 * `/api/admin/posts/:id` and PATCH on submit.
 */
export default function PostEdit() {
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const ctx = useSSRContext();

  const id = createMemo(() => (params.id ? Number(params.id) : null));
  const [existing] = createResource(id, async (i) => (i ? await getAdminPost(i) : null));

  const [slug, setSlug] = createSignal("");
  const [title, setTitle] = createSignal("");
  const [subtitle, setSubtitle] = createSignal("");
  const [bodyMd, setBodyMd] = createSignal("");
  const [excerpt, setExcerpt] = createSignal("");
  const [tags, setTags] = createSignal("");
  const [publishedAt, setPublishedAt] = createSignal("");
  const [published, setPublished] = createSignal(true);

  const [error, setError] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [hydrated, setHydrated] = createSignal(false);

  // Hydrate form when /admin/posts/:id loads.
  if (id() != null) {
    void (async () => {
      const data = await existing();
      if (!data) return;
      setSlug(data.post.slug);
      setTitle(data.post.title);
      setSubtitle(data.post.subtitle ?? "");
      setBodyMd(data.post.body_md);
      setExcerpt(data.post.excerpt ?? "");
      setTags(data.tags.map((t) => t.name).join(", "));
      setPublishedAt(data.post.published_at ?? "");
      setPublished(!!data.post.published_at);
      setHydrated(true);
    })();
  }

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
      const input: PostFormInput = {
        slug: slug().trim(),
        title: title().trim(),
        subtitle: subtitle().trim() || null,
        body_md: bodyMd(),
        excerpt: excerpt().trim() || null,
        published_at: published()
          ? publishedAt().trim() || nowSqlite()
          : null,
        tags: tags()
          .split(/[\s,]+/)
          .map((t) => t.trim())
          .filter(Boolean),
      };
      if (isNew()) {
        await createPost(ctx.csrf, input);
      } else {
        await updatePost(ctx.csrf, id()!, input);
      }
      navigate("/admin/posts");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article class="admin admin-edit">
      <Title>{isNew() ? "new post" : `edit · ${title() || "…"}`} — admin</Title>

      <h1>{isNew() ? "new post" : "edit post"}</h1>

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
            <span>subtitle <em>(optional)</em></span>
            <input
              type="text"
              value={subtitle()}
              onInput={(e) => setSubtitle(e.currentTarget.value)}
            />
          </label>

          <label>
            <span>body (markdown)</span>
            <textarea
              required
              rows={24}
              value={bodyMd()}
              onInput={(e) => setBodyMd(e.currentTarget.value)}
            />
          </label>

          <label>
            <span>excerpt <em>(optional, auto if blank)</em></span>
            <textarea
              rows={3}
              value={excerpt()}
              onInput={(e) => setExcerpt(e.currentTarget.value)}
            />
          </label>

          <label>
            <span>tags <em>(comma or space separated)</em></span>
            <input
              type="text"
              value={tags()}
              onInput={(e) => setTags(e.currentTarget.value)}
            />
          </label>

          <fieldset class="publish-block">
            <legend>publication</legend>
            <label class="inline">
              <input
                type="checkbox"
                checked={published()}
                onChange={(e) => setPublished(e.currentTarget.checked)}
              />
              <span>published</span>
            </label>
            <label>
              <span>published_at <em>(YYYY-MM-DD HH:MM:SS, blank = now)</em></span>
              <input
                type="text"
                placeholder={nowSqlite()}
                value={publishedAt()}
                disabled={!published()}
                onInput={(e) => setPublishedAt(e.currentTarget.value)}
              />
            </label>
          </fieldset>

          <Show when={error()}>
            <p class="error" role="alert">{error()}</p>
          </Show>

          <div class="actions">
            <button type="submit" disabled={busy()}>
              {busy() ? "…" : isNew() ? "create" : "save"}
            </button>
            <A href="/admin/posts" class="cancel">cancel</A>
          </div>
        </form>
      </Show>
    </article>
  );
}

function nowSqlite(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
