// SOPHIA Portal — Biblioteca (coming soon)
import { requireAuth } from "./auth.js";
import { renderShell } from "./ui-shell.js";
import { icon } from "./icons.js";

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  renderShell({
    persona,
    title: "Biblioteca",
    activePath: "/app/recursos",
    contentHtml: `
      <header class="page-header">
        <span class="page-eyebrow">Material descargable</span>
        <h2 class="page-title">Biblioteca</h2>
      </header>

      <section class="coming-soon">
        <div class="coming-soon__icon">${icon("recursos")}</div>
        <h3 class="coming-soon__title">Próximamente</h3>
        <p class="coming-soon__lead">
          Estamos preparando una biblioteca con lecturas complementarias,
          plantillas de journaling, podcasts recomendados y otros recursos
          curados por el equipo SOPHIA.
        </p>
        <p class="coming-soon__note">
          Disponible a partir de la <strong>Sesión 3</strong>.
        </p>
      </section>
    `,
  });
})();
