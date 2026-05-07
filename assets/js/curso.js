// SOPHIA Portal — Dashboard del curso
//
// Cambios v2:
//   - Pestaña "Test de Felicidad" eliminada. El acceso al test es vía:
//     a) la cajita "Tu rueda" en el Resumen (que linkea a resultados o lección)
//     b) la lección "Test de Felicidad" en el Temario.
//   - Hero rediseñado: layout horizontal con la imagen del curso a la izquierda
//     en su ratio nativo (5:4), no full-width.
//   - La cajita "Tu rueda de la felicidad" del Resumen ahora muestra la rueda
//     COMPLETA con iconos y hover tooltips (módulo compartido).
//   - Mini-cards (Temario/Recursos/Mensajes) en su propia sección con
//     separador visual.
//   - Más breathing room en el header de "Las 8 dimensiones".

import { requireAuth } from "./auth.js";
import { api, ApiError } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";
import { icon, lessonIcon, lessonTipoLabel } from "./icons.js";
import { loaderHtml, startLoaderRotation } from "./loader.js";
import { mountRueda } from "./rueda.js";

const LOCAL_COVERS = new Set(["happiness-workshop"]);

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

// "test" REMOVED from valid tabs.
const VALID_TABS = ["resumen", "temario", "recursos", "mensajes"];

