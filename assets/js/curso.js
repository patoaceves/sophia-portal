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

const LOCAL_COVERS = new Set(["happiness-workshop"]);

const PILARES = [
  { key: "autoconocimiento",      file: "autoconocimiento",      dim: "mental",    name: "Autoconocimiento" },      // cap 2
  { key: "bienestar_fisico",      file: "bienestar-fisico",      dim: "fisico",    name: "Bienestar Físico" },       // cap 3
  { key: "presencia_consciente",  file: "presencia-consciente",  dim: "fisico",    name: "Presencia Consciente" },   // cap 4
  { key: "bienestar_emocional",   file: "bienestar-emocional",   dim: "afectivo",  name: "Bienestar Emocional" },    // cap 5
  { key: "trabajo_proposito",     file: "trabajo-proposito",     dim: "mental",    name: "Trabajo con Propósito" },  // cap 6
  { key: "estetica_existencial",  file: "estetica-existencial",  dim: "spiritual", name: "Estética Existencial" },   // cap 7
  { key: "vinculos_vitales",      file: "vinculos-vitales",      dim: "afectivo",  name: "Vínculos Vitales" },       // cap 8
  { key: "fe_filosofia",          file: "fe-filosofia",          dim: "spiritual", name: "Fe y Filosofía" },         // cap 9
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
        ? `<a href="/app/cursos" class="btn btn-secondary" style="margin-top:var(--s-4);">${icon("arrowLeft")}<span>Volver a mis cursos</span></a>`
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

  // Cargar preview del foro en background (la card vive en el resumen,
  // que es el tab default). Si el usuario aterriza en otro tab, igual
  // se carga para que esté listo cuando vuelva al resumen.
  fetchForoPreview(ctx.curso.id);

  // Prefetch en background: lección siguiente + todas las del primer capítulo
  // Esto hace que la primera navegacion sea instantanea (sin cold start)
  setTimeout(() => {
    if (ctx.next?.id) api.leccion(ctx.next.id).catch(() => {});
    const primerasLecciones = (ctx.capitulos[0]?.lecciones ?? []).slice(0, 4);
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

  document.querySelector(`#tab-${tab}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

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
// and current chapter ("Vas en el capítulo X de N").
// ────────────────────────────────────────────────────────────────────
function renderHero(curso, coverUrl, ctx) {
  const directora = ctx?.curso?.instructor || "Mariana Riojas";
  const capituloEnCurso = findCurrentCapitulo(ctx?.capitulos || []);
  const totalCaps = ctx?.capitulos?.length || 0;

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
            ${capituloEnCurso ? `
              <div class="curso-hero__meta-item">
                <dt>${capituloEnCurso.done ? "Completado" : "Vas en"}</dt>
                <dd>${capituloEnCurso.done
                  ? `${totalCaps} de ${totalCaps} capítulos`
                  : `Capítulo ${capituloEnCurso.orden}${totalCaps ? ` de ${totalCaps}` : ""}`}</dd>
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
function findCurrentCapitulo(capitulos) {
  for (const c of capitulos) {
    const incomplete = c.lecciones.some(l => !l.completada);
    if (incomplete) return { orden: c.orden, done: false };
  }
  if (capitulos.length > 0) return { orden: capitulos.length, done: true };
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
  const { capitulos, totalLecc, completadas } = ctx;

  return `
    <div class="resumen-row">
      ${renderForoPreviewCard(ctx)}
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
  const { capitulos, totalLecc, completadas, progresoPct, next, slug } = ctx;

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

  const cap = capitulos.find(c => c.lecciones.some(l => l.id === next.id));
  return `
    <section class="curso-progress-strip">
      <div class="curso-progress-strip__main">
        <span class="curso-progress-strip__eyebrow">${progresoPct === 0 ? "Para comenzar" : "Continúa donde te quedaste"}</span>
        <p class="curso-progress-strip__meta">
          ${cap ? `Capítulo ${cap.orden} · ` : ""}
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
      <div class="foro-preview-card__body" data-foro-preview-body>
        <div class="foro-skeleton__row loading-skeleton" style="height: 56px; margin-bottom: 12px;"></div>
        <div class="foro-skeleton__row loading-skeleton" style="height: 56px;"></div>
      </div>
      <a class="foro-preview-card__link" href="?slug=${encodeURIComponent(ctx.slug)}&tab=foro">
        <span>Ver foro completo</span>
        ${icon("arrowRight")}
      </a>
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

  try {
    const data = await api.foroPosts(cursoId);
    // Actualizar badge del tab con el conteo de "nuevos"
    updateForoBadge(data?.posts ?? []);

    const posts = (data?.posts ?? []).filter(p => !p.eliminado).slice(0, 3);
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
        adjuntoHtml = `<a href="${escapeHtml(adjuntoUrl)}" target="_blank" rel="noopener" class="foro-preview-item__thumb"><img src="${escapeHtml(adjuntoUrl)}" alt="" loading="lazy"></a>`;
      } else if (adjuntoUrl && adjuntoTipo === "video") {
        adjuntoHtml = `<span class="foro-preview-item__attach-tag">▶ Video</span>`;
      } else if (adjuntoUrl && adjuntoTipo === "archivo") {
        adjuntoHtml = `<span class="foro-preview-item__attach-tag">📎 Archivo</span>`;
      }

      return `
        <article class="foro-preview-item">
          <div class="foro-preview-item__avatar ${url ? "has-photo" : ""}">${avatarInner}</div>
          <div class="foro-preview-item__body">
            <div class="foro-preview-item__head">
              <span class="foro-preview-item__author">${escapeHtml(displayName(p.autor))}</span>
              <span class="foro-preview-item__time">${escapeHtml(formatRelativeDate(p.fechaISO))}</span>
            </div>
            ${p.contenido ? `<p class="foro-preview-item__excerpt">${escapeHtml(truncate(p.contenido, 160))}</p>` : ""}
            ${adjuntoHtml}
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
        <p class="test-cajita__lead">16 preguntas · 5 min · Análisis personalizado en 8 pilares.</p>
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

  // Use the gray PNG when not done (already gray, no CSS filter needed).
  // Use the color SVG when done (full color, full saturation).
  const iconSrc = state === "done"
    ? `/assets/img/happiness-workshop/pilares/${pillar.file}.svg`
    : `/assets/img/happiness-workshop/pilares/${pillar.file}-gris.png`;

  return `
    <article class="pillar-icon pillar-icon--${pillar.dim} pillar-icon--${state}">
      <div class="pillar-icon__visual">
        <img src="${iconSrc}" alt="" aria-hidden="true">
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
function findNextLeccion(capitulos) {
  for (const c of capitulos) for (const l of c.lecciones) if (!l.completada) return l;
  return null;
}

function emptyState(title, desc, extra = "") {
  return `<div class="empty-state"><div class="empty-state__title">${title}</div><p class="empty-state__desc">${desc}</p>${extra}</div>`;
}
