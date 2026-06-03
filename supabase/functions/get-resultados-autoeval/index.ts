// SOPHIA Portal · get-resultados-autoeval (Postgres, inlined for dashboard deploy)
//
// GET /get-resultados-autoeval?autoeval=<key>[&id=<respuestaId>]
//   - sin `id`  → último intento del usuario para ese pilar
//   - con `id`  → intento específico
// Headers: Authorization: Bearer <jwt>
//
// Returns: { tieneResultados, respuestaId, autoevalKey, total, pct, banda,
//            lead, steps, note, completedAt }
// Soporta payloads v2 (autoevalKey) y v1 legacy (tipo + lead/steps embebidos).

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
    .eq("auth_user_id", user.id)
    .maybeSingle();
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

// ════════════════════════════════════════════════════════════════════
// END SHARED — handler abajo
// ════════════════════════════════════════════════════════════════════

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AUTOEVAL_KEYS = [
  "autoconocimiento", "bienestar_emocional", "bienestar_fisico",
  "presencia_consciente", "trabajo_proposito", "vinculos_vitales",
  "estetica_existencial", "fe_filosofia",
] as const;

// Detect si el payload (resultados jsonb) corresponde al autoevalKey solicitado.
// Soporta v2 (resultados.autoevalKey) y v1 legacy (resultados.tipo).
function matchesAutoeval(resultados: any, autoevalKey: string): boolean {
  if (!resultados) return false;
  if (resultados.autoevalKey === autoevalKey) return true;        // v2
  if (resultados.tipo === autoevalKey) return true;                // v1 legacy
  return false;
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  if (req.method !== "GET") {
    return errorResponse(req, new ApiError(405, "method_not_allowed", "Use GET"));
  }

  const span = startSpan("get-resultados-autoeval");

  try {
    const url = new URL(req.url);
    const autoevalKey = url.searchParams.get("autoeval")?.trim() ?? "";
    const respuestaId = url.searchParams.get("id")?.trim() || null;

    if (!autoevalKey || !(AUTOEVAL_KEYS as readonly string[]).includes(autoevalKey)) {
      throw new ApiError(400, "invalid_autoeval", `autoeval inválido: ${autoevalKey}`);
    }
    if (respuestaId && !UUID_RE.test(respuestaId)) {
      throw new ApiError(400, "invalid_respuesta_id", "id inválido (debe ser UUID)");
    }

    const persona = await requireUser(req);
    const db = getDb();

    // Get inscripciones del usuario
    const { data: inscripciones, error: insErr } = await db
      .from("inscripciones").select("id").eq("persona_id", persona.id);
    if (insErr) throw new ApiError(500, "db_error", insErr.message);
    const inscIds = (inscripciones ?? []).map((i: any) => i.id);
    if (inscIds.length === 0) {
      span.end({ persona: persona.id, no_inscripciones: true });
      return jsonResponse(req, { tieneResultados: false });
    }

    let row: any = null;

    if (respuestaId) {
      // Específico: trae el row, valida ownership + match de autoevalKey
      const { data, error } = await db
        .from("respuestas_autoeval")
        .select("id, inscripcion_id, respuestas, resultados, completado_en")
        .eq("id", respuestaId).maybeSingle();
      if (error) throw new ApiError(500, "db_error", error.message);
      if (!data) throw new ApiError(404, "not_found", "Respuesta no encontrada");
      if (!inscIds.includes(data.inscripcion_id)) {
        throw new ApiError(403, "not_authorized", "No autorizado");
      }
      if (!matchesAutoeval(data.resultados, autoevalKey)) {
        throw new ApiError(404, "wrong_autoeval", "La respuesta no corresponde a esa autoevaluación");
      }
      row = data;
    } else {
      // Último intento del usuario para ese pilar
      const { data, error } = await db
        .from("respuestas_autoeval")
        .select("id, inscripcion_id, respuestas, resultados, completado_en")
        .in("inscripcion_id", inscIds)
        .order("completado_en", { ascending: false });
      if (error) throw new ApiError(500, "db_error", error.message);
      row = (data ?? []).find((r: any) => matchesAutoeval(r.resultados, autoevalKey)) ?? null;
      if (!row) {
        span.end({ persona: persona.id, autoeval: autoevalKey, no_results: true });
        return jsonResponse(req, { tieneResultados: false });
      }
    }

    const p = row.resultados ?? {};
    span.end({ persona: persona.id, autoeval: autoevalKey, respuesta: row.id });
    return jsonResponse(req, {
      tieneResultados: true,
      respuestaId: row.id,
      autoevalKey,
      total: p.total ?? null,
      pct: p.pct ?? null,
      banda: p.banda ?? null,
      // Campos legacy v1: se devuelven si existen en el payload
      lead: p.lead ?? null,
      steps: p.steps ?? null,
      note: p.note ?? null,
      completedAt: p.completedAt ?? row.completado_en ?? null,
    });
  } catch (err) {
    span.end({ error: true });
    return errorResponse(req, err);
  }
});
