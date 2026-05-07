// SOPHIA Portal — Auth helpers
// Wraps Supabase auth + bootstraps Persona record on first signin.

import { supabase } from "./supabase-client.js";
import { api } from "./api.js";

const PERSONA_CACHE_KEY = "sophia_persona";
const POST_LOGIN_REDIRECT_KEY = "sophia_post_login_redirect";

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
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedPersona(persona) {
  try {
    sessionStorage.setItem(PERSONA_CACHE_KEY, JSON.stringify(persona));
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

  const persona = await api.bootstrap({});
  setCachedPersona(persona);
  return persona;
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
    return await bootstrapPersona();
  } catch (e) {
    console.error("bootstrapPersona failed:", e);
    showFatalError(e);
    return null;
  }
}

function showFatalError(err) {
  const msg = err?.message || "Unknown error";
  const status = err?.status || "—";
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
