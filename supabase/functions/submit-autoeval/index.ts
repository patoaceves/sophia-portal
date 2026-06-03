// SOPHIA Portal · submit-autoeval (Postgres, inlined for dashboard deploy)
//
// Edge function GENÉRICA para las 8 autoevaluaciones del modelo SOPHIA.
// Recibe 8 respuestas Likert (1-5), calcula total/pct/banda, guarda en
// respuestas_autoeval con formato v2.
//
// POST /submit-autoeval
// Body: { inscripcionId: <UUID>, autoevalKey: string, respuestas: { ... } }
// Headers: Authorization: Bearer <jwt>
//
// Returns 200: { respuestaId, autoevalKey, total, pct, banda, completedAt }

// ════════════════════════════════════════════════════════════════════
// SHARED HELPERS (inlined)
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

const NIVELES = [
  "adecuadamente", "disfrute", "emociones_pos", "compromiso",
  "logro", "satisfaccion", "sentido", "trascendencia",
] as const;

const AUTOEVAL_KEYS = [
  "autoconocimiento", "bienestar_emocional", "bienestar_fisico",
  "presencia_consciente", "trabajo_proposito", "vinculos_vitales",
  "estetica_existencial", "fe_filosofia",
] as const;

function bandaForTotal(total: number): string {
  if (total >= 31) return "Fortaleza Actual";
  if (total >= 21) return "Zona de Crecimiento";
  if (total >= 11) return "Área de Atención";
  return "Área Vulnerable";
}

function pctFromTotal(total: number): number {
  return Math.max(0, Math.min(100, Math.round(((total - 8) / 32) * 100)));
}

function validateAnswers(respuestas: Record<string, unknown>): { ok: true } | { ok: false; error: string } {
  for (const id of NIVELES) {
    const v = respuestas[id];
    if (typeof v !== "number" || v < 1 || v > 5 || !Number.isInteger(v)) {
      return { ok: false, error: `Respuesta inválida o faltante: ${id}` };
    }
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse(req, new ApiError(405, "method_not_allowed", "Use POST"));
  }

  const span = startSpan("submit-autoeval");

  try {
    const body = await req.json().catch(() => ({})) as {
      inscripcionId?: string; autoevalKey?: string;
      respuestas?: Record<string, number>;
    };
    const { inscripcionId, autoevalKey, respuestas } = body;

    if (!inscripcionId || !UUID_RE.test(inscripcionId)) {
      throw new ApiError(400, "invalid_inscripcion_id", "inscripcionId inválido (debe ser UUID)");
    }
    if (!autoevalKey || !(AUTOEVAL_KEYS as readonly string[]).includes(autoevalKey)) {
      throw new ApiError(400, "invalid_autoeval_key", `autoevalKey inválido: ${autoevalKey}`);
    }
    if (!respuestas || typeof respuestas !== "object") {
      throw new ApiError(400, "missing_respuestas", "respuestas es requerido");
    }
    const valid = validateAnswers(respuestas);
    if (!valid.ok) throw new ApiError(400, "invalid_respuestas", valid.error);

    const persona = await requireUser(req);
    const db = getDb();

    // Validate ownership
    const { data: inscripcion, error: iErr } = await db
      .from("inscripciones")
      .select("id, persona_id")
      .eq("id", inscripcionId)
      .maybeSingle();
    if (iErr) throw new ApiError(500, "db_error", iErr.message);
    if (!inscripcion) throw new ApiError(404, "inscripcion_not_found", "Inscripción no encontrada");
    if (inscripcion.persona_id !== persona.id) {
      throw new ApiError(403, "not_owner", "Esta inscripción no es tuya");
    }

    // Compute scores
    const total = NIVELES.reduce((s, id) => s + (respuestas[id] ?? 0), 0);
    const pct = pctFromTotal(total);
    const banda = bandaForTotal(total);
    const completedAt = new Date().toISOString();

    // Insert. Schema:
    //   respuestas (jsonb) = { answers: {...} }
    //   resultados (jsonb) = { version, autoevalKey, total, pct, banda, completedAt }
    //   completado_en (timestamptz)
    const insertRow = {
      inscripcion_id: inscripcionId,
      respuestas: { answers: respuestas },
      resultados: {
        version: 2, autoevalKey, total, pct, banda, completedAt,
      },
      completado_en: completedAt,
    };

    const { data: created, error: cErr } = await db
      .from("respuestas_autoeval")
      .insert(insertRow)
      .select("id")
      .single();
    if (cErr) throw new ApiError(500, "db_error", cErr.message);

    span.end({ persona: persona.id, autoeval: autoevalKey, total, banda });
    return jsonResponse(req, {
      respuestaId: created.id,
      autoevalKey, total, pct, banda, completedAt,
    });
  } catch (err) {
    span.end({ error: true });
    return errorResponse(req, err);
  }
});
