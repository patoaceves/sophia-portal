// SOPHIA Portal · Auth helpers
// Wraps Supabase auth + bootstraps Persona record on first signin.

import { supabase } from "./supabase-client.js";
import { api } from "./api.js";

const PERSONA_CACHE_KEY = "sophia_persona";
const POST_LOGIN_REDIRECT_KEY = "sophia_post_login_redirect";
const PENDING_INVITE_KEY = "sophia_pending_invite";

// ────────────────────────────────────────────────────────────────────
// Pending invite token
// ────────────────────────────────────────────────────────────────────
//
// Flow:
// 1. Landing page (index.html) sees `?invite=inv_xxx` in URL, stashes it.
// 2. User logs in with Google, callback.html runs, claims the token.
// 3. If claim returns 425 (sync pending), the token stays stashed and
//    cursos.html will retry on its next page load.

export function captureInviteFromUrl() {
  try {
    const url = new URL(location.href);
    const t = url.searchParams.get("invite");
    if (t && /^inv_[A-Za-z0-9_-]{4,40}$/.test(t)) {
      sessionStorage.setItem(PENDING_INVITE_KEY, t);
      // Limpiar la URL para que el token no quede visible
      url.searchParams.delete("invite");
      history.replaceState({}, "", url.pathname + url.search + url.hash);
      return t;
    }
  } catch {}
  return null;
}

export function getPendingInvite() {
  try { return sessionStorage.getItem(PENDING_INVITE_KEY); } catch { return null; }
}

export function clearPendingInvite() {
  try { sessionStorage.removeItem(PENDING_INVITE_KEY); } catch {}
}

/**
 * Intenta canjear la invitación pendiente (si existe).
 * Devuelve:
 *   { kind: "none" }                    no había token
 *   { kind: "claimed", data }           canje exitoso
 *   { kind: "already", data }           ya había sido canjeada por este usuario
 *   { kind: "retry", error }            sync pendiente, reintentar después (token NO se borra)
 *   { kind: "fatal", error }            error fatal, token se borra
 */
export async function tryClaimPendingInvite() {
  const token = getPendingInvite();
  if (!token) return { kind: "none" };

  try {
    const data = await api.claimInvitation(token);
    clearPendingInvite();
    // Limpiar cache de Persona para que cursos.html refresque
    clearCachedPersona();
    return { kind: data.alreadyClaimed ? "already" : "claimed", data };
  } catch (err) {
    const code = err?.payload?.code;
    if (code === "sync_pending") {
      // Mantener el token, reintentaremos
      return { kind: "retry", error: err };
    }
    // Cualquier otro error: borrar token (evita loops infinitos)
    clearPendingInvite();
    return { kind: "fatal", error: err };
  }
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("getSession error:", error);
    return null;
  }
  return data.session;
}

export function getCachedPersona() {
  try {
    const raw = sessionStorage.getItem(PERSONA_CACHE_KEY);
    if (!raw) return null;
    const persona = JSON.parse(raw);
    if (typeof window !== "undefined") window.__sophiaPersona = persona;
    return persona;
  } catch {
    return null;
  }
}

function setCachedPersona(persona) {
  try {
    sessionStorage.setItem(PERSONA_CACHE_KEY, JSON.stringify(persona));
    // También exponer en window para módulos que necesiten acceso rápido
    // (ej: foro-lightbox abierto desde el preview del resumen).
    if (typeof window !== "undefined") {
      window.__sophiaPersona = persona;
    }
  } catch {}
}

function clearCachedPersona() {
  try {
    sessionStorage.removeItem(PERSONA_CACHE_KEY);
  } catch {}
}

/**
 * Llama a auth-bootstrap si no hay caché. Devuelve la Persona.
 */
export async function bootstrapPersona() {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const cached = getCachedPersona();
  if (cached?.personaId) return cached;

  // Leer consent del aviso de privacidad de localStorage para mandarlo al
  // backend. El edge function lo persiste solo si la persona aún no tiene
  // ese campo en Airtable (no sobreescribe el timestamp original).
  let consentPayload = {};
  try {
    const raw = localStorage.getItem("sophia_aviso_aceptado");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version && parsed?.aceptadoEn) {
        consentPayload = {
          avisoVersion: String(parsed.version),
          avisoAceptadoEn: String(parsed.aceptadoEn),
        };
      }
    }
  } catch {}

  const persona = await api.bootstrap(consentPayload);
  setCachedPersona(persona);
  return persona;
}

/**
 * Llama a auth-bootstrap pasando todos los campos editables del perfil.
 * El backend graba lo que venga (modo override cuando perfilCompletado=true).
 * Limpia el caché para que la próxima página vea los valores actualizados.
 *
 * @param {object} fields
 * @param {string} fields.nombre
 * @param {string} fields.apellidos
 * @param {string} [fields.avatarUrl]
 * @param {string} [fields.telefonoPais]
 * @param {string} [fields.telefonoNumero]
 * @param {boolean} [fields.perfilCompletado]
 */
export async function updatePersonaProfile(fields) {
  clearCachedPersona();
  const persona = await api.bootstrap(fields);
  setCachedPersona(persona);
  return persona;
}

