// SOPHIA Portal — Lección (player de contenido + marca de progreso)

import { requireAuth } from "./auth.js";
import { api } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  const params = new URLSearchParams(location.search);
  const leccionId = params.get("id");

  if (!leccionId) {
    renderShell({
      persona,
      title: "Lección",
      contentHtml: `
        <div class="empty-state">
          <div class="empty-state__title">Falta la lección</div>
          <p class="empty-state__desc">No se proporcionó un ID. <a href="/app/cursos">Volver a mis cursos</a>.</p>
        </div>
      `,
    });
    return;
  }

  renderShell({
    persona,
    title: "Cargando lección…",
    activePath: "/app/cursos",
    contentHtml: `<div class="spinner" style="margin: 60px auto;"></div>`,
  });

  try {
    const data = await api.leccion(leccionId);
    renderLeccion(persona, data);
  } catch (e) {
    console.error("get-leccion failed:", e);
    document.querySelector(".app-main").innerHTML = `
      <div class="empty-state">
        <div class="empty-state__title">No pudimos cargar esta lección</div>
        <p class="empty-state__desc">${escapeHtml(e.message || "Intenta recargar.")}</p>
        <a href="/app/cursos" class="btn btn-secondary" style="margin-top:var(--s-4);">Volver a mis cursos</a>
      </div>
    `;
  }
})();

function renderLeccion(persona, payload) {
  const { leccion, capituloId, cursoId, inscripcionId, prevId, nextId } = payload;

  // Caso especial: lección tipo "test" lanza al Test de Felicidad
  if (leccion.tipo === "test" || leccion.tipo === "autoeval") {
    const testUrl =
      `/app/test-felicidad?inscripcion=${encodeURIComponent(inscripcionId)}` +
      `&leccion=${encodeURIComponent(leccion.id)}`;
    location.replace(testUrl);
    return;
  }

  renderShell({
    persona,
    title: leccion.titulo,
    activePath: "/app/cursos",
    contentHtml: `
      <article class="leccion-page">
        <header class="leccion-page__header">
          <a href="javascript:history.back()" style="color: var(--color-text-muted); font-size: 0.875rem;">← Volver al curso</a>
          ${leccion.etiqueta ? `<span class="leccion-page__tag">${escapeHtml(leccion.etiqueta)}</span>` : ""}
          <h2 class="page-title" style="margin-top: var(--s-3);">${escapeHtml(leccion.titulo)}</h2>
        </header>

        <div class="leccion-page__body">
          ${renderContent(leccion)}
        </div>

        <footer class="leccion-page__footer">
          <div>
            ${prevId
              ? `<a class="btn btn-secondary" href="/app/leccion?id=${encodeURIComponent(prevId)}">← Anterior</a>`
              : ""}
          </div>
          <div style="display:flex;gap:var(--s-3);">
            ${leccion.completada
              ? `<span class="btn btn-ghost" style="cursor:default;">✓ Completada</span>`
              : `<button class="btn btn-primary" id="markBtn" type="button">Marcar como completada</button>`}
            ${nextId
              ? `<a class="btn btn-accent" href="/app/leccion?id=${encodeURIComponent(nextId)}">Siguiente →</a>`
              : `<a class="btn btn-accent" href="/app/curso?slug=${encodeURIComponent(payload.cursoSlug || "")}">Volver al curso</a>`}
          </div>
        </footer>
      </article>
    `,
  });

  document.getElementById("markBtn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "Marcando…";
    try {
      await api.marcarLeccion(leccion.id, inscripcionId);
      btn.textContent = "✓ Completada";
      btn.classList.remove("btn-primary");
      btn.classList.add("btn-ghost");
      btn.style.cursor = "default";
    } catch (err) {
      console.error("marcar-leccion error:", err);
      btn.disabled = false;
      btn.textContent = "Marcar como completada";
      alert(`No se pudo marcar: ${err.message}`);
    }
  });
}

function renderContent(l) {
  const html = l.contenidoHTML || "";
  const tipo = l.tipo || "texto";

  switch (tipo) {
    case "video":
      return `
        ${l.urlVideo ? renderVideoEmbed(l.urlVideo) : ""}
        ${html ? `<div class="leccion-html">${html}</div>` : ""}
      `;
    case "documento":
      return `
        ${html ? `<div class="leccion-html">${html}</div>` : ""}
        ${l.archivoUrl
          ? `<a class="btn btn-secondary" href="${escapeHtml(l.archivoUrl)}" target="_blank" rel="noopener" style="margin-top:var(--s-4);">Abrir ${escapeHtml(l.archivoNombre || "documento")}</a>`
          : ""}
      `;
    case "enlace":
      return `
        ${html ? `<div class="leccion-html">${html}</div>` : ""}
        ${l.urlExterna
          ? `<a class="btn btn-accent" href="${escapeHtml(l.urlExterna)}" target="_blank" rel="noopener" style="margin-top:var(--s-4);">Abrir enlace ↗</a>`
          : ""}
      `;
    case "sesion_live":
      return `
        ${html ? `<div class="leccion-html">${html}</div>` : ""}
        ${l.urlExterna
          ? `<a class="btn btn-accent" href="${escapeHtml(l.urlExterna)}" target="_blank" rel="noopener" style="margin-top:var(--s-4);">Unirme a la sesión 🎤</a>`
          : `<p style="color:var(--color-text-muted);">El enlace a la sesión aparecerá aquí cuando se publique.</p>`}
      `;
    default:
      return html
        ? `<div class="leccion-html">${html}</div>`
        : `<p style="color:var(--color-text-muted);">Sin contenido.</p>`;
  }
}

function renderVideoEmbed(url) {
  // YouTube
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]+)/);
  if (yt) {
    return `<div class="video-embed"><iframe src="https://www.youtube.com/embed/${yt[1]}" frameborder="0" allowfullscreen></iframe></div>`;
  }
  // Vimeo
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) {
    return `<div class="video-embed"><iframe src="https://player.vimeo.com/video/${vm[1]}" frameborder="0" allowfullscreen></iframe></div>`;
  }
  // MP4 directo
  return `<video src="${escapeHtml(url)}" controls style="width:100%;border-radius:var(--r-lg);"></video>`;
}
