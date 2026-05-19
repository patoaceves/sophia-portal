// SOPHIA Portal · Dashboard del curso
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
import { mountForo } from "./foro.js";
import { renderComposerPill, wireComposerPill } from "./foro-composer-pill.js";
import { openForoLightbox } from "./foro-lightbox.js";

const LOCAL_COVERS = new Set(["happiness-workshop"]);

const PILARES = [
  { key: "autoconocimiento",      file: "autoconocimiento",      dim: "mental",    name: "Autoconocimiento" },      // mod 2
  { key: "bienestar_fisico",      file: "bienestar-fisico",      dim: "fisico",    name: "Bienestar Físico" },       // mod 3
  { key: "presencia_consciente",  file: "presencia-consciente",  dim: "fisico",    name: "Presencia Consciente" },   // mod 4
  { key: "bienestar_emocional",   file: "bienestar-emocional",   dim: "afectivo",  name: "Bienestar Emocional" },    // mod 5
  { key: "trabajo_proposito",     file: "trabajo-proposito",     dim: "mental",    name: "Trabajo con Propósito" },  // mod 6
  { key: "estetica_existencial",  file: "estetica-existencial",  dim: "spiritual", name: "Estética Existencial" },   // mod 7
  { key: "vinculos_vitales",      file: "vinculos-vitales",      dim: "afectivo",  name: "Vínculos Vitales" },       // mod 8
  { key: "fe_filosofia",          file: "fe-filosofia",          dim: "spiritual", name: "Fe y Filosofía" },         // mod 9
];

// "test" REMOVED from valid tabs.
// "mensajes" → renamed to "foro" (mensajes redirige a foro por compat).
const VALID_TABS = ["resumen", "temario", "recursos", "foro"];

// ────────────────────────────────────────────────────────────────────
(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  const params = new URLSearchParams(location.search);
  const slug = params.get("slug");
  let tab = params.get("tab") || "resumen";
  // Backwards-compat: if URL still has tab=test, redirect intent to resumen.
  if (tab === "test") tab = "resumen";
  // Backwards-compat: tab=mensajes ahora es foro
  if (tab === "mensajes") tab = "foro";
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
    const [data, resultadoTest, resultadoAutoconocimiento] = await Promise.all([
      api.curso(slug),
      api.resultadosTest().catch(() => null),
      api.resultadosAutoconocimiento().catch(() => null),
    ]);
    stopLoader();
    renderDashboard(persona, slug, tab, data, resultadoTest, resultadoAutoconocimiento);
  } catch (e) {
    stopLoader();
    console.error("get-curso failed:", e);
    document.querySelector(".app-main").innerHTML = emptyState(
      "No pudimos cargar este curso",
      escapeHtml(e.message || "Intenta recargar."),
      e instanceof ApiError && e.status === 403
        ? `<a href="/app/cursos" class="btn btn-secondary" style="margin-top:var(--s-4);">${icon("arrowLeft")}<span>Volver a mis cursos</span></a>`
        : ""
    );
  }
})();

