// SOPHIA Portal · submit-quiz (Postgres, inlined)
//
// Guarda las respuestas de un quiz (actividad en clase) en respuestas_quiz.
// Los quizzes NO puntúan: solo se registran las respuestas tal cual.
// Idempotente por (leccion_id + inscripcion_id).
//
// POST /submit-quiz
// Body: { leccionId, inscripcionId?, actividad: string, respuestas: Record<string,string> }
// Response: { ok: true, respuestaId, alreadySubmitted? }

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

const MAX_ANSWER_LEN = 5000;

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return errorResponse(req, new ApiError(405, "method_not_allowed", "Use POST"));
  }
  const span = startSpan("submit-quiz");

  try {
    const body = await req.json().catch(() => ({})) as {
      leccionId?: string;
      inscripcionId?: string;
      actividad?: string;
      respuestas?: Record<string, string>;
    };
    const { leccionId, inscripcionId: bodyInscripcionId, actividad, respuestas } = body;

    if (!leccionId || !UUID_RE.test(leccionId)) {
      throw new ApiError(400, "invalid_leccion_id", "leccionId inválido");
    }
    if (!actividad || typeof actividad !== "string") {
      throw new ApiError(400, "invalid_actividad", "actividad inválida");
    }
    if (!respuestas || typeof respuestas !== "object" || Array.isArray(respuestas)) {
      throw new ApiError(400, "invalid_respuestas", "respuestas debe ser un objeto");
    }
    if (Object.keys(respuestas).length === 0) {
      throw new ApiError(400, "empty_respuestas", "respuestas vacío");
    }
    for (const [k, v] of Object.entries(respuestas)) {
      if (typeof v !== "string") {
        throw new ApiError(400, "invalid_respuestas", `respuesta '${k}' debe ser string`);
      }
      if (v.length > MAX_ANSWER_LEN) {
        throw new ApiError(400, "answer_too_long", `respuesta '${k}' excede ${MAX_ANSWER_LEN} chars`);
      }
    }

    const persona = await requireUser(req);
    const db = getDb();

    // Validar lección existe y obtener curso_id (a través de modulo)
    const { data: leccion, error: lErr } = await db
      .from("lecciones")
      .select("id, modulo_id, modulos!inner(curso_id)")
      .eq("id", leccionId).maybeSingle();
    if (lErr) throw new ApiError(500, "db_error", lErr.message);
    if (!leccion) throw new ApiError(404, "leccion_not_found", "Lección no encontrada");
    const cursoId = (leccion as any).modulos?.curso_id;

    // Resolver inscripcion_id
    let inscripcionId = bodyInscripcionId;
    if (inscripcionId) {
      if (!UUID_RE.test(inscripcionId)) {
        throw new ApiError(400, "invalid_inscripcion_id", "inscripcionId inválido");
      }
      const { data: insc, error: iErr } = await db
        .from("inscripciones").select("id, persona_id, curso_id")
        .eq("id", inscripcionId).maybeSingle();
      if (iErr) throw new ApiError(500, "db_error", iErr.message);
      if (!insc) throw new ApiError(404, "inscripcion_not_found", "Inscripción no encontrada");
      if (insc.persona_id !== persona.id) {
        throw new ApiError(403, "not_owner", "Esta inscripción no es tuya");
      }
    } else {
      // Derivar inscripcion_id desde persona + curso de la lección
      const { data: insc, error: iErr } = await db
        .from("inscripciones")
        .select("id")
        .eq("persona_id", persona.id)
        .eq("curso_id", cursoId)
        .order("fecha_inscripcion", { ascending: false })
        .limit(1).maybeSingle();
      if (iErr) throw new ApiError(500, "db_error", iErr.message);
      if (!insc) throw new ApiError(403, "no_inscripcion", "No estás inscrito a este curso");
      inscripcionId = insc.id;
    }

    // Idempotencia por (leccion_id + inscripcion_id): si ya existe respuesta,
    // la ACTUALIZAMOS (gana la última). Antes se devolvía sin tocar, lo que
    // hacía que un "volver a contestar" se perdiera. Ahora siempre se guarda
    // el último intento.
    const completedAt = new Date().toISOString();
    const payload = {
      version: 1,
      actividad,
      respuestas,
      completedAt,
    };

    const { data: existing, error: eErr } = await db
      .from("respuestas_quiz")
      .select("id")
      .eq("leccion_id", leccionId)
      .eq("inscripcion_id", inscripcionId)
      .limit(1).maybeSingle();
    if (eErr) throw new ApiError(500, "db_error", eErr.message);

    if (existing) {
      const { error: uErr } = await db
        .from("respuestas_quiz")
        .update({ respuestas: payload, completado_en: completedAt })
        .eq("id", existing.id);
      if (uErr) throw new ApiError(500, "db_error", uErr.message);
      span.end({ persona: persona.id, respuesta: existing.id, updated: true });
      return jsonResponse(req, { ok: true, respuestaId: existing.id, updated: true });
    }

    // Insert (primer intento)
    const { data: created, error: cErr } = await db
      .from("respuestas_quiz")
      .insert({
        inscripcion_id: inscripcionId,
        leccion_id: leccionId,
        respuestas: payload,
        completado_en: completedAt,
      })
      .select("id").single();
    if (cErr) throw new ApiError(500, "db_error", cErr.message);

    span.end({ persona: persona.id, respuesta: created.id, actividad });
    return jsonResponse(req, { ok: true, respuestaId: created.id });
  } catch (err) {
    span.end({ error: true });
    return errorResponse(req, err);
  }
});
