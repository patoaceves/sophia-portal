// SOPHIA Portal · Resultados del Test de Felicidad

import { requireAuth } from "./auth.js";
import { api } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";
import { loaderHtml, startLoaderRotation } from "./loader.js";
import { mountRueda, RUEDA_AXES } from "./rueda.js";

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  const params = new URLSearchParams(location.search);
  const respuestaId = params.get("id");

  renderShell({
    persona,
    title: "Resultados · Test de Felicidad",
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
    renderResultados(persona, data);
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

function renderResultados(persona, data) {
  const { scores, analisis, pilarNombres, completedAt } = data;
  const fecha = completedAt
    ? new Date(completedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : "";

  const pilaresKeys = Object.keys(scores);
  const avg = pilaresKeys.reduce((s, k) => s + (scores[k] || 0), 0) / pilaresKeys.length;
  const avgPct = Math.round(((avg - 2) / 8) * 100);

  document.querySelector(".app-main").innerHTML = `
    <header class="page-header">
      <span class="page-eyebrow">Tu autoevaluación · ${escapeHtml(fecha)}</span>
      <h2 class="page-title">Tu rueda de la felicidad</h2>
      <p class="page-subtitle">
        Cada pilar refleja un área de tu vida. No hay puntajes "buenos" o "malos" ,
        son señales de dónde estás hoy y dónde puedes nutrir más.
      </p>
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
        <div class="summary-stat">
          <div class="summary-stat__num">${avgPct}%</div>
          <div class="summary-stat__label">Promedio general</div>
        </div>
        <p class="summary-text">
          <strong>Tu pilar más fuerte:</strong> ${escapeHtml(strongestPilar(scores, pilarNombres))}<br>
          <strong>Tu pilar más vulnerable:</strong> ${escapeHtml(weakestPilar(scores, pilarNombres))}
        </p>
      </div>
    </section>

    <section class="resultados-bloques">
      ${renderBloques(scores, analisis)}
    </section>

    <footer class="resultados-footer">
      <a class="btn btn-secondary" href="/app/cursos">Volver a mis cursos</a>
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
  return k ? (nombres?.[k] || k) : ",";
}

function weakestPilar(scores, nombres) {
  const sorted = Object.entries(scores).sort((a, b) => a[1] - b[1]);
  const k = sorted[0]?.[0];
  return k ? (nombres?.[k] || k) : ",";
}
