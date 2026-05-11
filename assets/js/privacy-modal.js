// SOPHIA Portal · Privacy consent modal (post-login)
//
// Si el usuario llega a una página interna del portal sin haber aceptado
// previamente el aviso de privacidad (caso típico: login con Google OAuth
// que NO pasa por el checkbox de /index.html, o usuarios con sesión
// pre-existente del feature-launch), mostramos un modal bloqueante.
//
// El modal exige aceptación explícita antes de poder seguir usando el
// portal. Al aceptar:
//   - guarda en localStorage `sophia_aviso_aceptado` con versión+timestamp
//   - llama a bootstrap de nuevo (que persiste en Personas CRM)
//   - cierra y permite continuar

import { api } from "./api.js";

const AVISO_VERSION = "1.0";

/**
 * Llamar después de obtener la persona via requireAuth.
 * Si la persona NO tiene avisoVersion registrado, muestra el modal.
 */
export async function ensurePrivacyConsent(persona) {
  // Si ya tiene consentimiento registrado en backend, no hacemos nada
  if (persona?.avisoVersion) return;

  // Si tiene localStorage pero no backend, lo enviamos y salimos
  // (caso: usuario aceptó en /index.html, primera vez después del login)
  let localConsent = null;
  try {
    localConsent = JSON.parse(localStorage.getItem("sophia_aviso_aceptado") || "null");
  } catch {}

  if (localConsent?.version === AVISO_VERSION) {
    // Ya aceptó en login, el bootstrap inicial debió haberlo persistido.
    // Si llegamos aquí es porque el bootstrap se hizo antes del checkbox
    // o llegó desde caché. Hacemos un bootstrap forzado para sincronizar.
    try {
      await api.bootstrap({
        avisoVersion: localConsent.version,
        avisoAceptadoEn: localConsent.aceptadoEn,
      });
    } catch (e) {
      console.warn("Could not sync consent to backend:", e);
    }
    return;
  }

  // No tiene consentimiento ni en local ni en backend: modal obligatorio
  return showConsentModal();
}

function showConsentModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "privacy-modal";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "privacyModalTitle");
    overlay.innerHTML = `
      <div class="privacy-modal__card">
        <h2 class="privacy-modal__title" id="privacyModalTitle">Aviso de Privacidad</h2>
        <p class="privacy-modal__body">
          Para continuar usando el Portal SOPHIA necesitamos que leas y aceptes
          nuestro Aviso de Privacidad. Es un paso de cumplimiento con la
          Ley Federal de Protección de Datos Personales en Posesión de los
          Particulares (LFPDPPP).
        </p>
        <p class="privacy-modal__body">
          Allí encontrarás qué datos tratamos, para qué los usamos, cómo
          ejercer tus derechos ARCO y a quién contactar para cualquier duda.
        </p>
        <a class="privacy-modal__link" href="/aviso-privacidad.html" target="_blank" rel="noopener noreferrer">
          Leer el Aviso de Privacidad ↗
        </a>
        <label class="privacy-modal__checkbox-row">
          <input type="checkbox" class="privacy-modal__checkbox" id="privacyModalCheck">
          <span>He leído y acepto el Aviso de Privacidad.</span>
        </label>
        <div class="privacy-modal__error" id="privacyModalError" hidden></div>
        <div class="privacy-modal__actions">
          <button type="button" class="btn btn-ghost" id="privacyModalCancel">Cerrar sesión</button>
          <button type="button" class="btn btn-accent" id="privacyModalAccept" disabled>Aceptar y continuar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    const check = overlay.querySelector("#privacyModalCheck");
    const acceptBtn = overlay.querySelector("#privacyModalAccept");
    const cancelBtn = overlay.querySelector("#privacyModalCancel");
    const errorEl = overlay.querySelector("#privacyModalError");

    check.addEventListener("change", () => {
      acceptBtn.disabled = !check.checked;
    });

    cancelBtn.addEventListener("click", async () => {
      try {
        // Logout y mandar a login
        const { supabase } = await import("./supabase-client.js");
        await supabase.auth.signOut();
      } catch {}
      location.href = "/";
    });

    acceptBtn.addEventListener("click", async () => {
      acceptBtn.disabled = true;
      acceptBtn.textContent = "Guardando…";
      errorEl.hidden = true;

      const aceptadoEn = new Date().toISOString();
      try {
        await api.bootstrap({
          avisoVersion: AVISO_VERSION,
          avisoAceptadoEn: aceptadoEn,
        });
        // Persistir también local para futuros logins
        try {
          localStorage.setItem("sophia_aviso_aceptado", JSON.stringify({
            version: AVISO_VERSION,
            aceptadoEn,
          }));
        } catch {}
        // Cerrar modal
        overlay.remove();
        document.body.style.overflow = "";
        resolve();
      } catch (err) {
        console.error("consent persist failed:", err);
        errorEl.textContent = "No pudimos guardar tu consentimiento. Inténtalo de nuevo.";
        errorEl.hidden = false;
        acceptBtn.disabled = false;
        acceptBtn.textContent = "Aceptar y continuar";
      }
    });
  });
}
