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

  // Path 1: hay token en sessionStorage (entró via invite link)
  if (token) {
    try {
      const data = await api.claimInvitation(token);
      clearPendingInvite();
      clearCachedPersona();
      // Después del claim por token, igual probamos email-based por si hay
      // OTRAS invitaciones pendientes para el mismo email (caso: persona
      // tiene 2 cursos pendientes, click en link de uno, el otro queda).
      tryClaimByEmail().catch(() => {});
      return { kind: data.alreadyClaimed ? "already" : "claimed", data };
    } catch (err) {
      const code = err?.payload?.code;
      if (code === "sync_pending") {
        return { kind: "retry", error: err };
      }
      clearPendingInvite();
      return { kind: "fatal", error: err };
    }
  }

  // Path 2: NO hay token. Buscar invitaciones pendientes por email igual.
  // Cubre el caso de la persona que recibió el email de invite pero entró
  // al portal directo via Google/magic link sin hacer click en el invite link.
  return await tryClaimByEmail();
}

/**
 * Intenta canjear invitaciones pendientes que matchean por email del JWT.
 * Llamado por tryClaimPendingInvite y opcionalmente desde otros lados.
 */
async function tryClaimByEmail() {
  try {
    const data = await api.claimByEmail();
    if (data.claimed > 0) {
      clearCachedPersona(); // forzar refresh
      return { kind: "claimed", data };
    }
    if (data.alreadyEnrolled > 0) {
      return { kind: "already", data };
    }
    if (data.retry) {
      return { kind: "retry", data };
    }
    return { kind: "none", data };
  } catch (err) {
    console.warn("[auth] claim-by-email failed:", err);
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

// TTL del cache de Persona. Si pasaron más de 60s desde el último fetch,
// re-bootstrap para que la reconciliación de invites huérfanos funcione
// (auth-bootstrap busca Invitaciones pendientes por email). Cache demasiado
// largo evita que se descubran invites recién creados desde ventas.
const PERSONA_CACHE_TTL_MS = 60 * 1000;

export function getCachedPersona() {
  try {
    const raw = sessionStorage.getItem(PERSONA_CACHE_KEY);
    if (!raw) return null;
    const wrapper = JSON.parse(raw);
    // Compatibilidad con formato viejo (sin ts): tratar como expirado
    if (!wrapper || !wrapper.ts || !wrapper.persona) return null;
    if (Date.now() - wrapper.ts > PERSONA_CACHE_TTL_MS) {
      // Expirado: limpiar y forzar refetch
      sessionStorage.removeItem(PERSONA_CACHE_KEY);
      return null;
    }
    const persona = wrapper.persona;
    if (typeof window !== "undefined") window.__sophiaPersona = persona;
    return persona;
  } catch {
    return null;
  }
}

function setCachedPersona(persona) {
  try {
    const wrapper = { ts: Date.now(), persona };
    sessionStorage.setItem(PERSONA_CACHE_KEY, JSON.stringify(wrapper));
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

  // Reconciliación de invitaciones huérfanas: si el backend detectó que
  // este email tiene una Invitación pendiente que nunca se canjeó (caso
  // típico: ventas inscribió a la persona pero entró al portal por flujo
  // normal sin clickear el link del email), guardamos el token en
  // sessionStorage. tryClaimPendingInvite lo canjeará en el siguiente paso.
  if (persona?.pendingInviteToken && !getPendingInvite()) {
    sessionStorage.setItem(PENDING_INVITE_KEY, persona.pendingInviteToken);
    console.log("[auth] reconciling huérfano invite from email match:", persona.pendingInviteToken);
  }

  // No cacheamos el token (es one-shot) — eliminarlo antes de persistir
  // para que llamadas subsecuentes no lo re-disparen.
  const personaForCache = { ...persona };
  delete personaForCache.pendingInviteToken;
  setCachedPersona(personaForCache);
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
    await showFatalError(e);
    return null;
  }
}

async function showFatalError(err) {
  const msg = err?.message || "Unknown error";
  const status = err?.status || 0;
  const payload = err?.payload ? JSON.stringify(err.payload, null, 2) : "";

  // ─── Auto-recovery: sesión stale ─────────────────────────────────
  // Caso típico: el usuario tenía sesión persistida en localStorage,
  // pero su Auth user fue borrado (delete-my-account, admin action, etc).
  // El JWT existe localmente pero ya no es válido en el servidor.
  // En lugar de mostrarle al usuario un error críptico, limpiamos la
  // sesión silenciosamente y lo regresamos al login.
  const isStaleSession =
    status === 401 ||
    /invalid jwt|user from sub claim|not authenticated|jwt expired/i.test(msg) ||
    /user from sub claim|invalid jwt/i.test(payload);
  if (isStaleSession) {
    console.warn("[auth] stale session detected, clearing and redirecting to login");
    try { sessionStorage.clear(); } catch {}
    try { localStorage.removeItem("sophia_aviso_aceptado"); } catch {}
    try { await supabase.auth.signOut(); } catch {}
    location.replace("/?session_expired=1");
    return;
  }

  // ─── Error page rediseñada ───────────────────────────────────────
  document.body.style.cssText =
    "background:#faf6ee;font-family:'Source Sans 3',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;color:#1f1a14;";
  document.body.innerHTML = `
    <div style="width:100%;max-width:480px;background:#fff;border-radius:16px;padding:36px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.06);">
      <div style="width:48px;height:48px;border-radius:50%;background:#fdecec;color:#c1122f;display:grid;place-items:center;margin-bottom:20px;">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <h1 style="font-family:Georgia,serif;font-size:1.5rem;line-height:1.25;margin:0 0 12px;font-weight:500;">
        Algo no salió bien
      </h1>
      <p style="color:#6b5f50;margin:0 0 24px;line-height:1.55;font-size:0.9375rem;">
        Tu sesión inició, pero hubo un problema al cargar tu perfil. Intenta de nuevo en unos segundos.
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;">
        <button id="retryBtn" style="flex:1;min-width:140px;padding:12px 20px;border-radius:10px;background:#c1122f;color:#fff;border:none;font-weight:600;font-size:0.9375rem;cursor:pointer;font-family:inherit;">
          Reintentar
        </button>
        <button id="logoutBtn" style="flex:1;min-width:140px;padding:12px 20px;border-radius:10px;background:transparent;color:#6b5f50;border:1px solid #d8cfbf;font-weight:500;font-size:0.9375rem;cursor:pointer;font-family:inherit;">
          Cerrar sesión
        </button>
      </div>
      <p style="font-size:0.8125rem;color:#9a8e7e;margin:0 0 12px;line-height:1.5;">
        Si el problema persiste, escribe a
        <a href="mailto:contacto@sophiamx.org" style="color:#c1122f;text-decoration:none;">contacto@sophiamx.org</a>.
      </p>
      <details style="margin-top:8px;">
        <summary style="cursor:pointer;font-size:0.8125rem;color:#9a8e7e;user-select:none;">Detalles técnicos</summary>
        <div style="background:#f8f3e9;border-radius:8px;padding:12px;font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:0.75rem;margin-top:10px;line-height:1.5;color:#3d3631;overflow:auto;">
          <div><strong>Error:</strong> ${escapeHtml(msg)}</div>
          <div><strong>Status:</strong> ${escapeHtml(String(status || "-"))}</div>
          ${payload ? `<pre style="margin:6px 0 0;white-space:pre-wrap;word-break:break-word;">${escapeHtml(payload)}</pre>` : ""}
        </div>
      </details>
    </div>
  `;
  document.getElementById("retryBtn").onclick = () => {
    try { sessionStorage.removeItem(PERSONA_CACHE_KEY); } catch {}
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
