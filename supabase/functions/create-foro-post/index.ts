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

// SOPHIA Portal · create-foro-post (Postgres)
// Crea un post (o comentario) en el foro de un curso.
//
// POST /create-foro-post
// Headers: Authorization: Bearer <supabase_jwt>
// Body: {
//   cursoId: <UUID>,
//   contenido: "texto plano, max 4000 chars",
//   adjuntoUrl?: "https://..." (de upload-asset),
//   adjuntoTipo?: "imagen"|"video"|"archivo",
//   adjuntoNombre?: string,
//   parentPostId?: <UUID>   // si presente, este post es un comentario
// }
//
// Returns 200: { ok: true, post: { id, contenido, fechaISO, autor, ... } }
// Errors: 400 validación · 401 auth · 403 not_enrolled · 404 parent_not_found · 500

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CONTENIDO_LEN = 4000;
const MAX_URL_LEN = 1000;
const MAX_FILENAME_LEN = 255;
const ATTACHMENT_TYPES = ["imagen", "video", "archivo"] as const;
type AttachmentType = typeof ATTACHMENT_TYPES[number];

function iniciales(nombre: string, apellidos: string): string {
  const a = (nombre || "").trim()[0] || "";
  const b = (apellidos || "").trim()[0] || "";
  return (a + b).toUpperCase() || "S";
}

/**
 * Acepta solo URLs del bucket de Storage de SOPHIA — evita que un atacante
 * use URLs externas como "adjunto" (vector de phishing).
 */
function isValidStorageUrl(s: string): boolean {
  if (!s || s.length > MAX_URL_LEN) return false;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:") return false;
    return /\.supabase\.co$/.test(u.hostname) &&
           u.pathname.startsWith("/storage/v1/object/public/sophia-portal-uploads/");
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse(req, new ApiError(405, "method_not_allowed", "Use POST"));
  }

  const span = startSpan("create-foro-post");

  try {
    const body = await req.json().catch(() => ({})) as {
      cursoId?: string;
      contenido?: string;
      adjuntoUrl?: string;
      adjuntoTipo?: string;
      adjuntoNombre?: string;
      parentPostId?: string;
    };

    const cursoId = body.cursoId;
    const contenido = (body.contenido ?? "").trim();
    const adjuntoUrl = (body.adjuntoUrl ?? "").trim();
    const adjuntoTipo = (body.adjuntoTipo ?? "").trim();
    const adjuntoNombre = (body.adjuntoNombre ?? "").trim().slice(0, MAX_FILENAME_LEN);
    const parentPostId = body.parentPostId?.trim();

    // ── Validación ──────────────────────────────────────────
    if (!cursoId || !UUID_RE.test(cursoId)) {
      throw new ApiError(400, "invalid_curso_id", "cursoId inválido");
    }
    if (!contenido && !adjuntoUrl) {
      throw new ApiError(400, "empty_post", "El post debe tener contenido o un adjunto");
    }
    if (contenido.length > MAX_CONTENIDO_LEN) {
      throw new ApiError(400, "too_long", `Contenido demasiado largo (max ${MAX_CONTENIDO_LEN} caracteres)`);
    }
    if (adjuntoUrl) {
      if (!isValidStorageUrl(adjuntoUrl)) {
        throw new ApiError(400, "invalid_adjunto_url", "URL del adjunto inválida (debe venir de upload-asset)");
      }
      if (!ATTACHMENT_TYPES.includes(adjuntoTipo as AttachmentType)) {
        throw new ApiError(400, "invalid_adjunto_tipo", "adjuntoTipo debe ser imagen, video o archivo");
      }
    }
    if (parentPostId && !UUID_RE.test(parentPostId)) {
      throw new ApiError(400, "invalid_parent_id", "parentPostId inválido");
    }

    const persona = await requireUser(req);
    const db = getDb();

    // ── Verificar inscripción ───────────────────────────────
    const { data: inscripcion, error: insErr } = await db
      .from("inscripciones")
      .select("id")
      .eq("persona_id", persona.id)
      .eq("curso_id", cursoId)
      .maybeSingle();
    if (insErr) throw new ApiError(500, "db_error", insErr.message);
    if (!inscripcion) {
      throw new ApiError(403, "not_enrolled", "No estás inscrito a este curso");
    }

    // ── Validar parent (si es comentario) ───────────────────
    if (parentPostId) {
      const { data: parent, error: parErr } = await db
        .from("posts")
        .select("id, curso_id, post_padre_id, estatus")
        .eq("id", parentPostId)
        .maybeSingle();
      if (parErr) throw new ApiError(500, "db_error", parErr.message);
      if (!parent) {
        throw new ApiError(404, "parent_not_found", "Post padre no encontrado");
      }
      if (parent.curso_id !== cursoId) {
        throw new ApiError(400, "parent_curso_mismatch", "Post padre no pertenece a este curso");
      }
      // Bloquear comentarios sobre posts eliminados: si el post se borró, su hilo se congela
      if (parent.estatus === "eliminado") {
        throw new ApiError(400, "parent_deleted", "No se puede comentar sobre un post eliminado");
      }
      // Max 1 nivel de anidación
      if (parent.post_padre_id) {
        throw new ApiError(400, "nesting_too_deep", "No se permiten respuestas anidadas (max 1 nivel)");
      }
    }

    // ── INSERT ──────────────────────────────────────────────
    const nowISO = new Date().toISOString();
    const insertRow: Record<string, unknown> = {
      curso_id: cursoId,
      autor_id: persona.id,
      contenido,
      estatus: "activo",
      fecha: nowISO,
      post_padre_id: parentPostId || null,
    };
    if (adjuntoUrl) {
      insertRow.adjunto_url = adjuntoUrl;
      insertRow.adjunto_tipo = adjuntoTipo;
      insertRow.adjunto_nombre = adjuntoNombre;
    }

    const { data: created, error: cErr } = await db
      .from("posts")
      .insert(insertRow)
      .select("id, fecha")
      .single();
    if (cErr) throw new ApiError(500, "db_error", cErr.message);

    span.end({ persona: persona.id, post: created.id, esComentario: !!parentPostId });
    return jsonResponse(req, {
      ok: true,
      post: {
        id: created.id,
        contenido,
        adjuntoUrl: adjuntoUrl || "",
        adjuntoTipo: adjuntoUrl ? adjuntoTipo : "",
        adjuntoNombre: adjuntoUrl ? adjuntoNombre : "",
        fechaISO: created.fecha ?? nowISO,
        parentId: parentPostId || null,
        esAutor: true,
        eliminado: false,
        autor: {
          id: persona.id,
          nombre: persona.nombre,
          apellidos: persona.apellidos,
          iniciales: iniciales(persona.nombre, persona.apellidos),
          avatarUrl: persona.avatar_url ?? "",
          rol: persona.rol,
        },
      },
    });
  } catch (err) {
    span.end({ error: true });
    return errorResponse(req, err);
  }
});
