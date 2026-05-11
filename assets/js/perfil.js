// SOPHIA Portal · Mi perfil (editable + uploads nativos v16)

import { requireAuth, getSession, logout, updatePersonaProfile } from "./auth.js";
import { renderShell, escapeHtml, updateSidebarAvatar } from "./ui-shell.js";
import { api, ApiError } from "./api.js";
import { openAvatarCropper } from "./avatar-crop.js";

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

  const paisOpts = PAISES
    .map((p) => `<option value="${p.code}" ${p.code === telPais ? "selected" : ""}>${p.flag} ${p.name} (${p.code})</option>`)
    .join("");

  renderShell({
    persona,
    title: "Mi perfil",
    contentHtml: `
      <section class="profile-card">
        <h3 class="profile-card__title">Datos de tu cuenta</h3>

        <div class="flash" id="profileFlash" role="status"></div>

        <form id="profileForm">
          <!-- Avatar -->
          <div class="onboarding-avatar-row" style="margin-bottom: var(--s-4);">
            <div class="onboarding-avatar" id="avatarPreview" data-has-image="${avatarUrl ? "true" : "false"}">
              ${avatarUrl
                ? `<img src="${escapeHtml(avatarUrl)}" alt="" referrerpolicy="no-referrer">`
                : `<span class="onboarding-avatar__initials">${escapeHtml(computeIniciales(nombre, apellidos, email))}</span>`}
            </div>
            <div class="onboarding-avatar-actions" id="avatarActions">
              <div class="onboarding-avatar-buttons">
                <button type="button" class="btn btn-ghost btn-sm" data-avatar-action="upload">
                  ${avatarUrl ? "Cambiar foto" : "Subir foto"}
                </button>
                ${avatarUrl ? `
                  <span class="onboarding-avatar-buttons__sep">·</span>
                  <button type="button" class="btn btn-ghost btn-sm" data-avatar-action="remove" style="color: var(--color-danger);">Quitar</button>
                ` : ""}
              </div>
              <p class="onboarding-help">JPG, PNG, WebP o GIF · max 5 MB</p>
            </div>
            <input type="file" id="avatarFileInput" accept="image/jpeg,image/png,image/webp,image/gif" style="display:none;">
          </div>

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

      <section class="perfil-privacy" id="perfilPrivacy">
        <header class="perfil-privacy__header">
          <h3 class="perfil-privacy__title">Privacidad y datos</h3>
          <p class="perfil-privacy__lead">
            Tienes derecho a acceder a tus datos y a eliminar tu cuenta en cualquier momento,
            conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).
          </p>
        </header>
        <div class="perfil-privacy__actions">
          <div class="perfil-privacy__card">
            <h4 class="perfil-privacy__card-title">Descargar mis datos</h4>
            <p class="perfil-privacy__card-text">
              Obtén un archivo JSON con toda la información que SOPHIA tiene sobre ti:
              perfil, inscripciones, progreso, respuestas y publicaciones.
            </p>
            <button type="button" class="btn btn-ghost" id="exportDataBtn">
              Descargar archivo
            </button>
          </div>
          <div class="perfil-privacy__card perfil-privacy__card--danger">
            <h4 class="perfil-privacy__card-title">Eliminar mi cuenta</h4>
            <p class="perfil-privacy__card-text">
              Elimina permanentemente tu cuenta y todos tus datos personales.
              Esta acción es irreversible y no se puede deshacer.
            </p>
            <button type="button" class="btn btn-danger" id="deleteAccountBtn">
              Eliminar cuenta
            </button>
          </div>
        </div>
      </section>
    `,
  });

  document.getElementById("logoutPageBtn")?.addEventListener("click", () => {
    if (confirm("¿Cerrar sesión?")) logout();
  });

  wirePrivacySection();

  wireProfileForm({ initialPersona: persona, email });
})();

