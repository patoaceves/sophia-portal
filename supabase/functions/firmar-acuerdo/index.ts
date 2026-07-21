// SOPHIA Portal - firmar-acuerdo (Postgres, inlined)
//
// Registra la firma electronica simple de un acuerdo de participacion en
// `acuerdos_firmados`. El timestamp lo pone el servidor (no el cliente), y se
// guardan ip y user_agent para valor probatorio.
//
// Idempotente por (inscripcion_id + documento_clave): si ya esta firmado,
// devuelve la firma existente SIN sobrescribirla (una firma no se re-escribe).
//
// POST /firmar-acuerdo
// Body: {
//   inscripcionId:   <UUID>,
//   leccionId:       <UUID>,
//   cursoId:         <UUID>            // opcional
//   documentoClave:  "anxiety-acuerdo-v1",
//   nombreFirma:     "Nombre Apellido",
//   casillas:        { he_leido: true, ... }  // todas deben ser true
// }
// Response 200: { ok: true, acuerdoId, firmadoEn, alreadySigned? }
// Response 4xx/5xx: { ok: false, error, code? }

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

function errorOk(req: Request, message: string, status = 400, code?: string): Response {
  return jsonResponse(req, { ok: false, error: message, code }, status);
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
  const { data: persona, error: pErr } = await db
    .from("personas")
    .select("id, auth_user_id, email, nombre, apellidos, rol, avatar_url")
    .eq("auth_user_id", user.id).maybeSingle();
  if (pErr) throw new ApiError(500, "db_error", pErr.message);
  if (!persona) throw new ApiError(403, "no_persona", "No hay persona vinculada a este usuario");
  return persona as Persona;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NOMBRE_LEN = 200;

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0]?.trim();
  return first || req.headers.get("cf-connecting-ip") || null;
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return errorOk(req, "Use POST", 405, "method_not_allowed");
  }

  try {
    const body = await req.json().catch(() => ({})) as {
      inscripcionId?: string;
      leccionId?: string;
      cursoId?: string;
      documentoClave?: string;
      nombreFirma?: string;
      casillas?: Record<string, unknown>;
    };
    const { inscripcionId, leccionId, cursoId, documentoClave, nombreFirma, casillas } = body;

    if (!inscripcionId || !UUID_RE.test(inscripcionId)) {
      return errorOk(req, "inscripcionId invalido", 400, "invalid_inscripcion_id");
    }
    if (!leccionId || !UUID_RE.test(leccionId)) {
      return errorOk(req, "leccionId invalido", 400, "invalid_leccion_id");
    }
    if (cursoId && !UUID_RE.test(cursoId)) {
      return errorOk(req, "cursoId invalido", 400, "invalid_curso_id");
    }
    if (!documentoClave || typeof documentoClave !== "string" || documentoClave.length > 120) {
      return errorOk(req, "documentoClave invalido", 400, "invalid_documento_clave");
    }
    const nombre = (nombreFirma ?? "").trim();
    if (nombre.length < 3 || nombre.length > MAX_NOMBRE_LEN) {
      return errorOk(req, "El nombre de firma es invalido", 400, "invalid_nombre_firma");
    }
    if (!casillas || typeof casillas !== "object" || Array.isArray(casillas)) {
      return errorOk(req, "casillas requerido", 400, "missing_casillas");
    }
    const keys = Object.keys(casillas);
    if (keys.length === 0) {
      return errorOk(req, "No hay casillas de consentimiento", 400, "empty_casillas");
    }
    const todasTrue = keys.every((k) => casillas[k] === true);
    if (!todasTrue) {
      return errorOk(req, "Debes confirmar todas las casillas", 400, "casillas_incompletas");
    }

    const persona = await requireUser(req);
    const db = getDb();

    // Ownership: la inscripcion debe ser del usuario.
    const { data: insc, error: iErr } = await db
      .from("inscripciones").select("id, persona_id, curso_id")
      .eq("id", inscripcionId).maybeSingle();
    if (iErr) return errorOk(req, iErr.message, 500, "db_error");
    if (!insc) return errorOk(req, "Inscripcion no encontrada", 404, "inscripcion_not_found");
    if (insc.persona_id !== persona.id) {
      return errorOk(req, "Esta inscripcion no es tuya", 403, "not_owner");
    }

    // Idempotencia: si ya firmo esta version, devolver la firma existente.
    const { data: existing, error: eErr } = await db
      .from("acuerdos_firmados")
      .select("id, firmado_en")
      .eq("inscripcion_id", inscripcionId)
      .eq("documento_clave", documentoClave)
      .limit(1).maybeSingle();
    if (eErr) return errorOk(req, eErr.message, 500, "db_error");
    if (existing) {
      return jsonResponse(req, {
        ok: true, acuerdoId: existing.id, firmadoEn: existing.firmado_en, alreadySigned: true,
      });
    }

    const fila: Record<string, unknown> = {
      inscripcion_id: inscripcionId,
      leccion_id: leccionId,
      curso_id: cursoId ?? insc.curso_id ?? null,
      documento_clave: documentoClave,
      nombre_firma: nombre,
      casillas: casillas,
      ip: clientIp(req),
      user_agent: (req.headers.get("user-agent") || "").slice(0, 500) || null,
      firmado_en: new Date().toISOString(),
    };

    const { data: created, error: cErr } = await db
      .from("acuerdos_firmados")
      .insert(fila)
      .select("id, firmado_en").single();
    if (cErr) return errorOk(req, cErr.message, 500, "db_error");

    return jsonResponse(req, { ok: true, acuerdoId: created.id, firmadoEn: created.firmado_en });
  } catch (err) {
    if (err instanceof ApiError) {
      return errorOk(req, err.message, err.status, err.code);
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[firmar-acuerdo] unhandled:", msg);
    return errorOk(req, msg, 500, "internal_error");
  }
});
