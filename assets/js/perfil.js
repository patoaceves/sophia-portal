// SOPHIA Portal · Mi perfil

import { requireAuth, getSession, logout } from "./auth.js";
import { renderShell, escapeHtml } from "./ui-shell.js";

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  const session = await getSession();
  const email = session?.user?.email || "—";
  const fullName =
    [persona.nombre, persona.apellidos].filter(Boolean).join(" ") || "—";

  renderShell({
    persona,
    title: "Mi perfil",
    contentHtml: `
      <header class="page-header">
        <span class="page-eyebrow">Cuenta</span>
        <h2 class="page-title">${escapeHtml(fullName)}</h2>
        <p class="page-subtitle">${escapeHtml(email)}</p>
      </header>

      <section class="profile-card">
        <h3 class="profile-card__title">Datos de tu cuenta</h3>
        <dl class="profile-list">
          <div class="profile-list__row">
            <dt>Nombre</dt>
            <dd>${escapeHtml(persona.nombre || "—")}</dd>
          </div>
          <div class="profile-list__row">
            <dt>Apellidos</dt>
            <dd>${escapeHtml(persona.apellidos || "—")}</dd>
          </div>
          <div class="profile-list__row">
            <dt>Correo</dt>
            <dd>${escapeHtml(email)}</dd>
          </div>
          <div class="profile-list__row">
            <dt>Rol</dt>
            <dd><span class="role-pill">${escapeHtml(persona.rol || "participante")}</span></dd>
          </div>
        </dl>
        <p class="profile-card__note">
          Para editar tus datos, escríbenos a <a href="mailto:contacto@sophiamx.org">contacto@sophiamx.org</a>.
        </p>
      </section>

      <div style="margin-top: var(--s-6);">
        <button class="btn btn-secondary" id="logoutPageBtn" type="button">Cerrar sesión</button>
      </div>
    `,
  });

  document.getElementById("logoutPageBtn")?.addEventListener("click", () => {
    if (confirm("¿Cerrar sesión?")) logout();
  });
})();