// ────────────────────────────────────────────────────────────────────
function renderDashboard(persona, slug, initialTab, payload, resultadoTest, resultadoAutoconocimiento) {
  const { curso, inscripcion, modulos } = payload;

  const totalLecc = modulos.reduce((s, c) => s + c.lecciones.length, 0);
  const completadas = modulos.reduce(
    (s, c) => s + c.lecciones.filter((l) => l.completada).length, 0,
  );
  const progresoPct = totalLecc > 0 ? Math.round((completadas / totalLecc) * 100) : 0;

  const next = findNextLeccion(modulos);

  const coverUrl = curso.coverUrl
    || (LOCAL_COVERS.has(slug) ? `/assets/img/${slug}/portada.png` : null);

  const ctx = { persona, slug, curso, inscripcion, modulos, totalLecc, completadas, progresoPct, next, resultadoTest, resultadoAutoconocimiento };

  const panels = {
    resumen:  renderResumenTab(ctx),
    temario:  renderTemarioTab(ctx),
    recursos: renderRecursosTab(ctx),
    foro:     renderForoTab(ctx),
  };

  renderShell({
    persona,
    title: curso.titulo,
    activePath: "/app/cursos",
    contentHtml: `
      ${renderHero(curso, coverUrl, ctx)}
      ${renderProgressStrip(ctx)}
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

  // Si la URL llegó con tab=foro, montar el foro inmediatamente
  // (los activateTab futuros lo manejan vía ensureForoMounted).
  if (initialTab === "foro") {
    ensureForoMounted();
  }

  // Mount the preview rueda inside the test card (only if user has results)
  if (resultadoTest?.tieneResultados && resultadoTest.scores) {
    const svg = document.getElementById("dashboard-rueda-svg");
    const tip = document.getElementById("dashboard-rueda-tooltip");
    if (svg && tip) {
      mountRueda({ svg, tooltip: tip, scores: resultadoTest.scores, animate: true, compact: true });
    }
  }

  // Mount mini-wedge inside the pillar-icon hover popup for Autoconocimiento.
  // (Previously vivía en la cajita standalone del dashboard; ahora vive
  // dentro del popup que aparece al hacer hover sobre la card del pilar.)
  if (resultadoAutoconocimiento?.tieneResultados && typeof resultadoAutoconocimiento.pct === "number") {
    const wedgeMount = document.getElementById("pillar-popup-wedge-autoconocimiento");
    if (wedgeMount) {
      drawMiniWedge(wedgeMount, resultadoAutoconocimiento.pct, "#66a3f4");
    }
  }

  // Sincronizar altura del foro con la del diagrama de felicidad.
  // La altura "tope" del row la define el diagrama (más compacto): medimos
  // su altura con ResizeObserver y la aplicamos al foro como max-height
  // (via CSS var --resumen-row-height). El foro hace scroll interno si su
  // contenido excede ese tope. Solo aplica en desktop (>= 901px); en
  // mobile el grid es de una columna y no tiene sentido limitar.
  matchResumenColumnHeights();

  // Cargar preview del foro en background (la card vive en el resumen,
  // que es el tab default). Si el usuario aterriza en otro tab, igual
  // se carga para que esté listo cuando vuelva al resumen.
  fetchForoPreview(ctx.curso.id);

  // Prefetch en background: lección siguiente + todas las del primer módulo
  // Esto hace que la primera navegacion sea instantanea (sin cold start)
  setTimeout(() => {
    if (ctx.next?.id) api.leccion(ctx.next.id).catch(() => {});
    const primerasLecciones = (ctx.modulos[0]?.lecciones ?? []).slice(0, 4);
    primerasLecciones.forEach(l => api.leccion(l.id).catch(() => {}));
  }, 1200);
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
    if (tab === "mensajes") tab = "foro";
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

  // Solo scroll cuando los tabs están fuera del viewport, y scrollea hacia
  // los TABS (no el panel) para que sigan visibles después del cambio.
  const tabsNav = document.querySelector(".tab-nav");
  if (tabsNav) {
    const rect = tabsNav.getBoundingClientRect();
    const isAbove = rect.bottom < 0;
    const isBelow = rect.top > window.innerHeight;
    if (isAbove || isBelow) {
      tabsNav.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Lazy-mount del foro: solo cuando el usuario activa el tab por primera vez.
  if (tab === "foro") {
    ensureForoMounted();
    // El usuario está viendo el foro → marcar todo como leído + limpiar badge
    markForoSeen();
  } else if (tab === "resumen") {
    // Volvimos al resumen: re-fetchear el preview por si el usuario posteó
    // algo nuevo en la pestaña Foro.
    const cursoId = document.querySelector('[data-foro-preview]')?.dataset.cursoId;
    if (cursoId) fetchForoPreview(cursoId);
  }
}

/**
 * LocalStorage key para tracking de última visita al foro por curso.
 */
function foroSeenKey(cursoId) {
  return `sophia_foro_last_seen_${cursoId}`;
}

function getForoLastSeen(cursoId) {
  try { return localStorage.getItem(foroSeenKey(cursoId)) || ""; }
  catch { return ""; }
}

function markForoSeen() {
  const cursoId = document.querySelector('[data-foro-preview]')?.dataset.cursoId
    || document.querySelector('[data-foro-mount]')?.dataset.cursoId;
  if (!cursoId) return;
  try { localStorage.setItem(foroSeenKey(cursoId), new Date().toISOString()); }
  catch { /* ignore */ }
  // Limpiar badge inmediatamente
  const badge = document.getElementById("foroTabBadge");
  if (badge) { badge.textContent = ""; badge.classList.remove("is-visible"); }
}

/**
 * Cuenta posts/comentarios nuevos desde la última visita al foro por el
 * usuario, excluyendo los que él mismo creó. Actualiza el badge en el tab.
 */
function updateForoBadge(posts) {
  const badge = document.getElementById("foroTabBadge");
  if (!badge || !Array.isArray(posts)) return;
  const cursoId = document.querySelector('[data-foro-preview]')?.dataset.cursoId
    || document.querySelector('[data-foro-mount]')?.dataset.cursoId;
  const lastSeen = getForoLastSeen(cursoId);

  const flat = [];
  for (const p of posts) {
    if (!p.eliminado) flat.push(p);
    if (Array.isArray(p.comentarios)) {
      for (const c of p.comentarios) {
        if (!c.eliminado) flat.push(c);
      }
    }
  }

  let count = 0;
  for (const item of flat) {
    if (item.esAutor) continue;
    if (!item.fechaISO) continue;
    if (!lastSeen || item.fechaISO > lastSeen) count += 1;
  }

  if (count > 0) {
    badge.textContent = count > 9 ? "9+" : String(count);
    badge.classList.add("is-visible");
  } else {
    badge.textContent = "";
    badge.classList.remove("is-visible");
  }
}

/** Monta el módulo foro.js dentro del placeholder, una sola vez. */
function ensureForoMounted() {
  const mount = document.querySelector('[data-foro-mount]');
  if (!mount) return;
  if (mount.dataset.mounted === "true") return;
  mount.dataset.mounted = "true";
  const cursoId = mount.dataset.cursoId;
  if (!cursoId) return;
  mountForo({ container: mount, cursoId });
}

// ────────────────────────────────────────────────────────────────────
// Hero · horizontal layout: image (5:4) on the left, content on the right
//
// Right side now includes additional metadata: directora del programa
// and current chapter ("Vas en el módulo X de N").
// ────────────────────────────────────────────────────────────────────
function renderHero(curso, coverUrl, ctx) {
  const directora = ctx?.curso?.instructor || "Mariana Riojas";
  const moduloEnCurso = findCurrentModulo(ctx?.modulos || []);
  const totalModulos = ctx?.modulos?.length || 0;

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
          <dl class="curso-hero__meta">
            ${directora ? `
              <div class="curso-hero__meta-item">
                <dt>Directora del programa</dt>
                <dd>${escapeHtml(directora)}</dd>
              </div>
            ` : ""}
            ${moduloEnCurso ? `
              <div class="curso-hero__meta-item">
                <dt>${moduloEnCurso.done ? "Completado" : "Vas en"}</dt>
                <dd>${moduloEnCurso.done
                  ? `${totalModulos} de ${totalModulos} módulos`
                  : `Módulo ${moduloEnCurso.orden}${totalModulos ? ` de ${totalModulos}` : ""}`}</dd>
              </div>
            ` : ""}
          </dl>
        </div>
      </div>
    </header>
  `;
}

/**
 * Find the chapter the student is currently in (first one with at least
 * one incomplete lesson). Returns { orden, done } or null if all done.
 */
function findCurrentModulo(modulos) {
  for (const c of modulos) {
    const incomplete = c.lecciones.some(l => !l.completada);
    if (incomplete) return { orden: c.orden, done: false };
  }
  if (modulos.length > 0) return { orden: modulos.length, done: true };
  return null;
}

function renderTabsNav(slug, currentTab) {
  const tabs = [
    { id: "resumen",  label: "Resumen" },
    { id: "temario",  label: "Temario" },
    { id: "recursos", label: "Recursos" },
    { id: "foro",     label: "Foro" },
  ];
  return `
    <nav class="tab-nav" role="tablist" aria-label="Secciones del curso">
      ${tabs.map(t => `
        <a role="tab"
           class="tab-nav__tab ${currentTab === t.id ? "is-active" : ""}"
           href="?slug=${encodeURIComponent(slug)}&tab=${t.id}"
           data-tab-target="${t.id}"
           aria-selected="${currentTab === t.id}">
          <span>${escapeHtml(t.label)}</span>
          ${t.id === "foro" ? `<span class="tab-nav__badge" id="foroTabBadge" aria-label="Publicaciones nuevas"></span>` : ""}
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
  const { modulos, totalLecc, completadas, resultadoAutoconocimiento, slug } = ctx;

  return `
    <div class="resumen-row">
      ${renderForoPreviewCard(ctx)}
      ${renderTestCajita(ctx)}
    </div>

    <section class="pillar-grid">
      <header class="pillar-grid__header">
        <span class="pillar-grid__eyebrow">Las 8 dimensiones del bienestar</span>
        <h3 class="pillar-grid__title">Tu camino, módulo por módulo</h3>
        <p class="pillar-grid__sub">Cada dimensión se ilumina a medida que completas su módulo.</p>
      </header>
      <div class="pillar-grid__grid">
        ${PILARES.map((p, i) => renderPillarIcon(p, i, modulos, { resultadoAutoconocimiento, slug })).join("")}
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
            <h4 class="mini-tab-card__title">${modulos.length} módulos · ${totalLecc} lecciones</h4>
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
        <a class="mini-tab-card" data-tab-jump="foro" href="?slug=${encodeURIComponent(ctx.slug)}&tab=foro">
          <div class="mini-tab-card__icon">${icon("mensajes")}</div>
          <div class="mini-tab-card__body">
            <span class="mini-tab-card__eyebrow">Foro</span>
            <h4 class="mini-tab-card__title">Conversación del grupo</h4>
            <p class="mini-tab-card__lead">Comparte y responde</p>
          </div>
          ${icon("arrowRight")}
        </a>
      </div>
    </section>
  `;
}

/**
 * Strip horizontal de progreso debajo del hero. Sustituye al old continue-card
 * que vivía en el resumen-row. Muestra: barra de progreso (full width) + 
 * descripción de qué sigue + botón continuar.
 */
function renderProgressStrip(ctx) {
  const { modulos, totalLecc, completadas, progresoPct, next, slug } = ctx;

  if (!next) {
    return `
      <section class="curso-progress-strip curso-progress-strip--done">
        <div class="curso-progress-strip__main">
          <span class="curso-progress-strip__eyebrow">¡Felicidades!</span>
          <p class="curso-progress-strip__meta">Has completado el curso · ${totalLecc} de ${totalLecc} lecciones</p>
          <div class="curso-progress-strip__bar">
            <div class="curso-progress-strip__bar-fill" style="width:100%"></div>
          </div>
        </div>
      </section>
    `;
  }

  const mod = modulos.find(c => c.lecciones.some(l => l.id === next.id));
  return `
    <section class="curso-progress-strip">
      <div class="curso-progress-strip__main">
        <span class="curso-progress-strip__eyebrow">${progresoPct === 0 ? "Para comenzar" : "Continúa donde te quedaste"}</span>
        <p class="curso-progress-strip__meta">
          ${mod ? `Módulo ${mod.orden} · ` : ""}
          <strong>${escapeHtml(next.titulo)}</strong>
          · ${completadas} de ${totalLecc} lecciones (${progresoPct}%)
        </p>
        <div class="curso-progress-strip__bar">
          <div class="curso-progress-strip__bar-fill" style="width:${progresoPct}%"></div>
        </div>
      </div>
      <a class="btn btn-accent curso-progress-strip__cta" href="/app/leccion?id=${encodeURIComponent(next.id)}">
        <span>${progresoPct === 0 ? "Comenzar" : "Continuar"}</span>
        ${icon("arrowRight")}
      </a>
    </section>
  `;
}

/**
 * Card del Resumen que muestra los posts más recientes del foro.
 * Contenido se rellena por fetch en background (renderForoPreview).
 */
function renderForoPreviewCard(ctx) {
  return `
    <section class="foro-preview-card" data-foro-preview data-curso-id="${escapeHtml(ctx.curso.id)}" data-curso-slug="${escapeHtml(ctx.slug)}">
      <header class="foro-preview-card__header">
        <span class="foro-preview-card__eyebrow">Conversación reciente</span>
        <h3 class="foro-preview-card__title">Foro</h3>
      </header>

      <div data-foro-preview-compose>
        ${renderComposerPill(ctx.persona)}
      </div>

      <div class="foro-preview-card__body" data-foro-preview-body>
        <div class="foro-skeleton__row loading-skeleton" style="height: 56px; margin-bottom: 12px;"></div>
        <div class="foro-skeleton__row loading-skeleton" style="height: 56px;"></div>
      </div>

      <button type="button" class="foro-preview-card__link" data-foro-preview-link>
        <span>Ver foro completo</span>
        ${icon("arrowRight")}
      </button>
    </section>
  `;
}

/**
 * Carga los posts más recientes del foro y los pinta en la card del resumen.
 * Fire-and-forget. Si falla (por ej. el usuario no está inscrito), simplemente
 * pone un mensaje de empty/error y no bloquea el dashboard.
 */
async function fetchForoPreview(cursoId) {
  const card = document.querySelector('[data-foro-preview]');
  if (!card) return;
  const body = card.querySelector('[data-foro-preview-body]');
  if (!body) return;

  // Asegurar que el composer inline esté wired (idempotente)
  wireForoPreviewCompose(card);

  try {
    const data = await api.foroPosts(cursoId);
    // Actualizar badge del tab con el conteo de "nuevos"
    updateForoBadge(data?.posts ?? []);

    const posts = (data?.posts ?? []).filter(p => !p.eliminado).slice(0, 2);
    if (posts.length === 0) {
      body.innerHTML = `
        <div class="foro-preview-card__empty">
          <p>Aún no hay publicaciones.</p>
          <p class="foro-preview-card__empty-sub">Sé la primera persona en compartir.</p>
        </div>
      `;
      return;
    }
    body.innerHTML = posts.map(p => {
      const url = (p.autor?.avatarUrl || "").trim();
      const initials = p.autor?.iniciales || "?";
      const avatarInner = url
        ? `<img src="${escapeHtml(url)}" alt="" referrerpolicy="no-referrer" loading="lazy">`
        : escapeHtml(initials);

      // Indicador de adjunto: thumbnail si imagen, icono si video/archivo
      const adjuntoUrl = (p.adjuntoUrl || "").trim();
      const adjuntoTipo = (p.adjuntoTipo || "").trim();
      let adjuntoHtml = "";
      if (adjuntoUrl && adjuntoTipo === "imagen") {
        adjuntoHtml = `<button type="button" class="foro-preview-item__thumb" data-action="open-lightbox" data-post-id="${escapeHtml(p.id)}" aria-label="Ver imagen en grande"><img src="${escapeHtml(adjuntoUrl)}" alt="" loading="lazy"></button>`;
      } else if (adjuntoUrl && adjuntoTipo === "video") {
        adjuntoHtml = `<span class="foro-preview-item__attach-tag">▶ Video</span>`;
      } else if (adjuntoUrl && adjuntoTipo === "archivo") {
        adjuntoHtml = `<span class="foro-preview-item__attach-tag">📎 Archivo</span>`;
      }

      // Conteo de comentarios (solo si hay)
      const numComments = Array.isArray(p.comentarios)
        ? p.comentarios.filter(c => !c.eliminado).length
        : 0;
      const commentsHtml = numComments > 0
        ? `<span class="foro-preview-item__comments">
             ${icon("mensajes")}
             <span>${numComments} ${numComments === 1 ? "comentario" : "comentarios"}</span>
           </span>`
        : "";

      return `
        <article class="foro-preview-item" data-post-id="${escapeHtml(p.id)}" tabindex="0" role="link" aria-label="Ver post de ${escapeHtml(displayName(p.autor))}">
          <div class="foro-preview-item__avatar ${url ? "has-photo" : ""}">${avatarInner}</div>
          <div class="foro-preview-item__body">
            <div class="foro-preview-item__head">
              <span class="foro-preview-item__author">${escapeHtml(displayName(p.autor))}</span>
              <span class="foro-preview-item__time">${escapeHtml(formatRelativeDate(p.fechaISO))}</span>
            </div>
            ${p.contenido ? `<p class="foro-preview-item__excerpt">${escapeHtml(truncate(p.contenido, 160))}</p>` : ""}
            ${adjuntoHtml}
            ${commentsHtml}
          </div>
        </article>
      `;
    }).join("");
  } catch (e) {
    console.warn("foro preview fetch failed:", e);
    body.innerHTML = `
      <div class="foro-preview-card__empty">
        <p>No pudimos cargar el foro.</p>
      </div>
    `;
  }
}

/**
 * Conecta el composer inline del preview del foro. Estilo Facebook:
 * pill colapsado por default, expande a composer completo on click.
 * Soporta adjuntos (imagen/video/archivo) idénticos al foro completo.
 * Idempotente: solo wirea una vez por instancia del card.
 */
function wireForoPreviewCompose(card) {
  if (!card || card.dataset.composeWired === "true") return;
  card.dataset.composeWired = "true";

  const cursoId = card.dataset.cursoId;

  // Composer pill compartido (módulo foro-composer-pill.js)
  const formContainer = card.querySelector("[data-foro-preview-compose]");
  const form = formContainer?.querySelector("[data-foro-pill]");
  if (form && cursoId) {
    wireComposerPill(form, {
      cursoId,
      onPublished: () => fetchForoPreview(cursoId),
    });
  }

  // "Ver foro completo" → activateTab(foro) sin recargar la página
  const verLink = card.querySelector("[data-foro-preview-link]");
  if (verLink) {
    verLink.addEventListener("click", (e) => {
      e.preventDefault();
      const slug = card.dataset.cursoSlug;
      activateTab("foro", slug);
    });
  }

  // Click en cualquier post del preview → navega al foro + scroll al post
  // (delegated porque los items se re-renderean al refrescar el preview)
  card.addEventListener("click", async (e) => {
    // No interferir si el click viene del composer (que está dentro del card)
    if (e.target.closest("[data-foro-preview-compose]")) return;
    if (e.target.closest("[data-foro-preview-link]")) return;

    // Click en el thumbnail de imagen → abrir lightbox modal con post + comments
    const thumbBtn = e.target.closest('[data-action="open-lightbox"]');
    if (thumbBtn) {
      e.stopPropagation();
      const postId = thumbBtn.dataset.postId;
      try {
        const data = await api.foroPosts(cursoId);
        const post = (data?.posts ?? []).find(p => p.id === postId);
        if (post) {
          openForoLightbox({
            post,
            cursoId,
            yo: window.__sophiaPersona || {},
            onChange: () => fetchForoPreview(cursoId),
          });
        }
      } catch (err) {
        console.error("preview lightbox failed:", err);
      }
      return;
    }

    const item = e.target.closest("[data-post-id]");
    if (!item) return;
    const postId = item.dataset.postId;
    if (!postId) return;
    const slug = card.dataset.cursoSlug;
    activateTab("foro", slug);
    // Esperar a que el foro termine de mountar/render, luego scrollear al post
    setTimeout(() => scrollToForoPost(postId), 100);
  });

  // Soporte teclado (Enter/Espacio sobre items) para a11y
  card.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const item = e.target.closest(".foro-preview-item[data-post-id]");
    if (!item) return;
    e.preventDefault();
    const postId = item.dataset.postId;
    const slug = card.dataset.cursoSlug;
    activateTab("foro", slug);
    setTimeout(() => scrollToForoPost(postId), 100);
  });
}