function wireProfileForm({ initialPersona, email }) {
  const flash = document.getElementById("profileFlash");
  const form = document.getElementById("profileForm");
  const submit = document.getElementById("profileSubmit");

  const avatarPreview = document.getElementById("avatarPreview");
  const avatarActions = document.getElementById("avatarActions");
  const avatarFileInput = document.getElementById("avatarFileInput");

  let currentAvatarUrl = initialPersona.avatarUrl || "";
  let isUploadingAvatar = false;

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
      avatarPreview.innerHTML = `<img src="${escapeHtml(currentAvatarUrl)}" alt="" referrerpolicy="no-referrer">`;
      avatarPreview.dataset.hasImage = "true";
    } else {
      avatarPreview.innerHTML = `<span class="onboarding-avatar__initials">${escapeHtml(initials)}</span>`;
      avatarPreview.dataset.hasImage = "false";
    }
    renderAvatarActions();
  }

  function renderAvatarActions() {
    avatarActions.innerHTML = `
      <div class="onboarding-avatar-buttons">
        <button type="button" class="btn btn-ghost btn-sm" data-avatar-action="upload"${isUploadingAvatar ? " disabled" : ""}>
          ${isUploadingAvatar ? "Subiendo…" : (currentAvatarUrl ? "Cambiar foto" : "Subir foto")}
        </button>
        ${currentAvatarUrl && !isUploadingAvatar ? `
          <span class="onboarding-avatar-buttons__sep">·</span>
          <button type="button" class="btn btn-ghost btn-sm" data-avatar-action="remove" style="color: var(--color-danger);">Quitar</button>
        ` : ""}
      </div>
      <p class="onboarding-help">JPG, PNG, WebP o GIF · max 5 MB</p>
    `;
  }

  avatarActions.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-avatar-action]");
    if (!btn || btn.disabled) return;
    if (btn.dataset.avatarAction === "upload") {
      avatarFileInput.click();
    } else if (btn.dataset.avatarAction === "remove") {
      removeAvatar();
    }
  });

  async function removeAvatar() {
    const previousUrl = currentAvatarUrl;
    currentAvatarUrl = "";
    refreshAvatarPreview();
    updateSidebarAvatar("", initialPersona);
    // Auto-persistir el remove en Airtable
    try {
      await updatePersonaProfile({
        nombre: document.getElementById("nombreInput").value.trim() || initialPersona.nombre,
        apellidos: document.getElementById("apellidosInput").value.trim() || initialPersona.apellidos,
        avatarUrl: "",
        telefonoPais: document.getElementById("telPaisInput").value.trim(),
        telefonoNumero: document.getElementById("telNumeroInput").value.trim(),
        perfilCompletado: true,
      });
    } catch (err) {
      console.error("avatar remove failed:", err);
      currentAvatarUrl = previousUrl;
      refreshAvatarPreview();
      updateSidebarAvatar(previousUrl, initialPersona);
      showFlash(err?.message || "No pudimos quitar la foto. Intenta de nuevo.");
    }
  }

  avatarFileInput.addEventListener("change", async () => {
    const file = avatarFileInput.files?.[0];
    if (!file) return;
    avatarFileInput.value = "";
    await uploadAvatarFile(file);
  });

  async function uploadAvatarFile(file) {
    clearFlash();

    // ─── Paso 1: cropper modal ──────────────────────────────────────
    // El usuario reposiciona/zoom y obtenemos un Blob 512×512 cuadrado.
    let croppedBlob;
    try {
      croppedBlob = await openAvatarCropper(file);
    } catch (err) {
      if (err?.message === "cancelled") return; // usuario cerró el modal
      console.error("cropper failed:", err);
      showFlash(err?.message || "No pudimos preparar la foto.");
      return;
    }
    const croppedFile = new File([croppedBlob], (file.name || "avatar").replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });

    // ─── Paso 2: preview optimista + upload ─────────────────────────
    const previewUrl = URL.createObjectURL(croppedBlob);
    avatarPreview.innerHTML = `<img src="${previewUrl}" alt="">`;
    avatarPreview.dataset.hasImage = "true";

    isUploadingAvatar = true;
    renderAvatarActions();

    try {
      const asset = await api.uploadAsset({ file: croppedFile, kind: "avatar" });
      currentAvatarUrl = asset.url;
      URL.revokeObjectURL(previewUrl);
      refreshAvatarPreview();

      // ─── Paso 3: auto-persist en Airtable ─────────────────────────
      try {
        await updatePersonaProfile({
          nombre: document.getElementById("nombreInput").value.trim() || initialPersona.nombre,
          apellidos: document.getElementById("apellidosInput").value.trim() || initialPersona.apellidos,
          avatarUrl: asset.url,
          telefonoPais: document.getElementById("telPaisInput").value.trim(),
          telefonoNumero: document.getElementById("telNumeroInput").value.trim(),
          perfilCompletado: true,
        });
        updateSidebarAvatar(asset.url, initialPersona);
        showFlash("Foto actualizada.", "success");
        setTimeout(clearFlash, 2200);
      } catch (saveErr) {
        console.error("avatar autosave failed:", saveErr);
        showFlash("Foto subida pero no se guardó en tu perfil. Click en \"Guardar cambios\".");
      }
    } catch (err) {
      URL.revokeObjectURL(previewUrl);
      console.error("avatar upload failed:", err);
      showFlash(err?.message || "No pudimos subir la foto. Intenta de nuevo.");
      refreshAvatarPreview();
    } finally {
      isUploadingAvatar = false;
      renderAvatarActions();
    }
  }

  const updateInitials = () => { if (!currentAvatarUrl) refreshAvatarPreview(); };
  document.getElementById("nombreInput")?.addEventListener("input", updateInitials);
  document.getElementById("apellidosInput")?.addEventListener("input", updateInitials);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isUploadingAvatar) {
      showFlash("Espera a que termine de subir la foto.");
      return;
    }
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