// ────────────────────────────────────────────────────────────────────
(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  const params = new URLSearchParams(location.search);
  const slug = params.get("slug");
  let tab = params.get("tab") || "resumen";
  // Backwards-compat: if URL still has tab=test, redirect intent to resumen.
  if (tab === "test") tab = "resumen";
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
    contentHtml: loaderHtml({ context: "curso" }),
  });
  const stopLoader = startLoaderRotation();

  try {
    const [data, resultadoTest] = await Promise.all([
      api.curso(slug),
      api.resultadosTest().catch(() => null),
    ]);
    stopLoader();
    renderDashboard(persona, slug, tab, data, resultadoTest);
  } catch (e) {
    stopLoader();
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
function renderDashboard(persona, slug, initialTab, payload, resultadoTest) {
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

  const panels = {
    resumen:  renderResumenTab(ctx),
    temario:  renderTemarioTab(ctx),
    recursos: renderRecursosTab(ctx),
    mensajes: renderMensajesTab(ctx),
  };

  renderShell({
    persona,
    title: curso.titulo,
    activePath: "/app/cursos",
    contentHtml: `
      ${renderHero(curso, coverUrl)}
      ${renderTabsNav(slug, initialTab)}
      <div class="tab-panels">
        ${VALID_TABS.map(t => `
          <section class="tab-panel ${t === initialTab ? "is-active" : ""}" data-tab="${t}" id="tab-${t}">
            ${panels[t]}
          </section>
        `).join("")}
      </div>
    `,
  });

  wireTabsClientSide(slug);

  // Mount the preview rueda inside the test card (only if user has results)
  if (resultadoTest?.tieneResultados && resultadoTest.scores) {
    const svg = document.getElementById("dashboard-rueda-svg");
    const tip = document.getElementById("dashboard-rueda-tooltip");
    if (svg && tip) {
      mountRueda({ svg, tooltip: tip, scores: resultadoTest.scores, animate: true, compact: true });
    }
  }
}

// ────────────────────────────────────────────────────────────────────
// Tab navigation (client-side, no reload)
// ────────────────────────────────────────────────────────────────────
function wireTabsClientSide(slug) {
  const tabsNav = document.querySelector(".tab-nav");
  if (!tabsNav) return;

  tabsNav.addEventListener("click", (e) => {
    const a = e.target.closest("[data-tab-target]");
    if (!a) return;
    e.preventDefault();
    const target = a.dataset.tabTarget;
    if (!VALID_TABS.includes(target)) return;
    activateTab(target, slug);
  });

  document.querySelector(".app-main")?.addEventListener("click", (e) => {
    const a = e.target.closest("[data-tab-jump]");
    if (!a) return;
    e.preventDefault();
    const target = a.dataset.tabJump;
    if (!VALID_TABS.includes(target)) return;
    activateTab(target, slug);
  });

  window.addEventListener("popstate", () => {
    const params = new URLSearchParams(location.search);
    let tab = params.get("tab") || "resumen";
    if (tab === "test") tab = "resumen";
    activateTab(tab, slug, /* updateHistory */ false);
  });
}

function activateTab(tab, slug, updateHistory = true) {
  if (!VALID_TABS.includes(tab)) tab = "resumen";

  document.querySelectorAll(".tab-nav__tab").forEach((el) => {
    const isActive = el.dataset.tabTarget === tab;
    el.classList.toggle("is-active", isActive);
    el.setAttribute("aria-selected", String(isActive));
  });

  document.querySelectorAll(".tab-panel").forEach((el) => {
    el.classList.toggle("is-active", el.dataset.tab === tab);
  });

  if (updateHistory) {
    const params = new URLSearchParams(location.search);
    params.set("tab", tab);
    history.pushState({ tab }, "", `?${params}`);
  }

  document.querySelector(`#tab-${tab}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ────────────────────────────────────────────────────────────────────
// Hero — horizontal layout: image (5:4) on the left, content on the right
// ────────────────────────────────────────────────────────────────────
function renderHero(curso, coverUrl) {
  return `
    <header class="curso-hero">
      <a href="/app/cursos" class="curso-hero__back">
        ${icon("chevronLeft")}
        <span>Mis cursos</span>
      </a>
      <div class="curso-hero__inner">
        <div class="curso-hero__cover">
          ${coverUrl
            ? `<img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(curso.titulo)}" loading="eager">`
            : `<div class="curso-hero__cover-placeholder">${escapeHtml(curso.titulo?.[0] || "S")}</div>`}
        </div>
        <div class="curso-hero__body">
          ${curso.modalidad ? `<span class="curso-hero__chip">${escapeHtml(curso.modalidad)}</span>` : ""}
          <h2 class="curso-hero__title">${escapeHtml(curso.titulo || "")}</h2>
          ${curso.descripcionCorta ? `<p class="curso-hero__lead">${escapeHtml(curso.descripcionCorta)}</p>` : ""}
        </div>
      </div>
    </header>
  `;
}

function renderTabsNav(slug, currentTab) {
  const tabs = [
    { id: "resumen",  label: "Resumen" },
    { id: "temario",  label: "Temario" },
    { id: "recursos", label: "Recursos" },
    { id: "mensajes", label: "Mensajes" },
  ];
  return `
    <nav class="tab-nav" role="tablist" aria-label="Secciones del curso">
      ${tabs.map(t => `
        <a role="tab"
           class="tab-nav__tab ${currentTab === t.id ? "is-active" : ""}"
           href="?slug=${encodeURIComponent(slug)}&tab=${t.id}"
           data-tab-target="${t.id}"
           aria-selected="${currentTab === t.id}">
          ${escapeHtml(t.label)}
        </a>
      `).join("")}
    </nav>
  `;
}

// ────────────────────────────────────────────────────────────────────
// TAB · Resumen
//   1. Header del tab
//   2. Continúa + Test de felicidad cajita (rueda completa)
//   3. Las 8 dimensiones (sección distinta)
//   4. Material adicional (mini-cards en su propia sección)
// ────────────────────────────────────────────────────────────────────
function renderResumenTab(ctx) {
  const { capitulos, totalLecc, completadas, progresoPct, next } = ctx;

  return `
    <header class="tab-panel-header">
      <span class="tab-panel-header__eyebrow">Tu camino</span>
      <h3 class="tab-panel-header__title">Continúa donde te quedaste</h3>
    </header>

    <div class="resumen-row">
      ${renderContinuePanel(next, capitulos, totalLecc, completadas, progresoPct)}
      ${renderTestCajita(ctx)}
    </div>

    <section class="pillar-grid">
      <header class="pillar-grid__header">
        <span class="pillar-grid__eyebrow">Las 8 dimensiones del bienestar</span>
        <h3 class="pillar-grid__title">Tu camino, capítulo por capítulo</h3>
        <p class="pillar-grid__sub">Cada dimensión se ilumina a medida que completas su capítulo.</p>
      </header>
      <div class="pillar-grid__grid">
        ${PILARES.map((p, i) => renderPillarIcon(p, i, capitulos)).join("")}
      </div>
    </section>

    <section class="resumen-extras">
      <header class="resumen-extras__header">
        <span class="resumen-extras__eyebrow">Material adicional</span>
        <h3 class="resumen-extras__title">Para profundizar</h3>
      </header>
      <div class="resumen-extras__grid">
        <a class="mini-tab-card" data-tab-jump="temario" href="?slug=${encodeURIComponent(ctx.slug)}&tab=temario">
          <div class="mini-tab-card__icon">${icon("temario")}</div>
          <div class="mini-tab-card__body">
            <span class="mini-tab-card__eyebrow">Temario</span>
            <h4 class="mini-tab-card__title">${capitulos.length} capítulos · ${totalLecc} lecciones</h4>
            <p class="mini-tab-card__lead">${completadas} completadas</p>
          </div>
          ${icon("arrowRight")}
        </a>
        <a class="mini-tab-card mini-tab-card--soft" data-tab-jump="recursos" href="?slug=${encodeURIComponent(ctx.slug)}&tab=recursos">
          <div class="mini-tab-card__icon">${icon("recursos")}</div>
          <div class="mini-tab-card__body">
            <span class="mini-tab-card__eyebrow">Recursos</span>
            <h4 class="mini-tab-card__title">Material descargable</h4>
            <p class="mini-tab-card__lead">Próximamente</p>
          </div>
          ${icon("arrowRight")}
        </a>
        <a class="mini-tab-card mini-tab-card--soft" data-tab-jump="mensajes" href="?slug=${encodeURIComponent(ctx.slug)}&tab=mensajes">
          <div class="mini-tab-card__icon">${icon("mensajes")}</div>
          <div class="mini-tab-card__body">
            <span class="mini-tab-card__eyebrow">Mensajes</span>
            <h4 class="mini-tab-card__title">Del instructor</h4>
            <p class="mini-tab-card__lead">Próximamente</p>
          </div>
          ${icon("arrowRight")}
        </a>
      </div>
    </section>
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

/**
 * Cajita del Test de Felicidad en el Resumen.
 * - Si NO ha tomado el test: card de invitación con botón a la lección del test
 * - Si SÍ ha tomado: card con la rueda COMPLETA (con iconos + hover) + link
 *   "Ver mis resultados" que va directo al análisis completo.
 */
function renderTestCajita(ctx) {
  const { capitulos, resultadoTest } = ctx;
  const testLecc = capitulos.flatMap(c => c.lecciones).find(l =>
    l.tipo === "test" && /felicidad/i.test(l.titulo + " " + (l.etiqueta || "")),
  );
  const taken = !!resultadoTest?.tieneResultados;
  const fecha = taken && resultadoTest.completedAt
    ? new Date(resultadoTest.completedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : "";

  if (!taken) {
    const href = testLecc ? `/app/leccion?id=${encodeURIComponent(testLecc.id)}` : "/app/cursos";
    return `
      <section class="test-cajita test-cajita--cta">
        <div class="test-cajita__header">
          <span class="test-cajita__eyebrow">Tu evaluación inicial</span>
          <h3 class="test-cajita__title">Test de Felicidad</h3>
        </div>
        <p class="test-cajita__lead">16 preguntas · 5 min · análisis personalizado en 8 pilares.</p>
        <a class="btn btn-accent btn-sm test-cajita__cta" href="${href}">
          <span>Tomar el test</span>
          ${icon("arrowRight")}
        </a>
      </section>
    `;
  }

  // Has results: full rueda preview with icons + hover, link to results
  return `
    <section class="test-cajita test-cajita--results">
      <div class="test-cajita__header">
        <span class="test-cajita__eyebrow">Tu evaluación · ${escapeHtml(fecha)}</span>
        <h3 class="test-cajita__title">Tu rueda de la felicidad</h3>
      </div>
      <div class="test-cajita__chart">
        <svg id="dashboard-rueda-svg" class="rueda-svg-preview"></svg>
        <div class="rueda-tooltip" id="dashboard-rueda-tooltip">
          <div class="rueda-tooltip__title"></div>
          <div class="rueda-tooltip__score"></div>
        </div>
      </div>
      <a class="test-cajita__link" href="/app/test-felicidad/resultados?id=${encodeURIComponent(resultadoTest.respuestaId)}">
        <span>Ver mis resultados</span>
        ${icon("arrowRight")}
      </a>
    </section>
  `;
}

function renderPillarIcon(pillar, idx, capitulos) {
  const cap = capitulos.find(c => c.orden === idx + 2);
  let progress = 0, total = 0, done = 0;
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

// ────────────────────────────────────────────────────────────────────
// TAB · Temario
// ────────────────────────────────────────────────────────────────────
function renderTemarioTab(ctx) {
  const { capitulos, totalLecc, completadas, progresoPct } = ctx;
  return `
    <header class="tab-panel-header">
      <span class="tab-panel-header__eyebrow">Temario</span>
      <h3 class="tab-panel-header__title">${capitulos.length} capítulos · ${totalLecc} lecciones · ${progresoPct}% completado</h3>
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
// TAB · Recursos / Mensajes
// ────────────────────────────────────────────────────────────────────
function renderRecursosTab(ctx) {
  return `
    <header class="tab-panel-header">
      <span class="tab-panel-header__eyebrow">Material complementario</span>
      <h3 class="tab-panel-header__title">Recursos</h3>
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
    <header class="tab-panel-header">
      <span class="tab-panel-header__eyebrow">Comunicaciones</span>
      <h3 class="tab-panel-header__title">Mensajes</h3>
    </header>
    <div class="placeholder-state">
      <div class="placeholder-state__icon">${icon("mensajes")}</div>
      <h4>En construcción</h4>
      <p>Anuncios y mensajes del instructor aparecerán aquí. También podrás responder.</p>
    </div>
  `;
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────
function findNextLeccion(capitulos) {
  for (const c of capitulos) for (const l of c.lecciones) if (!l.completada) return l;
  return null;
}

function emptyState(title, desc, extra = "") {
  return `<div class="empty-state"><div class="empty-state__title">${title}</div><p class="empty-state__desc">${desc}</p>${extra}</div>`;
}
