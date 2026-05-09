// SOPHIA Portal · Onboarding (captura nombre/apellidos para usuarios
// que entraron por magic link, donde no tenemos metadata del proveedor).
//
// Flow:
// 1. requireAuth() devuelve la Persona. En esta página el guard de
//    onboarding NO redirige (estamos exactamente en /app/bienvenida).
// 2. Si el persona ya tiene nombre+apellidos completos, redirigimos
//    directamente al destino post-login (cubre el caso de usuario que
//    aterriza aquí por accidente).
// 3. Si faltan datos, mostramos un form. Submit llama updatePersonaProfile,
//    refresca el caché, y manda al destino guardado o /app/cursos.

import {
  requireAuth,
  needsOnboarding,
  updatePersonaProfile,
  getSession,
  logout,
} from "./auth.js";

const POST_LOGIN_REDIRECT_KEY = "sophia_post_login_redirect";

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  // Caso edge: el usuario navegó a /app/bienvenida pero ya tiene perfil
  // completo. Mandarlo al portal.
  if (!needsOnboarding(persona)) {
    redirectToTarget();
    return;
  }

  const session = await getSession();
  const email = session?.user?.email || "";

  document.body.innerHTML = renderForm(persona, email);
  wireForm(persona);
})();

function redirectToTarget() {
  const target =
    sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY) || "/app/cursos";
  sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  // Si el target era la propia página de bienvenida, mandar al portal.
  const safeTarget = target.startsWith("/app/bienvenida") ? "/app/cursos" : target;
  location.replace(safeTarget);
}

function renderForm(persona, email) {
  const nombre = escape(persona.nombre || "");
  const apellidos = escape(persona.apellidos || "");
  return `
    <main class="login-page">
      <section class="login-hero">
        <div class="login-hero__brand">
          <img src="https://static.wixstatic.com/media/6bf1ef_d0efb91350e04315be1fe1a9982e69c8~mv2.png" alt="SOPHIA" class="login-hero__logo">
        </div>
        <div class="login-hero__content">
          <span class="login-hero__eyebrow">Bienvenida a SOPHIA</span>
          <h1 class="login-hero__title">Antes de continuar, <em>cuéntanos quién eres</em>.</h1>
          <p class="login-hero__lead">
            Solo necesitamos tu nombre para personalizar tu experiencia y
            que el equipo del programa pueda dirigirse a ti correctamente.
          </p>
        </div>
        <footer class="login-hero__footer">
          <span>© SOPHIA</span>
          <span>portal.sophiamx.org</span>
        </footer>
      </section>

      <section class="login-form-wrap">
        <div class="login-card">
          <header class="login-card__header">
            <h2 class="login-card__title">Completa tu perfil</h2>
            <p class="login-card__subtitle">${escape(email)}</p>
          </header>

          <div class="flash" id="flash" role="status"></div>

          <form class="email-form" id="onboardingForm" autocomplete="on">
            <label class="onboarding-label" for="nombreInput">Nombre(s)</label>
            <input
              class="email-input"
              type="text"
              id="nombreInput"
              name="given-name"
              placeholder="Tu nombre"
              autocomplete="given-name"
              value="${nombre}"
              required
              minlength="1"
              maxlength="80"
            >

            <label class="onboarding-label" for="apellidosInput" style="margin-top: var(--s-3);">Apellido(s)</label>
            <input
              class="email-input"
              type="text"
              id="apellidosInput"
              name="family-name"
              placeholder="Tus apellidos"
              autocomplete="family-name"
              value="${apellidos}"
              required
              minlength="1"
              maxlength="120"
            >

            <button class="btn btn-primary email-submit" type="submit" id="onboardingSubmit" style="margin-top: var(--s-4);">
              Continuar al portal
            </button>
          </form>

          <p class="login-footer-note">
            ¿No eres tú?
            <a href="#" id="logoutLink" style="color: var(--color-accent); text-decoration: none;">Cierra sesión</a>
            y entra con la cuenta correcta.
          </p>
        </div>
      </section>
    </main>
  `;
}

function wireForm(persona) {
  const flash = document.getElementById("flash");
  const form = document.getElementById("onboardingForm");
  const submit = document.getElementById("onboardingSubmit");
  const logoutLink = document.getElementById("logoutLink");

  function showFlash(msg, kind = "error") {
    flash.textContent = msg;
    flash.className = `flash is-visible is-${kind}`;
  }

  logoutLink.addEventListener("click", (e) => {
    e.preventDefault();
    logout();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = document.getElementById("nombreInput").value.trim();
    const apellidos = document.getElementById("apellidosInput").value.trim();

    if (!nombre || !apellidos) {
      showFlash("Por favor completa nombre y apellidos.");
      return;
    }

    submit.disabled = true;
    submit.textContent = "Guardando…";
    flash.className = "flash";
    flash.textContent = "";

    try {
      await updatePersonaProfile({ nombre, apellidos });
      submit.textContent = "Listo. Redirigiendo…";
      redirectToTarget();
    } catch (err) {
      console.error("updatePersonaProfile failed:", err);
      showFlash(err?.message || "No pudimos guardar tus datos. Intenta de nuevo.");
      submit.disabled = false;
      submit.textContent = "Continuar al portal";
    }
  });
}

function escape(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
