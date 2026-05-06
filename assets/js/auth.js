// SOPHIA Portal — Auth helpers
// Wraps Supabase auth + bootstraps Persona record on first signin.

import { supabase } from "./supabase-client.js";
import { callEdge } from "./api.js";

const PERSONA_CACHE_KEY = "sophia_persona";
const POST_LOGIN_REDIRECT_KEY = "sophia_post_login_redirect";

/**
 * Get the current Supabase session. Returns null if not signed in.
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("getSession error:", error);
    return null;
  }
  return data.session;
}

/**
 * Get cached Persona record (set by `bootstrapPersona`).
 * Returns { personaId, rol, nombre, apellidos } or null.
 */
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
  } catch {
    /* ignore */
  }
}

function clearCachedPersona() {
  try {
    sessionStorage.removeItem(PERSONA_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Calls auth-bootstrap to ensure a Persona record exists for this user.
 * Caches the result in sessionStorage. Idempotent.
 */
export async function bootstrapPersona() {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const cached = getCachedPersona();
  if (cached?.personaId) return cached;

  const { data } = await callEdge("auth-bootstrap", {
    method: "POST",
    body: {},
  });
  setCachedPersona(data);
  return data;
}

/**
 * Page guard: ensures the user is signed in. If not, redirects to /.
 * Use at the top of every authenticated page.
 *
 * Returns the persona on success.
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, location.pathname + location.search);
    location.replace("/");
    return null;
  }
  try {
    return await bootstrapPersona();
  } catch (e) {
    console.error("bootstrapPersona failed:", e);
    location.replace("/");
    return null;
  }
}

/**
 * Reverse: redirect to /app/cursos if already signed in.
 * Use on the login page.
 */
export async function redirectIfAuthed() {
  const session = await getSession();
  if (session) {
    const target = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY) || "/app/cursos";
    sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    location.replace(target);
  }
}

/* ---------- Login methods ---------- */

export async function loginWithGoogle() {
  return await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${location.origin}/auth/callback`,
    },
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
    options: {
      emailRedirectTo: `${location.origin}/auth/callback`,
    },
  });
}

export async function logout() {
  clearCachedPersona();
  await supabase.auth.signOut();
  location.replace("/");
}

/* ---------- Role helpers ---------- */

export function isAdmin(persona) {
  return persona?.rol === "admin";
}
