// SOPHIA Portal · get-resultados-ryff (Postgres, clean)
//
// GET /get-resultados-ryff?id=<UUID>   (intento especifico)
// GET /get-resultados-ryff             (ultimo intento del usuario)
// Returns: { tieneResultados, respuestaId, completedAt, dimensiones, global,
//            dimNombres, respuestas }
//
// Lectura a nivel persona (respuestas_ryff no vincula inscripcion). Mismo
// modelo que get-resultados-test. No cachea (private, no-store) para que un
// resultado recien guardado aparezca de inmediato al volver al curso.

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

function jsonResponse(req: Request, body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders(req), "Content-Type": "application/json", ...extraHeaders },
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
  if (authErr || !user) throw new ApiError(401, "invalid_token", "Token invalido o expirado");

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
  const span = startSpan("get-resultados-ryff");

  try {
    const persona = await requireUser(req);
    const db = getDb();

    const url = new URL(req.url);
    const respuestaId = url.searchParams.get("id")?.trim() || null;
    if (respuestaId && !UUID_RE.test(respuestaId)) {
      throw new ApiError(400, "invalid_id", "id invalido");
    }

    let row: { id: string; persona_id: string; respuestas: any; resultados: any; completado_en: string } | null = null;

    if (respuestaId) {
      const { data, error } = await db
        .from("respuestas_ryff")
        .select("id, persona_id, respuestas, resultados, completado_en")
        .eq("id", respuestaId).maybeSingle();
      if (error) throw new ApiError(500, "db_error", error.message);
      if (!data) return jsonResponse(req, { tieneResultados: false });
      if (data.persona_id !== persona.id) {
        throw new ApiError(403, "not_owner", "Este resultado no es tuyo");
      }
      row = data;
    } else {
      const { data, error } = await db
        .from("respuestas_ryff")
        .select("id, persona_id, respuestas, resultados, completado_en")
        .eq("persona_id", persona.id)
        .order("completado_en", { ascending: false })
        .limit(1).maybeSingle();
      if (error) throw new ApiError(500, "db_error", error.message);
      if (!data) {
        span.end({ persona: persona.id, empty: true });
        return jsonResponse(req, { tieneResultados: false }, 200, {
          "Cache-Control": "private, no-store",
        });
      }
      row = data;
    }

    const r = row.resultados ?? {};
    const ans = row.respuestas?.answers ?? row.respuestas ?? null;

    span.end({ persona: persona.id, respuesta: row.id });
    return jsonResponse(req, {
      tieneResultados: true,
      respuestaId: row.id,
      completedAt: r.completedAt ?? row.completado_en ?? null,
      dimensiones: r.dimensiones ?? null,
      global: r.global ?? null,
      dimNombres: r.dimNombres ?? null,
      respuestas: ans,
    }, 200, { "Cache-Control": "private, no-store" });
  } catch (err) {
    span.end({ error: true });
    return errorResponse(req, err);
  }
});
