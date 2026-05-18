// SOPHIA Portal · API wrapper for Edge Function calls
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
// Named API methods · uno por cada Edge Function deployada.
// Cada uno devuelve directamente el `data` (no envuelto en {data,status})
// para que las páginas no tengan que desempacar.
// ────────────────────────────────────────────────────────────────────

// ── Caché en sessionStorage ──────────────────────────────────────────────────
// Guarda respuestas por tab-session (se limpia al cerrar la pestaña).
// TTL: 5 minutos. Se invalida al marcar una lección como completada.
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheGet(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { ts, value } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) { sessionStorage.removeItem(key); return null; }
    return value;
  } catch { return null; }
}

function cacheSet(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), value })); } catch {}
}

function cacheDel(key) {
  try { sessionStorage.removeItem(key); } catch {}
}

function cacheClear(prefix) {
  try {
    Object.keys(sessionStorage)
      .filter(k => k.startsWith(prefix))
      .forEach(k => sessionStorage.removeItem(k));
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────

export const api = {
  /** POST /auth-bootstrap → { personaId, rol, nombre, apellidos, isNew } */
  async bootstrap(payload = {}) {
    const { data } = await callEdge("auth-bootstrap", {
      method: "POST",
      body: payload,
    });
    return data;
  },
  async misCursos() {
    const hit = cacheGet("api:mis-cursos");
    if (hit) return hit;
    const { data } = await callEdge("get-mis-cursos");
    cacheSet("api:mis-cursos", data);
    return data;
  },

  /** GET /get-curso?slug= → { curso, inscripcion, capitulos } */
  async curso(slug) {
    const key = `api:curso:${slug}`;
    const hit = cacheGet(key);
    if (hit) return hit;
    const { data } = await callEdge("get-curso", { query: { slug } });
    cacheSet(key, data);
    return data;
  },

  /** GET /get-leccion?id= → { leccion, capituloId, cursoId, inscripcionId, prevId, nextId } */
  async leccion(id) {
    const key = `api:leccion:${id}`;
    const hit = cacheGet(key);
    if (hit) return hit;
    const { data } = await callEdge("get-leccion", { query: { id } });
    cacheSet(key, data);
    return data;
  },

  /** POST /marcar-leccion → { ok, progresoId, completada, completadaEn } */
  async marcarLeccion(leccionId, inscripcionId, videoPctCompletado) {
    const body = { leccionId, inscripcionId };
    if (typeof videoPctCompletado === "number") {
      body.videoPctCompletado = videoPctCompletado;
    }
    const { data } = await callEdge("marcar-leccion", { method: "POST", body });
    // Invalida cache para que progreso se refleje de inmediato
    cacheClear("api:curso:");
    cacheDel("api:mis-cursos");
    cacheDel(`api:leccion:${leccionId}`);
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

  /**
   * POST /submit-test-autoconocimiento
   * Autoevaluación VIA · 24 preguntas Likert (S1..T5).
   * → { respuestaId, ranking, signatureStrengths, virtudes, virtudNombres, completedAt }
   */
  async submitAutoconocimiento(inscripcionId, respuestas) {
    const { data } = await callEdge("submit-test-autoconocimiento", {
      method: "POST",
      body: { inscripcionId, respuestas },
    });
    return data;
  },

  /**
   * GET /get-resultados-autoconocimiento
   * - resultadosAutoconocimiento()              → último intento del usuario
   * - resultadosAutoconocimiento(respuestaId)   → intento específico
   * → { tieneResultados, respuestaId, ranking, signatureStrengths, virtudes, ... }
   */
  async resultadosAutoconocimiento(respuestaId) {
    const query = respuestaId ? { id: respuestaId } : undefined;
    const { data } = await callEdge("get-resultados-autoconocimiento", { query });
    return data;
  },

  /**
   * POST /claim-invitation, devuelve
   *   { ok, isNew, cohorteId, cursoSlug, inscripcionId, alreadyClaimed }
   *
   * Códigos de error útiles (en err.payload.code):
   *   invalid_token, not_found, already_claimed, expired, revoked,
   *   email_mismatch, cohort_closed, no_cohort, no_course,
   *   sync_pending  (el frontend debe reintentar más tarde)
   */
  async claimInvitation(token) {
    const { data } = await callEdge("claim-invitation", {
      method: "POST",
      body: { token },
    });
    return data;
  },

  // ── Foro ────────────────────────────────────────────────────────────────

  /**
   * GET /get-foro-posts?cursoId=recXXX
   * → { posts: [...], yo: { personaPortalId, nombre, apellidos, iniciales, esAdmin } }
   * NO se cachea (el feed cambia constantemente).
   */
  async foroPosts(cursoId) {
    const { data } = await callEdge("get-foro-posts", { query: { cursoId } });
    return data;
  },

  /**
   * POST /create-foro-post
   * body: { cursoId, contenido, adjuntoUrl?, adjuntoTipo?, adjuntoNombre?, parentPostId? }
   * → { ok, post }
   */
  async crearForoPost({ cursoId, contenido, adjuntoUrl, adjuntoTipo, adjuntoNombre, parentPostId }) {
    const body = { cursoId, contenido };
    if (adjuntoUrl) {
      body.adjuntoUrl = adjuntoUrl;
      body.adjuntoTipo = adjuntoTipo;
      if (adjuntoNombre) body.adjuntoNombre = adjuntoNombre;
    }
    if (parentPostId) body.parentPostId = parentPostId;
    const { data } = await callEdge("create-foro-post", { method: "POST", body });
    return data;
  },

  /**
   * POST /delete-foro-post
   * body: { postId }
   * → { ok, postId }
   */
  async borrarForoPost(postId) {
    const { data } = await callEdge("delete-foro-post", {
      method: "POST",
      body: { postId },
    });
    return data;
  },

  /**
   * POST /upload-asset · multipart upload to Supabase Storage.
   *
   * @param {object} opts
   * @param {File} opts.file
   * @param {"avatar"|"foro-attachment"} opts.kind
   * @param {string} [opts.cursoId] · required if kind=foro-attachment
   * @param {(progress01: number) => void} [opts.onProgress] · 0..1
   * @returns {Promise<{ url, path, kind, attachmentType, mimeType, size, originalName }>}
   */
  async uploadAsset({ file, kind, cursoId, onProgress }) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new ApiError("Not authenticated", 401);

    const url = new URL("/functions/v1/upload-asset", SUPABASE_URL);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    if (cursoId) fd.append("cursoId", cursoId);

    // Usamos XHR (no fetch) para tener progreso de upload.
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url.toString());
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);

      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(e.loaded / e.total);
        };
      }

      xhr.onload = () => {
        let payload = null;
        try { payload = JSON.parse(xhr.responseText); } catch { /* not json */ }
        if (xhr.status >= 200 && xhr.status < 300 && payload?.ok) {
          resolve(payload.asset);
        } else {
          const msg = payload?.error || `Upload failed (${xhr.status})`;
          reject(new ApiError(msg, xhr.status, payload));
        }
      };
      xhr.onerror = () => reject(new ApiError("Network error during upload", 0));
      xhr.send(fd);
    });
  },

  /**
   * POST /submit-evaluacion · guarda las respuestas del wizard de evaluación
   * de sesión en la tabla "Evaluaciones Sesión" de Airtable.
   *
   * @param {object} opts
   * @param {string} opts.leccionId
   * @param {string} [opts.inscripcionId]
   * @param {{ profesor_preparado: number, contenido_relevante: number, fomento_participacion: number, ideas_aplicables: number, profesor_general: number, comentarios?: string }} opts.respuestas
   * @returns {Promise<{ ok: boolean, evaluacionId: string, alreadySubmitted?: boolean }>}
   */
  async submitEvaluacion({ leccionId, inscripcionId, respuestas }) {
    const body = { leccionId, respuestas };
    if (inscripcionId) body.inscripcionId = inscripcionId;
    const { data } = await callEdge("submit-evaluacion", { method: "POST", body });
    return data;
  },

  /**
   * POST /submit-quiz
   * Guarda las respuestas de una actividad en clase (quiz) en la tabla
   * "Actividades en Clase".
   * @param {object} opts
   * @param {string} opts.leccionId
   * @param {string} [opts.inscripcionId]
   * @param {string} opts.actividad   · clave del quiz, ej. "gnothi-seauton"
   * @param {object} opts.respuestas  · { preguntaId: valor }
   * @returns {Promise<{ ok: boolean, respuestaId: string }>}
   */
  async submitQuiz({ leccionId, inscripcionId, actividad, respuestas }) {
    const body = { leccionId, actividad, respuestas };
    if (inscripcionId) body.inscripcionId = inscripcionId;
    const { data } = await callEdge("submit-quiz", { method: "POST", body });
    return data;
  },

  /**
   * GET /get-resultados-quiz?leccionId=...
   * Devuelve la última respuesta del usuario a esa actividad en clase.
   * → { tieneResultados, respuestaId, actividad, respuestas, completedAt }
   */
  async resultadosQuiz(leccionId) {
    const { data } = await callEdge(
      `get-resultados-quiz?leccionId=${encodeURIComponent(leccionId)}`,
      { method: "GET" },
    );
    return data;
  },

  /**
   * GET /get-curso-roster?cursoId=...
   * Devuelve los inscritos del curso (Persona Portal info), para alimentar
   * el autocomplete de menciones en el composer del foro.
   *
   * Sin cache: las inscripciones cambian frecuentemente (cuando ventas
   * inscribe gente nueva), y si cacheamos puede mostrar una lista vieja
   * que excluye personas recién agregadas. Roster es ~10-50 records típicos,
   * llamada es rápida.
   */
  async getCursoRoster(cursoId) {
    const { data } = await callEdge(`get-curso-roster?cursoId=${encodeURIComponent(cursoId)}`, {
      method: "GET",
    });
    return data?.roster ?? [];
  },

  /**
   * POST /claim-by-email
   * Canjea automáticamente cualquier Invitación pendiente que matchea con
   * el email del usuario autenticado. Cubre el caso de gente que se registra
   * directamente sin haber hecho click en el invite link.
   */
  async claimByEmail() {
    const { data } = await callEdge("claim-by-email", { method: "POST" });
    return data;
  },

  /**
   * GET /export-my-data → JSON con todos los datos personales del usuario.
   * Derecho de Acceso LFPDPPP.
   */
  async exportMyData() {
    const { data } = await callEdge("export-my-data", { method: "GET" });
    return data;
  },

  /**
   * POST /delete-my-account → elimina permanentemente la cuenta + datos.
   * Derecho de Cancelación LFPDPPP. IRREVERSIBLE.
   *
   * @param {string} confirmacion · debe ser exactamente "ELIMINAR MI CUENTA"
   */
  async deleteMyAccount(confirmacion) {
    const { data } = await callEdge("delete-my-account", {
      method: "POST",
      body: { confirmacion },
    });
    return data;
  },
};
