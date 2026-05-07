// SOPHIA Portal — Dashboard del curso (tabs)
// Estructura:
//   ?slug=X (default tab=resumen)
//     · resumen  → preview de todo, con los 8 iconos como visual central
//     · temario  → lista completa de capítulos y lecciones (con ponente)
//     · test     → resultados del Test de Felicidad o CTA para tomarlo
//     · recursos → placeholder
//     · mensajes → placeholder

import { requireAuth } from "./auth.js";
import { api, ApiError } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";
import { icon, lessonIcon, lessonTipoLabel } from "./icons.js";

const LOCAL_COVERS = new Set(["happiness-workshop"]);

// 8 pilares en orden para el componente visual.
// El mapeo capítulo→pilar es por orden: capítulo N (con N≥2) se asigna al
// pilar (N-2). El capítulo 1 ("Bienvenida") es intro y no mapea a pilar.
// Si un curso futuro no respeta este orden, agregar campo `Capitulos.pilar`.
const PILARES = [
  { key: "estetica_existencial", file: "estetica-existencial",  dim: "spiritual", name: "Estética Existencial" },
  { key: "fe_filosofia",          file: "fe-filosofia",          dim: "spiritual", name: "Fe y Filosofía" },
  { key: "vinculos_vitales",      file: "vinculos-vitales",      dim: "afectivo",  name: "Vínculos Vitales" },
  { key: "bienestar_emocional",   file: "bienestar-emocional",   dim: "afectivo",  name: "Bienestar Emocional" },
  { key: "bienestar_fisico",      file: "bienestar-fisico",      dim: "fisico",    name: "Bienestar Físico" },
  { key: "presencia_consciente",  file: "presencia-consciente",  dim: "fisico",    name: "Presencia Consciente" },
  { key: "autoconocimiento",      file: "autoconocimiento",      dim: "mental",    name: "Autoconocimiento" },
  { key: "trabajo_proposito",     file: "trabajo-proposito",     dim: "mental",    name: "Trabajo con Propósito" },
];

const VALID_TABS = ["resumen", "temario", "test", "recursos", "mensajes"];

// ────────────────────────────────────────────────────────────────────
(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  const params = new URLSearchParams(location.search);
  const slug = params.get("slug");
  let tab = params.get("tab") || "resumen";
  if (!VALID_TABS.includes(tab)) tab = "resumen";

  if (!slug) {
    renderShell({
      persona,
      title: "Curso",
      activePath: "/app/cursos",
      contentHtml: emptyState("Falta el curso", `No se proporcionó un slug. <a href="/app/cursos">Volver a mis cursos</a>.`),
    });
    return;
  }

  renderShell({
    persona,
    title: "Cargando…",
    activePath: "/app/cursos",
    contentHtml: spinnerHtml(),
  });

  try {
    const data = await api.curso(slug);
    let resultadoTest = null;
    try { resultadoTest = await api.resultadosTest(); } catch {}
    renderDashboard(persona, slug, tab, data, resultadoTest);
  } catch (e) {
    console.error("get-curso failed:", e);
    document.querySelector(".app-main").innerHTML = emptyState(
      "No pudimos cargar este curso",
      escapeHtml(e.message || "Intenta recargar."),
      e instanceof ApiError && e.status === 403
        ? `<a href="/app/cursos" class="btn btn-secondary" style="margin-top:var(--s-4);">Volver a mis cursos</a>`
        : ""
    );
  }
})();

// ────────────────────────────────────────────────────────────────────
function renderDashboard(persona, slug, tab, payload, resultadoTest) {
  const { curso, inscripcion, capitulos } = payload;

  const totalLecc = capitulos.reduce((s, c) => s + c.lecciones.length, 0);
  const completadas = capitulos.reduce(
    (s, c) => s + c.lecciones.filter((l) => l.completada).length, 0,
  );
  const progresoPct = totalLecc > 0 ? Math.round((completadas / totalLecc) * 100) : 0;

  const next = findNextLeccion(capitulos);

  const coverUrl = curso.coverUrl
    || (LOCAL_COVERS.has(slug) ? `/assets/img/${slug}/portada.png` : null);

  const ctx = { persona, slug, curso, inscripcion, capitulos, totalLecc, completadas, progresoPct, next, resultadoTest };

  let body = "";
  switch (tab) {
    case "temario":  body = renderTemarioTab(ctx); break;
    case "test":     body = renderTestTab(ctx); break;
    case "recursos": body = renderRecursosTab(ctx); break;
    case "mensajes": body = renderMensajesTab(ctx); break;
    default:         body = renderResumenTab(ctx); break;
  }

  renderShell({
    persona,
    title: curso.titulo,
    activePath: "/app/cursos",
    contentHtml: `
      ${renderHero(curso, coverUrl)}
      ${renderTabsNav(slug, tab)}
      <div class="tab-panel">${body}</div>
    `,
  });
}

