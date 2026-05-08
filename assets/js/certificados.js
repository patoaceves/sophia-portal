// SOPHIA Portal — Certificados (coming soon)
import { requireAuth } from "./auth.js";
import { renderShell } from "./ui-shell.js";
import { icon } from "./icons.js";

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  renderShell({
    persona,
    title: "Certificados",
    activePath: "/app/certificados",
    contentHtml: `
      <header class="page-header">
        <span class="page-eyebrow">Tu reconocimiento</span>
        <h2 class="page-title">Certificados</h2>
      </header>

      <section class="coming-soon">
        <div class="coming-soon__icon">${icon("certificados")}</div>
        <h3 class="coming-soon__title">Próximamente</h3>
        <p class="coming-soon__lead">
          Cuando completes el Happiness Workshop recibirás un certificado
          digital firmado por SOPHIA Centro de Formación en Humanidades,
          descargable y compartible en LinkedIn.
        </p>
        <p class="coming-soon__note">
          Se habilita al <strong>completar el 100%</strong> del programa.
        </p>
      </section>
    `,
  });
})();
