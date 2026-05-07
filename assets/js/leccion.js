// SOPHIA Portal — Lección (player de contenido con checkpoints visuales)

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
    contentHtml: `<div style="display:grid;place-items:center;padding:80px 0;"><div class="spinner spinner--wheel"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div></div>`,
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

  // Test felicidad: redirige al wizard
  if (leccionData.leccion.tipo === "test" || leccionData.leccion.tipo === "autoeval") {
    const testUrl =
      `/app/test-felicidad?inscripcion=${encodeURIComponent(leccionData.inscripcionId)}` +
      `&leccion=${encodeURIComponent(leccionData.leccion.id)}`;
    location.href = testUrl;
    return;
  }

  // Necesitamos el contexto del curso para los checkpoints del capítulo
  let cursoContext = null;
  try { cursoContext = await fetchCursoContext(leccionData.cursoId); } catch (e) {
    console.warn("Could not fetch curso context for checkpoints:", e);
  }

  renderLeccion(persona, leccionData, cursoContext);
})();

async function fetchCursoContext(cursoId) {
  const { cursos } = await api.misCursos();
  const c = cursos.find((x) => x.id === cursoId);
  if (!c) return null;
  const detalle = await api.curso(c.slug);
  return { ...detalle, slug: c.slug };
}

function renderLeccion(persona, payload, cursoContext) {
  const { leccion, capituloId, capitulo: capInfo, cursoId, inscripcionId, prevId, nextId } = payload;

  // Encontrar el capítulo en el contexto del curso (para conocer todas las lecciones)
  let capCompleto = null;
  let cursoSlug = "";
  let cursoTitulo = "";
  if (cursoContext) {
    capCompleto = cursoContext.capitulos.find((c) => c.id === capituloId);
    cursoSlug = cursoContext.slug;
    cursoTitulo = cursoContext.curso.titulo;
  }

  const capLecciones = capCompleto?.lecciones ?? [];
  const idxHere = capLecciones.findIndex((l) => l.id === leccion.id);
  const ponente = capInfo?.ponente || capCompleto?.ponente || "";

  const backHref = cursoSlug
    ? `/app/curso?slug=${encodeURIComponent(cursoSlug)}&tab=temario`
    : "/app/cursos";
  const backLabel = cursoTitulo ? `${cursoTitulo} · Temario` : "Volver";

  renderShell({
    persona,
    title: leccion.titulo,
    activePath: "/app/cursos",
    contentHtml: `
      ${renderCheckpointBar(capLecciones, idxHere, leccion)}

      <article class="leccion-page">
        <header class="leccion-page__header">
          <a href="${backHref}" class="page-back">
            ${icon("chevronLeft")}
            <span>${escapeHtml(backLabel)}</span>
          </a>
          ${capInfo || capCompleto ? `
            <div class="leccion-page__crumb">
              <span class="leccion-page__crumb-cap">Capítulo ${capInfo?.orden ?? capCompleto?.orden} · ${escapeHtml(capInfo?.titulo ?? capCompleto?.titulo ?? "")}</span>
              ${capLecciones.length > 0 ? `
                <span class="leccion-page__crumb-sep">·</span>
                <span class="leccion-page__crumb-leccion">Lección ${leccion.orden} de ${capLecciones.length}</span>
              ` : ""}
            </div>
          ` : ""}
          <div class="leccion-page__tipo">
            ${icon(lessonIcon(leccion.tipo))}
            <span>${escapeHtml(lessonTipoLabel(leccion.tipo))}</span>
            ${leccion.etiqueta ? `<span class="leccion-page__etiqueta">${escapeHtml(leccion.etiqueta)}</span>` : ""}
          </div>
          <h2 class="page-title leccion-page__title">${escapeHtml(leccion.titulo)}</h2>
          ${ponente ? `
            <div class="leccion-page__ponente">
              ${icon("instructor")}
              <span><strong>Ponente:</strong> ${escapeHtml(ponente)}</span>
            </div>
          ` : ""}
        </header>

        <div class="leccion-page__body">
          ${renderContent(leccion)}
        </div>

        <footer class="leccion-page__footer">
          <div>
            ${prevId
              ? `<a class="btn btn-ghost" href="/app/leccion?id=${encodeURIComponent(prevId)}">
                   ${icon("arrowLeft")}<span>Anterior</span>
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
 * Barra de checkpoints. Un dot por cada lección del capítulo, con check
 * cuando está completada, dot lleno cuando es la actual, vacío cuando no
 * se ha tocado. Líneas conectoras entre dots.
 *
 * Si no hay contexto del capítulo (capLecciones vacío), fallback a barra
 * simple de progreso porcentual.
 */
function renderCheckpointBar(capLecciones, idxHere, currentLeccion) {
  if (capLecciones.length === 0) {
    return `<div class="leccion-progress-bar"><div class="leccion-progress-bar__fill" style="width: 50%;"></div></div>`;
  }

  return `
    <div class="checkpoint-bar">
      <ol class="checkpoint-bar__list">
        ${capLecciones.map((l, i) => {
          const isHere = i === idxHere;
          const isDone = l.completada;
          // Si la lección actual no está marcada done pero estamos en ella,
          // mostrarla como "current" (pendiente pero activa)
          const state = isHere && !isDone ? "current"
            : isDone ? "done"
            : i < idxHere ? "skipped"
            : "todo";
          return `
            <li class="checkpoint checkpoint--${state}">
              ${i > 0 ? `<span class="checkpoint__line ${state === "todo" ? "checkpoint__line--todo" : ""}"></span>` : ""}
              <a class="checkpoint__dot" href="/app/leccion?id=${encodeURIComponent(l.id)}"
                 title="${escapeHtml(l.titulo)}"
                 aria-current="${isHere ? "true" : "false"}">
                ${isDone ? icon("check") : ""}
                ${isHere && !isDone ? `<span class="checkpoint__pulse"></span>` : ""}
              </a>
              <span class="checkpoint__label">${escapeHtml(shortenTitle(l.titulo))}</span>
            </li>
          `;
        }).join("")}
      </ol>
    </div>
  `;
}

function shortenTitle(t) {
  if (!t) return "";
  if (t.length <= 22) return t;
  return t.slice(0, 22).trimEnd() + "…";
}

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
  const completeNext = document.getElementById("completeNextBtn");
  const complete = document.getElementById("completeBtn");

  async function mark() { return await api.marcarLeccion(leccion.id, inscripcionId); }

  completeNext?.addEventListener("click", async () => {
    completeNext.disabled = true;
    completeNext.innerHTML = `<span>Guardando…</span>`;
    try {
      await mark();
      location.href = `/app/leccion?id=${encodeURIComponent(nextId)}`;
    } catch (err) {
      console.error("marcar-leccion error:", err);
      completeNext.disabled = false;
      completeNext.innerHTML = `<span>Reintentar</span> ${icon("arrowRight")}`;
      alert(`No se pudo marcar: ${err.message}`);
    }
  });

  complete?.addEventListener("click", async () => {
    complete.disabled = true;
    complete.innerHTML = `<span>Guardando…</span>`;
    try {
      await mark();
      location.href = backHref;
    } catch (err) {
      console.error("marcar-leccion error:", err);
      complete.disabled = false;
      complete.innerHTML = `<span>Reintentar</span> ${icon("check")}`;
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
        ${l.archivoUrl ? `<a class="btn btn-secondary" href="${escapeHtml(l.archivoUrl)}" target="_blank" rel="noopener" style="margin-top:var(--s-4);">${icon("download")}<span>Abrir ${escapeHtml(l.archivoNombre || "documento")}</span></a>` : ""}
      `;
    case "enlace":
      return `
        ${html ? `<div class="leccion-html">${html}</div>` : ""}
        ${l.urlExterna ? `<a class="btn btn-accent" href="${escapeHtml(l.urlExterna)}" target="_blank" rel="noopener" style="margin-top:var(--s-4);">${icon("external")}<span>Abrir enlace</span></a>` : ""}
      `;
    case "sesion_live":
    case "sesion-live":
    case "live":
      return `
        ${html ? `<div class="leccion-html">${html}</div>` : ""}
        ${l.urlExterna ? `<a class="btn btn-accent" href="${escapeHtml(l.urlExterna)}" target="_blank" rel="noopener" style="margin-top:var(--s-4);">${icon("lessonLive")}<span>Unirme a la sesión</span></a>` : `<p style="color:var(--color-text-muted);">El enlace a la sesión aparecerá aquí cuando se publique.</p>`}
      `;
    default:
      return html ? `<div class="leccion-html">${html}</div>` : `<p style="color:var(--color-text-muted);">Sin contenido.</p>`;
  }
}

function renderVideoEmbed(url) {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]+)/);
  if (yt) return `<div class="video-embed"><iframe src="https://www.youtube.com/embed/${yt[1]}" frameborder="0" allowfullscreen></iframe></div>`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `<div class="video-embed"><iframe src="https://player.vimeo.com/video/${vm[1]}" frameborder="0" allowfullscreen></iframe></div>`;
  return `<video src="${escapeHtml(url)}" controls style="width:100%;border-radius:var(--r-lg);"></video>`;
}
