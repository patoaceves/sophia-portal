// SOPHIA Portal · get-entrega-tarea (Postgres, inlined)
//
// Devuelve la entrega del usuario autenticado para una leccion tipo `tarea`
// (archivos + comentario). Lee de `entregas_tarea` (NO de respuestas_quiz).
// Si no hay entrega, devuelve { tieneResultados: false }.
//
// GET /get-entrega-tarea?leccionId=<UUID>
// Response: { tieneResultados, respuestaId?, archivos?, comentario?, comentariosHistorial?, fechaEntrega? }
//
// Nota: el esquema actual de entregas_tarea guarda un solo `comentario` (la
// ultima nota), no un historial. comentariosHistorial se deriva de ese
// comentario como entrada unica para que tarea.js lo muestre.

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

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== "GET") {
    return errorResponse(req, new ApiError(405, "method_not_allowed", "Use GET"));
  }
  const span = startSpan("get-entrega-tarea");

  try {
    const url = new URL(req.url);
    const leccionId = url.searchParams.get("leccionId")?.trim() || "";
    if (!leccionId || !UUID_RE.test(leccionId)) {
      throw new ApiError(400, "invalid_leccion_id", "leccionId inválido");
    }

    const persona = await requireUser(req);
    const db = getDb();

    // Entrega del usuario para esta lección. Join a inscripciones!inner para
    // garantizar ownership (solo devuelve entregas del usuario autenticado).
    const { data: row, error } = await db
      .from("entregas_tarea")
      .select("id, archivos, comentario, fecha_entrega, inscripciones!inner(persona_id)")
      .eq("leccion_id", leccionId)
      .eq("inscripciones.persona_id", persona.id)
      .order("fecha_entrega", { ascending: false })
      .limit(1).maybeSingle();
    if (error) throw new ApiError(500, "db_error", error.message);

    if (!row) {
      span.end({ persona: persona.id, leccion: leccionId, no_results: true });
      return jsonResponse(req, { tieneResultados: false });
    }

    const archivos = Array.isArray(row.archivos) ? row.archivos : [];
    const comentario = row.comentario ?? "";
    const comentariosHistorial = comentario.trim()
      ? [{ texto: comentario, ts: row.fecha_entrega ?? null }]
      : [];

    span.end({ persona: persona.id, leccion: leccionId, archivos: archivos.length });
    return jsonResponse(req, {
      tieneResultados: true,
      respuestaId: row.id,
      archivos,
      comentario,
      comentariosHistorial,
      fechaEntrega: row.fecha_entrega ?? null,
    });
  } catch (err) {
    span.end({ error: true });
    return errorResponse(req, err);
  }
});