// ────────────────────────────────────────────────────────────────────
// Hero & Tabs nav
// ────────────────────────────────────────────────────────────────────
function renderHero(curso, coverUrl) {
  const inline = coverUrl ? `style="--curso-cover: url('${escapeHtml(coverUrl)}');"` : "";
  return `
    <header class="curso-hero curso-hero--minimal" ${inline}>
      <a href="/app/cursos" class="curso-hero__back">
        ${icon("chevronLeft")}
        <span>Mis cursos</span>
      </a>
      ${curso.modalidad ? `<span class="curso-hero__chip">${escapeHtml(curso.modalidad)}</span>` : ""}
    </header>
  `;
}

function renderTabsNav(slug, currentTab) {
  const tabs = [
    { id: "resumen",  label: "Resumen" },
    { id: "temario",  label: "Temario" },
    { id: "test",     label: "Test de Felicidad" },
    { id: "recursos", label: "Recursos" },
    { id: "mensajes", label: "Mensajes" },
  ];
  return `
    <nav class="tab-nav" role="tablist" aria-label="Secciones del curso">
      ${tabs.map(t => `
        <a role="tab"
           class="tab-nav__tab ${currentTab === t.id ? "is-active" : ""}"
           href="?slug=${encodeURIComponent(slug)}&tab=${t.id}"
           aria-selected="${currentTab === t.id}">
          ${escapeHtml(t.label)}
        </a>
      `).join("")}
    </nav>
  `;
}

// ────────────────────────────────────────────────────────────────────
// TAB · Resumen — overview con 8 iconos como visual + previews
// ────────────────────────────────────────────────────────────────────
function renderResumenTab(ctx) {
  const { slug, capitulos, totalLecc, completadas, progresoPct, next, resultadoTest, inscripcion } = ctx;

  return `
    <div class="resumen">
      <section class="pillar-grid">
        <header class="resumen-section-header">
          <span class="resumen-section-header__eyebrow">Tu camino</span>
          <h3 class="resumen-section-header__title">Las 8 dimensiones del bienestar</h3>
          <p class="resumen-section-header__sub">Cada capítulo (después de la bienvenida) profundiza en uno de los pilares. Se iluminan a medida que los completas.</p>
        </header>
        <div class="pillar-grid__grid">
          ${PILARES.map((p, i) => renderPillarIcon(p, i, capitulos)).join("")}
        </div>
      </section>

      <div class="resumen-row">
        ${renderContinuePanel(next, capitulos, totalLecc, completadas, progresoPct)}
        ${renderTestPreview(ctx, /* compact */ true)}
      </div>

      <div class="resumen-mini-row">
        <a class="mini-tab-card" href="?slug=${encodeURIComponent(slug)}&tab=temario">
          <div class="mini-tab-card__icon">${icon("temario")}</div>
          <div class="mini-tab-card__body">
            <span class="mini-tab-card__eyebrow">Temario</span>
            <h4 class="mini-tab-card__title">${capitulos.length} capítulos · ${totalLecc} lecciones</h4>
            <p class="mini-tab-card__lead">${completadas} completadas</p>
          </div>
          ${icon("arrowRight")}
        </a>
        <a class="mini-tab-card mini-tab-card--soft" href="?slug=${encodeURIComponent(slug)}&tab=recursos">
          <div class="mini-tab-card__icon">${icon("recursos")}</div>
          <div class="mini-tab-card__body">
            <span class="mini-tab-card__eyebrow">Recursos</span>
            <h4 class="mini-tab-card__title">Material descargable</h4>
            <p class="mini-tab-card__lead">Próximamente</p>
          </div>
          ${icon("arrowRight")}
        </a>
        <a class="mini-tab-card mini-tab-card--soft" href="?slug=${encodeURIComponent(slug)}&tab=mensajes">
          <div class="mini-tab-card__icon">${icon("mensajes")}</div>
          <div class="mini-tab-card__body">
            <span class="mini-tab-card__eyebrow">Mensajes</span>
            <h4 class="mini-tab-card__title">Del instructor</h4>
            <p class="mini-tab-card__lead">Próximamente</p>
          </div>
          ${icon("arrowRight")}
        </a>
      </div>
    </div>
  `;
}

