// SOPHIA Portal — Lección (player de contenido)

import { requireAuth } from "./auth.js";
import { api } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";
import { icon, lessonIcon, lessonTipoLabel } from "./icons.js";

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

  let leccionData;
  try {
    leccionData = await api.leccion(leccionId);
  } catch (e) {
    console.error("get-leccion failed:", e);
    document.querySelector(".app-main").innerHTML = `
      <div class="empty-state">
        <div class="empty-state__title">No pudimos cargar esta lección</div>
        <p class="empty-state__desc">${escapeHtml(e.message || "Intenta recargar.")}</p>
        <a href="/app/cursos" class="btn btn-secondary" style="margin-top:var(--s-4);">Volver a mis cursos</a>
      </div>
    `;
    return;
  }

  // Caso especial: lección tipo "test" → llevar al wizard del Test de Felicidad
  // Usamos location.href (NO replace) para que el back funcione.
  if (leccionData.leccion.tipo === "test" || leccionData.leccion.tipo === "autoeval") {
    const testUrl =
      `/app/test-felicidad?inscripcion=${encodeURIComponent(leccionData.inscripcionId)}` +
      `&leccion=${encodeURIComponent(leccionData.leccion.id)}`;
    location.href = testUrl;
    return;
  }

  // Necesitamos el contexto del curso (capítulos + slug) para la barra de
  // progreso del capítulo y la navegación al volver.
  let cursoContext = null;
  try {
    cursoContext = await fetchCursoContext(leccionData.cursoId);
  } catch (e) {
    console.warn("Could not fetch curso context for progress bar:", e);
  }

  renderLeccion(persona, leccionData, cursoContext);
})();

/**
 * El endpoint get-leccion devuelve cursoId pero no el slug ni el capítulo
 * completo. Para tener la barra de progreso del capítulo necesitamos los datos
 * del curso. Hacemos una llamada extra (cacheada) — alternativamente podríamos
 * mover esto al endpoint en una iteración futura.
 */
async function fetchCursoContext(cursoId) {
  // No tenemos un endpoint "get-curso-by-id"; el endpoint es por slug.
  // Estrategia: traer mis cursos, encontrar el slug, después el detalle.
  const { cursos } = await api.misCursos();
  const c = cursos.find((x) => x.id === cursoId);
  if (!c) return null;
  const detalle = await api.curso(c.slug);
  return { ...detalle, slug: c.slug };
}

function renderLeccion(persona, payload, cursoContext) {
  const { leccion, capituloId, cursoId, inscripcionId, prevId, nextId } = payload;

  // Encontrar el capítulo actual y calcular progreso
  let capitulo = null;
  let cursoTitulo = "";
  let cursoSlug = "";
  if (cursoContext) {
    capitulo = cursoContext.capitulos.find((c) => c.id === capituloId);
    cursoTitulo = cursoContext.curso.titulo;
    cursoSlug = cursoContext.slug;
  }

  const capLecciones = capitulo?.lecciones ?? [];
  const totalLecc = capLecciones.length;
  // Marcar la lección actual como "in progress" pero no completada hasta que el
  // usuario haga click. Para la barra: completadas + 1 (la que está viendo)
  // sería visualmente útil. Pero para no engañar, mostramos solo completadas.
  const completadas = capLecciones.filter((l) => l.completada).length;
  const idxHere = capLecciones.findIndex((l) => l.id === leccion.id);
  const pctChapter = totalLecc > 0
    ? Math.round(((idxHere >= 0 ? idxHere : 0) + (leccion.completada ? 1 : 0)) / totalLecc * 100)
    : 0;

  // Header: link de regreso al temario
  const backHref = cursoSlug
    ? `/app/temario?slug=${encodeURIComponent(cursoSlug)}`
    : "/app/cursos";
  const backLabel = cursoTitulo || "Volver";

  renderShell({
    persona,
    title: leccion.titulo,
    activePath: "/app/cursos",
    contentHtml: `
      <div class="leccion-progress-bar">
        <div class="leccion-progress-bar__fill" style="width: ${pctChapter}%;"></div>
      </div>

      <article class="leccion-page">
        <header class="leccion-page__header">
          <a href="${backHref}" class="page-back">
            ${icon("chevronLeft")}
            <span>${escapeHtml(backLabel)}</span>
          </a>
          ${capitulo ? `
            <div class="leccion-page__crumb">
              <span class="leccion-page__crumb-cap">Capítulo ${capitulo.orden} · ${escapeHtml(capitulo.titulo)}</span>
              <span class="leccion-page__crumb-sep">·</span>
              <span class="leccion-page__crumb-leccion">Lección ${leccion.orden} de ${totalLecc}</span>
            </div>
          ` : ""}
          <div class="leccion-page__tipo">
            ${icon(lessonIcon(leccion.tipo))}
            <span>${escapeHtml(lessonTipoLabel(leccion.tipo))}</span>
            ${leccion.etiqueta ? `<span class="leccion-page__etiqueta">${escapeHtml(leccion.etiqueta)}</span>` : ""}
          </div>
          <h2 class="page-title leccion-page__title">${escapeHtml(leccion.titulo)}</h2>
        </header>

        <div class="leccion-page__body">
          ${renderContent(leccion)}
        </div>

        <footer class="leccion-page__footer">
          <div>
            ${prevId
              ? `<a class="btn btn-ghost" href="/app/leccion?id=${encodeURIComponent(prevId)}">
                   ${icon("arrowLeft")}
                   <span>Anterior</span>
                 </a>`
              : ""}
          </div>
          <div class="leccion-page__cta">
            ${renderCta(leccion, inscripcionId, nextId, backHref)}
          </div>
        </footer>
      </article>
    `,
  });

  wireCtaButtons(leccion, inscripcionId, nextId, backHref);
}

