// SOPHIA Portal · Mi perfil (editable)

import { requireAuth, getSession, logout, updatePersonaProfile } from "./auth.js";
import { renderShell, escapeHtml } from "./ui-shell.js";

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

  const session = await getSession();
  const email = session?.user?.email || persona.email || "—";

  const nombre = persona.nombre || "";
  const apellidos = persona.apellidos || "";
  const avatarUrl = persona.avatarUrl || "";
  const telPais = persona.telefonoPais || "+52";
  const telNumero = persona.telefonoNumero || "";
  const fullName = [nombre, apellidos].filter(Boolean).join(" ") || "—";

  const paisOpts = PAISES
    .map((p) => `<option value="${p.code}" ${p.code === telPais ? "selected" : ""}>${p.flag} ${p.name} (${p.code})</option>`)
    .join("");

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

        <div class="flash" id="profileFlash" role="status"></div>

        <form id="profileForm">
          <!-- Avatar -->
          <div class="onboarding-avatar-row" style="margin-bottom: var(--s-4);">
            <div class="onboarding-avatar" id="avatarPreview" data-has-image="${avatarUrl ? "true" : "false"}">
              ${avatarUrl
                ? `<img src="${escapeHtml(avatarUrl)}" alt="">`
                : `<span class="onboarding-avatar__initials">${escapeHtml(computeIniciales(nombre, apellidos, email))}</span>`}
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
              value="${escapeHtml(avatarUrl)}"
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
          <input class="email-input" type="text" id="nombreInput" autocomplete="given-name"
                 value="${escapeHtml(nombre)}" required maxlength="80">

          <!-- Apellidos -->
          <label class="onboarding-label" for="apellidosInput">Apellido(s) <span class="required">*</span></label>
          <input class="email-input" type="text" id="apellidosInput" autocomplete="family-name"
                 value="${escapeHtml(apellidos)}" required maxlength="120">

          <!-- Email read-only -->
          <label class="onboarding-label" for="emailInput">Correo</label>
          <input class="email-input email-input--readonly" type="email" id="emailInput"
                 value="${escapeHtml(email)}" readonly>
          <p class="onboarding-help">Para cambiarlo, escribe a <a href="mailto:contacto@sophiamx.org">contacto@sophiamx.org</a>.</p>

          <!-- Teléfono -->
          <label class="onboarding-label">Teléfono <span class="optional">(opcional)</span></label>
          <div class="onboarding-phone-row">
            <select class="email-input onboarding-phone-pais" id="telPaisInput" aria-label="Clave de país">
              ${paisOpts}
            </select>
            <input class="email-input onboarding-phone-numero" type="tel" id="telNumeroInput"
                   placeholder="8112345678" autocomplete="tel-national"
                   value="${escapeHtml(telNumero)}" maxlength="20" inputmode="tel">
          </div>

          <!-- Rol read-only -->
          <label class="onboarding-label">Rol</label>
          <div style="margin-bottom: var(--s-3);">
            <span class="role-pill">${escapeHtml(persona.rol || "participante")}</span>
          </div>

          <button class="btn btn-primary" type="submit" id="profileSubmit" style="margin-top: var(--s-4);">
            Guardar cambios
          </button>
        </form>
      </section>

      <div style="margin-top: var(--s-6);">
        <button class="btn btn-secondary" id="logoutPageBtn" type="button">Cerrar sesión</button>
      </div>
    `,
  });

  document.getElementById("logoutPageBtn")?.addEventListener("click", () => {
    if (confirm("¿Cerrar sesión?")) logout();
  });

  wireProfileForm({ initialPersona: persona, email });
})();

function wireProfileForm({ initialPersona, email }) {
  const flash = document.getElementById("profileFlash");
  const form = document.getElementById("profileForm");
  const submit = document.getElementById("profileSubmit");

  const avatarPreview = document.getElementById("avatarPreview");
  const avatarActions = document.getElementById("avatarActions");
  const avatarInputRow = document.getElementById("avatarInputRow");
  const avatarUrlInput = document.getElementById("avatarUrlInput");
  const applyAvatarBtn = document.getElementById("applyAvatarBtn");
  const cancelAvatarBtn = document.getElementById("cancelAvatarBtn");
  const avatarHelp = document.getElementById("avatarHelp");

  let currentAvatarUrl = initialPersona.avatarUrl || "";

  function showFlash(msg, kind = "error") {
    flash.textContent = msg;
    flash.className = `flash is-visible is-${kind}`;
  }
  function clearFlash() {
    flash.className = "flash";
    flash.textContent = "";
  }

  function refreshAvatarPreview() {
    const initials = computeIniciales(
      document.getElementById("nombreInput").value,
      document.getElementById("apellidosInput").value,
      email,
    );
    if (currentAvatarUrl) {
      avatarPreview.innerHTML = `<img src="${escapeHtml(currentAvatarUrl)}" alt="">`;
      avatarPreview.dataset.hasImage = "true";
    } else {
      avatarPreview.innerHTML = `<span class="onboarding-avatar__initials">${escapeHtml(initials)}</span>`;
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
    clearFlash();
    refreshAvatarPreview();
  });

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
    clearFlash();

    try {
      await updatePersonaProfile({
        nombre,
        apellidos,
        avatarUrl: currentAvatarUrl,
        telefonoPais,
        telefonoNumero: telefonoNumero || "",
        perfilCompletado: true,
      });
      submit.textContent = "Guardado ✓";
      showFlash("Cambios guardados.", "success");
      setTimeout(() => {
        submit.disabled = false;
        submit.textContent = "Guardar cambios";
      }, 1800);
    } catch (err) {
      console.error("updatePersonaProfile failed:", err);
      showFlash(err?.message || "No pudimos guardar tus cambios. Intenta de nuevo.");
      submit.disabled = false;
      submit.textContent = "Guardar cambios";
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
