// SOPHIA Portal · Resultados de la Escala RYFF de Bienestar Psicologico.
//
// Dos modos:
//   1. IIFE (page mode): /app/ryff/resultados?id=<UUID>[&slug=<curso>]
//   2. Export renderRyffResultadosInto(container, respuestaId): monta los
//      mismos resultados en cualquier container (sin shell ni redirect).
//
// Muestra: radar de 6 ejes + indice global + desglose por dimension (banda,
// lead y siguiente paso). Todo el texto viene de ryff-defs.js; el backend
// solo aporta numeros + etiqueta de banda.

import { requireAuth } from "./auth.js";
import { api } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";
import { loaderHtml, startLoaderRotation } from "./loader.js";
import { icon } from "./icons.js";
import { mountRadar } from "./radar.js";
import { DIMS, NOTE, bandaColor, bandaLabel, getDim, bandTextFor } from "./ryff-defs.js";

const ACCENT = "#7A5BB0";

// Arma el arreglo de dims para el radar a partir de los resultados del backend.
function radarDims(dimensiones) {
  return DIMS.map((d) => ({
    key: d.key,
    nombre: d.nombreDisplay,
    color: d.accentColor,
    pct: dimensiones?.[d.key]?.pct ?? 0,
  }));
}

function fmtFecha(iso) {
  return iso
    ? new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : "";
}

