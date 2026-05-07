// SOPHIA Portal — Temario del curso (lista de capítulos y lecciones)

import { requireAuth } from "./auth.js";
import { api, ApiError } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";
import { icon, lessonIcon, lessonTipoLabel } from "./icons.js";

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  const params = new URLSearchParams(location.search);
  const slug = params.get("slug");

  if (!slug) {
    renderShell({
      persona,
      title: "Temario",
      activePath: "/app/cursos",
      contentHtml: `
        <div class="empty-state">
          <div class="empty-state__title">Falta el curso</div>
          <p class="empty-state__desc">No se proporcionó un slug. <a href="/app/cursos">Volver a mis cursos</a>.</p>
        </div>
      `,
    });
    return;
  }

  renderShell({
    persona,
    title: "Cargando temario…",
    activePath: "/app/cursos",
    contentHtml: `<div class="spinner" style="margin: 60px auto;"></div>`,
  });

  try {
    const data = await api.curso(slug);
    renderTemario(persona, slug, data);
  } catch (e) {
    console.error("get-curso failed:", e);
    document.querySelector(".app-main").innerHTML = `
      <div class="empty-state">
        <div class="empty-state__title">No pudimos cargar el temario</div>
        <p class="empty-state__desc">${escapeHtml(e.message || "Intenta recargar.")}</p>
        ${e instanceof ApiError && e.status === 403
          ? `<a href="/app/cursos" class="btn btn-secondary" style="margin-top:var(--s-4);">Volver a mis cursos</a>`
          : ""}
      </div>
    `;
  }
})();

function renderTemario(persona, slug, payload) {
  const { curso, inscripcion, capitulos } = payload;

  const totalLecciones = capitulos.reduce((s, c) => s + c.lecciones.length, 0);
  const completadas = capitulos.reduce(
    (s, c) => s + c.lecciones.filter((l) => l.completada).length,
    0,
  );
  const progresoPct = totalLecciones > 0
    ? Math.round((completadas / totalLecciones) * 100)
    : 0;

  renderShell({
    persona,
    title: `Temario · ${curso.titulo}`,
    activePath: "/app/cursos",
    contentHtml: `
      <header class="page-header page-header--with-back">
        <a href="/app/curso?slug=${encodeURIComponent(slug)}" class="page-back">
          ${icon("chevronLeft")}
          <span>${escapeHtml(curso.titulo)}</span>
        </a>
        <h2 class="page-title">Temario</h2>
        <p class="page-subtitle">
          ${capitulos.length} ${capitulos.length === 1 ? "capítulo" : "capítulos"} ·
          ${totalLecciones} ${totalLecciones === 1 ? "lección" : "lecciones"} ·
          ${progresoPct}% completado
        </p>
        <div class="curso-progress-bar" style="margin-top: var(--s-4);">
          <div class="curso-progress-bar__fill" style="width: ${progresoPct}%;"></div>
        </div>
      </header>

      <div class="curso-capitulos">
        ${capitulos.map(renderCapitulo).join("")}
      </div>
    `,
  });
}

function renderCapitulo(cap) {
  const totalLecc = cap.lecciones.length;
  const doneLecc = cap.lecciones.filter((l) => l.completada).length;
  const pct = totalLecc > 0 ? Math.round((doneLecc / totalLecc) * 100) : 0;
  return `
    <section class="capitulo-card">
      <header class="capitulo-card__header">
        <div>
          <div class="capitulo-card__num">Capítulo ${cap.orden}</div>
          <h3 class="capitulo-card__title">${escapeHtml(cap.titulo)}</h3>
          ${cap.descripcion ? `<p class="capitulo-card__desc">${escapeHtml(cap.descripcion)}</p>` : ""}
        </div>
        <div class="capitulo-card__progress">${doneLecc} / ${totalLecc}</div>
      </header>
      <div class="capitulo-card__bar">
        <div class="capitulo-card__bar-fill" style="width: ${pct}%;"></div>
      </div>
      <ol class="leccion-list">
        ${cap.lecciones.map(renderLeccion).join("")}
      </ol>
    </section>
  `;
}

function renderLeccion(l) {
  return `
    <li class="leccion-item ${l.completada ? "is-done" : ""}">
      <a href="/app/leccion?id=${encodeURIComponent(l.id)}" class="leccion-item__link">
        <span class="leccion-item__check" aria-hidden="true">
          ${l.completada ? icon("check") : ""}
        </span>
        <div class="leccion-item__body">
          <div class="leccion-item__title">${escapeHtml(l.titulo)}</div>
          <div class="leccion-item__meta">
            <span class="leccion-item__tipo">
              ${icon(lessonIcon(l.tipo))}
              <span>${escapeHtml(lessonTipoLabel(l.tipo))}</span>
            </span>
            ${l.etiqueta ? `<span class="leccion-item__etiqueta">${escapeHtml(l.etiqueta)}</span>` : ""}
          </div>
        </div>
        <span class="leccion-item__chevron">${icon("chevronRight")}</span>
      </a>
    </li>
  `;
}
