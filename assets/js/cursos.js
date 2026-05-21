// SOPHIA Portal · Mis Cursos page logic

import { requireAuth, tryClaimPendingInvite, getPendingInvite, bootstrapPersona } from "./auth.js";
import { callEdge } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";

// Cursos que tienen una portada local en /assets/img/{slug}/portada.{ext}
// (fallback cuando no hay COVER_IMAGE en Airtable). El valor es la extensión
// del archivo (png/jpg) — usamos png para ilustraciones generadas, jpg para
// fotos con muchos gradientes (mucho más liviano).
const LOCAL_COVERS = new Map([
  ["happiness-workshop", "png"],
  ["fundamentos-de-coaching", "jpg"],
]);

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

  // RECONCILIACIÓN DE INVITES HUÉRFANOS:
  // 1. Invalidamos cache de Persona y re-bootstrap para que auth-bootstrap
  //    consulte si hay Invitaciones pendientes para el email del usuario.
  //    Esto cubre el caso: ventas inscribe → email no llegó / no clickeó →
  //    usuario entra al portal por flujo normal → bootstrap encuentra
  //    invite huérfano y lo deposita en sessionStorage.
  // 2. Luego tryClaimPendingInvite() consume el token de sessionStorage
  //    (sea de URL, de callback, o del recién detectado por bootstrap).
  try { sessionStorage.removeItem("sophia_persona"); } catch {}
  try {
    await bootstrapPersona();
  } catch (e) {
    console.warn("[cursos] fresh bootstrap failed:", e);
  }

  const claimResult = await tryClaimPendingInvite();
  if (claimResult.kind === "retry") {
    console.warn("[cursos] claim sync still pending, will retry next visit");
  } else if (claimResult.kind === "fatal") {
    console.error("[cursos] claim failed:", claimResult.error);
  } else if (claimResult.kind === "claimed") {
    console.log("[cursos] invite huérfano canjeado, recargando lista");
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
  const localExt = LOCAL_COVERS.get(slug);
  const coverUrl = c.coverUrl
    || (localExt ? `/assets/img/${slug}/portada.${localExt}` : null);

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