// ─────────────────────────────────────────────────────────────────────
// Privacidad y datos (LFPDPPP — sesión S3)
// Wire de los dos botones: descargar mis datos + eliminar mi cuenta.
// ─────────────────────────────────────────────────────────────────────
function wirePrivacySection() {
  const exportBtn = document.getElementById("exportDataBtn");
  const deleteBtn = document.getElementById("deleteAccountBtn");
  if (!exportBtn || !deleteBtn) return;

  // ── Exportar mis datos ────────────────────────────────────────────
  exportBtn.addEventListener("click", async () => {
    exportBtn.disabled = true;
    const originalText = exportBtn.textContent;
    exportBtn.textContent = "Preparando…";
    try {
      const data = await api.exportMyData();
      // Descargar como archivo JSON
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const fecha = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sophia-mis-datos-${fecha}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      exportBtn.textContent = "✓ Descargado";
      setTimeout(() => { exportBtn.textContent = originalText; exportBtn.disabled = false; }, 2500);
    } catch (err) {
      console.error("export failed:", err);
      alert("No pudimos preparar tu archivo. Intenta de nuevo o contacta soporte.");
      exportBtn.textContent = originalText;
      exportBtn.disabled = false;
    }
  });

  // ── Eliminar mi cuenta ─────────────────────────────────────────────
  deleteBtn.addEventListener("click", () => openDeleteAccountModal());
}

function openDeleteAccountModal() {
  const EXPECTED = "ELIMINAR MI CUENTA";
  const overlay = document.createElement("div");
  overlay.className = "privacy-modal";
  overlay.innerHTML = `
    <div class="privacy-modal__card">
      <h2 class="privacy-modal__title">Eliminar mi cuenta</h2>
      <p class="privacy-modal__body">
        Esto borrará permanentemente: tu perfil, inscripciones, progreso de lecciones,
        respuestas al Test de Felicidad, evaluaciones, fotos y archivos subidos.
        Tus publicaciones top-level del foro se eliminan; los comentarios se anonimizan
        para no romper hilos de otras personas.
      </p>
      <p class="privacy-modal__body" style="color: var(--color-danger); font-weight: 500;">
        Esta acción es <strong>irreversible</strong> y no se puede deshacer.
      </p>
      <p class="privacy-modal__body">
        Para confirmar, escribe exactamente: <strong>${EXPECTED}</strong>
      </p>
      <input type="text" class="privacy-modal__confirm-input" id="deleteConfirmInput"
             placeholder="${EXPECTED}" autocomplete="off">
      <div class="privacy-modal__error" id="deleteError" hidden></div>
      <div class="privacy-modal__actions">
        <button type="button" class="btn btn-ghost" id="deleteCancel">Cancelar</button>
        <button type="button" class="btn btn-danger" id="deleteConfirm" disabled>
          Eliminar permanentemente
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  const input = overlay.querySelector("#deleteConfirmInput");
  const confirm = overlay.querySelector("#deleteConfirm");
  const cancel = overlay.querySelector("#deleteCancel");
  const errorEl = overlay.querySelector("#deleteError");

  input.addEventListener("input", () => {
    confirm.disabled = input.value !== EXPECTED;
    errorEl.hidden = true;
  });
  input.focus();

  cancel.addEventListener("click", () => {
    overlay.remove();
    document.body.style.overflow = "";
  });

  confirm.addEventListener("click", async () => {
    if (input.value !== EXPECTED) return;
    confirm.disabled = true;
    confirm.textContent = "Eliminando…";
    errorEl.hidden = true;
    try {
      const result = await api.deleteMyAccount(input.value);
      // Limpiar todo el estado local + redirect al login con mensaje
      try {
        sessionStorage.clear();
        localStorage.removeItem("sophia_persona");
        localStorage.removeItem("sophia_aviso_aceptado");
      } catch {}
      const partial = result?.partial ? "?deleted=partial" : "?deleted=ok";
      location.replace(`/${partial}`);
    } catch (err) {
      console.error("delete-my-account failed:", err);
      errorEl.textContent = "No pudimos eliminar tu cuenta. Si el problema persiste, contacta privacidad@sophiamx.org.";
      errorEl.hidden = false;
      confirm.disabled = false;
      confirm.textContent = "Eliminar permanentemente";
    }
  });
}
