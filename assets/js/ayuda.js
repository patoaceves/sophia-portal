// SOPHIA Portal · Soporte
// Form de contacto que abre un mailto a contacto@sophiamx.org

import { requireAuth } from "./auth.js";
import { renderShell, escapeHtml } from "./ui-shell.js";

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  const nombrePrefill = persona.nombre ? escapeHtml(persona.nombre) : "";
  const emailPrefill = persona.email ? escapeHtml(persona.email) : "";

  renderShell({
    persona,
    title: "Soporte",
    activePath: "/app/ayuda",
    contentHtml: `
      <header class="page-header">
        <span class="page-eyebrow">Centro de ayuda</span>
        <h2 class="page-title">Soporte</h2>
        <p class="page-subtitle">
          Escribe tu mensaje y te responderemos a la brevedad.
        </p>
      </header>

      <div class="ayuda-layout">
        <section class="ayuda-form-card card">
          <form id="soporte-form" class="ayuda-form" novalidate>
            <div class="form-field">
              <label class="form-label" for="sf-nombre">Nombre</label>
              <input
                id="sf-nombre"
                class="form-input"
                type="text"
                placeholder="Tu nombre"
                value="${nombrePrefill}"
                required
                autocomplete="name"
              >
            </div>

            <div class="form-field">
              <label class="form-label" for="sf-email">Correo electrónico</label>
              <input
                id="sf-email"
                class="form-input"
                type="email"
                placeholder="tu@correo.com"
                value="${emailPrefill}"
                required
                autocomplete="email"
              >
            </div>

            <div class="form-field">
              <label class="form-label" for="sf-asunto">Asunto</label>
              <input
                id="sf-asunto"
                class="form-input"
                type="text"
                placeholder="Describe brevemente tu solicitud"
                required
              >
            </div>

            <div class="form-field">
              <label class="form-label" for="sf-mensaje">Mensaje</label>
              <textarea
                id="sf-mensaje"
                class="form-input form-textarea"
                rows="6"
                placeholder="Cuéntanos en qué podemos ayudarte..."
                required
              ></textarea>
            </div>

            <div id="sf-error" class="form-error" style="display:none;"></div>

            <button type="submit" class="btn btn-accent" id="sf-submit">
              Enviar mensaje
            </button>
          </form>

          <div id="sf-success" class="ayuda-success" style="display:none;">
            <div class="ayuda-success__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h3 class="ayuda-success__title">Mensaje enviado</h3>
            <p class="ayuda-success__desc">
              Se abrira tu cliente de correo con el mensaje listo. Si no se abre automaticamente,
              escribe directamente a
              <a href="mailto:contacto@sophiamx.org">contacto@sophiamx.org</a>.
            </p>
          </div>
        </section>

        <aside class="ayuda-sidebar">
          <div class="card ayuda-info-card">
            <h4 class="ayuda-info-card__title">Contacto directo</h4>
            <p class="ayuda-info-card__text">
              <a href="mailto:contacto@sophiamx.org" class="ayuda-info-card__link">
                contacto@sophiamx.org
              </a>
            </p>
          </div>

          <div class="card ayuda-info-card">
            <h4 class="ayuda-info-card__title">Tiempo de respuesta</h4>
            <p class="ayuda-info-card__text">
              Respondemos en un plazo de 24 a 48 horas habiles.
            </p>
          </div>
        </aside>
      </div>
    `,
  });

  // Wire up the form
  const form = document.getElementById("soporte-form");
  const errorEl = document.getElementById("sf-error");
  const successEl = document.getElementById("sf-success");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errorEl.style.display = "none";

    const nombre = document.getElementById("sf-nombre").value.trim();
    const email = document.getElementById("sf-email").value.trim();
    const asunto = document.getElementById("sf-asunto").value.trim();
    const mensaje = document.getElementById("sf-mensaje").value.trim();

    if (!nombre || !email || !asunto || !mensaje) {
      errorEl.textContent = "Por favor completa todos los campos.";
      errorEl.style.display = "block";
      return;
    }

    const cuerpo = `Nombre: ${nombre}\nCorreo: ${email}\n\n${mensaje}`;
    const mailtoUrl =
      `mailto:contacto@sophiamx.org` +
      `?subject=${encodeURIComponent(asunto)}` +
      `&body=${encodeURIComponent(cuerpo)}`;

    window.location.href = mailtoUrl;

    // Show success state after a brief delay
    setTimeout(() => {
      form.style.display = "none";
      successEl.style.display = "flex";
    }, 400);
  });
})();
