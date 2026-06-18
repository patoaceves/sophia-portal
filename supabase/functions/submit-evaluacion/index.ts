// SOPHIA Portal · submit-evaluacion (Postgres, inlined)
//
// Guarda la evaluación de la sesión en `evaluaciones_sesion`.
// Idempotente por (leccion_id + inscripcion_id): si ya existe, devuelve el ID
// existente sin crear duplicado.
//
// POST /submit-evaluacion
// Body: {
//   leccionId: <UUID>,
//   inscripcionId: <UUID>,
//   respuestas: {
//     profesor_preparado:    1..5,
//     contenido_relevante:   1..5,
//     fomento_participacion: 1..5,
//     ideas_aplicables:      1..5,
//     profesor_general:      1..5,
//     comentarios:           "string"  // opcional, max 2000 chars
//   }
// }
// Response 200: { ok: true, evaluacionId, alreadySubmitted? }
// Response 4xx/5xx: { ok: false, error, code? }

// ════════════════════════════════════════════════════════════════════
// SHARED HELPERS (inlined for dashboard deploy)
// ════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

const ALLOWED_ORIGINS = [
  "https://portal.sophiamx.org",
  "http://localhost:3000", "http://localhost:5173",
  "http://127.0.0.1:3000", "http://127.0.0.1:5500",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  return null;
}

function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function errorResponse(req: Request, err: unknown): Response {
  if (err instanceof ApiError) {
    return jsonResponse(req, { error: err.message, code: err.code, details: err.details }, err.status);
  }
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[edge] unhandled error:", msg, err);
  return jsonResponse(req, { error: msg, code: "internal_error" }, 500);
}

let _db: SupabaseClient | null = null;
function getDb(): SupabaseClient {
  if (_db) return _db;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  _db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });
  return _db;
}

type Persona = {
  id: string; auth_user_id: string; email: string;
  nombre: string; apellidos: string; rol: string; avatar_url: string | null;
};

function normalizeEmail(email: string): string { return email.trim().toLowerCase(); }

async function requireUser(req: Request): Promise<Persona> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new ApiError(401, "missing_auth", "Falta header Authorization");

  const url = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !publicKey) throw new ApiError(500, "config_error", "Supabase env no configurado");

  const authClient = createClient(url, publicKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) throw new ApiError(401, "invalid_token", "Token inválido o expirado");

  const email = normalizeEmail(user.email ?? "");
  if (!email) throw new ApiError(401, "no_email", "El usuario no tiene email");

  const db = getDb();
  let { data: persona, error: pErr } = await db
    .from("personas")
    .select("id, auth_user_id, email, nombre, apellidos, rol, avatar_url")
    .eq("auth_user_id", user.id).maybeSingle();
  if (pErr) throw new ApiError(500, "db_error", pErr.message);

  if (!persona) {
    const { data: byEmail, error: eErr } = await db
      .from("personas")
      .select("id, auth_user_id, email, nombre, apellidos, rol, avatar_url")
      .eq("email", email).maybeSingle();
    if (eErr) throw new ApiError(500, "db_error", eErr.message);
    if (!byEmail) throw new ApiError(403, "no_persona", "No hay persona vinculada a este email");
    if (!byEmail.auth_user_id) {
      const { error: uErr } = await db.from("personas").update({ auth_user_id: user.id }).eq("id", byEmail.id);
      if (uErr) throw new ApiError(500, "db_error", uErr.message);
      byEmail.auth_user_id = user.id;
    } else if (byEmail.auth_user_id !== user.id) {
      throw new ApiError(409, "email_conflict", "Email ya vinculado a otra cuenta");
    }
    persona = byEmail;
  }
  return persona as Persona;
}

