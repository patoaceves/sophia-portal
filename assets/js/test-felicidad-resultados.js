// SOPHIA Portal — Resultados del Test de Felicidad.
//
// La rueda usa el diseño exacto del HTML legacy (sophia-test-felicidad):
//   - 8 ejes con ángulos asimétricos (60° para 4 ejes, 30° para los otros 4)
//   - Iconos centrados en cada segmento
//   - Hover tooltip con nombre + puntuación
//   - Animación stagger easeOutCubic al cargar
//   - Círculo central blanco + anillos concéntricos punteados de referencia
//
// Layout de resultados:
//   - Hero con saludo + rueda + summary de promedio/strongest/weakest
//   - 3 columnas: Fortaleza (8-10) · En crecimiento (5-7) · Vulnerable (1-4)

import { requireAuth } from "./auth.js";
import { api } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";
import { loaderHtml, startLoaderRotation } from "./loader.js";

// Geometría de la rueda (idéntica al HTML viejo)
const CX = 250, CY = 250, OUTER_R = 220, INNER_R = 80;

// 8 ejes con ángulos asimétricos. Los 4 ejes "principales" ocupan 60° cada uno
// y los 4 "secundarios" ocupan 30° cada uno. Total: 360°.
//
// Las `key` corresponden a la respuesta del API `get-resultados-test`
// (snake_case). Los nombres y colores son los del modelo de Sophia.
const AXES = [
  { name: "Estética Existencial",   key: "estetica_existencial", color: "#e3a52d", file: "estetica-existencial",  start: -60,  end: 0   },
  { name: "Fe y Filosofía de Vida", key: "fe_filosofia",         color: "#e3a52d", file: "fe-filosofia",          start:   0,  end: 60  },
  { name: "Vínculos Vitales",       key: "vinculos_vitales",     color: "#d21744", file: "vinculos-vitales",      start:  60,  end: 120 },
  { name: "Bienestar Emocional",    key: "bienestar_emocional",  color: "#d21744", file: "bienestar-emocional",   start: 120,  end: 150 },
  { name: "Bienestar Físico",       key: "bienestar_fisico",     color: "#8d9438", file: "bienestar-fisico",      start: 150,  end: 180 },
  { name: "Presencia Consciente",   key: "presencia_consciente", color: "#8d9438", file: "presencia-consciente",  start: 180,  end: 210 },
  { name: "Autoconocimiento",       key: "autoconocimiento",     color: "#66a3f4", file: "autoconocimiento",      start: 210,  end: 240 },
  { name: "Trabajo con Propósito",  key: "trabajo_proposito",    color: "#66a3f4", file: "trabajo-proposito",     start: 240,  end: 300 },
];

const ICON_SIZE = 56;

// ────────────────────────────────────────────────────────────────────
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
  const { scores, niveles, analisis, pilarNombres, completedAt } = data;
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
        Cada pilar refleja un área de tu vida. No hay puntajes "buenos" o "malos" —
        son señales de dónde estás hoy y dónde puedes nutrir más.
      </p>
    </header>

    <section class="resultados-overview">
      <div class="rueda-wrap" id="ruedaWrap">
        <svg id="rueda-svg" viewBox="0 0 500 500" class="rueda-svg-full"></svg>
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

  // Generate the wheel and animate
  generateWheel(scores);
  animateSegments(scores);
  setupTooltips(scores);

  // Stagger the bloques fade-in
  setTimeout(() => document.getElementById("col-fortaleza")?.classList.add("show"), 1800);
  setTimeout(() => document.getElementById("col-crecimiento")?.classList.add("show"), 2200);
  setTimeout(() => document.getElementById("col-vulnerable")?.classList.add("show"), 2600);
}

// ────────────────────────────────────────────────────────────────────
// Wheel SVG (legacy design, ported)
// ────────────────────────────────────────────────────────────────────

function seg(iR, oR, sA, eA) {
  const s = (sA - 90) * Math.PI / 180;
  const e = (eA - 90) * Math.PI / 180;
  const x1o = CX + oR * Math.cos(s), y1o = CY + oR * Math.sin(s);
  const x2o = CX + oR * Math.cos(e), y2o = CY + oR * Math.sin(e);
  const x1i = CX + iR * Math.cos(s), y1i = CY + iR * Math.sin(s);
  const x2i = CX + iR * Math.cos(e), y2i = CY + iR * Math.sin(e);
  const lg = ((eA - sA + 360) % 360) > 180 ? 1 : 0;
  return `M ${x1o} ${y1o} A ${oR} ${oR} 0 ${lg} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${iR} ${iR} 0 ${lg} 0 ${x1i} ${y1i} Z`;
}