/**
 * Renderiza un icono del pilar. Estados:
 * - "todo"        — gris, baja opacidad, sin progreso
 * - "in-progress" — color dimensional con opacidad media, barra parcial
 * - "done"        — color dimensional full, badge ✓
 */
function renderPillarIcon(pillar, idx, capitulos) {
  // Capítulo correspondiente: el orden = idx + 2 (capítulo 1 es Bienvenida)
  const cap = capitulos.find(c => c.orden === idx + 2);
  let progress = 0;
  let total = 0;
  let done = 0;
  if (cap) {
    total = cap.lecciones.length;
    done = cap.lecciones.filter(l => l.completada).length;
    progress = total > 0 ? done / total : 0;
  }

  const state = !cap ? "locked"
    : progress === 1 && total > 0 ? "done"
    : progress > 0 ? "in-progress"
    : "todo";

  return `
    <article class="pillar-icon pillar-icon--${pillar.dim} pillar-icon--${state}">
      <div class="pillar-icon__visual">
        <img src="/assets/img/happiness-workshop/pilares/${pillar.file}.svg" alt="" aria-hidden="true">
        ${state === "done" ? `<span class="pillar-icon__check">${icon("check")}</span>` : ""}
      </div>
      <div class="pillar-icon__name">${escapeHtml(pillar.name)}</div>
      ${cap ? `
        <div class="pillar-icon__cap">Capítulo ${cap.orden}</div>
        <div class="pillar-icon__progress">
          <div class="pillar-icon__progress-fill" style="width: ${progress * 100}%;"></div>
        </div>
        <div class="pillar-icon__count">${done} / ${total}</div>
      ` : `
        <div class="pillar-icon__cap">Por publicarse</div>
      `}
    </article>
  `;
}

function renderContinuePanel(next, capitulos, total, completadas, pct) {
  if (!next) {
    return `
      <section class="continue-card continue-card--done">
        <span class="continue-card__eyebrow">¡Felicidades!</span>
        <h3 class="continue-card__title">Has completado el curso</h3>
        <div class="continue-card__progress">
          <div class="continue-card__bar"><div class="continue-card__bar-fill" style="width:100%"></div></div>
          <div class="continue-card__progress-meta">
            <span class="continue-card__pct">100%</span>
            <span>${total} de ${total} lecciones</span>
          </div>
        </div>
      </section>
    `;
  }
  const cap = capitulos.find(c => c.lecciones.some(l => l.id === next.id));
  return `
    <section class="continue-card">
      <span class="continue-card__eyebrow">Continúa donde te quedaste</span>
      ${cap ? `<div class="continue-card__cap">Capítulo ${cap.orden} · ${escapeHtml(cap.titulo)}</div>` : ""}
      <h3 class="continue-card__title">${escapeHtml(next.titulo)}</h3>
      <p class="continue-card__lead">
        ${escapeHtml(lessonTipoLabel(next.tipo))}${cap ? ` · Lección ${next.orden} de ${cap.lecciones.length}` : ""}
      </p>
      <a class="btn btn-accent continue-card__cta" href="/app/leccion?id=${encodeURIComponent(next.id)}">
        <span>${pct === 0 ? "Comenzar" : "Continuar"}</span>
        ${icon("arrowRight")}
      </a>
      <div class="continue-card__progress">
        <div class="continue-card__bar"><div class="continue-card__bar-fill" style="width:${pct}%"></div></div>
        <div class="continue-card__progress-meta">
          <span class="continue-card__pct">${pct}%</span>
          <span>· ${completadas} de ${total} lecciones</span>
        </div>
      </div>
    </section>
  `;
}