const SLOW_THRESHOLD_MS = 2000;
function startSpan(name: string, extra: Record<string, unknown> = {}) {
  const t0 = performance.now();
  return {
    end(more: Record<string, unknown> = {}) {
      const ms = Math.round(performance.now() - t0);
      const slow = ms > SLOW_THRESHOLD_MS;
      console.log(JSON.stringify({
        span: name, ms, ...(slow ? { slow: true } : {}),
        ts: new Date().toISOString(), ...extra, ...more,
      }));
      return ms;
    },
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REQUIRED_RATINGS = [
  "profesor_preparado",
  "contenido_relevante",
  "fomento_participacion",
  "ideas_aplicables",
  "profesor_general",
] as const;

const MAX_COMENTARIOS_LEN = 2000;

interface RespuestasBody {
  profesor_preparado?: number;
  contenido_relevante?: number;
  fomento_participacion?: number;
  ideas_aplicables?: number;
  profesor_general?: number;
  comentarios?: string;
}

function validateRespuestas(r: RespuestasBody): { ok: true } | { ok: false; error: string } {
  for (const k of REQUIRED_RATINGS) {
    const v = (r as any)[k];
    if (typeof v !== "number" || v < 1 || v > 5 || !Number.isInteger(v)) {
      return { ok: false, error: `Respuesta inválida o faltante: ${k}` };
    }
  }
  if (r.comentarios !== undefined && r.comentarios !== null) {
    if (typeof r.comentarios !== "string") {
      return { ok: false, error: "comentarios debe ser string" };
    }
    if (r.comentarios.length > MAX_COMENTARIOS_LEN) {
      return { ok: false, error: `comentarios excede ${MAX_COMENTARIOS_LEN} caracteres` };
    }
  }
  return { ok: true };
}

function errorOk(req: Request, message: string, status = 400, code?: string): Response {
  return jsonResponse(req, { ok: false, error: message, code }, status);
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return errorOk(req, "Use POST", 405, "method_not_allowed");
  }
  const span = startSpan("submit-evaluacion");

  try {
    const body = await req.json().catch(() => ({})) as {
      leccionId?: string;
      inscripcionId?: string;
      respuestas?: RespuestasBody;
    };
    const { leccionId, inscripcionId, respuestas } = body;

    if (!leccionId || !UUID_RE.test(leccionId)) {
      return errorOk(req, "leccionId inválido", 400, "invalid_leccion_id");
    }
    if (!inscripcionId || !UUID_RE.test(inscripcionId)) {
      return errorOk(req, "inscripcionId inválido", 400, "invalid_inscripcion_id");
    }
    if (!respuestas) {
      return errorOk(req, "respuestas requerido", 400, "missing_respuestas");
    }
    const valid = validateRespuestas(respuestas);
    if (!valid.ok) {
      return errorOk(req, valid.error, 400, "invalid_respuestas");
    }

    const persona = await requireUser(req);
    const db = getDb();

    // Validar ownership: la inscripción debe ser del user
    const { data: insc, error: iErr } = await db
      .from("inscripciones").select("id, persona_id")
      .eq("id", inscripcionId).maybeSingle();
    if (iErr) return errorOk(req, iErr.message, 500, "db_error");
    if (!insc) return errorOk(req, "Inscripción no encontrada", 404, "inscripcion_not_found");
    if (insc.persona_id !== persona.id) {
      return errorOk(req, "Esta inscripción no es tuya", 403, "not_owner");
    }

    // Validar que la lección existe
    const { data: lec, error: lErr } = await db
      .from("lecciones").select("id, tipo, etiqueta")
      .eq("id", leccionId).maybeSingle();
    if (lErr) return errorOk(req, lErr.message, 500, "db_error");
    if (!lec) return errorOk(req, "Lección no encontrada", 404, "leccion_not_found");

    const completadoEn = new Date().toISOString();
    const comentarios = (respuestas.comentarios ?? "").trim();
    const fila: Record<string, unknown> = {
      inscripcion_id: inscripcionId,
      leccion_id: leccionId,
      respuestas: respuestas,
      profesor_preparado: respuestas.profesor_preparado,
      fomento_participacion: respuestas.fomento_participacion,
      ideas_aplicables: respuestas.ideas_aplicables,
      profesor_general: respuestas.profesor_general,
      resumen: comentarios || null,
      completado_en: completadoEn,
    };

    // Si ya existe evaluación para esta (lección + inscripción), la
    // ACTUALIZAMOS (gana la última). Antes se descartaba el reenvío.
    const { data: existing, error: eErr } = await db
      .from("evaluaciones_sesion")
      .select("id")
      .eq("leccion_id", leccionId)
      .eq("inscripcion_id", inscripcionId)
      .limit(1).maybeSingle();
    if (eErr) return errorOk(req, eErr.message, 500, "db_error");

    if (existing) {
      const { error: uErr } = await db
        .from("evaluaciones_sesion")
        .update(fila)
        .eq("id", existing.id);
      if (uErr) return errorOk(req, uErr.message, 500, "db_error");
      span.end({ persona: persona.id, evaluacion: existing.id, updated: true });
      return jsonResponse(req, { ok: true, evaluacionId: existing.id, updated: true });
    }

    const { data: created, error: cErr } = await db
      .from("evaluaciones_sesion")
      .insert(fila)
      .select("id").single();
    if (cErr) return errorOk(req, cErr.message, 500, "db_error");

    span.end({ persona: persona.id, evaluacion: created.id, inscripcion: inscripcionId });
    return jsonResponse(req, { ok: true, evaluacionId: created.id });
  } catch (err) {
    span.end({ error: true });
    if (err instanceof ApiError) {
      return errorOk(req, err.message, err.status, err.code);
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[submit-evaluacion] unhandled:", msg);
    return errorOk(req, msg, 500, "internal_error");
  }
});
