// SOPHIA Portal · Onboarding (captura nombre/apellidos/teléfono/foto
// para todo usuario nuevo, sea por magic link o por Google sign-in).
//
// Trigger: Persona.perfilCompletado === false en Airtable.
// Flow:
// 1. requireAuth() devuelve la Persona. Esta página NO redirige
//    si perfilCompletado=false (estamos exactamente en /app/bienvenida).
// 2. Si la Persona ya tiene perfilCompletado=true, redirigimos al
//    destino post-login (cubre el caso de aterrizar aquí por accidente).
// 3. Mostramos un form con todos los campos del perfil.
// 4. Submit llama updatePersonaProfile con perfilCompletado=true,
//    refresca el caché y manda a /app/cursos.

import {
  requireAuth,
  needsOnboarding,
  updatePersonaProfile,
  getSession,
  logout,
} from "./auth.js";

const POST_LOGIN_REDIRECT_KEY = "sophia_post_login_redirect";

// Top países LATAM + USA + España + Canadá + algunos extra. En orden alfabético.
const PAISES = [
  { name: "Argentina",          code: "+54",  flag: "🇦🇷" },
  { name: "Bolivia",            code: "+591", flag: "🇧🇴" },
  { name: "Brasil",             code: "+55",  flag: "🇧🇷" },
  { name: "Canadá",             code: "+1",   flag: "🇨🇦" },
  { name: "Chile",              code: "+56",  flag: "🇨🇱" },
  { name: "Colombia",           code: "+57",  flag: "🇨🇴" },
  { name: "Costa Rica",         code: "+506", flag: "🇨🇷" },
  { name: "Cuba",               code: "+53",  flag: "🇨🇺" },
  { name: "Ecuador",            code: "+593", flag: "🇪🇨" },
  { name: "El Salvador",        code: "+503", flag: "🇸🇻" },
  { name: "España",             code: "+34",  flag: "🇪🇸" },
  { name: "Estados Unidos",     code: "+1",   flag: "🇺🇸" },
  { name: "Guatemala",          code: "+502", flag: "🇬🇹" },
  { name: "Honduras",           code: "+504", flag: "🇭🇳" },
  { name: "México",             code: "+52",  flag: "🇲🇽" },
  { name: "Nicaragua",          code: "+505", flag: "🇳🇮" },
  { name: "Panamá",             code: "+507", flag: "🇵🇦" },
  { name: "Paraguay",           code: "+595", flag: "🇵🇾" },
  { name: "Perú",               code: "+51",  flag: "🇵🇪" },
  { name: "Puerto Rico",        code: "+1",   flag: "🇵🇷" },
  { name: "República Dominicana", code: "+1", flag: "🇩🇴" },
  { name: "Uruguay",            code: "+598", flag: "🇺🇾" },
  { name: "Venezuela",          code: "+58",  flag: "🇻🇪" },
];

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  // Caso edge: el usuario navegó a /app/bienvenida pero ya completó
  // el perfil. Mandarlo al portal.
  if (!needsOnboarding(persona)) {
    redirectToTarget();
    return;
  }

  const session = await getSession();
  const email = session?.user?.email || persona.email || "";

  document.body.innerHTML = renderForm(persona, email);
  wireForm(persona);
})();

function redirectToTarget() {
  const target =
    sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY) || "/app/cursos";
  sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  const safeTarget = target.startsWith("/app/bienvenida") ? "/app/cursos" : target;
  location.replace(safeTarget);
}

