// SOPHIA Portal - submit-medicion (Postgres, inlined)
//
// Guarda las respuestas de los instrumentos de medicion (GAD-7 y WHO-5) y
// CALCULA el puntaje en el servidor. El cliente nunca manda puntajes: solo
// las respuestas crudas, y aqui se recalcula todo.
//
// Idempotente por (inscripcion_id + instrumento_clave + momento): si ya
// existe, devuelve la medicion previa sin sobrescribirla.
//
// POST /submit-medicion
// Body: {
//   inscripcionId, leccionId, cursoId?, instrumentoClave,
//   momento?: "inicial" | "final",
//   respuestas: { gad7: [0..3 x7], who5: [0..5 x5], funcionalidad?: string }
// }
// Response 200: { ok: true, medicionId, resultados, alreadyDone? }

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
const FUNCIONALIDAD = ["Ninguna", "Poca", "Mucha", "Extrema"];

// ── Puntuacion (servidor) ───────────────────────────────────────────────────
// GAD-7: 7 reactivos, 0 a 3 cada uno, total 0 a 21.
function gadBanda(total: number): string {
  if (total <= 4) return "Mínima";
  if (total <= 9) return "Leve";
  if (total <= 14) return "Moderada";
  return "Severa";
}

// WHO-5: 5 reactivos, 0 a 5 cada uno. Crudo 0 a 25, indice = crudo x 4.
function whoBanda(indice: number): string {
  if (indice >= 50) return "Bienestar adecuado";
  if (indice >= 29) return "Bienestar bajo";
  return "Bienestar muy bajo";
}

function validarEscala(arr: unknown, n: number, max: number): number[] | null {
  if (!Array.isArray(arr) || arr.length !== n) return null;
  const out: number[] = [];
  for (const v of arr) {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > max) return null;
    out.push(v);
  }
  return out;
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== "POST") return errorOk(req, "Use POST", 405, "method_not_allowed");

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const inscripcionId = String(body.inscripcionId ?? "");
    const leccionId = String(body.leccionId ?? "");
    const cursoId = body.cursoId ? String(body.cursoId) : null;
    const instrumentoClave = String(body.instrumentoClave ?? "").trim();
    const momento = String(body.momento ?? "inicial");
    const respuestas = (body.respuestas ?? {}) as Record<string, unknown>;

    if (!UUID_RE.test(inscripcionId)) {
      return errorOk(req, "inscripcionId invalido", 400, "invalid_inscripcion_id");
    }
    if (!UUID_RE.test(leccionId)) {
      return errorOk(req, "leccionId invalido", 400, "invalid_leccion_id");
    }
    if (cursoId && !UUID_RE.test(cursoId)) {
      return errorOk(req, "cursoId invalido", 400, "invalid_curso_id");
    }
    if (!instrumentoClave || instrumentoClave.length > 120) {
      return errorOk(req, "instrumentoClave invalido", 400, "invalid_instrumento");
    }
    if (momento !== "inicial" && momento !== "final") {
      return errorOk(req, "momento invalido", 400, "invalid_momento");
    }

    const gad = validarEscala(respuestas.gad7, 7, 3);
    if (!gad) return errorOk(req, "Respuestas de GAD-7 incompletas o invalidas", 400, "invalid_gad7");
    const who = validarEscala(respuestas.who5, 5, 5);
    if (!who) return errorOk(req, "Respuestas de WHO-5 incompletas o invalidas", 400, "invalid_who5");

    let funcionalidad: string | null = null;
    if (respuestas.funcionalidad != null && respuestas.funcionalidad !== "") {
      const f = String(respuestas.funcionalidad);
      if (!FUNCIONALIDAD.includes(f)) {
        return errorOk(req, "Respuesta de funcionalidad invalida", 400, "invalid_funcionalidad");
      }
      funcionalidad = f;
    }

    const persona = await requireUser(req);
    const db = getDb();

    const { data: insc, error: iErr } = await db
      .from("inscripciones").select("id, persona_id, curso_id")
      .eq("id", inscripcionId).maybeSingle();
    if (iErr) return errorOk(req, iErr.message, 500, "db_error");
    if (!insc) return errorOk(req, "Inscripcion no encontrada", 404, "inscripcion_not_found");
    if (insc.persona_id !== persona.id) {
      return errorOk(req, "Esta inscripcion no es tuya", 403, "not_owner");
    }

    const { data: existing, error: eErr } = await db
      .from("mediciones")
      .select("id, resultados, completado_en")
      .eq("inscripcion_id", inscripcionId)
      .eq("instrumento_clave", instrumentoClave)
      .eq("momento", momento)
      .limit(1).maybeSingle();
    if (eErr) return errorOk(req, eErr.message, 500, "db_error");
    if (existing) {
      return jsonResponse(req, {
        ok: true, medicionId: existing.id, resultados: existing.resultados,
        completadoEn: existing.completado_en, alreadyDone: true,
      });
    }

    // Puntuacion en servidor.
    const gadTotal = gad.reduce((a, b) => a + b, 0);
    const whoCrudo = who.reduce((a, b) => a + b, 0);
    const whoIndice = whoCrudo * 4;
    const resultados = {
      gad7: { total: gadTotal, max: 21, banda: gadBanda(gadTotal) },
      who5: { crudo: whoCrudo, indice: whoIndice, max: 100, banda: whoBanda(whoIndice) },
      funcionalidad,
      // Marca para el equipo del programa: puntajes que ameritan seguimiento.
      seguimiento: gadTotal >= 15 || whoIndice <= 28,
    };

    const { data: created, error: cErr } = await db
      .from("mediciones")
      .insert({
        inscripcion_id: inscripcionId,
        leccion_id: leccionId,
        curso_id: cursoId ?? insc.curso_id ?? null,
        instrumento_clave: instrumentoClave,
        momento,
        respuestas: { gad7: gad, who5: who, funcionalidad },
        resultados,
        completado_en: new Date().toISOString(),
      })
      .select("id, completado_en").single();
    if (cErr) return errorOk(req, cErr.message, 500, "db_error");

    return jsonResponse(req, {
      ok: true, medicionId: created.id, resultados, completadoEn: created.completado_en,
    });
  } catch (err) {
    if (err instanceof ApiError) return errorOk(req, err.message, err.status, err.code);
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[submit-medicion] unhandled:", msg);
    return errorOk(req, msg, 500, "internal_error");
  }
});
