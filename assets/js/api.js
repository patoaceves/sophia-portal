// SOPHIA Portal — API wrapper for Edge Function calls
// Automatically attaches JWT, parses JSON, throws ApiError on errors.

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-client.js";

export class ApiError extends Error {
  constructor(message, status = 500, payload = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

/**
 * Calls a Supabase Edge Function. Throws ApiError on non-2xx.
 *
 * @param {string} fnName
 * @param {object} [opts]
 * @param {"GET"|"POST"|"PATCH"|"DELETE"} [opts.method]
 * @param {object} [opts.body]
 * @param {Record<string,string|number|undefined|null>} [opts.query]
 * @param {Record<string,string>} [opts.headers]
 * @returns {Promise<{data: any, status: number}>}
 */
export async function callEdge(fnName, opts = {}) {
  const method = opts.method ?? "GET";
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new ApiError("Not authenticated", 401);

  const url = new URL(`/functions/v1/${fnName}`, SUPABASE_URL);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    apikey: SUPABASE_ANON_KEY,
    ...opts.headers,
  };
  let body;
  if (opts.body !== undefined && method !== "GET") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, { method, headers, body });
  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
  }

  if (!res.ok) {
    const msg = data?.error ?? `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, data);
  }

  return { data, status: res.status };
}

// ────────────────────────────────────────────────────────────────────
// Named API methods — uno por cada Edge Function deployada.
// Cada uno devuelve directamente el `data` (no envuelto en {data,status})
// para que las páginas no tengan que desempacar.
// ────────────────────────────────────────────────────────────────────

export const api = {
  /** POST /auth-bootstrap → { personaId, rol, nombre, apellidos, isNew } */
  async bootstrap(payload = {}) {
    const { data } = await callEdge("auth-bootstrap", {
      method: "POST",
      body: payload,
    });
    return data;
  },

  /** GET /get-mis-cursos → { cursos: [...] } */
  async misCursos() {
    const { data } = await callEdge("get-mis-cursos");
    return data;
  },

  /** GET /get-curso?slug= → { curso, inscripcion, capitulos } */
  async curso(slug) {
    const { data } = await callEdge("get-curso", { query: { slug } });
    return data;
  },

  /** GET /get-leccion?id= → { leccion, capituloId, cursoId, inscripcionId, prevId, nextId } */
  async leccion(id) {
    const { data } = await callEdge("get-leccion", { query: { id } });
    return data;
  },

  /** POST /marcar-leccion → { ok, progresoId, completada, completadaEn } */
  async marcarLeccion(leccionId, inscripcionId, videoPctCompletado) {
    const body = { leccionId, inscripcionId };
    if (typeof videoPctCompletado === "number") {
      body.videoPctCompletado = videoPctCompletado;
    }
    const { data } = await callEdge("marcar-leccion", { method: "POST", body });
    return data;
  },

  /** POST /submit-test-felicidad → { respuestaId, scores, niveles, analisis, completedAt } */
  async submitTest(inscripcionId, respuestas) {
    const { data } = await callEdge("submit-test-felicidad", {
      method: "POST",
      body: { inscripcionId, respuestas },
    });
    return data;
  },

  /**
   * GET /get-resultados-test
   * - resultadosTest()                 → último intento del usuario
   * - resultadosTest(respuestaId)      → intento específico (param id=)
   */
  async resultadosTest(respuestaId) {
    const query = respuestaId ? { id: respuestaId } : undefined;
    const { data } = await callEdge("get-resultados-test", { query });
    return data;
  },
};