function renderForm(persona, email) {
  const nombre = escape(persona.nombre || "");
  const apellidos = escape(persona.apellidos || "");
  const avatarUrl = escape(persona.avatarUrl || "");
  const telPais = escape(persona.telefonoPais || "+52");
  const telNumero = escape(persona.telefonoNumero || "");
  const iniciales = computeIniciales(persona.nombre, persona.apellidos, email);

  const paisOpts = PAISES
    .map((p) => `<option value="${p.code}" ${p.code === telPais ? "selected" : ""}>${p.flag} ${p.name} (${p.code})</option>`)
    .join("");

  return `
    <main class="login-page">
      <section class="login-hero">
        <div class="login-hero__brand">
          <img src="https://static.wixstatic.com/media/6bf1ef_d0efb91350e04315be1fe1a9982e69c8~mv2.png" alt="SOPHIA" class="login-hero__logo">
        </div>
        <div class="login-hero__content">
          <span class="login-hero__eyebrow">Bienvenida a SOPHIA</span>
          <h1 class="login-hero__title">Confirma tus datos <em>antes de comenzar</em>.</h1>
          <p class="login-hero__lead">
            Solo lo necesario para personalizar tu experiencia y que el equipo
            del programa pueda contactarte. Podrás editarlo más tarde desde tu perfil.
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
            <h2 class="login-card__title">Tu perfil</h2>
          </header>

          <div class="flash" id="flash" role="status"></div>

          <form class="email-form" id="onboardingForm" autocomplete="on">
            <!-- Avatar -->
            <div class="onboarding-avatar-row">
              <div class="onboarding-avatar" id="avatarPreview" data-has-image="${avatarUrl ? "true" : "false"}">
                ${avatarUrl
                  ? `<img src="${avatarUrl}" alt="" id="avatarImg">`
                  : `<span class="onboarding-avatar__initials">${escape(iniciales)}</span>`}
              </div>
              <div class="onboarding-avatar-actions" id="avatarActions">
                <button type="button" class="btn btn-ghost btn-sm" data-avatar-action="change">
                  ${avatarUrl ? "Cambiar foto" : "Agregar foto"}
                </button>
                ${avatarUrl ? `<button type="button" class="btn btn-ghost btn-sm" data-avatar-action="remove" style="color: var(--color-danger);">Quitar</button>` : ""}
              </div>
            </div>
            <div class="onboarding-avatar-input-row" id="avatarInputRow" hidden>
              <input
                type="url"
                class="email-input"
                id="avatarUrlInput"
                placeholder="https://… (URL pública de imagen)"
                value="${avatarUrl}"
                maxlength="1000"
              >
              <button type="button" class="btn btn-secondary btn-sm" id="applyAvatarBtn">Aplicar</button>
              <button type="button" class="btn btn-ghost btn-sm" id="cancelAvatarBtn">Cancelar</button>
            </div>
            <p class="onboarding-help" id="avatarHelp" hidden>
              Pega la URL pública de una foto. v16 incluirá subida directa de archivos.
            </p>

            <!-- Nombre -->
            <label class="onboarding-label" for="nombreInput">Nombre(s) <span class="required">*</span></label>
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

            <!-- Apellidos -->
            <label class="onboarding-label" for="apellidosInput">Apellido(s) <span class="required">*</span></label>
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

            <!-- Email (read-only) -->
            <label class="onboarding-label" for="emailInput">Correo</label>
            <input
              class="email-input email-input--readonly"
              type="email"
              id="emailInput"
              value="${escape(email)}"
              readonly
            >
            <p class="onboarding-help">Para cambiarlo, escribe a contacto@sophiamx.org.</p>

            <!-- Teléfono -->
            <label class="onboarding-label">Teléfono <span class="optional">(opcional)</span></label>
            <div class="onboarding-phone-row">
              <select class="email-input onboarding-phone-pais" id="telPaisInput" aria-label="Clave de país">
                ${paisOpts}
              </select>
              <input
                class="email-input onboarding-phone-numero"
                type="tel"
                id="telNumeroInput"
                placeholder="8112345678"
                autocomplete="tel-national"
                value="${telNumero}"
                maxlength="20"
                inputmode="tel"
              >
            </div>

            <button class="btn btn-primary email-submit" type="submit" id="onboardingSubmit" style="margin-top: var(--s-5);">
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

  const avatarPreview = document.getElementById("avatarPreview");
  const avatarActions = document.getElementById("avatarActions");
  const avatarInputRow = document.getElementById("avatarInputRow");
  const avatarUrlInput = document.getElementById("avatarUrlInput");
  const applyAvatarBtn = document.getElementById("applyAvatarBtn");
  const cancelAvatarBtn = document.getElementById("cancelAvatarBtn");
  const avatarHelp = document.getElementById("avatarHelp");

  let currentAvatarUrl = persona.avatarUrl || "";

  function showFlash(msg, kind = "error") {
    flash.textContent = msg;
    flash.className = `flash is-visible is-${kind}`;
  }

  function refreshAvatarPreview() {
    const initials = computeIniciales(
      document.getElementById("nombreInput").value,
      document.getElementById("apellidosInput").value,
      document.getElementById("emailInput").value,
    );
    if (currentAvatarUrl) {
      avatarPreview.innerHTML = `<img src="${escape(currentAvatarUrl)}" alt="">`;
      avatarPreview.dataset.hasImage = "true";
    } else {
      avatarPreview.innerHTML = `<span class="onboarding-avatar__initials">${escape(initials)}</span>`;
      avatarPreview.dataset.hasImage = "false";
    }
    renderAvatarActions();
  }

  function renderAvatarActions() {
    avatarActions.innerHTML = `
      <button type="button" class="btn btn-ghost btn-sm" data-avatar-action="change">
        ${currentAvatarUrl ? "Cambiar foto" : "Agregar foto"}
      </button>
      ${currentAvatarUrl ? `<button type="button" class="btn btn-ghost btn-sm" data-avatar-action="remove" style="color: var(--color-danger);">Quitar</button>` : ""}
    `;
  }

  // Delegated handler for change/remove buttons (re-renders on each click)
  avatarActions.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-avatar-action]");
    if (!btn) return;
    if (btn.dataset.avatarAction === "change") {
      avatarInputRow.hidden = false;
      avatarHelp.hidden = false;
      avatarUrlInput.focus();
    } else if (btn.dataset.avatarAction === "remove") {
      currentAvatarUrl = "";
      avatarUrlInput.value = "";
      refreshAvatarPreview();
    }
  });

  cancelAvatarBtn.addEventListener("click", () => {
    avatarInputRow.hidden = true;
    avatarHelp.hidden = true;
    avatarUrlInput.value = currentAvatarUrl;
  });

  applyAvatarBtn.addEventListener("click", () => {
    const u = avatarUrlInput.value.trim();
    if (u && !isValidHttpsUrl(u)) {
      showFlash("La URL de imagen no es válida.");
      return;
    }
    currentAvatarUrl = u;
    avatarInputRow.hidden = true;
    avatarHelp.hidden = true;
    flash.className = "flash";
    flash.textContent = "";
    refreshAvatarPreview();
  });

  logoutLink.addEventListener("click", (e) => {
    e.preventDefault();
    logout();
  });

  // Refresh initials live as the user types (only matters if no avatar)
  const updateInitials = () => { if (!currentAvatarUrl) refreshAvatarPreview(); };
  document.getElementById("nombreInput")?.addEventListener("input", updateInitials);
  document.getElementById("apellidosInput")?.addEventListener("input", updateInitials);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = document.getElementById("nombreInput").value.trim();
    const apellidos = document.getElementById("apellidosInput").value.trim();
    const telefonoPais = document.getElementById("telPaisInput").value.trim();
    const telefonoNumero = document.getElementById("telNumeroInput").value.trim();

    if (!nombre || !apellidos) {
      showFlash("Por favor completa nombre y apellidos.");
      return;
    }
    if (telefonoNumero && !/^[\d\s\-()]{6,20}$/.test(telefonoNumero)) {
      showFlash("El número telefónico no parece válido. Solo dígitos, espacios, guiones y paréntesis.");
      return;
    }

    submit.disabled = true;
    submit.textContent = "Guardando…";
    flash.className = "flash";
    flash.textContent = "";

    try {
      await updatePersonaProfile({
        nombre,
        apellidos,
        avatarUrl: currentAvatarUrl,
        telefonoPais,
        telefonoNumero: telefonoNumero || "",
        perfilCompletado: true,
      });
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

function computeIniciales(nombre, apellidos, email) {
  const a = (nombre || "").trim()[0] || "";
  const b = (apellidos || "").trim()[0] || "";
  const fromNames = (a + b).toUpperCase();
  if (fromNames) return fromNames;
  const e = (email || "").trim()[0]?.toUpperCase();
  return e || "S";
}

function isValidHttpsUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function escape(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