// ────────────────────────────────────────────────────────────────────
// TAB · Temario — full chapter list with ponente
// ────────────────────────────────────────────────────────────────────
function renderTemarioTab(ctx) {
  const { capitulos, totalLecc, completadas, progresoPct } = ctx;
  return `
    <header class="resumen-section-header">
      <span class="resumen-section-header__eyebrow">Temario</span>
      <h3 class="resumen-section-header__title">9 capítulos · ${totalLecc} lecciones · ${progresoPct}% completado</h3>
    </header>
    <div class="curso-progress-bar" style="margin-bottom: var(--s-6);">
      <div class="curso-progress-bar__fill" style="width: ${progresoPct}%;"></div>
    </div>
    <div class="capitulos-list">
      ${capitulos.map(renderCapituloCard).join("")}
    </div>
  `;
}

function renderCapituloCard(cap) {
  const total = cap.lecciones.length;
  const done = cap.lecciones.filter(l => l.completada).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return `
    <section class="capitulo-card" id="cap-${escapeHtml(cap.id)}">
      <header class="capitulo-card__header">
        <div class="capitulo-card__head-info">
          <div class="capitulo-card__num">Capítulo ${cap.orden}</div>
          <h3 class="capitulo-card__title">${escapeHtml(cap.titulo)}</h3>
          ${cap.descripcion ? `<p class="capitulo-card__desc">${escapeHtml(cap.descripcion)}</p>` : ""}
          ${cap.ponente ? `
            <div class="capitulo-card__ponente">
              ${icon("instructor")}
              <span><strong>Ponente:</strong> ${escapeHtml(cap.ponente)}</span>
            </div>
          ` : ""}
        </div>
        <div class="capitulo-card__progress">${done} / ${total}</div>
      </header>
      <div class="capitulo-card__bar">
        <div class="capitulo-card__bar-fill" style="width: ${pct}%;"></div>
      </div>
      <ol class="leccion-list">
        ${cap.lecciones.map(renderLeccionItem).join("")}
      </ol>
    </section>
  `;
}

function renderLeccionItem(l) {
  return `
    <li class="leccion-item ${l.completada ? "is-done" : ""}">
      <a href="/app/leccion?id=${encodeURIComponent(l.id)}" class="leccion-item__link">
        <span class="leccion-item__check" aria-hidden="true">${l.completada ? icon("check") : ""}</span>
        <div class="leccion-item__body">
          <div class="leccion-item__title">${escapeHtml(l.titulo)}</div>
          <div class="leccion-item__meta">
            <span class="leccion-item__tipo">
              ${icon(lessonIcon(l.tipo))}
              <span>${escapeHtml(lessonTipoLabel(l.tipo))}</span>
            </span>
            ${l.etiqueta ? `<span class="leccion-item__etiqueta">${escapeHtml(l.etiqueta)}</span>` : ""}
          </div>
        </div>
        <span class="leccion-item__chevron">${icon("chevronRight")}</span>
      </a>
    </li>
  `;
}

// ────────────────────────────────────────────────────────────────────
// TAB · Test de Felicidad — preview / results
// ────────────────────────────────────────────────────────────────────
function renderTestTab(ctx) {
  return renderTestPreview(ctx, /* compact */ false);
}

