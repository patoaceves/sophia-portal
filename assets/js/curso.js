// SOPHIA Portal — Dashboard del curso
// Vista de overview que se ve al entrar a un curso. Muestra tarjetas para
// las distintas herramientas: test inicial, temario, autoevaluaciones, recursos.
// Las lecciones individuales viven en /app/temario.

import { requireAuth } from "./auth.js";
import { api, ApiError } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";
import { icon } from "./icons.js";

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  const params = new URLSearchParams(location.search);
  const slug = params.get("slug");

  if (!slug) {
    renderShell({
      persona,
      title: "Curso",
      contentHtml: emptyStateHtml(
        "Falta el curso",
        `No se proporcionó un slug. <a href="/app/cursos">Volver a mis cursos</a>.`,
      ),
    });
    return;
  }

  // Skeleton mientras carga
  renderShell({
    persona,
    title: "Cargando…",
    activePath: "/app/cursos",
    contentHtml: `<div class="spinner" style="margin: 60px auto;"></div>`,
  });

  try {
    const data = await api.curso(slug);
    let resultadoTest = null;
    try {
      resultadoTest = await api.resultadosTest();
    } catch {
      // sin resultados aún — no es error
    }
    renderDashboard(persona, data, resultadoTest);
  } catch (e) {
    console.error("get-curso failed:", e);
    document.querySelector(".app-main").innerHTML = emptyStateHtml(
      "No pudimos cargar este curso",
      escapeHtml(e.message || "Intenta recargar."),
      e instanceof ApiError && e.status === 403
        ? `<a href="/app/cursos" class="btn btn-secondary" style="margin-top:var(--s-4);">Volver a mis cursos</a>`
        : "",
    );
  }
})();

function renderDashboard(persona, payload, resultadoTest) {
  const { curso, inscripcion, capitulos } = payload;

  // Si Airtable aún no tiene la portada subida, fallback a /assets/img/<slug>/portada.png
  // (la convención de carpetas es: assets/img/<slug>/ contiene los assets del curso)
  const coverUrl = curso.coverUrl || resolveLocalCover(curso.slug);

  const totalLecciones = capitulos.reduce((s, c) => s + c.lecciones.length, 0);
  const completadas = capitulos.reduce(
    (s, c) => s + c.lecciones.filter((l) => l.completada).length,
    0,
  );
  const progresoPct = totalLecciones > 0
    ? Math.round((completadas / totalLecciones) * 100)
    : 0;

  // Próxima lección sin completar (para botón "continuar")
  const proximaLeccion = findNextLeccion(capitulos);

  // Conteo de autoevaluaciones (lecciones tipo test/autoeval) y completadas
  const autoLecciones = capitulos.flatMap((c) =>
    c.lecciones.filter((l) => l.tipo === "test" || l.tipo === "autoeval"),
  );
  const autoCompletadas = autoLecciones.filter((l) => l.completada).length;

  // Test de Felicidad: detectar si el curso lo incluye y el estado del usuario
  // Por convención el curso "Happiness Workshop" siempre tiene un test de
  // felicidad. Lo detectamos buscando una lección tipo test con etiqueta
  // o título que mencione "felicidad", o usando el resultado del test si existe.
  const testFelicidadLeccion = autoLecciones.find((l) =>
    /felicidad/i.test(l.titulo) || /pre[-_ ]?test/i.test(l.etiqueta || ""),
  );
  const testFelicidadCompletado = !!resultadoTest?.tieneResultados;

  renderShell({
    persona,
    title: curso.titulo,
    activePath: "/app/cursos",
    contentHtml: `
      <div class="curso-hero" ${coverUrl ? `style="--curso-cover: url('${escapeHtml(coverUrl)}');"` : ""}>
        <div class="curso-hero__overlay">
          <a href="/app/cursos" class="curso-hero__back">
            ${icon("chevronLeft")}
            <span>Mis cursos</span>
          </a>
          <div class="curso-hero__content">
            <span class="curso-hero__eyebrow">${escapeHtml(curso.modalidad || "Curso")}</span>
            <h2 class="curso-hero__title">${escapeHtml(curso.titulo)}</h2>
            ${curso.descripcionCorta ? `<p class="curso-hero__lead">${escapeHtml(curso.descripcionCorta)}</p>` : ""}
            <div class="curso-hero__meta">
              ${curso.instructor ? `<span>${icon("instructor")} ${escapeHtml(curso.instructor)}</span>` : ""}
              ${curso.fechaInicio ? `<span>${icon("fecha")} ${escapeHtml(formatDate(curso.fechaInicio))}</span>` : ""}
            </div>
          </div>
        </div>
      </div>

      <section class="curso-progress-row">
        <div class="curso-progress-row__left">
          <span class="curso-progress-row__label">Tu avance</span>
          <span class="curso-progress-row__pct">${progresoPct}%</span>
          <span class="curso-progress-row__detail">${completadas} de ${totalLecciones} lecciones completadas</span>
        </div>
        ${proximaLeccion
          ? `<a class="btn btn-accent" href="/app/leccion?id=${encodeURIComponent(proximaLeccion.id)}">
               ${progresoPct === 0 ? "Comenzar" : "Continuar"}
               ${icon("arrowRight")}
             </a>`
          : `<span class="btn btn-ghost" style="cursor:default;">${icon("check")} Curso completado</span>`}
      </section>
      <div class="curso-progress-bar">
        <div class="curso-progress-bar__fill" style="width: ${progresoPct}%;"></div>
      </div>

      <section class="dashboard-grid">
        <h3 class="dashboard-grid__title">Herramientas del curso</h3>
        <div class="dashboard-grid__cards">

          ${testFelicidadLeccion ? renderTestCard(
            testFelicidadLeccion,
            testFelicidadCompletado,
            inscripcion.id,
            resultadoTest,
          ) : ""}

          ${renderTemarioCard(slug(), capitulos, completadas, totalLecciones)}

          ${renderAutoevalCard(autoLecciones, autoCompletadas)}

          ${renderRecursosCard()}

        </div>
      </section>
    `,
  });
}

