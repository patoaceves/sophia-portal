// SOPHIA Portal · submit-ryff (Postgres, clean)
//
// Recibe las 18 respuestas Likert (1-6) de la Escala RYFF de Bienestar
// Psicologico (version corta de 18 reactivos, 3 por dimension), invierte los
// reactivos negativos, suma por dimension (rango 3-18), calcula % y banda por
// dimension + un indice global. Guarda en respuestas_ryff (nivel persona).
//
// POST /submit-ryff
// Body: { respuestas: { AA1..CP3: 1..6 } }
// Returns: { respuestaId, dimensiones, global, completedAt }
//
// El backend NO guarda texto (leads, pasos): solo numeros + etiquetas de
// banda. Todo el contenido vive en el frontend (ryff-defs.js).

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
// Modelo RYFF · 6 dimensiones x 3 reactivos. Escala 1-6.
// Los reactivos marcados `reverse: true` se invierten (7 - v) antes de sumar.
// El orden de DIMS define el orden de ejes en el radar del frontend.
// ════════════════════════════════════════════════════════════════════

const DIMS = [
  "autoaceptacion",
  "relaciones_positivas",
  "autonomia",
  "dominio_entorno",
  "proposito_vida",
  "crecimiento_personal",
] as const;
type Dim = typeof DIMS[number];

const NOMBRE: Record<Dim, string> = {
  autoaceptacion: "Autoaceptacion",
  relaciones_positivas: "Relaciones positivas",
  autonomia: "Autonomia",
  dominio_entorno: "Dominio del entorno",
  proposito_vida: "Proposito en la vida",
  crecimiento_personal: "Crecimiento personal",
};

// Reactivos por dimension: { id, reverse }. El texto vive en el frontend.
const ITEMS: Record<Dim, { id: string; reverse: boolean }[]> = {
  autoaceptacion: [
    { id: "AA1", reverse: false },
    { id: "AA2", reverse: true },
    { id: "AA3", reverse: false },
  ],
  relaciones_positivas: [
    { id: "RP1", reverse: false },
    { id: "RP2", reverse: true },
    { id: "RP3", reverse: true },
  ],
  autonomia: [
    { id: "AU1", reverse: false },
    { id: "AU2", reverse: true },
    { id: "AU3", reverse: false },
  ],
  dominio_entorno: [
    { id: "DE1", reverse: false },
    { id: "DE2", reverse: true },
    { id: "DE3", reverse: false },
  ],
  proposito_vida: [
    { id: "PV1", reverse: false },
    { id: "PV2", reverse: true },
    { id: "PV3", reverse: true },
  ],
  crecimiento_personal: [
    { id: "CP1", reverse: false },
    { id: "CP2", reverse: true },
    { id: "CP3", reverse: false },
  ],
};

const SCALE_MIN = 1, SCALE_MAX = 6;
const ITEMS_PER_DIM = 3;
const DIM_MIN = SCALE_MIN * ITEMS_PER_DIM; // 3
const DIM_MAX = SCALE_MAX * ITEMS_PER_DIM; // 18
const TOTAL_ITEMS = DIMS.length * ITEMS_PER_DIM; // 18
const GLOBAL_MIN = SCALE_MIN * TOTAL_ITEMS; // 18
const GLOBAL_MAX = SCALE_MAX * TOTAL_ITEMS; // 108

// Bandas universales (mismas que autoeval). Por % 0-100, mayor a menor.
const BANDAS = [
  { label: "Fortaleza Actual",    minPct: 70 },
  { label: "Zona de Crecimiento", minPct: 45 },
  { label: "Area de Atencion",    minPct: 22 },
  { label: "Area Vulnerable",     minPct: 0  },
];

function bandaForPct(pct: number): string {
  for (const b of BANDAS) {
    if (pct >= b.minPct) return b.label;
  }
  return BANDAS[BANDAS.length - 1].label;
}

function pctFrom(sum: number, min: number, max: number): number {
  return Math.max(0, Math.min(100, Math.round(((sum - min) / (max - min)) * 100)));
}

function validateAnswers(
  respuestas: Record<string, unknown>,
): { ok: true } | { ok: false; error: string } {
  for (const dim of DIMS) {
    for (const item of ITEMS[dim]) {
      const v = respuestas[item.id];
      if (typeof v !== "number" || v < SCALE_MIN || v > SCALE_MAX || !Number.isInteger(v)) {
        return { ok: false, error: `Respuesta invalida o faltante: ${item.id}` };
      }
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
  const span = startSpan("submit-ryff");

  try {
    const body = await req.json().catch(() => ({})) as {
      respuestas?: Record<string, number>;
    };
    const { respuestas } = body;
    if (!respuestas) throw new ApiError(400, "missing_respuestas", "respuestas requerido");
    const valid = validateAnswers(respuestas);
    if (!valid.ok) throw new ApiError(400, "invalid_respuestas", valid.error);

    const persona = await requireUser(req);
    const db = getDb();

    // Calcula scores por dimension (con reactivos invertidos) + indice global.
    const dimensiones: Record<string, { sum: number; pct: number; banda: string }> = {};
    let globalSum = 0;
    for (const dim of DIMS) {
      let sum = 0;
      for (const item of ITEMS[dim]) {
        const raw = respuestas[item.id] as number;
        const scored = item.reverse ? (SCALE_MAX + SCALE_MIN - raw) : raw; // 7 - raw si inverso
        sum += scored;
      }
      const pct = pctFrom(sum, DIM_MIN, DIM_MAX);
      dimensiones[dim] = { sum, pct, banda: bandaForPct(pct) };
      globalSum += sum;
    }
    const globalPct = pctFrom(globalSum, GLOBAL_MIN, GLOBAL_MAX);
    const global = { sum: globalSum, pct: globalPct, banda: bandaForPct(globalPct) };

    const completedAt = new Date().toISOString();
    const { data: created, error: cErr } = await db
      .from("respuestas_ryff")
      .insert({
        persona_id: persona.id,
        respuestas: { answers: respuestas },
        resultados: {
          version: 1, scale: { min: SCALE_MIN, max: SCALE_MAX },
          dimensiones, global, dimNombres: NOMBRE, completedAt,
        },
        completado_en: completedAt,
      })
      .select("id").single();
    if (cErr) throw new ApiError(500, "db_error", cErr.message);

    span.end({ persona: persona.id, respuesta: created.id });
    return jsonResponse(req, {
      respuestaId: created.id, dimensiones, global, completedAt,
    });
  } catch (err) {
    span.end({ error: true });
    return errorResponse(req, err);
  }
});
