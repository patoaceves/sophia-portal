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

// SOPHIA Portal · get-curso (Postgres)
// Returns full course detail (by slug): modules, lessons, user's enrollment,
// per-lesson completion state.
//
// GET /get-curso?slug=happiness-workshop
// Headers: Authorization: Bearer <supabase_jwt>
//
// Returns 200: { curso, inscripcion, modulos: [{ id, titulo, orden, lecciones: [...] }] }

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  if (req.method !== "GET") {
    return errorResponse(req, new ApiError(405, "method_not_allowed", "Use GET"));
  }

  const span = startSpan("get-curso");

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug")?.trim();
    if (!slug) {
      throw new ApiError(400, "missing_slug", "Falta parámetro slug");
    }

    const persona = await requireUser(req);
    const db = getDb();

    // 1. Curso por slug
    const { data: curso, error: cErr } = await db
      .from("cursos")
      .select(`
        id, slug, titulo, descripcion_corta, descripcion_larga,
        cover_image, instructor, color_primario, modalidad,
        fecha_inicio, fecha_fin, estatus
      `)
      .eq("slug", slug)
      .maybeSingle();
    if (cErr) throw new ApiError(500, "db_error", cErr.message);
    if (!curso) throw new ApiError(404, "curso_not_found", `No existe curso con slug=${slug}`);

    // 2. Inscripción de la persona en este curso
    const { data: inscripcion, error: iErr } = await db
      .from("inscripciones")
      .select("id, estatus, fecha_inscripcion")
      .eq("persona_id", persona.id)
      .eq("curso_id", curso.id)
      .maybeSingle();
    if (iErr) throw new ApiError(500, "db_error", iErr.message);
    if (!inscripcion) {
      throw new ApiError(403, "not_enrolled", "No estás inscrito a este curso");
    }

    // 3. Módulos del curso (ordenados)
    const { data: modulos, error: mErr } = await db
      .from("modulos")
      .select("id, titulo, descripcion, orden, ponente")
      .eq("curso_id", curso.id)
      .order("orden", { ascending: true });
    if (mErr) throw new ApiError(500, "db_error", mErr.message);

    const moduloIds = (modulos ?? []).map((m: any) => m.id);

    // 4. Lecciones de todos los módulos (publicadas)
    const { data: lecciones, error: lErr } = await db
      .from("lecciones")
      .select("id, modulo_id, titulo, orden, tipo, etiqueta, estatus")
      .in("modulo_id", moduloIds)
      .neq("estatus", "archivada")
      .order("orden", { ascending: true });
    if (lErr) throw new ApiError(500, "db_error", lErr.message);

    // 5. Progreso de la inscripción
    const { data: progresos, error: pErr } = await db
      .from("progreso_lecciones")
      .select("leccion_id, completado, completado_en")
      .eq("inscripcion_id", inscripcion.id);
    if (pErr) throw new ApiError(500, "db_error", pErr.message);

    const progresoPorLeccion = new Map<string, { completada: boolean; completadaEn: string | null }>();
    for (const p of progresos || []) {
      progresoPorLeccion.set((p as any).leccion_id, {
        completada: Boolean((p as any).completado),
        completadaEn: (p as any).completado_en ?? null,
      });
    }

    // 6. Construir árbol módulos → lecciones
    const leccionesPorModulo = new Map<string, any[]>();
    for (const l of lecciones || []) {
      const arr = leccionesPorModulo.get((l as any).modulo_id) ?? [];
      const prog = progresoPorLeccion.get((l as any).id);
      arr.push({
        id: (l as any).id,
        titulo: (l as any).titulo ?? "",
        orden: (l as any).orden ?? 0,
        tipo: (l as any).tipo ?? "texto",
        etiqueta: (l as any).etiqueta ?? "",
        completada: prog?.completada ?? false,
        completadaEn: prog?.completadaEn ?? null,
      });
      leccionesPorModulo.set((l as any).modulo_id, arr);
    }

    const modulosOut = (modulos ?? []).map((m: any) => ({
      id: m.id,
      titulo: m.titulo ?? "",
      descripcion: m.descripcion ?? "",
      orden: m.orden ?? 0,
      ponente: m.ponente ?? "",
      lecciones: leccionesPorModulo.get(m.id) ?? [],
    }));

    // Computar progresoPct on-the-fly
    const totalLecc = (lecciones ?? []).length;
    const completadas = (progresos ?? []).filter((p: any) => p.completado).length;
    const progresoPct = totalLecc > 0 ? Math.round((completadas / totalLecc) * 100) : 0;

    span.end({ persona: persona.id, curso: curso.id, lecciones: totalLecc });
    return jsonResponse(req, {
      curso: {
        id: curso.id,
        slug: curso.slug,
        titulo: curso.titulo ?? "",
        descripcionCorta: curso.descripcion_corta ?? "",
        descripcionLarga: curso.descripcion_larga ?? "",
        coverUrl: curso.cover_image ?? null,
        instructor: curso.instructor ?? "",
        colorPrimario: curso.color_primario ?? "",
        modalidad: curso.modalidad ?? "",
        fechaInicio: curso.fecha_inicio ?? null,
        fechaFin: curso.fecha_fin ?? null,
        estatus: curso.estatus ?? "",
      },
      inscripcion: {
        id: inscripcion.id,
        estatus: inscripcion.estatus ?? "",
        fechaInscripcion: inscripcion.fecha_inscripcion ?? null,
        progresoPct,
      },
      modulos: modulosOut,
    });
  } catch (err) {
    span.end({ error: true });
    return errorResponse(req, err);
  }
});
