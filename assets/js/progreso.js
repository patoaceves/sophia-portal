// SOPHIA Portal · Mi progreso
//
// Vista panorámica del avance del alumno. Combina datos de get-mis-cursos
// (cursos inscritos + progreso por curso) con la respuesta del Test de
// Felicidad (si la tomó). En el futuro se le puede agregar racha de días,
// tiempo dedicado por capítulo, etc.

import { requireAuth } from "./auth.js";
import { api } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";
import { icon } from "./icons.js";
import { loaderHtml, startLoaderRotation } from "./loader.js";
import { mountRueda } from "./rueda.js";

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  renderShell({
    persona,
    title: "Mi progreso",
    activePath: "/app/progreso",
    contentHtml: loaderHtml({ context: "progreso" }),
  });
  const stopLoader = startLoaderRotation();

  try {
    const [misCursosResp, resultadoTest] = await Promise.all([
      api.misCursos(),
      api.resultadosTest().catch(() => null),
    ]);
    stopLoader();
    const cursos = misCursosResp?.cursos ?? [];
    renderProgreso(persona, cursos, resultadoTest);
  } catch (e) {
    stopLoader();
    document.querySelector(".app-main").innerHTML = `
      <div class="empty-state">
        <div class="empty-state__title">No pudimos cargar tu progreso</div>
        <p class="empty-state__desc">${escapeHtml(e.message || "Intenta recargar.")}</p>
      </div>
    `;
  }
})();

function renderProgreso(persona, cursos, resultadoTest) {
  // Aggregate stats across all courses
  const totalCursos     = cursos.length;
  const cursosCompletos = cursos.filter(c => (c.progresoPct || 0) >= 100).length;
  const cursosEnCurso   = cursos.filter(c => (c.progresoPct || 0) > 0 && (c.progresoPct || 0) < 100).length;

  const totalLecciones = cursos.reduce((s, c) => s + (c.totalLecciones || 0), 0);
  const leccionesDone  = cursos.reduce((s, c) => s + (c.leccionesCompletadas || 0), 0);
  const promedioPct    = totalCursos > 0
    ? Math.round(cursos.reduce((s, c) => s + (c.progresoPct || 0), 0) / totalCursos)
    : 0;

  const testTomado = !!resultadoTest?.tieneResultados;

  document.querySelector(".app-main").innerHTML = `
    <header class="page-header">
      <span class="page-eyebrow">Tu camino, en una vista</span>
      <h2 class="page-title">Mi progreso</h2>
      <p class="page-subtitle">
        Aquí ves todo lo que has avanzado: tus cursos en marcha, el ritmo
        de tu autoevaluación, y los hitos que vas conquistando.
      </p>
    </header>

    <section class="stats-grid">
      <article class="stat-card">
        <div class="stat-card__num">${promedioPct}%</div>
        <div class="stat-card__label">Avance promedio</div>
        <div class="stat-card__sub">en tus ${totalCursos} curso${totalCursos === 1 ? "" : "s"}</div>
      </article>
      <article class="stat-card">
        <div class="stat-card__num">${leccionesDone}<span class="stat-card__num-sub">/${totalLecciones}</span></div>
        <div class="stat-card__label">Lecciones completadas</div>
        <div class="stat-card__sub">${totalLecciones > 0 ? Math.round(leccionesDone * 100 / totalLecciones) : 0}% del total</div>
      </article>
      <article class="stat-card">
        <div class="stat-card__num">${cursosEnCurso}</div>
        <div class="stat-card__label">En curso</div>
        <div class="stat-card__sub">${cursosCompletos} completado${cursosCompletos === 1 ? "" : "s"}</div>
      </article>
      <article class="stat-card stat-card--accent">
        <div class="stat-card__num">${testTomado ? "✓" : "—"}</div>
        <div class="stat-card__label">Test de Felicidad</div>
        <div class="stat-card__sub">${testTomado ? "Tomado" : "Pendiente"}</div>
      </article>
    </section>

    ${testTomado ? renderRuedaSection(resultadoTest) : ""}

    <section class="progreso-cursos">
      <header class="progreso-cursos__header">
        <h3>Por curso</h3>
      </header>
      ${cursos.length === 0
        ? `<p class="empty-state__desc" style="text-align:center; padding: var(--s-8) 0;">No tienes cursos inscritos todavía.</p>`
        : `<div class="progreso-cursos__list">${cursos.map(renderCursoRow).join("")}</div>`
      }
    </section>
  `;

  if (testTomado) {
    requestAnimationFrame(() => {
      const svg = document.getElementById("progreso-rueda-svg");
      const tip = document.getElementById("progreso-rueda-tooltip");
      if (svg && tip) {
        mountRueda({ svg, tooltip: tip, scores: resultadoTest.scores, animate: true, compact: true });
      }
    });
  }
}

function renderRuedaSection(resultadoTest) {
  const fecha = resultadoTest.completedAt
    ? new Date(resultadoTest.completedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : "";

  return `
    <section class="progreso-rueda">
      <div class="progreso-rueda__chart">
        <svg id="progreso-rueda-svg" class="rueda-svg-preview"></svg>
        <div class="rueda-tooltip" id="progreso-rueda-tooltip">
          <div class="rueda-tooltip__title"></div>
          <div class="rueda-tooltip__score"></div>
        </div>
      </div>
      <div class="progreso-rueda__body">
        <span class="progreso-rueda__eyebrow">Tu autoevaluación · ${escapeHtml(fecha)}</span>
        <h3 class="progreso-rueda__title">Tu diagrama de felicidad</h3>
        <p class="progreso-rueda__lead">
          La fotografía de tu bienestar al inicio del programa. Vuélvela a tomar
          al cerrar el Workshop para ver cuánto cambió.
        </p>
        <a class="btn btn-secondary btn-sm" href="/app/test-felicidad/resultados?id=${encodeURIComponent(resultadoTest.respuestaId)}">
          <span>Ver análisis completo</span>
          ${icon("arrowRight")}
        </a>
      </div>
    </section>
  `;
}

function renderCursoRow(c) {
  const pct = Math.round(c.progresoPct || 0);
  return `
    <a class="curso-row" href="/app/curso?slug=${encodeURIComponent(c.slug)}">
      <div class="curso-row__body">
        <h4 class="curso-row__title">${escapeHtml(c.titulo)}</h4>
        <p class="curso-row__meta">${c.leccionesCompletadas || 0} / ${c.totalLecciones || 0} lecciones</p>
      </div>
      <div class="curso-row__progress">
        <div class="curso-row__bar">
          <div class="curso-row__bar-fill" style="width: ${pct}%;"></div>
        </div>
        <div class="curso-row__pct">${pct}%</div>
      </div>
      <span class="curso-row__chevron">${icon("chevronRight")}</span>
    </a>
  `;
}
