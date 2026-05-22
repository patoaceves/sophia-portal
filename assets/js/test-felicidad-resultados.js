// SOPHIA Portal · Resultados del Test de Felicidad
//
// Dos modos:
//   1. IIFE (page mode): standalone en /app/test-felicidad/resultados.
//   2. Export: `renderTestFelicidadInto(container, respuestaId)` para
//      embed inline en lección.

import { requireAuth } from "./auth.js";
import { api } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";
import { loaderHtml, startLoaderRotation } from "./loader.js";
import { mountRueda, RUEDA_AXES } from "./rueda.js";
import { icon } from "./icons.js";

/**
 * Renderiza el resultado del Test de Felicidad inline dentro de un
 * container, sin header de página ni footer con CTA. Para usar desde
 * leccion.js después de completar el test.
 *
 * @param {HTMLElement} container
 * @param {string} [respuestaId] - opcional; si no viene, usa el último intento
 */
export async function renderTestFelicidadInto(container, respuestaId) {
  if (!container) return;
  container.innerHTML = `<div class="autoeval-inline-loading">Cargando resultados…</div>`;
  try {
    const data = await api.resultadosTest(respuestaId);
    if (!data.tieneResultados) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__title">Aún no has tomado el test</div>
        </div>`;
      return;
    }
    renderResultadosInline(container, data);
  } catch (e) {
    console.error("test-felicidad inline failed:", e);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__title">No pudimos cargar tus resultados</div>
        <p class="empty-state__desc">${escapeHtml(e.message || "Intenta recargar.")}</p>
      </div>`;
  }
}