function scrollToForoPost(postId, retries = 12) {
  if (!postId) return;
  const post = document.querySelector(`[data-post-id="${CSS.escape(postId)}"].foro-post`);
  if (post) {
    post.scrollIntoView({ behavior: "smooth", block: "center" });
    post.classList.add("is-highlighted");
    setTimeout(() => post.classList.remove("is-highlighted"), 2200);
    return;
  }
  // El foro está montando aún (red + render): reintentar
  if (retries > 0) {
    setTimeout(() => scrollToForoPost(postId, retries - 1), 200);
  }
}

/**
 * Sincroniza la altura del foro preview con la del diagrama de felicidad.
 *
 * Idea: el diagrama es naturalmente más compacto que el foro (que crece con
 * cada post). Queremos que el alto del row lo defina el diagrama, no el foro.
 *
 * Implementación: ResizeObserver mide la altura del .test-cajita--results
 * y la escribe en --resumen-row-height en el .foro-preview-card. El CSS
 * usa esa var como max-height + el body es overflow-y: auto.
 *
 * Si no hay diagrama (test no completado, falta data), no aplicamos nada
 * y ambos quedan en altura natural sin scroll.
 *
 * Solo desktop (>= 901px): en mobile el grid es 1 columna y matchear
 * alturas no aplica.
 */
