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

// SOPHIA Portal · get-mis-cursos (Postgres)
// Returns the list of courses the authenticated user is enrolled in,
// with computed progress %.
//
// GET /get-mis-cursos
// Headers: Authorization: Bearer <supabase_jwt>
//
// Returns 200: { cursos: [{ id, inscripcionId, slug, titulo, ..., progresoPct, ... }] }

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  if (req.method !== "GET") {
    return errorResponse(req, new ApiError(405, "method_not_allowed", "Use GET"));
  }

  const span = startSpan("get-mis-cursos");

  try {
    const persona = await requireUser(req);
    const db = getDb();

    // Inscripciones activas con curso joineado
    const { data: inscripciones, error: insErr } = await db
      .from("inscripciones")
      .select(`
        id, estatus, fecha_inscripcion,
        curso:cursos!inner (
          id, slug, titulo, descripcion_corta,
          cover_image, instructor, color_primario, modalidad,
          fecha_inicio, fecha_fin, estatus
        )
      `)
      .eq("persona_id", persona.id)
      .in("estatus", ["activa", "finalizada"])
      .order("fecha_inscripcion", { ascending: false });

    if (insErr) throw new ApiError(500, "db_error", insErr.message);
    if (!inscripciones?.length) {
      span.end({ persona: persona.id, cursos: 0 });
      return jsonResponse(req, { cursos: [] });
    }

    const cursoIds = inscripciones.map((i: any) => i.curso.id);
    const inscripcionIds = inscripciones.map((i: any) => i.id);

    // Total lecciones por curso (via módulos)
    const { data: totales, error: tErr } = await db
      .from("lecciones")
      .select("modulo_id, modulos!inner(curso_id)")
      .in("modulos.curso_id", cursoIds);
    if (tErr) throw new ApiError(500, "db_error", tErr.message);

    const totalesPorCurso = new Map<string, number>();
    for (const l of totales || []) {
      const cid = (l as any).modulos.curso_id;
      totalesPorCurso.set(cid, (totalesPorCurso.get(cid) ?? 0) + 1);
    }

    // Completadas por inscripción
    const { data: progresos, error: pErr } = await db
      .from("progreso_lecciones")
      .select("inscripcion_id")
      .in("inscripcion_id", inscripcionIds)
      .eq("completado", true);
    if (pErr) throw new ApiError(500, "db_error", pErr.message);

    const completadasPorInscripcion = new Map<string, number>();
    for (const p of progresos || []) {
      const k = (p as any).inscripcion_id;
      completadasPorInscripcion.set(k, (completadasPorInscripcion.get(k) ?? 0) + 1);
    }

    const cursos = inscripciones.map((i: any) => {
      const c = i.curso;
      const totalLecciones = totalesPorCurso.get(c.id) ?? 0;
      const completadas = completadasPorInscripcion.get(i.id) ?? 0;
      const progresoPct = totalLecciones > 0
        ? Math.round((completadas / totalLecciones) * 100)
        : 0;

      return {
        id: c.id,
        inscripcionId: i.id,
        slug: c.slug ?? "",
        titulo: c.titulo ?? "",
        descripcionCorta: c.descripcion_corta ?? "",
        coverUrl: c.cover_image ?? null,
        instructor: c.instructor ?? "",
        colorPrimario: c.color_primario ?? "",
        modalidad: c.modalidad ?? "",
        fechaInicio: c.fecha_inicio ?? null,
        fechaFin: c.fecha_fin ?? null,
        estatus: c.estatus ?? "",
        inscripcionEstatus: i.estatus ?? "",
        fechaInscripcion: i.fecha_inscripcion ?? null,
        progresoPct,
        totalLecciones,
        leccionesCompletadas: completadas,
      };
    });

    span.end({ persona: persona.id, cursos: cursos.length });
    return jsonResponse(req, { cursos });
  } catch (err) {
    span.end({ error: true });
    return errorResponse(req, err);
  }
});
