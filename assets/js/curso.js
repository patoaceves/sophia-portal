// SOPHIA Portal — Detalle de curso (player con índice de capítulos/lecciones)

import { requireAuth } from "./auth.js";
import { api } from "./api.js";
import { ApiError } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  const params = new URLSearchParams(location.search);
  const slug = params.get("slug");

  if (!slug) {
    renderShell({
      persona,
      title: "Curso",
      contentHtml: `
        <div class="empty-state">
          <div class="empty-state__title">Falta el curso</div>
          <p class="empty-state__desc">No se proporcionó un slug. <a href="/app/cursos">Volver a mis cursos</a>.</p>
        </div>
      `,
    });
    return;
  }

  // Skeleton mientras carga
  renderShell({
    persona,
    title: "Cargando curso…",
    contentHtml: `
      <header class="page-header">
        <a href="/app/cursos" style="color: var(--color-text-muted); font-size: 0.875rem;">← Volver a mis cursos</a>
      </header>
      <div id="cursoBody"><div class="spinner" style="margin: 40px auto;"></div></div>
    `,
  });

  try {
    const data = await api.curso(slug);
    renderCurso(persona, data);
  } catch (e) {
    console.error("get-curso failed:", e);
    document.getElementById("cursoBody").innerHTML = `
      <div class="empty-state">
        <div class="empty-state__title">No pudimos cargar este curso</div>
        <p class="empty-state__desc">${escapeHtml(e.message || "Intenta recargar.")}</p>
        ${e instanceof ApiError && e.status === 403
          ? `<p class="empty-state__desc"><a href="/app/cursos">Volver a mis cursos</a></p>` : ""}
      </div>
    `;
  }
})();

function renderCurso(persona, { curso, inscripcion, capitulos }) {
  // Re-render el shell con el título correcto
  renderShell({
    persona,
    title: curso.titulo,
    activePath: "/app/cursos",
    contentHtml: `
      <header class="page-header">
        <a href="/app/cursos" style="color: var(--color-text-muted); font-size: 0.875rem;">← Volver a mis cursos</a>
        <h2 class="page-title" style="margin-top: var(--s-3);">${escapeHtml(curso.titulo)}</h2>
        ${curso.descripcionCorta ? `<p class="page-subtitle">${escapeHtml(curso.descripcionCorta)}</p>` : ""}
        <div style="display:flex;gap:var(--s-4);margin-top:var(--s-4);font-size:0.875rem;color:var(--color-text-muted);">
          ${curso.instructor ? `<span>👤 ${escapeHtml(curso.instructor)}</span>` : ""}
          ${curso.modalidad ? `<span>📍 ${escapeHtml(curso.modalidad)}</span>` : ""}
          <span>📊 ${inscripcion.progresoPct || 0}% completado</span>
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
  const doneLecc = cap.lecciones.filter(l => l.completada).length;
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
      <ol class="leccion-list">
        ${cap.lecciones.map(renderLeccion).join("")}
      </ol>
    </section>
  `;
}

function renderLeccion(l) {
  const tipo = l.tipo || "texto";
  const tipoLabel = ({
    "video": "🎥 Video",
    "texto": "📖 Lectura",
    "documento": "📄 Documento",
    "enlace": "🔗 Enlace",
    "sesion_live": "🎤 Sesión en vivo",
    "test": "✏️ Autoevaluación",
    "tarea": "📝 Tarea",
  })[tipo] || tipo;

  return `
    <li class="leccion-item ${l.completada ? "is-done" : ""}">
      <a href="/app/leccion?id=${encodeURIComponent(l.id)}" class="leccion-item__link">
        <span class="leccion-item__check" aria-hidden="true">${l.completada ? "✓" : ""}</span>
        <div class="leccion-item__body">
          <div class="leccion-item__title">${escapeHtml(l.titulo)}</div>
          <div class="leccion-item__meta">
            <span>${tipoLabel}</span>
            ${l.etiqueta ? `<span>· ${escapeHtml(l.etiqueta)}</span>` : ""}
          </div>
        </div>
      </a>
    </li>
  `;
}
