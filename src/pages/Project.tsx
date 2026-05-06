import { createResource, Show, Suspense } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A, useParams } from "@solidjs/router";
import { loadProject } from "~/lib/data";

/**
 * Project detail page. Only reachable when the project has body content;
 * the gallery card otherwise links straight to the external URL.
 */
export default function Project() {
  const params = useParams<{ slug: string }>();
  const [project] = createResource(() => params.slug, loadProject);

  return (
    <Suspense fallback={<p class="loading">…loading…</p>}>
      <Show when={project()} fallback={<NotFoundBlock />}>
        {(p) => (
          <article class="project">
            <Title>{p().title} — Serial Experiments</Title>
            <Meta name="description" content={p().summary} />

            <header>
              <h1>{p().title}</h1>
              <p class="summary">{p().summary}</p>
              <Show when={p().link_url}>
                <p class="meta">
                  <a href={p().link_url!} target="_blank" rel="noreferrer">
                    {p().link_url}
                  </a>
                </p>
              </Show>
            </header>

            <Show when={p().image_path}>
              <img class="project-hero" src={p().image_path!} alt="" />
            </Show>

            <Show when={p().body_html}>
              <div class="post-body" innerHTML={p().body_html!} />
            </Show>

            <p class="back"><A href="/projects">← all projects</A></p>
          </article>
        )}
      </Show>
    </Suspense>
  );
}

function NotFoundBlock() {
  return (
    <article class="not-found">
      <Title>project not found — Serial Experiments</Title>
      <h1>404</h1>
      <p>That project doesn't exist (or hasn't been published).</p>
      <p>
        <A href="/projects">back to projects</A>
      </p>
    </article>
  );
}
