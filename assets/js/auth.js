// SOPHIA Portal · Auth helpers
import { supabase } from './supabase-client.js';

/**
 * requireAuth() — usar al inicio de cualquier página de /app/*
 * Si no hay sesión, redirige al login. Devuelve la sesión.
 */
export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/?next=${next}`);
    throw new Error('No session');
  }
  return session;
}

/**
 * redirectIfAuthed() — usar en /index.html (login). Si ya hay sesión, manda a /app.
 */
export async function redirectIfAuthed() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const next = new URLSearchParams(window.location.search).get('next') || '/app';
    window.location.replace(next);
  }
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.replace('/');
}

export async function getUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
}

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` }
  });
}

export async function signInWithMagicLink(email) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
  });
}
