// SOPHIA Portal — Resultados del Test de Felicidad

import { requireAuth } from "./auth.js";
import { api } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";

const PILAR_ICON = {
  autoconocimiento: "/assets/img/happiness-workshop/pilares/autoconocimiento.svg",
  bienestar_emocional: "/assets/img/happiness-workshop/pilares/bienestar-emocional.svg",
  bienestar_fisico: "/assets/img/happiness-workshop/pilares/bienestar-fisico.svg",
  presencia_consciente: "/assets/img/happiness-workshop/pilares/presencia-consciente.svg",
  vinculos_vitales: "/assets/img/happiness-workshop/pilares/vinculos-vitales.svg",
  trabajo_proposito: "/assets/img/happiness-workshop/pilares/trabajo-proposito.svg",
  estetica_existencial: "/assets/img/happiness-workshop/pilares/estetica-existencial.svg",
  fe_filosofia: "/assets/img/happiness-workshop/pilares/fe-filosofia.svg",
};

const NIVEL_CLASS = {
  "Fortaleza": "is-high",
  "En crecimiento": "is-mid",
  "Vulnerable": "is-low",
};

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  const params = new URLSearchParams(location.search);
  const respuestaId = params.get("id");

  renderShell({
    persona,
    title: "Resultados · Test de Felicidad",
    activePath: "/app/test-felicidad",
    contentHtml: `<div class="spinner spinner--wheel" style="margin: 60px auto;"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>`,
  });

  try {
    const data = await api.resultadosTest(respuestaId);
    if (!data.tieneResultados) {
      document.querySelector(".app-main").innerHTML = `
        <div class="empty-state">
          <div class="empty-state__title">Aún no has tomado el test</div>
          <p class="empty-state__desc">Toma el Test de Felicidad para ver tu análisis personalizado.</p>
          <a href="/app/test-felicidad" class="btn btn-accent" style="margin-top:var(--s-4);">Tomar el test</a>
        </div>
      `;
      return;
    }
    renderResultados(persona, data);
  } catch (e) {
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
  const pilares = Object.keys(scores);
  const fecha = completedAt
    ? new Date(completedAt).toLocaleDateString("es-MX", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "";

  // Score promedio (de 2 a 10)
  const avg = pilares.reduce((s, k) => s + (scores[k] || 0), 0) / pilares.length;
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
      <div class="rueda-wrap">
        ${renderWheel(scores, pilares, pilarNombres)}
      </div>
      <div class="resultados-summary">
        <div class="summary-stat">
          <div class="summary-stat__num">${avgPct}%</div>
          <div class="summary-stat__label">Promedio general</div>
        </div>
        <p class="summary-text">
          Tu pilar más fuerte: <strong>${strongestPilar(scores, pilarNombres)}</strong><br>
          Tu pilar más vulnerable: <strong>${weakestPilar(scores, pilarNombres)}</strong>
        </p>
      </div>
    </section>

    <section class="resultados-pilares">
      <h3 class="resultados-pilares__title">Análisis pilar por pilar</h3>
      ${pilares.map(p => renderPilarCard(p, scores[p], niveles[p], analisis[p], pilarNombres[p])).join("")}
    </section>

    <footer class="resultados-footer">
      <a class="btn btn-secondary" href="/app/test-felicidad">Tomar el test de nuevo</a>
      <a class="btn btn-ghost" href="/app/cursos">Volver a mis cursos</a>
    </footer>
  `;
}

function renderWheel(scores, pilares, nombres) {
  const N = pilares.length;
  const cx = 200, cy = 200, rMax = 150;
  const sectors = pilares.map((key, i) => {
    const score = scores[key] || 0;
    const r = ((score - 2) / 8) * rMax;
    const a0 = (i / N) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / N) * Math.PI * 2 - Math.PI / 2;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const intensity = (score - 2) / 8;
    const fillOpacity = 0.3 + intensity * 0.6;
    return `<path d="M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z"
      fill="var(--color-accent)" fill-opacity="${fillOpacity.toFixed(2)}" stroke="var(--color-bg)" stroke-width="1"/>`;
  }).join("");

  // Concentric reference rings (2,4,6,8,10)
  const rings = [2, 4, 6, 8, 10].map(v => {
    const r = ((v - 2) / 8) * rMax;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--color-border)" stroke-width="1" stroke-dasharray="${v === 10 ? "none" : "2 3"}"/>`;
  }).join("");

  // Labels
  const labels = pilares.map((key, i) => {
    const a = (i / N) * Math.PI * 2 + Math.PI / N - Math.PI / 2;
    const lr = rMax + 22;
    const x = cx + lr * Math.cos(a);
    const y = cy + lr * Math.sin(a);
    const name = nombres?.[key] || key;
    const short = name.length > 20 ? name.split(" ").slice(0, 2).join(" ") : name;
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle"
      font-size="11" fill="var(--color-text-muted)" font-family="var(--font-body)">${escapeHtml(short)}</text>`;
  }).join("");

  return `
    <svg viewBox="0 0 400 400" class="rueda-svg">
      ${rings}
      ${sectors}
      ${labels}
    </svg>
  `;
}

function renderPilarCard(key, score, nivel, texto, nombre) {
  const cls = NIVEL_CLASS[nivel] || "is-mid";
  const icon = PILAR_ICON[key];
  return `
    <article class="pilar-card ${cls}">
      <div class="pilar-card__header">
        ${icon ? `<img class="pilar-card__icon" src="${icon}" alt="">` : ""}
        <div>
          <h4 class="pilar-card__name">${escapeHtml(nombre || key)}</h4>
          <div class="pilar-card__nivel">${escapeHtml(nivel)} · ${score}/10</div>
        </div>
      </div>
      <p class="pilar-card__analisis">${escapeHtml(texto || "")}</p>
    </article>
  `;
}

function strongestPilar(scores, nombres) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [k] = sorted[0] || [];
  return k ? (nombres?.[k] || k) : "—";
}

function weakestPilar(scores, nombres) {
  const sorted = Object.entries(scores).sort((a, b) => a[1] - b[1]);
  const [k] = sorted[0] || [];
  return k ? (nombres?.[k] || k) : "—";
}