function renderResultadosInline(container, data) {
  const { scores, analisis, pilarNombres, completedAt } = data;
  const fecha = completedAt
    ? new Date(completedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : "";

  // Generamos IDs únicos para esta instancia (por si hay múltiples en la
  // misma página por error). Usamos el container para query relativos.
  const uid = `tf${Math.random().toString(36).slice(2, 8)}`;

  container.innerHTML = `
    <div class="autoeval-inline-eyebrow">Tu autoevaluación · ${escapeHtml(fecha)}</div>
    <section class="resultados-overview">
      <div class="rueda-wrap">
        <svg id="rueda-svg-${uid}" class="rueda-svg-full"></svg>
        <div class="rueda-tooltip" id="rueda-tooltip-${uid}">
          <div class="rueda-tooltip__title"></div>
          <div class="rueda-tooltip__score"></div>
        </div>
      </div>
      <div class="resultados-summary">
        <h3 class="resultados-summary__title">Análisis de tu diagrama</h3>
        <div class="resultados-summary__pillars">
          <div class="resultados-summary__pillar">
            <span class="resultados-summary__pillar-label">Tu pilar más fuerte</span>
            <span class="resultados-summary__pillar-value resultados-summary__pillar-value--strong">${escapeHtml(strongestPilar(scores, pilarNombres))}</span>
          </div>
          <div class="resultados-summary__pillar">
            <span class="resultados-summary__pillar-label">Tu pilar más vulnerable</span>
            <span class="resultados-summary__pillar-value resultados-summary__pillar-value--weak">${escapeHtml(weakestPilar(scores, pilarNombres))}</span>
          </div>
        </div>
        <p class="resultados-summary__lead">${escapeHtml(buildHolisticAnalysis(scores, pilarNombres))}</p>
      </div>
    </section>

    <section class="resultados-bloques">
      ${renderBloques(scores, analisis)}
    </section>
  `;

  mountRueda({
    svg: document.getElementById(`rueda-svg-${uid}`),
    scores,
    pilarNombres,
    tooltipEl: document.getElementById(`rueda-tooltip-${uid}`),
  });
}

// ────────────────────────────────────────────────────────────────────
// Página standalone (IIFE) — solo en /app/test-felicidad/resultados
// ────────────────────────────────────────────────────────────────────

const isStandalonePage = location.pathname.includes("/test-felicidad/resultados");

if (isStandalonePage) (async () => {
  const persona = await requireAuth();
  if (!persona) return;

  const params = new URLSearchParams(location.search);
  const respuestaId = params.get("id");
  const cursoSlug = params.get("slug") || "";
  const nextLeccionId = params.get("next") || "";

  renderShell({
    persona,
    title: "Resultados - Test de Felicidad",
    activePath: "/app/cursos",
    contentHtml: loaderHtml({ context: "resultados" }),
  });
  const stopLoader = startLoaderRotation();

  try {
    const data = await api.resultadosTest(respuestaId);
    stopLoader();
    if (!data.tieneResultados) {
      document.querySelector(".app-main").innerHTML = `
        <div class="empty-state">
          <div class="empty-state__title">Aún no has tomado el test</div>
          <p class="empty-state__desc">Toma el Test de Felicidad para ver tu análisis personalizado.</p>
          <a href="/app/cursos" class="btn btn-accent" style="margin-top:var(--s-4);">Ir a mis cursos</a>
        </div>
      `;
      return;
    }
    renderResultados(persona, data, cursoSlug, nextLeccionId);
  } catch (e) {
    stopLoader();
    console.error("get-resultados-test failed:", e);
    document.querySelector(".app-main").innerHTML = `
      <div class="empty-state">
        <div class="empty-state__title">No pudimos cargar tus resultados</div>
        <p class="empty-state__desc">${escapeHtml(e.message || "Intenta recargar.")}</p>
      </div>
    `;
  }
})();

function renderResultados(persona, data, cursoSlug, nextLeccionId) {
  const { scores, analisis, pilarNombres, completedAt } = data;
  // Si viene `next` (desde el lesson context), el CTA primario apunta a la
  // siguiente lección (típicamente "Evaluación de la sesión"). Así el alumno
  // no se brinca el paso de evaluar al ponente al regresar al dashboard.
  // Si no viene next, fallback al curso o al listado de cursos.
  const hasNext = !!nextLeccionId;
  const backHref = hasNext
    ? `/app/leccion?id=${encodeURIComponent(nextLeccionId)}`
    : (cursoSlug ? `/app/curso?slug=${encodeURIComponent(cursoSlug)}` : "/app/cursos");
  const backLabel = hasNext
    ? "Continuar"
    : (cursoSlug ? "Volver a Mi Curso" : "Volver a mis cursos");
  // Si vamos "hacia adelante" (continuar al siguiente paso), el ícono va a la
  // derecha. Si regresamos al curso, va a la izquierda.
  const backIconHtml = hasNext
    ? `<span>${backLabel}</span>${icon("arrowRight")}`
    : `${icon("arrowLeft")}<span>${backLabel}</span>`;
  const backBtnClass = hasNext ? "btn btn-accent" : "btn btn-secondary";
  const fecha = completedAt
    ? new Date(completedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : "";

  const pilaresKeys = Object.keys(scores);
  const avg = pilaresKeys.reduce((s, k) => s + (scores[k] || 0), 0) / pilaresKeys.length;
  const avgPct = Math.round(((avg - 2) / 8) * 100);

  document.querySelector(".app-main").innerHTML = `
    <header class="page-header page-header--with-action">
      <div class="page-header__main">
        <span class="page-eyebrow">Tu autoevaluación · ${escapeHtml(fecha)}</span>
        <h2 class="page-title">Tu diagrama de felicidad</h2>
        <p class="page-subtitle">
          Cada pilar refleja un área de tu vida. No hay puntajes "buenos" o "malos" —
          son señales de dónde estás hoy y dónde puedes nutrir más.
        </p>
      </div>
      <a class="${backBtnClass} page-header__action" href="${backHref}">
        ${backIconHtml}
      </a>
    </header>

    <section class="resultados-overview">
      <div class="rueda-wrap">
        <svg id="rueda-svg" class="rueda-svg-full"></svg>
        <div class="rueda-tooltip" id="rueda-tooltip">
          <div class="rueda-tooltip__title"></div>
          <div class="rueda-tooltip__score"></div>
        </div>
      </div>
      <div class="resultados-summary">
        <h3 class="resultados-summary__title">Análisis de tu diagrama</h3>
        <div class="resultados-summary__pillars">
          <div class="resultados-summary__pillar">
            <span class="resultados-summary__pillar-label">Tu pilar más fuerte</span>
            <span class="resultados-summary__pillar-value resultados-summary__pillar-value--strong">${escapeHtml(strongestPilar(scores, pilarNombres))}</span>
          </div>
          <div class="resultados-summary__pillar">
            <span class="resultados-summary__pillar-label">Tu pilar más vulnerable</span>
            <span class="resultados-summary__pillar-value resultados-summary__pillar-value--weak">${escapeHtml(weakestPilar(scores, pilarNombres))}</span>
          </div>
        </div>
        <p class="resultados-summary__lead">${escapeHtml(buildHolisticAnalysis(scores, pilarNombres))}</p>
      </div>
    </section>

    <section class="resultados-bloques">
      ${renderBloques(scores, analisis)}
    </section>

    <footer class="resultados-footer">
      <a class="${backBtnClass}" href="${backHref}">${backIconHtml}</a>
    </footer>
  `;

  // Mount the wheel using the shared module
  mountRueda({
    svg: document.getElementById("rueda-svg"),
    tooltip: document.getElementById("rueda-tooltip"),
    scores,
    animate: true,
    compact: false,
  });

  // Stagger the bloques fade-in
  setTimeout(() => document.getElementById("col-fortaleza")?.classList.add("show"), 1800);
  setTimeout(() => document.getElementById("col-crecimiento")?.classList.add("show"), 2200);
  setTimeout(() => document.getElementById("col-vulnerable")?.classList.add("show"), 2600);
}

// ────────────────────────────────────────────────────────────────────
// 3 columnas: Fortaleza / Crecimiento / Vulnerable
// ────────────────────────────────────────────────────────────────────
function renderBloques(scores, analisis) {
  const fortaleza = [], crecimiento = [], vulnerable = [];

  RUEDA_AXES.forEach((a) => {
    const s = scores[a.key];
    if (typeof s !== "number") return;
    if (s >= 8 && s <= 10) fortaleza.push(a);
    else if (s >= 5 && s <= 7) crecimiento.push(a);
    else if (s >= 1 && s <= 4) vulnerable.push(a);
  });

  function cards(items) {
    if (!items.length) return `<div class="rueda-bloque__empty">Sin pilares en este rango</div>`;
    return items.map((a) => `
      <article class="rueda-card">
        <h4 class="rueda-card__title" style="color: ${a.color};">${escapeHtml(a.name)}</h4>
        <p class="rueda-card__text">${escapeHtml(analisis?.[a.key] || "Análisis no disponible.")}</p>
      </article>
    `).join("");
  }

  return `
    <div class="rueda-bloques-grid">
      <div class="rueda-bloque rueda-bloque--fortaleza" id="col-fortaleza">
        <div class="rueda-bloque__title">Fortaleza</div>
        ${cards(fortaleza)}
      </div>
      <div class="rueda-bloque rueda-bloque--crecimiento" id="col-crecimiento">
        <div class="rueda-bloque__title">En crecimiento</div>
        ${cards(crecimiento)}
      </div>
      <div class="rueda-bloque rueda-bloque--vulnerable" id="col-vulnerable">
        <div class="rueda-bloque__title">Vulnerable</div>
        ${cards(vulnerable)}
      </div>
    </div>
  `;
}

function strongestPilar(scores, nombres) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const k = sorted[0]?.[0];
  return k ? (nombres?.[k] || k) : "–";
}

function weakestPilar(scores, nombres) {
  const sorted = Object.entries(scores).sort((a, b) => a[1] - b[1]);
  const k = sorted[0]?.[0];
  return k ? (nombres?.[k] || k) : "–";
}

/**
 * Genera un párrafo de análisis holístico. Mira la dispersión de los
 * puntajes (cuán balanceada está tu rueda), el rango fuerte/débil y la
 * relación entre el pilar más fuerte y el más vulnerable.
 *
 * Los puntajes vienen en escala 2-10 (suma de dos preguntas Likert 1-5).
 * - Promedio alto (>7.5) + dispersión baja: rueda balanceada y nutrida
 * - Promedio alto + dispersión alta: hay un área que requiere atención
 * - Promedio medio: zona de cultivo, oportunidad amplia
 * - Promedio bajo: invitación a empezar por el pilar más fuerte
 */
function buildHolisticAnalysis(scores, nombres) {
  const values = Object.values(scores);
  if (values.length === 0) return "";
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const spread = max - min;

  const fuerte = strongestPilar(scores, nombres);
  const vulnerable = weakestPilar(scores, nombres);

  // Tier por promedio
  let tone;
  if (avg >= 8) tone = "alto";
  else if (avg >= 6.5) tone = "medio-alto";
  else if (avg >= 5) tone = "medio";
  else tone = "explorador";

  // Tier por dispersión
  const balanced = spread <= 2;

  // Construcción del texto según los tiers
  if (tone === "alto" && balanced) {
    return `Tu diagrama refleja una vida con cimientos firmes y bien distribuidos. Tu fortaleza en ${fuerte} convive con un cuidado parejo de tus otras áreas – eso habla de hábitos integrados, no de un solo pilar cargando con todo. La oportunidad ahora es sostener este equilibrio y profundizar, sin perder de vista ${vulnerable.toLowerCase()}, que aunque está cerca de las demás, podría ser tu próximo lugar de exploración.`;
  }
  if (tone === "alto" && !balanced) {
    return `Tu pilar más fuerte, ${fuerte}, está claramente nutrido y se nota. Sin embargo, hay una distancia notable con ${vulnerable.toLowerCase()}, lo que sugiere que estás invirtiendo mucho en ciertas áreas y descuidando otras. La invitación es a llevar parte de la energía que ya sabes generar hacia el pilar más vulnerable – no para descuidar tu fortaleza, sino para que el conjunto te sostenga.`;
  }
  if (tone === "medio-alto") {
    return `Tu rueda muestra una base sólida con espacios claros de crecimiento. ${fuerte} es tu ancla y eso es una buena señal: ya sabes lo que se siente cuidar bien un área. ${vulnerable} aparece como tu invitación más directa – no como déficit, sino como el lugar donde el siguiente módulo puede florecer. Pequeños movimientos consistentes ahí mueven mucho el conjunto.`;
  }
  if (tone === "medio") {
    return `Tu diagrama dice algo importante: estás en una zona de cultivo. Ningún pilar está abandonado, pero ninguno está en su mejor momento tampoco. ${fuerte} es por dónde empezar a sostenerte – usa lo que ya funciona ahí como punto de apoyo. ${vulnerable} merece atención específica, idealmente con una práctica concreta y sostenida más que con un cambio drástico.`;
  }
  // explorador (avg < 5)
  return `Tu diagrama refleja un momento de exploración. Es honesto y vale la pena reconocerlo: estás registrando dónde estás hoy, no dónde "deberías" estar. Empieza por ${fuerte} – incluso si no se siente fuerte, es tu mayor punto de apoyo. ${vulnerable} probablemente requiere acompañamiento o una decisión estructural, no solo voluntad. Este es un buen lugar desde el cual empezar.`;
}