// ── Markup compartido del bloque de resultados ──
function resultadosHtml(data, { embedded = false } = {}) {
  const { dimensiones, global, completedAt } = data;
  const fecha = fmtFecha(completedAt);
  const globalPct = global?.pct ?? 0;
  const globalBanda = global?.banda ?? "";

  const dimCards = DIMS.map((d) => {
    const r = dimensiones?.[d.key] || { pct: 0, banda: "" };
    const txt = bandTextFor(d.key, r.banda);
    const color = d.accentColor;
    return `
      <article class="ryff-dim" style="--dim-color:${color};">
        <div class="ryff-dim__head">
          <div class="ryff-dim__name">${escapeHtml(d.nombreDisplay)}</div>
          <div class="ryff-dim__pct">${r.pct}%</div>
        </div>
        <div class="ryff-dim__bar"><div class="ryff-dim__bar-fill" style="width:${r.pct}%;"></div></div>
        <div class="ryff-dim__band autoeval-band-tag" style="color:${bandaColor(r.banda)};">
          ${escapeHtml(bandaLabel(r.banda))}
        </div>
        <p class="ryff-dim__desc">${escapeHtml(d.descripcion)}</p>
        ${txt.lead ? `<p class="ryff-dim__lead">${escapeHtml(txt.lead)}</p>` : ""}
        ${txt.steps && txt.steps.length ? `
          <div class="ryff-dim__steps-label">Siguiente paso</div>
          <ul class="ryff-dim__steps">
            ${txt.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
          </ul>
        ` : ""}
      </article>
    `;
  }).join("");

  return `
    <section class="ryff-overview">
      <div class="ryff-overview__chart">
        <svg id="ryffRadarSvg" class="ryff-radar"></svg>
      </div>
      <div class="ryff-overview__summary">
        <div class="ryff-global">
          <div class="ryff-global__pct">${globalPct}%</div>
          <div class="ryff-global__label">Índice global de bienestar</div>
        </div>
        <div class="autoeval-band-tag" style="color:${bandaColor(globalBanda)};">
          ${escapeHtml(bandaLabel(globalBanda))}
        </div>
        <p class="ryff-overview__text">
          El radar muestra tus seis dimensiones de 0 a 100%. No existe un
          puntaje "ideal": úsalo para ver dónde te sientes con más fuerza hoy
          y dónde hay espacio para crecer. Abajo tienes una lectura por dimensión.
        </p>
        ${fecha ? `<div class="ryff-overview__fecha">Evaluación del ${escapeHtml(fecha)}</div>` : ""}
      </div>
    </section>

    <section class="ryff-dims">
      ${dimCards}
    </section>

    <p class="ryff-note">${escapeHtml(NOTE)}</p>
  `;
}

function mountRadarFromData(data) {
  const svg = document.getElementById("ryffRadarSvg");
  if (svg) {
    mountRadar({ svg, dims: radarDims(data.dimensiones), animate: !data.__noAnim, labels: true, fill: ACCENT });
  }
}

/**
 * Monta los resultados Ryff dentro de un container arbitrario (sin shell).
 */
export async function renderRyffResultadosInto(container, respuestaId) {
  if (!container) return;
  container.innerHTML = `<div class="autoeval-inline-loading">Cargando resultados…</div>`;
  try {
    const data = await api.resultadosRyff(respuestaId);
    if (!data.tieneResultados) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__title">Aún no has tomado esta evaluación</div>
        </div>`;
      return;
    }
    container.innerHTML = resultadosHtml(data, { embedded: true });
    mountRadarFromData(data);
  } catch (e) {
    console.error("get-resultados-ryff inline failed:", e);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__title">No pudimos cargar tus resultados</div>
        <p class="empty-state__desc">${escapeHtml(e.message || "Intenta recargar.")}</p>
      </div>`;
  }
}

// ────────────────────────────────────────────────────────────────────
// Pagina standalone (IIFE)
// ────────────────────────────────────────────────────────────────────

const isStandalonePage = location.pathname.includes("/ryff/resultados");

if (isStandalonePage) (async () => {
  const persona = await requireAuth();
  if (!persona) return;

  const params = new URLSearchParams(location.search);
  const respuestaId = params.get("id");
  const cursoSlug = params.get("slug") || "";

  renderShell({
    persona,
    title: "Resultados · Bienestar Psicológico",
    activePath: "/app/cursos",
    contentHtml: loaderHtml({ context: "resultados" }),
  });
  const stopLoader = startLoaderRotation();

  try {
    const data = await api.resultadosRyff(respuestaId);
    stopLoader();
    if (!data.tieneResultados) {
      document.querySelector(".app-main").innerHTML = `
        <div class="empty-state">
          <div class="empty-state__title">Aún no has tomado la evaluación de bienestar</div>
          <p class="empty-state__desc">Toma la Escala de Bienestar Psicológico para ver tu radar y tus dimensiones.</p>
          <a href="/app/ryff${cursoSlug ? `?slug=${encodeURIComponent(cursoSlug)}` : ""}" class="btn btn-accent" style="margin-top:var(--s-4);">Tomar evaluación</a>
        </div>`;
      return;
    }
    renderPage(data, cursoSlug);
  } catch (e) {
    stopLoader();
    console.error("get-resultados-ryff failed:", e);
    document.querySelector(".app-main").innerHTML = `
      <div class="empty-state">
        <div class="empty-state__title">No pudimos cargar tus resultados</div>
        <p class="empty-state__desc">${escapeHtml(e.message || "Intenta recargar.")}</p>
      </div>`;
  }
})();

function renderPage(data, cursoSlug) {
  const fecha = fmtFecha(data.completedAt);
  const backHref = cursoSlug ? `/app/curso?slug=${encodeURIComponent(cursoSlug)}` : "/app/cursos";
  const backLabel = cursoSlug ? "Volver a mi curso" : "Volver a mis cursos";
  const retomarHref = `/app/ryff${cursoSlug ? `?slug=${encodeURIComponent(cursoSlug)}` : ""}`;

  document.querySelector(".app-main").innerHTML = `
    <header class="page-header page-header--with-action">
      <div class="page-header__main">
        <span class="page-eyebrow">Tu evaluación de bienestar psicológico${fecha ? ` · ${escapeHtml(fecha)}` : ""}</span>
        <h2 class="page-title">Tu bienestar en 6 dimensiones</h2>
        <p class="page-subtitle">
          Basado en la Escala de Bienestar Psicológico de Carol Ryff. Mide
          <em>autoaceptación, relaciones positivas, autonomía, dominio del entorno,
          propósito en la vida y crecimiento personal</em>.
        </p>
      </div>
      <a class="btn btn-secondary page-header__action" href="${backHref}">
        ${icon("arrowLeft")}<span>${escapeHtml(backLabel)}</span>
      </a>
    </header>

    <div id="ryffResultsMount"></div>

    <div class="ryff-actions">
      <a class="btn btn-ghost" href="${retomarHref}">
        ${icon("refresh")}<span>Volver a tomar la evaluación</span>
      </a>
    </div>
  `;

  const mount = document.getElementById("ryffResultsMount");
  mount.innerHTML = resultadosHtml(data);
  mountRadarFromData(data);
}