function renderTestPreview(ctx, compact) {
  const { slug, capitulos, resultadoTest, inscripcion } = ctx;
  const testLecc = capitulos.flatMap(c => c.lecciones).find(l =>
    l.tipo === "test" && /felicidad/i.test(l.titulo + " " + (l.etiqueta || "")),
  );
  const taken = !!resultadoTest?.tieneResultados;

  if (compact) {
    // Compact preview shown alongside continue panel in Resumen tab
    if (!taken) {
      return `
        <a class="test-preview-card test-preview-card--cta" href="?slug=${encodeURIComponent(slug)}&tab=test">
          <div class="test-preview-card__header">
            <span class="test-preview-card__eyebrow">Tu evaluación inicial</span>
            <h3 class="test-preview-card__title">Test de Felicidad</h3>
          </div>
          <p class="test-preview-card__lead">16 preguntas · 5 min · análisis personalizado en 8 pilares.</p>
          <div class="test-preview-card__footer">
            <span class="btn btn-accent btn-sm">
              <span>Tomar el test</span>
              ${icon("arrowRight")}
            </span>
          </div>
        </a>
      `;
    }
    // Taken: show wheel preview
    return `
      <a class="test-preview-card test-preview-card--results" href="?slug=${encodeURIComponent(slug)}&tab=test">
        <div class="test-preview-card__header">
          <span class="test-preview-card__eyebrow">Tu evaluación · ${formatDate(resultadoTest.completedAt)}</span>
          <h3 class="test-preview-card__title">Tu rueda de la felicidad</h3>
        </div>
        <div class="test-preview-card__chart">
          ${renderRuedaSVG(resultadoTest.scores)}
        </div>
        <div class="test-preview-card__footer">
          <span class="test-preview-card__cta">
            <span>Ver mis resultados</span>
            ${icon("arrowRight")}
          </span>
        </div>
      </a>
    `;
  }

  // Full Test tab
  if (!taken) {
    return `
      <header class="resumen-section-header">
        <span class="resumen-section-header__eyebrow">Tu evaluación inicial</span>
        <h3 class="resumen-section-header__title">Test de Felicidad</h3>
        <p class="resumen-section-header__sub">Una autoevaluación de 16 preguntas en los 8 pilares del bienestar. Tarda ~5 minutos. Recibes un análisis personalizado y una rueda visual con tus dimensiones.</p>
      </header>

      <section class="test-tab__cta-box">
        <div class="test-tab__chart-tease">
          ${renderRuedaSVG(null /* preview */)}
        </div>
        <div class="test-tab__cta-body">
          <h4>Cuando tomes el test, tu rueda aparecerá aquí llena con tus puntajes.</h4>
          <p>El análisis cualitativo te dirá qué pilares son tu fortaleza y cuáles necesitan más atención.</p>
          ${testLecc ? `
            <a class="btn btn-accent btn-lg" href="/app/test-felicidad?inscripcion=${encodeURIComponent(inscripcion.id)}&leccion=${encodeURIComponent(testLecc.id)}">
              <span>Tomar el test</span>
              ${icon("arrowRight")}
            </a>
          ` : `
            <a class="btn btn-accent btn-lg" href="/app/test-felicidad?inscripcion=${encodeURIComponent(inscripcion.id)}">
              <span>Tomar el test</span>
              ${icon("arrowRight")}
            </a>
          `}
        </div>
      </section>
    `;
  }

  // Has taken the test: show results inline
  const { scores, niveles, analisis, pilarNombres } = resultadoTest;
  const pillars = Object.keys(scores);
  return `
    <header class="resumen-section-header">
      <span class="resumen-section-header__eyebrow">Tu evaluación · ${formatDate(resultadoTest.completedAt)}</span>
      <h3 class="resumen-section-header__title">Tu rueda de la felicidad</h3>
    </header>

    <section class="test-results-row">
      <div class="test-results-row__chart">
        ${renderRuedaSVG(scores)}
      </div>
      <div class="test-results-row__summary">
        <div class="summary-stat">
          <div class="summary-stat__num">${avgPct(scores)}%</div>
          <div class="summary-stat__label">Promedio general</div>
        </div>
        <p class="summary-text">
          <strong>Tu pilar más fuerte:</strong> ${escapeHtml(strongestPilar(scores, pilarNombres))}<br>
          <strong>Tu pilar más vulnerable:</strong> ${escapeHtml(weakestPilar(scores, pilarNombres))}
        </p>
        <a class="btn btn-secondary btn-sm" href="/app/test-felicidad/resultados?id=${encodeURIComponent(resultadoTest.respuestaId)}">
          <span>Ver análisis completo</span>
          ${icon("arrowRight")}
        </a>
        ${testLecc ? `
          <a class="btn btn-ghost btn-sm" href="/app/test-felicidad?inscripcion=${encodeURIComponent(inscripcion.id)}&leccion=${encodeURIComponent(testLecc.id)}">
            <span>Volver a tomar</span>
          </a>
        ` : ""}
      </div>
    </section>
  `;
}

// ────────────────────────────────────────────────────────────────────
// TAB · Recursos / Mensajes (placeholders)
// ────────────────────────────────────────────────────────────────────
function renderRecursosTab(ctx) {
  return `
    <header class="resumen-section-header">
      <span class="resumen-section-header__eyebrow">Material complementario</span>
      <h3 class="resumen-section-header__title">Recursos</h3>
    </header>
    <div class="placeholder-state">
      <div class="placeholder-state__icon">${icon("recursos")}</div>
      <h4>En construcción</h4>
      <p>Aquí aparecerán materiales descargables, lecturas, y recursos adicionales del curso.</p>
    </div>
  `;
}

