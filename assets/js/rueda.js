// SOPHIA Portal · Rueda de la Felicidad (módulo compartido).
//
// Renderiza el SVG de la rueda con la geometría legacy:
//   - 8 ejes con ángulos asimétricos (60°/30°)
//   - Iconos centrados en cada segmento
//   - Hover tooltip con nombre + puntuación
//   - Animación stagger easeOutCubic al cargar
//   - Anillos concéntricos punteados de referencia
//
// Uso:
//   import { mountRueda } from "./rueda.js";
//   mountRueda({
//     svg: document.getElementById("myRueda"),
//     tooltip: document.getElementById("myTooltip"),
//     scores,                         // { autoconocimiento: 7, ... } o null para preview vacía
//     animate: true,
//     compact: false,                 // true = iconos chicos, tooltip slim
//   });

const CX = 250, CY = 250, OUTER_R = 220, INNER_R = 80;

// 8 ejes en el orden visual del HTML legacy. Las `key` son del API
// del portal (snake_case).
const AXES = [
  { name: "Estética Existencial",   key: "estetica_existencial", color: "#e3a52d", file: "estetica-existencial",  start: -60, end: 0   },
  { name: "Fe y Filosofía de Vida", key: "fe_filosofia",         color: "#e3a52d", file: "fe-filosofia",          start:   0, end: 60  },
  { name: "Vínculos Vitales",       key: "vinculos_vitales",     color: "#d21744", file: "vinculos-vitales",      start:  60, end: 120 },
  { name: "Bienestar Emocional",    key: "bienestar_emocional",  color: "#d21744", file: "bienestar-emocional",   start: 120, end: 150 },
  { name: "Bienestar Físico",       key: "bienestar_fisico",     color: "#8d9438", file: "bienestar-fisico",      start: 150, end: 180 },
  { name: "Presencia Consciente",   key: "presencia_consciente", color: "#8d9438", file: "presencia-consciente",  start: 180, end: 210 },
  { name: "Autoconocimiento",       key: "autoconocimiento",     color: "#66a3f4", file: "autoconocimiento",      start: 210, end: 240 },
  { name: "Trabajo con Propósito",  key: "trabajo_proposito",    color: "#66a3f4", file: "trabajo-proposito",     start: 240, end: 300 },
];

export const RUEDA_AXES = AXES;

/**
 * Monta la rueda en un elemento SVG existente.
 * @param {object} opts
 * @param {SVGElement} opts.svg · el elemento <svg> donde montar
 * @param {HTMLElement} opts.tooltip · el div del tooltip
 * @param {object|null} opts.scores · objeto con scores por key, o null para vista vacía
 * @param {boolean} [opts.animate=true] · animar con stagger al cargar
 * @param {boolean} [opts.compact=false] · versión chica (preview en dashboard)
 */
export function mountRueda({ svg, tooltip, scores, animate = true, compact = false }) {
  if (!svg) return;
  svg.setAttribute("viewBox", `0 0 500 500`);

  // El iconSize escala con el tamaño visual.
  // - compact (preview en dashboard): iconos visibles pero más chicos
  //   que en el modo full (resultados page). Cuidado con hacerlos muy
  //   chicos porque se pierden los detalles.
  // - normal (resultados): iconos legacy (56px) o 1.13x en mobile
  const isMobile = window.innerWidth < 600;
  const iconSize = compact
    ? (isMobile ? 50 : 46)
    : (isMobile ? 56 * 1.13 : 56);

  drawWheel(svg, iconSize);
  if (animate) {
    requestAnimationFrame(() => animateSegments(svg, scores));
  } else {
    fillStaticSegments(svg, scores);
  }

  if (tooltip && scores) {
    setupTooltips(svg, tooltip, scores);
  }
}

// ────────────────────────────────────────────────────────────────────
// SVG path helpers
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

// ────────────────────────────────────────────────────────────────────
// Drawing
// ────────────────────────────────────────────────────────────────────

