// SOPHIA Portal · Resultados de la Autoevaluación Autoconocimiento.
//
// Visualización:
//   - Wedge SVG (cuarto de círculo en 5 anillos concéntricos, llenado proporcional al %)
//   - Banda tag (Fortaleza Actual / Zona Crecimiento / Área Atención / Área Vulnerable)
//   - Lead text descriptivo
//   - 2 sugerencias de "siguiente paso"
//   - Nota disclaimer
//
// Portado del legacy `evalfelicidad.sophiamx.org` (Lic. Mariana Riojas, modelo SOPHIA).

import { requireAuth } from "./auth.js";
import { api } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";
import { loaderHtml, startLoaderRotation } from "./loader.js";
import { icon } from "./icons.js";

const AREA_COLOR = "#66a3f4"; // azul autoconocimiento

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  const params = new URLSearchParams(location.search);
  const respuestaId = params.get("id");
  const cursoSlug = params.get("slug") || "";

  renderShell({
    persona,
    title: "Resultados · Autoconocimiento",
    activePath: "/app/cursos",
    contentHtml: loaderHtml({ context: "resultados" }),
  });
  const stopLoader = startLoaderRotation();

  try {
    const data = await api.resultadosAutoconocimiento(respuestaId);
    stopLoader();
    if (!data.tieneResultados) {
      document.querySelector(".app-main").innerHTML = `
        <div class="empty-state">
          <div class="empty-state__title">Aún no has tomado la autoevaluación</div>
          <p class="empty-state__desc">Toma la Autoevaluación de Autoconocimiento para ver tu wedge y tu banda.</p>
          <a href="/app/cursos" class="btn btn-accent" style="margin-top:var(--s-4);">Ir a mis cursos</a>
        </div>
      `;
      return;
    }
    renderResultados(persona, data, cursoSlug);
  } catch (e) {
    stopLoader();
    console.error("get-resultados-autoconocimiento failed:", e);
    document.querySelector(".app-main").innerHTML = `
      <div class="empty-state">
        <div class="empty-state__title">No pudimos cargar tus resultados</div>
        <p class="empty-state__desc">${escapeHtml(e.message || "Intenta recargar.")}</p>
      </div>
    `;
  }
})();

function renderResultados(persona, data, cursoSlug) {
  const { total, pct, banda, lead, steps, note, completedAt } = data;

  const backHref = cursoSlug ? `/app/curso?slug=${encodeURIComponent(cursoSlug)}` : "/app/cursos";
  const backLabel = cursoSlug ? "Volver a Mi Curso" : "Volver a mis cursos";
  const fecha = completedAt
    ? new Date(completedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : "";

  document.querySelector(".app-main").innerHTML = `
    <header class="page-header page-header--with-action">
      <div class="page-header__main">
        <span class="page-eyebrow">Tu autoevaluación de Autoconocimiento · ${escapeHtml(fecha)}</span>
        <h2 class="page-title">Tu integración del Autoconocimiento</h2>
        <p class="page-subtitle">
          Una medida de qué tan integrado tienes el autoconocimiento en tu vida,
          según los 8 niveles del modelo SOPHIA: <em>adecuadamente, disfrute,
          emociones positivas, compromiso, logro, satisfacción, sentido y trascendencia</em>.
        </p>
      </div>
      <a class="btn btn-secondary page-header__action" href="${backHref}">
        ${icon("arrowLeft")}<span>${backLabel}</span>
      </a>
    </header>

    <section class="autoeval-result">
      <div class="autoeval-result__visual">
        <div class="autoeval-wedge-wrap">
          <div id="wedgeMount"></div>
          <div class="autoeval-wedge-pct">${pct}%</div>
        </div>
      </div>
      <div class="autoeval-result__body">
        <div class="autoeval-band-tag" data-band="${escapeHtml(banda)}">
          ${escapeHtml(banda)}
        </div>
        <h3 class="autoeval-result__title">Autoconocimiento</h3>
        <p class="autoeval-result__lead">${escapeHtml(lead)}</p>
        <div class="autoeval-result__steps-label">Siguiente paso (1–2 semanas)</div>
        <ul class="autoeval-result__steps">
          ${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
        </ul>
        <p class="autoeval-result__note">${escapeHtml(note)}</p>
      </div>
    </section>

    <footer class="resultados-footer">
      <a class="btn btn-secondary" href="${backHref}">${icon("arrowLeft")}<span>${backLabel}</span></a>
    </footer>
  `;

  drawWedge(document.getElementById("wedgeMount"), pct, AREA_COLOR);
}

// ────────────────────────────────────────────────────────────────────
// Wedge SVG (cuarto de círculo con 5 anillos concéntricos)
// Portado de legacy evalfelicidad.sophiamx.org
// ────────────────────────────────────────────────────────────────────

function fanSector(cx, cy, r0, r1, a0, a1) {
  const ns = "http://www.w3.org/2000/svg";
  const p = document.createElementNS(ns, "path");
  const cos = Math.cos, sin = Math.sin;
  const lg = (a1 - a0) > Math.PI ? 1 : 0;
  const d = [
    `M ${cx + r0 * cos(a0)} ${cy + r0 * sin(a0)}`,
    `A ${r0} ${r0} 0 ${lg} 1 ${cx + r0 * cos(a1)} ${cy + r0 * sin(a1)}`,
    `L ${cx + r1 * cos(a1)} ${cy + r1 * sin(a1)}`,
    `A ${r1} ${r1} 0 ${lg} 0 ${cx + r1 * cos(a0)} ${cy + r1 * sin(a0)}`,
    `Z`,
  ].join(" ");
  p.setAttribute("d", d);
  return p;
}

function drawWedge(container, pct, color) {
  const size = 260, cx = 0, cy = size;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  const rings = 5, rMin = 40, rMax = 250, rStep = (rMax - rMin) / rings, gap = 6;
  const aStart = -Math.PI / 2, aEnd = 0;
  const fillEnd = aStart + (aEnd - aStart) * (pct / 100);
  const opacities = [1, 0.75, 0.55, 0.38, 0.22];
  for (let i = 0; i < rings; i++) {
    const r0 = rMin + i * rStep, r1 = r0 + rStep - gap;
    const bg = fanSector(cx, cy, r0, r1, aStart, aEnd);
    bg.setAttribute("fill", "rgba(0,0,0,.07)");
    svg.appendChild(bg);
    if (pct > 0) {
      const fg = fanSector(cx, cy, r0, r1, aStart, fillEnd);
      fg.setAttribute("fill", color);
      fg.setAttribute("opacity", opacities[i]);
      svg.appendChild(fg);
    }
  }
  container.innerHTML = "";
  container.appendChild(svg);
}