function renderTestCard(leccion, completado, inscripcionId, resultado) {
  const linkToTest = `/app/test-felicidad?inscripcion=${encodeURIComponent(inscripcionId)}&leccion=${encodeURIComponent(leccion.id)}`;
  const linkToResults = resultado?.respuestaId
    ? `/app/test-felicidad/resultados?id=${encodeURIComponent(resultado.respuestaId)}`
    : `/app/test-felicidad/resultados`;

  return `
    <article class="tool-card ${completado ? "is-done" : ""}">
      <div class="tool-card__icon">${icon("test")}</div>
      <div class="tool-card__body">
        <span class="tool-card__eyebrow">${completado ? "Completado" : "Empieza aquí"}</span>
        <h4 class="tool-card__title">Test de Felicidad</h4>
        <p class="tool-card__desc">${completado
          ? "Ya tomaste tu evaluación inicial. Revisa tus resultados y compáralos al terminar el curso."
          : "Una autoevaluación de 16 preguntas en 8 pilares. Te toma ~5 min y recibes un análisis personalizado."}</p>
      </div>
      <div class="tool-card__action">
        ${completado
          ? `<a class="btn btn-secondary btn-sm" href="${linkToResults}">Ver resultados</a>
             <a class="btn btn-ghost btn-sm" href="${linkToTest}">Volver a tomar</a>`
          : `<a class="btn btn-accent btn-sm" href="${linkToTest}">Tomar el test</a>`}
      </div>
    </article>
  `;
}

function renderTemarioCard(currentSlug, capitulos, completadas, total) {
  const numCaps = capitulos.length;
  const lockText = numCaps === 0 ? "Próximamente disponible" : `${numCaps} ${numCaps === 1 ? "capítulo" : "capítulos"} · ${total} ${total === 1 ? "lección" : "lecciones"}`;
  return `
    <article class="tool-card ${total === completadas && total > 0 ? "is-done" : ""}">
      <div class="tool-card__icon">${icon("temario")}</div>
      <div class="tool-card__body">
        <span class="tool-card__eyebrow">Contenido principal</span>
        <h4 class="tool-card__title">Temario</h4>
        <p class="tool-card__desc">${escapeHtml(lockText)}. Avanza a tu ritmo, las lecciones quedan disponibles en cualquier momento.</p>
      </div>
      <div class="tool-card__action">
        <a class="btn btn-primary btn-sm" href="/app/temario?slug=${encodeURIComponent(currentSlug)}">
          ${completadas > 0 ? "Continuar" : "Empezar"}
          ${icon("arrowRight")}
        </a>
      </div>
    </article>
  `;
}

function renderAutoevalCard(autoLecciones, completadas) {
  const total = autoLecciones.length;
  if (total === 0) {
    return `
      <article class="tool-card is-disabled">
        <div class="tool-card__icon">${icon("autoevaluacion")}</div>
        <div class="tool-card__body">
          <span class="tool-card__eyebrow">Por capítulo</span>
          <h4 class="tool-card__title">Autoevaluaciones</h4>
          <p class="tool-card__desc">Cuando los capítulos incluyan autoevaluaciones aparecerán aquí.</p>
        </div>
      </article>
    `;
  }
  const pct = Math.round((completadas / total) * 100);
  return `
    <article class="tool-card">
      <div class="tool-card__icon">${icon("autoevaluacion")}</div>
      <div class="tool-card__body">
        <span class="tool-card__eyebrow">Tu seguimiento</span>
        <h4 class="tool-card__title">Autoevaluaciones</h4>
        <p class="tool-card__desc">${completadas} de ${total} completadas. Cada autoevaluación te ayuda a integrar lo aprendido en cada capítulo.</p>
        <div class="tool-card__progress">
          <div class="tool-card__progress-fill" style="width: ${pct}%;"></div>
        </div>
      </div>
    </article>
  `;
}

function renderRecursosCard() {
  return `
    <article class="tool-card is-disabled">
      <div class="tool-card__icon">${icon("recursos")}</div>
      <div class="tool-card__body">
        <span class="tool-card__eyebrow">Próximamente</span>
        <h4 class="tool-card__title">Recursos y mensajes</h4>
        <p class="tool-card__desc">Material descargable, lecturas complementarias y mensajes del instructor llegarán aquí.</p>
      </div>
    </article>
  `;
}

// ──────── Helpers ────────

/**
 * Mapping de fallbacks locales para covers de curso. Si Airtable no tiene
 * la attachment subida, usamos el archivo en /assets/img/<slug>/portada.png
 * (convención de carpetas).
 */
const LOCAL_COVERS = new Set([
  "happiness-workshop",
]);

function resolveLocalCover(slug) {
  if (slug && LOCAL_COVERS.has(slug)) {
    return `/assets/img/${slug}/portada.png`;
  }
  return null;
}

function findNextLeccion(capitulos) {
  for (const c of capitulos) {
    for (const l of c.lecciones) {
      if (!l.completada) return l;
    }
  }
  return null;
}

function slug() {
  return new URLSearchParams(location.search).get("slug") || "";
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return iso;
  }
}

function emptyStateHtml(title, desc, extraHtml = "") {
  return `
    <div class="empty-state">
      <div class="empty-state__title">${title}</div>
      <p class="empty-state__desc">${desc}</p>
      ${extraHtml}
    </div>
  `;
}