/**
 * Decide qué CTA mostrar:
 * - Si la lección NO está completada y hay siguiente: "Marcar y siguiente"
 *   (botón principal único).
 * - Si la lección NO está completada y NO hay siguiente: "Marcar como completada"
 *   (último capítulo completado → vuelve al curso).
 * - Si ya está completada y hay siguiente: "Siguiente".
 * - Si ya está completada y NO hay siguiente: "Volver al curso".
 */
function renderCta(leccion, inscripcionId, nextId, backHref) {
  if (!leccion.completada && nextId) {
    return `
      <button class="btn btn-accent" id="completeNextBtn" type="button">
        <span>Marcar y siguiente</span>
        ${icon("arrowRight")}
      </button>
    `;
  }
  if (!leccion.completada && !nextId) {
    return `
      <button class="btn btn-accent" id="completeBtn" type="button">
        <span>Marcar como completada</span>
        ${icon("check")}
      </button>
    `;
  }
  if (leccion.completada && nextId) {
    return `
      <a class="btn btn-accent" href="/app/leccion?id=${encodeURIComponent(nextId)}">
        <span>Siguiente lección</span>
        ${icon("arrowRight")}
      </a>
      <span class="leccion-done-pill">${icon("check")} Completada</span>
    `;
  }
  return `
    <a class="btn btn-accent" href="${backHref}">
      <span>Volver al temario</span>
      ${icon("arrowRight")}
    </a>
    <span class="leccion-done-pill">${icon("check")} Completada</span>
  `;
}

function wireCtaButtons(leccion, inscripcionId, nextId, backHref) {
  const completeNextBtn = document.getElementById("completeNextBtn");
  const completeBtn = document.getElementById("completeBtn");

  async function markAsCompleted() {
    return await api.marcarLeccion(leccion.id, inscripcionId);
  }

  completeNextBtn?.addEventListener("click", async () => {
    completeNextBtn.disabled = true;
    completeNextBtn.innerHTML = `<span>Guardando…</span>`;
    try {
      await markAsCompleted();
      // Navegar a la siguiente lección
      location.href = `/app/leccion?id=${encodeURIComponent(nextId)}`;
    } catch (err) {
      console.error("marcar-leccion error:", err);
      completeNextBtn.disabled = false;
      completeNextBtn.innerHTML = `<span>Reintentar</span> ${icon("arrowRight")}`;
      alert(`No se pudo marcar: ${err.message}`);
    }
  });

  completeBtn?.addEventListener("click", async () => {
    completeBtn.disabled = true;
    completeBtn.innerHTML = `<span>Guardando…</span>`;
    try {
      await markAsCompleted();
      // Sin siguiente: volver al temario
      location.href = backHref;
    } catch (err) {
      console.error("marcar-leccion error:", err);
      completeBtn.disabled = false;
      completeBtn.innerHTML = `<span>Reintentar</span> ${icon("check")}`;
      alert(`No se pudo marcar: ${err.message}`);
    }
  });
}

function renderContent(l) {
  const html = l.contenidoHTML || "";
  const tipo = (l.tipo || "texto").toLowerCase();

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
          ? `<a class="btn btn-secondary" href="${escapeHtml(l.archivoUrl)}" target="_blank" rel="noopener" style="margin-top:var(--s-4);">
               ${icon("download")}
               <span>Abrir ${escapeHtml(l.archivoNombre || "documento")}</span>
             </a>`
          : ""}
      `;
    case "enlace":
      return `
        ${html ? `<div class="leccion-html">${html}</div>` : ""}
        ${l.urlExterna
          ? `<a class="btn btn-accent" href="${escapeHtml(l.urlExterna)}" target="_blank" rel="noopener" style="margin-top:var(--s-4);">
               ${icon("external")}
               <span>Abrir enlace</span>
             </a>`
          : ""}
      `;
    case "sesion_live":
    case "sesion-live":
    case "live":
      return `
        ${html ? `<div class="leccion-html">${html}</div>` : ""}
        ${l.urlExterna
          ? `<a class="btn btn-accent" href="${escapeHtml(l.urlExterna)}" target="_blank" rel="noopener" style="margin-top:var(--s-4);">
               ${icon("lessonLive")}
               <span>Unirme a la sesión</span>
             </a>`
          : `<p style="color:var(--color-text-muted);">El enlace a la sesión aparecerá aquí cuando se publique.</p>`}
      `;
    default:
      return html
        ? `<div class="leccion-html">${html}</div>`
        : `<p style="color:var(--color-text-muted);">Sin contenido.</p>`;
  }
}

function renderVideoEmbed(url) {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]+)/);
  if (yt) {
    return `<div class="video-embed"><iframe src="https://www.youtube.com/embed/${yt[1]}" frameborder="0" allowfullscreen></iframe></div>`;
  }
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) {
    return `<div class="video-embed"><iframe src="https://player.vimeo.com/video/${vm[1]}" frameborder="0" allowfullscreen></iframe></div>`;
  }
  return `<video src="${escapeHtml(url)}" controls style="width:100%;border-radius:var(--r-lg);"></video>`;
}
