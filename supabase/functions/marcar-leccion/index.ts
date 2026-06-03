// ════════════════════════════════════════════════════════════════════
// SHARED HELPERS (inlined for dashboard deploy)
// Mantener sincronizado con _shared/ si en algún momento se usa CLI deploy.
// ════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ── ApiError + CORS + responses ─────────────────────────────────────
class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

const ALLOWED_ORIGINS = [
  "https://portal.sophiamx.org",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5500",
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
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
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

// ── DB singleton (service_role, bypassa RLS) ────────────────────────
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

// ── Persona + JWT validation ─────────────────────────────────────────
type Persona = {
  id: string;
  auth_user_id: string;
  email: string;
  nombre: string;
  apellidos: string;
  rol: string;
  avatar_url: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

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

  const authUserId = user.id;
  const email = normalizeEmail(user.email ?? "");
  if (!email) throw new ApiError(401, "no_email", "El usuario no tiene email");

  const db = getDb();
  let { data: persona, error: pErr } = await db
    .from("personas")
    .select("id, auth_user_id, email, nombre, apellidos, rol, avatar_url")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (pErr) throw new ApiError(500, "db_error", pErr.message);

  if (!persona) {
    const { data: byEmail, error: eErr } = await db
      .from("personas")
      .select("id, auth_user_id, email, nombre, apellidos, rol, avatar_url")
      .eq("email", email)
      .maybeSingle();
    if (eErr) throw new ApiError(500, "db_error", eErr.message);
    if (!byEmail) throw new ApiError(403, "no_persona", "No hay persona vinculada a este email");
    if (!byEmail.auth_user_id) {
      const { error: uErr } = await db.from("personas").update({ auth_user_id: authUserId }).eq("id", byEmail.id);
      if (uErr) throw new ApiError(500, "db_error", uErr.message);
      byEmail.auth_user_id = authUserId;
    } else if (byEmail.auth_user_id !== authUserId) {
      throw new ApiError(409, "email_conflict", "Email ya vinculado a otra cuenta");
    }
    persona = byEmail;
  }
  return persona as Persona;
}

// ── Observability ────────────────────────────────────────────────────
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

// ════════════════════════════════════════════════════════════════════
// END OF SHARED HELPERS — handler de la función comienza abajo
// ════════════════════════════════════════════════════════════════════

// SOPHIA Portal · marcar-leccion (Postgres)
// Marks a lesson as completed for the authenticated user. Idempotent:
// preserves the original completion timestamp on repeat calls.
//
// POST /marcar-leccion
// Headers: Authorization: Bearer <supabase_jwt>
// Body: { leccionId: UUID, inscripcionId: UUID, videoPctCompletado?: number }
//
// Returns 200: { ok, progresoId, completada, completadaEn, alreadyDone? }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse(req, new ApiError(405, "method_not_allowed", "Use POST"));
  }

  const span = startSpan("marcar-leccion");

  try {
    const body = await req.json().catch(() => ({}));
    const { leccionId, inscripcionId, videoPctCompletado } = body as {
      leccionId?: string;
      inscripcionId?: string;
      videoPctCompletado?: number;
    };

    if (!leccionId || !UUID_RE.test(leccionId)) {
      throw new ApiError(400, "invalid_leccion_id", "leccionId inválido");
    }
    if (!inscripcionId || !UUID_RE.test(inscripcionId)) {
      throw new ApiError(400, "invalid_inscripcion_id", "inscripcionId inválido");
    }

    const persona = await requireUser(req);
    const db = getDb();

    // Verificar que la inscripción pertenece a la persona
    const { data: inscripcion, error: iErr } = await db
      .from("inscripciones")
      .select("id, persona_id, curso_id")
      .eq("id", inscripcionId)
      .maybeSingle();
    if (iErr) throw new ApiError(500, "db_error", iErr.message);
    if (!inscripcion) {
      throw new ApiError(404, "inscripcion_not_found", "Inscripción no encontrada");
    }
    if (inscripcion.persona_id !== persona.id) {
      throw new ApiError(403, "not_owner", "Esta inscripción no es tuya");
    }

    // Verificar que la lección existe y pertenece al curso de la inscripción
    const { data: leccion, error: lErr } = await db
      .from("lecciones")
      .select("id, modulo_id, modulos!inner(curso_id)")
      .eq("id", leccionId)
      .maybeSingle();
    if (lErr) throw new ApiError(500, "db_error", lErr.message);
    if (!leccion) {
      throw new ApiError(404, "leccion_not_found", "Lección no encontrada");
    }
    if ((leccion as any).modulos.curso_id !== inscripcion.curso_id) {
      throw new ApiError(400, "leccion_curso_mismatch", "Lección no pertenece a este curso");
    }

    // Buscar progreso existente
    const { data: existing, error: eErr } = await db
      .from("progreso_lecciones")
      .select("id, completado, completado_en")
      .eq("inscripcion_id", inscripcionId)
      .eq("leccion_id", leccionId)
      .maybeSingle();
    if (eErr) throw new ApiError(500, "db_error", eErr.message);

    if (existing && existing.completado) {
      // Idempotente: si ya estaba completada, no toques el timestamp
      span.end({ already_done: true, progreso: existing.id });
      return jsonResponse(req, {
        ok: true,
        progresoId: existing.id,
        completada: true,
        completadaEn: existing.completado_en,
        alreadyDone: true,
      });
    }

    const nowISO = new Date().toISOString();
    const update: Record<string, unknown> = {
      completado: true,
      completado_en: nowISO,
    };
    if (typeof videoPctCompletado === "number") {
      update.video_pct = videoPctCompletado;
    }

    let progresoId: string;
    if (existing) {
      // Update existing row (completado=false → true)
      const { data, error: uErr } = await db
        .from("progreso_lecciones")
        .update(update)
        .eq("id", existing.id)
        .select("id")
        .single();
      if (uErr) throw new ApiError(500, "db_error", uErr.message);
      progresoId = data.id;
    } else {
      // Insert
      const insertRow = {
        inscripcion_id: inscripcionId,
        leccion_id: leccionId,
        ...update,
      };
      const { data, error: nErr } = await db
        .from("progreso_lecciones")
        .insert(insertRow)
        .select("id")
        .single();
      if (nErr) throw new ApiError(500, "db_error", nErr.message);
      progresoId = data.id;
    }

    span.end({ progreso: progresoId });
    return jsonResponse(req, {
      ok: true,
      progresoId,
      completada: true,
      completadaEn: nowISO,
    });
  } catch (err) {
    span.end({ error: true });
    return errorResponse(req, err);
  }
});