function matchResumenColumnHeights() {
  const diagram = document.querySelector(".test-cajita--results");
  const foro = document.querySelector(".foro-preview-card");
  if (!diagram || !foro) return;

  const apply = () => {
    if (window.matchMedia("(max-width: 900px)").matches) {
      foro.style.removeProperty("--resumen-row-height");
      return;
    }
    const h = Math.round(diagram.getBoundingClientRect().height);
    if (h > 0) {
      foro.style.setProperty("--resumen-row-height", `${h}px`);
    }
  };

  // Aplicar una vez de entrada (el diagrama puede aún no estar al alto final
  // si el SVG está rendereándose, pero el ResizeObserver va a re-aplicar).
  apply();

  // Observar cambios de tamaño del diagrama (resize de ventana, fonts loading)
  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(() => apply());
    ro.observe(diagram);
  }

  // También resync al cambiar el breakpoint mobile/desktop
  window.addEventListener("resize", apply);
}

function displayName(autor) {
  if (!autor) return "Anónimo";
  const n = (autor.nombre || "").trim();
  const a = (autor.apellidos || "").trim();
  return [n, a].filter(Boolean).join(" ") || "Anónimo";
}

function formatRelativeDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `hace ${diffD} d`;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function truncate(s, n) {
  s = String(s ?? "").trim();
  return s.length > n ? s.slice(0, n - 1).trim() + "…" : s;
}

