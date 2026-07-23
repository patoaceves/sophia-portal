// SOPHIA Portal - get-medicion (Postgres, inlined)
//
// Devuelve si el participante ya contesto un instrumento (por clave y momento),
// para que el front pinte los resultados en vez del formulario.
//
// GET /get-medicion?instrumentoClave=...&inscripcionId=...&momento=inicial
// Response 200: { completado: boolean, resultados?, completadoEn? }

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
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

function errorOk(req: Request, message: string, status = 400, code?: string): Response {
  return jsonResponse(req, { error: message, code }, status);
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

async function requireUser(req: Request): Promise<{ id: string }> {
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

  const db = getDb();
  const { data: persona, error: pErr } = await db
    .from("personas").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (pErr) throw new ApiError(500, "db_error", pErr.message);
  if (!persona) throw new ApiError(403, "no_persona", "No hay persona vinculada a este usuario");
  return persona as { id: string };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== "GET") return errorOk(req, "Use GET", 405, "method_not_allowed");

  try {
    const url = new URL(req.url);
    const instrumentoClave = (url.searchParams.get("instrumentoClave") || "").trim();
    const inscripcionId = (url.searchParams.get("inscripcionId") || "").trim();
    const momento = (url.searchParams.get("momento") || "inicial").trim();

    if (!instrumentoClave) return errorOk(req, "instrumentoClave requerido", 400, "missing_clave");
    if (!UUID_RE.test(inscripcionId)) {
      return errorOk(req, "inscripcionId invalido", 400, "invalid_inscripcion_id");
    }
    if (momento !== "inicial" && momento !== "final") {
      return errorOk(req, "momento invalido", 400, "invalid_momento");
    }

    const persona = await requireUser(req);
    const db = getDb();

    const { data: insc, error: iErr } = await db
      .from("inscripciones").select("id, persona_id")
      .eq("id", inscripcionId).maybeSingle();
    if (iErr) return errorOk(req, iErr.message, 500, "db_error");
    if (!insc) return errorOk(req, "Inscripcion no encontrada", 404, "inscripcion_not_found");
    if (insc.persona_id !== persona.id) {
      return errorOk(req, "Esta inscripcion no es tuya", 403, "not_owner");
    }

    const { data: med, error: mErr } = await db
      .from("mediciones")
      .select("resultados, completado_en")
      .eq("inscripcion_id", inscripcionId)
      .eq("instrumento_clave", instrumentoClave)
      .eq("momento", momento)
      .limit(1).maybeSingle();
    if (mErr) return errorOk(req, mErr.message, 500, "db_error");

    if (!med) return jsonResponse(req, { completado: false });
    return jsonResponse(req, {
      completado: true,
      resultados: med.resultados,
      completadoEn: med.completado_en,
    });
  } catch (err) {
    if (err instanceof ApiError) return errorOk(req, err.message, err.status, err.code);
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[get-medicion] unhandled:", msg);
    return errorOk(req, msg, 500, "internal_error");
  }
});