function drawWheel(svg, iconSize) {
  svg.innerHTML = "";

  // Subtle reference rings
  [4, 6, 8].forEach((v) => {
    const r = INNER_R + (OUTER_R - INNER_R) * ((v - 2) / 8);
    const c = ns("circle");
    c.setAttribute("cx", CX);
    c.setAttribute("cy", CY);
    c.setAttribute("r", r);
    c.setAttribute("fill", "none");
    c.setAttribute("stroke", "#eae3d4");
    c.setAttribute("stroke-width", "1");
    c.setAttribute("stroke-dasharray", "2 4");
    svg.appendChild(c);
  });

  AXES.forEach((axis, i) => {
    const g = ns("g");
    g.classList.add("rueda-segment-group");
    g.dataset.index = i;

    const empty = ns("path");
    empty.setAttribute("d", seg(INNER_R, OUTER_R, axis.start, axis.end));
    empty.classList.add("rueda-segment-empty");
    g.appendChild(empty);

    const filled = ns("path");
    filled.setAttribute("d", seg(INNER_R, INNER_R + 1, axis.start, axis.end));
    filled.setAttribute("fill", axis.color);
    filled.classList.add("rueda-segment-filled");
    filled.dataset.idx = i;
    g.appendChild(filled);

    svg.appendChild(g);

    // Icon at the segment's middle
    const pos = midIconPos(axis.start, axis.end);
    // Slight x offset for the autoconocimiento icon (legacy quirk: idx 6)
    const xOff = (i === 6) ? -12 * (iconSize / 56) : 0;
    const img = ns("image");
    img.setAttribute("href", `/assets/img/happiness-workshop/pilares/${axis.file}.svg`);
    img.setAttribute("x", pos.x - iconSize / 2 + xOff);
    img.setAttribute("y", pos.y - iconSize / 2);
    img.setAttribute("width", iconSize);
    img.setAttribute("height", iconSize);
    img.classList.add("rueda-icon-img");
    img.dataset.idx = i;
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

function fillStaticSegments(svg, scores) {
  AXES.forEach((axis, i) => {
    const fp = svg.querySelector(`.rueda-segment-filled[data-idx="${i}"]`);
    if (!fp) return;
    const score = scores?.[axis.key] || 0;
    if (score > 0) {
      const targetR = INNER_R + (OUTER_R - INNER_R) * (score / 10);
      fp.setAttribute("d", seg(INNER_R, targetR, axis.start, axis.end));
    }
    const ic = svg.querySelector(`.rueda-icon-img[data-idx="${i}"]`);
    if (ic) ic.classList.add("visible");
  });
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function animateSegments(svg, scores) {
  const duration = 1200;
  const stagger = 120;
  const t0 = performance.now();

  // If no scores, still show segments at a default neutral level so the wheel
  // looks "alive" in the empty preview.
  const previewMode = !scores;
  const previewScore = 5; // halfway

  function frame(now) {
    let done = true;
    AXES.forEach((axis, i) => {
      const elapsed = now - t0 - i * stagger;
      if (elapsed < 0) { done = false; return; }
      const p = Math.min(elapsed / duration, 1);
      const e = easeOutCubic(p);
      const score = previewMode ? previewScore : (scores[axis.key] || 0);
      const targetR = INNER_R + (OUTER_R - INNER_R) * (score / 10);
      const curR = INNER_R + (targetR - INNER_R) * e;
      const fp = svg.querySelector(`.rueda-segment-filled[data-idx="${i}"]`);
      if (fp) fp.setAttribute("d", seg(INNER_R, curR, axis.start, axis.end));
      if (p > 0.5) {
        const ic = svg.querySelector(`.rueda-icon-img[data-idx="${i}"]`);
        if (ic) ic.classList.add("visible");
      }
      if (p < 1) done = false;
    });
    if (!done) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ────────────────────────────────────────────────────────────────────
// Hover tooltips · tight to the cursor (small offset, narrow width)
// ────────────────────────────────────────────────────────────────────

function setupTooltips(svg, tooltip, scores) {
  const titleEl = tooltip.querySelector(".rueda-tooltip__title");
  const scoreEl = tooltip.querySelector(".rueda-tooltip__score");
  if (!titleEl || !scoreEl) return;

  // Re-parent the tooltip to <body> so position:fixed is always relative
  // to the viewport (regardless of any ancestor transforms/filters that
  // would otherwise create a containing block).
  if (tooltip.parentNode && tooltip.parentNode !== document.body) {
    document.body.appendChild(tooltip);
  }

  const OFFSET = 12;          // tight offset so tooltip hugs the cursor
  const TT_W = 200;            // narrower tooltip
  const TT_H = 70;

  svg.querySelectorAll(".rueda-segment-group").forEach((g) => {
    const idx = parseInt(g.dataset.index, 10);
    const axis = AXES[idx];

    g.addEventListener("mouseenter", () => {
      titleEl.textContent = axis.name;
      titleEl.style.color = axis.color;
      scoreEl.textContent = `Puntuación: ${scores[axis.key] || 0}/10`;
      tooltip.classList.add("active");
    });

    g.addEventListener("mousemove", (e) => {
      let l = e.clientX + OFFSET;
      let t = e.clientY + OFFSET;
      // Flip horizontal if overflowing right
      if (l + TT_W > window.innerWidth - 8) {
        l = e.clientX - TT_W - OFFSET;
      }
      // Flip vertical if overflowing bottom
      if (t + TT_H > window.innerHeight - 8) {
        t = e.clientY - TT_H - OFFSET;
      }
      tooltip.style.left = `${l}px`;
      tooltip.style.top = `${t}px`;
    });

    g.addEventListener("mouseleave", () => {
      tooltip.classList.remove("active");
    });
  });
}