function midIconPos(sA, eA) {
  const mid = sA + (eA - sA) / 2;
  const rad = (mid - 90) * Math.PI / 180;
  const r = INNER_R + (OUTER_R - INNER_R) * 0.5;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function ns(tag) {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

function generateWheel(scores) {
  const svg = document.getElementById("rueda-svg");
  if (!svg) return;
  svg.innerHTML = "";

  const isMobile = window.innerWidth < 600;
  const scale = isMobile ? 1.13 : 1;

  // Concentric reference rings (subtle, so the empty wheel still has structure)
  const refRings = [4, 6, 8].forEach(v => {
    const r = INNER_R + (OUTER_R - INNER_R) * ((v - 2) / 8);
    const c = ns("circle");
    c.setAttribute("cx", CX);
    c.setAttribute("cy", CY);
    c.setAttribute("r", r);
    c.setAttribute("fill", "none");
    c.setAttribute("stroke", "#eee");
    c.setAttribute("stroke-width", "1");
    c.setAttribute("stroke-dasharray", "2 4");
    svg.appendChild(c);
  });

  AXES.forEach((axis, i) => {
    const g = ns("g");
    g.classList.add("rueda-segment-group");
    g.dataset.index = i;

    // Empty (background) path — full extent
    const empty = ns("path");
    empty.setAttribute("d", seg(INNER_R, OUTER_R, axis.start, axis.end));
    empty.classList.add("rueda-segment-empty");
    g.appendChild(empty);

    // Filled path — animated from inner radius outwards
    const filled = ns("path");
    filled.setAttribute("d", seg(INNER_R, INNER_R + 1, axis.start, axis.end));
    filled.setAttribute("fill", axis.color);
    filled.classList.add("rueda-segment-filled");
    filled.id = `rueda-filled-${i}`;
    g.appendChild(filled);

    svg.appendChild(g);

    // Icon at the segment's middle
    const pos = midIconPos(axis.start, axis.end);
    const sz = ICON_SIZE * scale;
    const img = ns("image");
    img.setAttribute("href", `/assets/img/happiness-workshop/pilares/${axis.file}.svg`);
    // Slight x offset for the autoconocimiento icon (idx 6 in old, axis 6 here)
    const xOff = (i === 6) ? -12 : 0;
    img.setAttribute("x", pos.x - sz / 2 + xOff);
    img.setAttribute("y", pos.y - sz / 2);
    img.setAttribute("width", sz);
    img.setAttribute("height", sz);
    img.classList.add("rueda-icon-img");
    img.id = `rueda-icon-${i}`;
    svg.appendChild(img);
  });

  // Center white circle on top
  const c = ns("circle");
  c.setAttribute("cx", CX);
  c.setAttribute("cy", CY);
  c.setAttribute("r", INNER_R);
  c.classList.add("rueda-center-circle");
  svg.appendChild(c);
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function animateSegments(scores) {
  const duration = 1200;
  const stagger = 120;
  const t0 = performance.now();

  function frame(now) {
    let done = true;
    AXES.forEach((axis, i) => {
      const elapsed = now - t0 - i * stagger;
      if (elapsed < 0) { done = false; return; }
      const p = Math.min(elapsed / duration, 1);
      const e = easeOutCubic(p);
      const score = scores[axis.key] || 0;
      const targetR = INNER_R + (OUTER_R - INNER_R) * (score / 10);
      const curR = INNER_R + (targetR - INNER_R) * e;
      const fp = document.getElementById(`rueda-filled-${i}`);
      if (fp) fp.setAttribute("d", seg(INNER_R, curR, axis.start, axis.end));
      if (p > 0.5) {
        const ic = document.getElementById(`rueda-icon-${i}`);
        if (ic) ic.classList.add("visible");
      }
      if (p < 1) done = false;
    });
    if (!done) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function setupTooltips(scores) {
  const tooltip = document.getElementById("rueda-tooltip");
  if (!tooltip) return;

  const titleEl = tooltip.querySelector(".rueda-tooltip__title");
  const scoreEl = tooltip.querySelector(".rueda-tooltip__score");

  document.querySelectorAll(".rueda-segment-group").forEach((g) => {
    const idx = parseInt(g.dataset.index, 10);
    const axis = AXES[idx];

    g.addEventListener("mouseenter", () => {
      titleEl.textContent = axis.name;
      titleEl.style.color = axis.color;
      scoreEl.textContent = `Puntuación: ${scores[axis.key] || 0}/10`;
      tooltip.classList.add("active");
    });

    g.addEventListener("mousemove", (e) => {
      let l = e.clientX + 15;
      let t = e.clientY + 15;
      if (l + 250 > window.innerWidth) l = e.clientX - 265;
      if (t + 80 > window.innerHeight) t = e.clientY - 95;
      tooltip.style.left = `${l}px`;
      tooltip.style.top = `${t}px`;
    });

    g.addEventListener("mouseleave", () => {
      tooltip.classList.remove("active");
    });
  });
}

// ────────────────────────────────────────────────────────────────────
// 3 columnas de bloques: Fortaleza / En crecimiento / Vulnerable
// ────────────────────────────────────────────────────────────────────
function renderBloques(scores, analisis) {
  const fortaleza = [], crecimiento = [], vulnerable = [];

  AXES.forEach((a) => {
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

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────
function strongestPilar(scores, nombres) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const k = sorted[0]?.[0];
  return k ? (nombres?.[k] || k) : "—";
}

function weakestPilar(scores, nombres) {
  const sorted = Object.entries(scores).sort((a, b) => a[1] - b[1]);
  const k = sorted[0]?.[0];
  return k ? (nombres?.[k] || k) : "—";
}
