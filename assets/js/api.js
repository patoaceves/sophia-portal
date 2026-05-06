// SOPHIA Portal · API wrapper para Edge Functions
import { supabase } from './supabase-client.js';

const cfg = window.PORTAL_CONFIG || {};
const BASE = cfg.EDGE_FUNCTIONS_URL || '';

/**
 * apiCall(name, body?) — llama una Edge Function pasando el JWT del usuario.
 * Devuelve la data o lanza error con detail.
 */
export async function apiCall(name, body = null, opts = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sin sesión activa');

  const url = `${BASE}/${name}`;
  const init = {
    method: opts.method || (body ? 'POST' : 'GET'),
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': cfg.SUPABASE_ANON_KEY || ''
    }
  };
  if (body) init.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new Error(`Error de red llamando ${name}: ${e.message}`);
  }
  let json;
  try { json = await res.json(); }
  catch { json = { error: `Respuesta no-JSON (${res.status})` }; }

  if (!res.ok) {
    const msg = json?.error || `${name} falló (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

// Atajos por endpoint
export const api = {
  bootstrap:        () => apiCall('auth-bootstrap'),
  misCursos:        () => apiCall('get-mis-cursos'),
  curso:            (slug) => apiCall(`get-curso?slug=${encodeURIComponent(slug)}`),
  leccion:          (id) => apiCall(`get-leccion?id=${encodeURIComponent(id)}`),
  marcarLeccion:    (leccionId, inscripcionId) => apiCall('marcar-leccion', { leccionId, inscripcionId }),
  submitTest:       (inscripcionId, respuestas) => apiCall('submit-test-felicidad', { inscripcionId, respuestas }),
  resultadosTest:   (inscripcionId) => apiCall(`get-resultados-test?inscripcion=${encodeURIComponent(inscripcionId)}`)
};