/**
 * Cajita del Test de Felicidad en el Resumen.
 * - Si NO ha tomado el test: card de invitación con botón a la lección del test
 * - Si SÍ ha tomado: card con la rueda COMPLETA (con iconos + hover) + link
 *   "Ver mis resultados" que va directo al análisis completo.
 */
function renderTestCajita(ctx) {
  const { modulos, resultadoTest } = ctx;
  const testLecc = modulos.flatMap(c => c.lecciones).find(l =>
    l.tipo === "test" && /felicidad/i.test(l.titulo + " " + (l.etiqueta || "")),
  );
  const taken = !!resultadoTest?.tieneResultados;
  const fecha = taken && resultadoTest.completedAt
    ? new Date(resultadoTest.completedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : "";

  if (!taken) {
    return `
      <section class="test-cajita test-cajita--locked">
        <div class="test-cajita__header">
          <span class="test-cajita__eyebrow">Tu evaluación inicial</span>
          <h3 class="test-cajita__title">Tu diagrama de felicidad</h3>
        </div>
        <p class="test-cajita__lead">Completa el Módulo 1 y obtén tu diagnóstico personalizado en 8 pilares.</p>
      </section>
    `;
  }

  // Has results: full rueda preview with icons + hover, link to results
  return `
    <section class="test-cajita test-cajita--results">
      <div class="test-cajita__header">
        <span class="test-cajita__eyebrow">Tu evaluación · ${escapeHtml(fecha)}</span>
        <h3 class="test-cajita__title">Tu diagrama de felicidad</h3>
      </div>
      <div class="test-cajita__chart">
        <svg id="dashboard-rueda-svg" class="rueda-svg-preview"></svg>
        <div class="rueda-tooltip" id="dashboard-rueda-tooltip">
          <div class="rueda-tooltip__title"></div>
          <div class="rueda-tooltip__score"></div>
        </div>
      </div>
      <a class="test-cajita__link" href="/app/test-felicidad/resultados?id=${encodeURIComponent(resultadoTest.respuestaId)}&slug=${encodeURIComponent(ctx.slug)}">
        <span>Ver mis resultados</span>
        ${icon("arrowRight")}
      </a>
    </section>
  `;
}

function renderPillarIcon(pillar, idx, modulos, autoevalCtx = {}) {
  const mod = modulos.find(c => c.orden === idx + 2);
  let progress = 0, total = 0, done = 0;
  if (mod) {
    total = mod.lecciones.length;
    done = mod.lecciones.filter(l => l.completada).length;
    progress = total > 0 ? done / total : 0;
  }
  const state = !mod ? "locked"
    : progress === 1 && total > 0 ? "done"
    : progress > 0 ? "in-progress"
    : "todo";

  // Use the gray PNG when not done (already gray, no CSS filter needed).
  // Use the color SVG when done (full color, full saturation).
  const iconSrc = state === "done"
    ? `/assets/img/happiness-workshop/pilares/${pillar.file}.svg`
    : `/assets/img/happiness-workshop/pilares/${pillar.file}-gris.png`;

  // Si este pilar tiene una autoevaluación tomada, renderea el hover popup
  // con el wedge, banda y link. Por ahora SOLO autoconocimiento tiene
  // autoeval (las demás dimensiones tendrán su autoeval en futuras versiones).
  const popupHtml = renderPillarAutoevalPopup(pillar, autoevalCtx);

  return `
    <article class="pillar-icon pillar-icon--${pillar.dim} pillar-icon--${state}${popupHtml ? " pillar-icon--has-popup" : ""}">
      <div class="pillar-icon__visual">
        <img src="${iconSrc}" alt="" aria-hidden="true">
        ${state === "done" ? `<span class="pillar-icon__check">${icon("check")}</span>` : ""}
      </div>
      <div class="pillar-icon__name">${escapeHtml(pillar.name)}</div>
      ${mod ? `
        <div class="pillar-icon__modulo">Módulo ${mod.orden}</div>
        <div class="pillar-icon__progress">
          <div class="pillar-icon__progress-fill" style="width: ${progress * 100}%;"></div>
        </div>
        <div class="pillar-icon__count">${done} / ${total}</div>
      ` : `
        <div class="pillar-icon__modulo">Por publicarse</div>
      `}
      ${popupHtml}
    </article>
  `;
}

/**
 * Hover popup con el resultado de la autoevaluación del pilar.
 *
 * Aparece encima de la card del pilar cuando el alumno está en hover (o el
 * elemento está enfocado) Y existe un resultado para ese pilar. Por ahora
 * sólo Autoconocimiento tiene autoevaluación; las demás dimensiones se
 * agregarán cuando se publiquen sus tests.
 *
 * Devuelve "" si no hay resultado → la card no muestra popup ni gana la
 * clase `--has-popup`.
 */
function renderPillarAutoevalPopup(pillar, { resultadoAutoconocimiento, slug } = {}) {
  if (pillar.key === "autoconocimiento" && resultadoAutoconocimiento?.tieneResultados) {
    const pct = resultadoAutoconocimiento.pct || 0;
    const banda = resultadoAutoconocimiento.banda || "";
    const bandaColor = resultadoAutoconocimiento.bandaColor || "#888";
    const lead = resultadoAutoconocimiento.lead || "";
    const steps = Array.isArray(resultadoAutoconocimiento.steps) ? resultadoAutoconocimiento.steps : [];
    const fecha = resultadoAutoconocimiento.completedAt
      ? new Date(resultadoAutoconocimiento.completedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
      : "";
    const linkHref = `/app/test-autoconocimiento/resultados?id=${encodeURIComponent(resultadoAutoconocimiento.respuestaId)}&slug=${encodeURIComponent(slug || "")}`;
    // Mostramos hasta los primeros 2 pasos para mantener el popup compacto;
    // el detalle completo (todos los steps + nota) está en el link.
    const stepsHtml = steps.length > 0
      ? `
        <div class="pillar-icon__popup-steps">
          <div class="pillar-icon__popup-steps-label">Siguiente paso</div>
          <ul>${steps.slice(0, 2).map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
        </div>
      `
      : "";
    return `
      <div class="pillar-icon__popup" data-pillar-key="${pillar.key}">
        <div class="pillar-icon__popup-eyebrow">Tu autoevaluación · ${escapeHtml(fecha)}</div>
        <div class="pillar-icon__popup-top">
          <div class="pillar-icon__popup-wedge">
            <div id="pillar-popup-wedge-${pillar.key}" class="autoeval-mini-wedge"></div>
            <div class="autoeval-mini-wedge__pct">${pct}%</div>
          </div>
          <div class="pillar-icon__popup-band-wrap">
            <div class="autoeval-band-tag" style="color: ${bandaColor};">
              ${escapeHtml(banda)}
            </div>
          </div>
        </div>
        ${lead ? `<p class="pillar-icon__popup-lead">${escapeHtml(lead)}</p>` : ""}
        ${stepsHtml}
        <a class="pillar-icon__popup-link" href="${linkHref}">
          <span>Ver resultado completo</span>
          ${icon("arrowRight")}
        </a>
      </div>
    `;
  }
  return "";
}

/**
 * Cajita de la Autoevaluación de Autoconocimiento en el Resumen.
 *
 * - Si NO la tomó: card de invitación (sólo si el mod 2 ya está publicado).
 * - Si SÍ la tomó: card con mini-wedge SVG + banda + % + link.
 *
 * Vive en su propia fila debajo del resumen-row para mantener el alto
 * matched entre foro y rueda de felicidad.
 */
function renderAutoconocimientoCajita(ctx) {
  const { modulos, resultadoAutoconocimiento, slug } = ctx;

  const mod2 = modulos.find(c => c.orden === 2);
  if (!mod2) return ""; // módulo aún no publicado → no mostrar

  const taken = !!resultadoAutoconocimiento?.tieneResultados;
  const fecha = taken && resultadoAutoconocimiento.completedAt
    ? new Date(resultadoAutoconocimiento.completedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : "";

  const autoevalLecc = mod2.lecciones.find(l => l.tipo === "autoeval");
  const ctaHref = autoevalLecc
    ? `/app/leccion?id=${encodeURIComponent(autoevalLecc.id)}`
    : `/app/curso?slug=${encodeURIComponent(slug)}&tab=temario`;

  if (!taken) {
    return `
      <section class="autoeval-cajita autoeval-cajita--locked">
        <div class="autoeval-cajita__header">
          <span class="autoeval-cajita__eyebrow">Tu autoevaluación · Módulo 2</span>
          <h3 class="autoeval-cajita__title">Tu integración del Autoconocimiento</h3>
        </div>
        <p class="autoeval-cajita__lead">
          8 preguntas para medir qué tan integrado tienes el autoconocimiento
          en tu vida, según los 8 niveles del modelo SOPHIA. ~3 min.
        </p>
        <a class="autoeval-cajita__cta btn btn-accent" href="${ctaHref}">
          <span>Comenzar evaluación</span>
          ${icon("arrowRight")}
        </a>
      </section>
    `;
  }

  const pct = resultadoAutoconocimiento.pct || 0;
  const banda = resultadoAutoconocimiento.banda || "";
  const bandaColor = resultadoAutoconocimiento.bandaColor || "#888";

  return `
    <section class="autoeval-cajita autoeval-cajita--results">
      <div class="autoeval-cajita__split">
        <div class="autoeval-cajita__wedge">
          <div id="autoeval-mini-wedge" class="autoeval-mini-wedge"></div>
          <div class="autoeval-mini-wedge__pct">${pct}%</div>
        </div>
        <div class="autoeval-cajita__info">
          <span class="autoeval-cajita__eyebrow">Tu autoevaluación · ${escapeHtml(fecha)}</span>
          <h3 class="autoeval-cajita__title">Autoconocimiento</h3>
          <div class="autoeval-band-tag" style="color: ${bandaColor};">
            ${escapeHtml(banda)}
          </div>
          <a class="autoeval-cajita__link" href="/app/test-autoconocimiento/resultados?id=${encodeURIComponent(resultadoAutoconocimiento.respuestaId)}&slug=${encodeURIComponent(slug)}">
            <span>Ver mi resultado completo</span>
            ${icon("arrowRight")}
          </a>
        </div>
      </div>
    </section>
  `;
}

// ────────────────────────────────────────────────────────────────────
// TAB · Temario
// ────────────────────────────────────────────────────────────────────
function renderTemarioTab(ctx) {
  const { modulos, totalLecc, completadas, progresoPct } = ctx;
  return `
    <header class="tab-panel-header">
      <span class="tab-panel-header__eyebrow">Temario</span>
      <h3 class="tab-panel-header__title">${modulos.length} módulos · ${totalLecc} lecciones · ${progresoPct}% completado</h3>
    </header>
    <div class="curso-progress-bar" style="margin-bottom: var(--s-6);">
      <div class="curso-progress-bar__fill" style="width: ${progresoPct}%;"></div>
    </div>
    <div class="modulos-list">
      ${modulos.map(renderModuloCard).join("")}
    </div>
  `;
}

function renderModuloCard(mod) {
  const total = mod.lecciones.length;
  const done = mod.lecciones.filter(l => l.completada).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return `
    <section class="modulo-card" id="modulo-${escapeHtml(mod.id)}">
      <header class="modulo-card__header">
        <div class="modulo-card__head-info">
          <div class="modulo-card__num">Módulo ${mod.orden}</div>
          <h3 class="modulo-card__title">${escapeHtml(mod.titulo)}</h3>
          ${mod.descripcion ? `<p class="modulo-card__desc">${escapeHtml(mod.descripcion)}</p>` : ""}
          ${mod.ponente ? `
            <div class="modulo-card__ponente">
              ${icon("instructor")}
              <span><strong>Ponente:</strong> ${escapeHtml(mod.ponente)}</span>
            </div>
          ` : ""}
        </div>
        <div class="modulo-card__progress">${done} / ${total}</div>
      </header>
      <div class="modulo-card__bar">
        <div class="modulo-card__bar-fill" style="width: ${pct}%;"></div>
      </div>
      <ol class="leccion-list">
        ${mod.lecciones.map(renderLeccionItem).join("")}
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

function renderForoTab(ctx) {
  // Placeholder visual. El módulo foro.js se monta cuando el usuario
  // activa el tab por primera vez (ver activateTab más abajo).
  return `
    <div class="foro-mount" data-foro-mount data-curso-id="${escapeHtml(ctx.curso.id)}" data-mounted="false">
      <header class="tab-panel-header">
        <span class="tab-panel-header__eyebrow">Conversación del grupo</span>
        <h3 class="tab-panel-header__title">Foro</h3>
        <p class="tab-panel-header__sub">Cargando…</p>
      </header>
      <div class="foro-skeleton">
        <div class="foro-skeleton__row loading-skeleton" style="height: 120px;"></div>
        <div class="foro-skeleton__row loading-skeleton" style="height: 80px; margin-top: 16px;"></div>
      </div>
    </div>
  `;
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────
function findNextLeccion(modulos) {
  for (const c of modulos) for (const l of c.lecciones) if (!l.completada) return l;
  return null;
}

function emptyState(title, desc, extra = "") {
  return `<div class="empty-state"><div class="empty-state__title">${title}</div><p class="empty-state__desc">${desc}</p>${extra}</div>`;
}

// ────────────────────────────────────────────────────────────────────
// Mini wedge SVG para la cajita de Autoconocimiento en el dashboard.
// Versión compacta del wedge de test-autoconocimiento-resultados.js.
// ────────────────────────────────────────────────────────────────────

function drawMiniWedge(container, pct, color) {
  const ns = "http://www.w3.org/2000/svg";
  const size = 140, cx = 0, cy = size;
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  const rings = 5, rMin = 22, rMax = 134, rStep = (rMax - rMin) / rings, gap = 4;
  const aStart = -Math.PI / 2, aEnd = 0;
  const fillEnd = aStart + (aEnd - aStart) * (pct / 100);
  const opacities = [1, 0.75, 0.55, 0.38, 0.22];

  function fanSector(r0, r1, a0, a1) {
    const p = document.createElementNS(ns, "path");
    const cos = Math.cos, sin = Math.sin;
    const lg = (a1 - a0) > Math.PI ? 1 : 0;
    p.setAttribute("d", [
      `M ${cx + r0 * cos(a0)} ${cy + r0 * sin(a0)}`,
      `A ${r0} ${r0} 0 ${lg} 1 ${cx + r0 * cos(a1)} ${cy + r0 * sin(a1)}`,
      `L ${cx + r1 * cos(a1)} ${cy + r1 * sin(a1)}`,
      `A ${r1} ${r1} 0 ${lg} 0 ${cx + r1 * cos(a0)} ${cy + r1 * sin(a0)}`,
      `Z`,
    ].join(" "));
    return p;
  }

  for (let i = 0; i < rings; i++) {
    const r0 = rMin + i * rStep, r1 = r0 + rStep - gap;
    const bg = fanSector(r0, r1, aStart, aEnd);
    bg.setAttribute("fill", "rgba(0,0,0,.07)");
    svg.appendChild(bg);
    if (pct > 0) {
      const fg = fanSector(r0, r1, aStart, fillEnd);
      fg.setAttribute("fill", color);
      fg.setAttribute("opacity", opacities[i]);
      svg.appendChild(fg);
    }
  }
  container.innerHTML = "";
  container.appendChild(svg);
}
