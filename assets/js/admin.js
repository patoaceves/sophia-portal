// SOPHIA Portal — Panel admin (gated by rol === "admin")

import { requireAuth } from "./auth.js";
import { isAdmin } from "./auth.js";
import { renderShell } from "./ui-shell.js";

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  if (!isAdmin(persona)) {
    renderShell({
      persona,
      title: "Acceso restringido",
      activePath: "/app/cursos",
      contentHtml: `
        <div class="empty-state">
          <div class="empty-state__title">No tienes acceso</div>
          <p class="empty-state__desc">El panel de administración solo es accesible para roles <code>admin</code>.</p>
          <a href="/app/cursos" class="btn btn-secondary" style="margin-top:var(--s-4);">Volver a mis cursos</a>
        </div>
      `,
    });
    return;
  }

  renderShell({
    persona,
    title: "Panel admin",
    contentHtml: `
      <header class="page-header">
        <span class="page-eyebrow">Administración</span>
        <h2 class="page-title">Panel de control</h2>
        <p class="page-subtitle">Esta sección se construirá conforme se necesite — gestión de inscripciones, cursos, autoevaluaciones, etc.</p>
      </header>
      <div class="empty-state">
        <div class="empty-state__title">En construcción</div>
        <p class="empty-state__desc">Aquí irán las herramientas de administración cuando se prioricen.</p>
      </div>
    `,
  });
})();
