// SOPHIA Portal · Mis Cursos page logic

import { requireAuth, tryClaimPendingInvite, getPendingInvite } from "./auth.js";
import { callEdge } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";

// Cursos que tienen una portada local en /assets/img/{slug}/portada.png
// (fallback cuando no hay COVER_IMAGE en Airtable)
const LOCAL_COVERS = new Set(["happiness-workshop"]);

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  // Render shell with skeleton first for instant feedback
  renderShell({
    persona,
    title: "Mis cursos",
    contentHtml: `
      <header class="page-header">
        <span class="page-eyebrow">Bienvenido${persona.nombre ? ", " + escapeHtml(persona.nombre.split(" ")[0]) : ""}</span>
        <h2 class="page-title">Tu camino de aprendizaje</h2>
        <p class="page-subtitle">Continúa donde te quedaste. Cada lección es un paso hacia una vida más consciente.</p>
      </header>
      <div class="cursos-grid" id="cursosGrid">
        ${renderSkeleton(3)}
      </div>
    `,
  });

  // Si quedó una invitación sin canjear (ej. sync pendiente desde callback),
  // intentar canjearla AHORA antes de cargar la lista de cursos. Después del
  // canje, NO redirigimos al curso específico — dejamos que el usuario vea
  // su dashboard de cursos y elija a cuál entrar (puede tener varios).
  if (getPendingInvite()) {
    const result = await tryClaimPendingInvite();
    if (result.kind === "retry") {
      console.warn("[cursos] sync still pending, will retry next visit");
    } else if (result.kind === "fatal") {
      console.error("[cursos] claim failed:", result.error);
    }
    // kind === "claimed" o "already": el canje se completó, sigue normal y
    // el curso recién inscrito aparecerá en la grid.
  }

  // Mostrar error de canje guardado en sessionStorage (si lo hay)
  let inviteErrorMsg = null;
  try {
    inviteErrorMsg = sessionStorage.getItem("sophia_invite_error");
    if (inviteErrorMsg) sessionStorage.removeItem("sophia_invite_error");
  } catch {}

  try {
    const { data } = await callEdge("get-mis-cursos");
    renderCursos(data.cursos || [], { inviteErrorMsg });
  } catch (e) {
    console.error("get-mis-cursos failed:", e);
    document.getElementById("cursosGrid").innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1">
        <div class="empty-state__title">No pudimos cargar tus cursos</div>
        <p class="empty-state__desc">${escapeHtml(e.message || "Intenta recargar la página.")}</p>
      </div>
    `;
  }
})();

function renderCursos(cursos, opts = {}) {
  const grid = document.getElementById("cursosGrid");
  if (!grid) return;

  if (cursos.length === 0) {
    const errorBlock = opts.inviteErrorMsg
      ? `<div style="background:#fdecec;border:1px solid #f3c0c0;color:#9a2424;padding:12px 14px;border-radius:8px;margin-bottom:16px;font-size:0.9rem;">
           <strong>Hubo un problema con tu invitación:</strong> ${escapeHtml(opts.inviteErrorMsg)}
         </div>`
      : "";
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1">
        ${errorBlock}
        <div class="empty-state__title">Todavía no tienes cursos activos</div>
        <p class="empty-state__desc">
          Si pagaste recientemente, tu invitación llegará pronto al correo
          con el que te registraste. Busca un mensaje de SOPHIA.
          Si tienes el link de invitación, ábrelo desde este mismo navegador.
        </p>
        <p class="empty-state__desc" style="margin-top:8px;">
          ¿Algo raro? Escribe a
          <a href="mailto:contacto@sophiamx.org" style="color:var(--color-accent);">contacto@sophiamx.org</a>.
        </p>
      </div>
    `;
    return;
  }

  grid.innerHTML = cursos.map(renderCursoCard).join("");
}

function renderCursoCard(c) {
  const slug = c.slug || c.id;
  // Fallback: si Airtable no tiene cover, usar la portada local (si existe).
  const coverUrl = c.coverUrl
    || (LOCAL_COVERS.has(slug) ? `/assets/img/${slug}/portada.png` : null);

  const cover = coverUrl
    ? `<img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(c.titulo)}" loading="lazy">`
    : `<div class="curso-card__cover-placeholder">${escapeHtml(initial(c.titulo))}</div>`;

  return `
    <a class="curso-card" href="/app/curso?slug=${encodeURIComponent(slug)}">
      <div class="curso-card__cover">${cover}</div>
      <div class="curso-card__body">
        <h3 class="curso-card__title">${escapeHtml(c.titulo)}</h3>
        ${c.descripcionCorta ? `<p class="curso-card__desc">${escapeHtml(c.descripcionCorta)}</p>` : ""}
        <div class="curso-card__progress">
          <div class="progress-track">
            <div class="progress-fill" style="width: ${Math.min(100, Math.max(0, c.progresoPct || 0))}%"></div>
          </div>
          <div class="progress-meta">
            <span><strong>${c.progresoPct || 0}%</strong> completado</span>
            <span>${c.leccionesCompletadas || 0} de ${c.totalLecciones || 0} lecciones</span>
          </div>
        </div>
      </div>
    </a>
  `;
}

function initial(s) {
  return (s || "S").trim()[0] || "S";
}

function renderSkeleton(n) {
  return Array(n).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-card__cover loading-skeleton"></div>
      <div class="skeleton-card__body">
        <div class="skeleton-line skeleton-line--short loading-skeleton"></div>
        <div class="skeleton-line skeleton-line--medium loading-skeleton"></div>
        <div class="skeleton-line skeleton-line--short loading-skeleton"></div>
      </div>
    </div>
  `).join("");
}