/**
 * Devuelve true si la Persona aún no completó el onboarding del portal.
 * Usamos un flag explícito (Airtable: "Perfil completado") para distinguir
 * usuarios reales completados de usuarios recién creados con datos parciales
 * (típico de Google sign-in: trae nombre+apellidos pero no teléfono).
 */
export function needsOnboarding(persona) {
  if (!persona) return false;
  return !persona.perfilCompletado;
}

/**
 * Page guard. Si no hay sesión, redirige a login. Si hay, hace bootstrap y
 * devuelve la Persona. Si bootstrap falla, muestra pantalla de error
 * (no loopea de vuelta al login).
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    sessionStorage.setItem(
      POST_LOGIN_REDIRECT_KEY,
      location.pathname + location.search,
    );
    location.replace("/");
    return null;
  }
  try {
    const persona = await bootstrapPersona();

    // Gate del aviso de privacidad (LFPDPPP). Si la persona no tiene
    // avisoVersion registrado, mostramos modal modal bloqueante.
    // El modal NO se muestra en /app/bienvenida (onboarding) ni en la
    // página del aviso mismo, para no anidar diálogos.
    const onAvisoPage = location.pathname.startsWith("/aviso-privacidad");
    if (!onAvisoPage && !persona?.avisoVersion) {
      try {
        const { ensurePrivacyConsent } = await import("./privacy-modal.js");
        await ensurePrivacyConsent(persona);
        // Después de aceptar, actualizamos cache local con avisoVersion
        const updated = { ...persona, avisoVersion: "1.0" };
        setCachedPersona(updated);
      } catch (e) {
        console.warn("privacy modal failed:", e);
      }
    }

    // Onboarding gate: si la persona aún no marcó perfilCompletado,
    // mandarla a /app/bienvenida (excepto si ya está ahí).
    const onBienvenida = location.pathname.startsWith("/app/bienvenida");
    if (!onBienvenida && needsOnboarding(persona)) {
      // No guardamos pathname actual: siempre regresamos a /app/cursos
      // post-onboarding (ver bienvenida.js).
      location.replace("/app/bienvenida");
      return null;
    }

    return persona;
  } catch (e) {
    console.error("bootstrapPersona failed:", e);
    showFatalError(e);
    return null;
  }
}

function showFatalError(err) {
  const msg = err?.message || "Unknown error";
  const status = err?.status || "-";
  const payload = err?.payload ? JSON.stringify(err.payload, null, 2) : "";

  document.body.style.cssText =
    "background:#faf6ee;font-family:system-ui,sans-serif;padding:32px;color:#1f1a14;margin:0;min-height:100vh;";
  document.body.innerHTML = `
    <div style="max-width:560px;margin:60px auto;background:#fff;border:1px solid #e8dfd0;border-radius:14px;padding:32px;">
      <h1 style="font-family:Georgia,serif;font-size:1.5rem;margin:0 0 16px;font-weight:500;">No pudimos completar tu acceso</h1>
      <p style="color:#6b5f50;margin:0 0 16px;line-height:1.5;">
        Iniciaste sesión correctamente, pero algo falló al registrar tu cuenta en la base de datos.
      </p>
      <div style="background:#f7ecdb;border-radius:8px;padding:12px;font-family:ui-monospace,monospace;font-size:0.8125rem;margin-bottom:16px;line-height:1.4;">
        <div><strong>Error:</strong> ${escapeHtml(msg)}</div>
        <div><strong>Status:</strong> ${escapeHtml(String(status))}</div>
        ${payload ? `<pre style="margin:8px 0 0;white-space:pre-wrap;word-break:break-word;">${escapeHtml(payload)}</pre>` : ""}
      </div>
      <p style="font-size:0.875rem;color:#9a8e7e;margin:0 0 20px;line-height:1.5;">
        Si eres administrador, revisa los logs de la Edge Function <code>auth-bootstrap</code> en Supabase.
      </p>
      <button id="retryBtn" style="padding:10px 20px;border-radius:8px;background:#1f1a14;color:#faf6ee;border:none;font-weight:500;cursor:pointer;margin-right:8px;font-family:inherit;">
        Reintentar
      </button>
      <button id="logoutBtn" style="padding:10px 20px;border-radius:8px;background:transparent;color:#6b5f50;border:1px solid #e8dfd0;font-weight:500;cursor:pointer;font-family:inherit;">
        Cerrar sesión
      </button>
    </div>
  `;
  document.getElementById("retryBtn").onclick = () => {
    sessionStorage.removeItem(PERSONA_CACHE_KEY);
    location.reload();
  };
  document.getElementById("logoutBtn").onclick = () => logout();
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export async function redirectIfAuthed() {
  const session = await getSession();
  if (session) {
    const target =
      sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY) || "/app/cursos";
    sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    location.replace(target);
  }
}

export async function loginWithGoogle() {
  return await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${location.origin}/auth/callback` },
  });
}

export async function loginWithMicrosoft() {
  return await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: {
      redirectTo: `${location.origin}/auth/callback`,
      scopes: "email openid profile",
    },
  });
}

export async function loginWithMagicLink(email) {
  return await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${location.origin}/auth/callback` },
  });
}

export async function logout() {
  clearCachedPersona();
  await supabase.auth.signOut();
  location.replace("/");
}

export function isAdmin(persona) {
  return persona?.rol === "admin";
}