function renderMensajesTab(ctx) {
  return `
    <header class="resumen-section-header">
      <span class="resumen-section-header__eyebrow">Comunicaciones</span>
      <h3 class="resumen-section-header__title">Mensajes</h3>
    </header>
    <div class="placeholder-state">
      <div class="placeholder-state__icon">${icon("mensajes")}</div>
      <h4>En construcción</h4>
      <p>Anuncios y mensajes del instructor aparecerán aquí. También podrás responder.</p>
    </div>
  `;
}

// ────────────────────────────────────────────────────────────────────
// SVG de la rueda (compartido — preview o con scores)
// ────────────────────────────────────────────────────────────────────
function renderRuedaSVG(scores) {
  // Mismo orden que PILARES para la rueda visual
  const order = PILARES;
  const cx = 100, cy = 100;
  const rOuter = 84;
  const rInner = 22;
  const wedgeSpan = 360 / order.length;

  const wedges = order.map((p, i) => {
    const a0 = -90 - wedgeSpan / 2 + i * wedgeSpan;
    const a1 = a0 + wedgeSpan;
    const score = scores?.[p.key];
    const filled = typeof score === "number";
    const r = filled
      ? rInner + ((score - 2) / 8) * (rOuter - rInner)
      : rOuter * 0.95;
    const opacity = filled ? 0.9 : 0.45;
    return `<path d="${arcPath(cx, cy, rInner, r, a0, a1)}"
      fill="var(--pillar-${p.dim})" fill-opacity="${opacity}"
      stroke="var(--color-bg-elevated)" stroke-width="1" />`;
  }).join("");

  const isFilled = !!scores;
  const rings = [4, 6, 8].map(v => {
    const r = rInner + ((v - 2) / 8) * (rOuter - rInner);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="var(--color-border)" stroke-width="0.5"
      stroke-dasharray="2 4" opacity="${isFilled ? 0.45 : 0}" />`;
  }).join("");

  return `
    <svg viewBox="0 0 200 200" class="rueda-svg" preserveAspectRatio="xMidYMid meet">
      <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="none" stroke="var(--color-border)" stroke-width="1"/>
      ${rings}
      ${wedges}
      <circle cx="${cx}" cy="${cy}" r="${rInner}" fill="var(--color-bg-elevated)" stroke="var(--color-border)" stroke-width="1"/>
    </svg>
  `;
}

function arcPath(cx, cy, rIn, rOut, aStart, aEnd) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const x1 = cx + rIn * Math.cos(rad(aStart));
  const y1 = cy + rIn * Math.sin(rad(aStart));
  const x2 = cx + rOut * Math.cos(rad(aStart));
  const y2 = cy + rOut * Math.sin(rad(aStart));
  const x3 = cx + rOut * Math.cos(rad(aEnd));
  const y3 = cy + rOut * Math.sin(rad(aEnd));
  const x4 = cx + rIn * Math.cos(rad(aEnd));
  const y4 = cy + rIn * Math.sin(rad(aEnd));
  const largeArc = (aEnd - aStart) > 180 ? 1 : 0;
  return [
    `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `L ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `A ${rOut} ${rOut} 0 ${largeArc} 1 ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    `L ${x4.toFixed(2)} ${y4.toFixed(2)}`,
    `A ${rIn} ${rIn} 0 ${largeArc} 0 ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    "Z",
  ].join(" ");
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────
function findNextLeccion(capitulos) {
  for (const c of capitulos) for (const l of c.lecciones) if (!l.completada) return l;
  return null;
}

function avgPct(scores) {
  const ks = Object.keys(scores);
  if (!ks.length) return 0;
  const avg = ks.reduce((s, k) => s + (scores[k] || 0), 0) / ks.length;
  return Math.round(((avg - 2) / 8) * 100);
}

function strongestPilar(scores, names) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const k = sorted[0]?.[0];
  return k ? (names?.[k] || k) : "—";
}

function weakestPilar(scores, names) {
  const sorted = Object.entries(scores).sort((a, b) => a[1] - b[1]);
  const k = sorted[0]?.[0];
  return k ? (names?.[k] || k) : "—";
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  } catch { return iso; }
}

function spinnerHtml() {
  return `<div style="display:grid;place-items:center;padding:80px 0;"><div class="spinner spinner--wheel"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div></div>`;
}

function emptyState(title, desc, extra = "") {
  return `<div class="empty-state"><div class="empty-state__title">${title}</div><p class="empty-state__desc">${desc}</p>${extra}</div>`;
}
