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

// SOPHIA Portal · get-foro-posts (Postgres)
// Devuelve los posts del foro de un curso, con sus comentarios anidados.
// Solo lo ven los inscritos al curso.
//
// GET /get-foro-posts?cursoId=<UUID>
// Headers: Authorization: Bearer <supabase_jwt>
//
// Returns 200:
// {
//   posts: [
//     { id, contenido, adjuntoUrl, adjuntoTipo, adjuntoNombre, fechaISO,
//       eliminado, esAutor,
//       autor: { id, nombre, apellidos, iniciales, avatarUrl, rol },
//       comentarios: [ same shape ] },
//     ...
//   ],
//   yo: { personaPortalId, nombre, apellidos, iniciales, avatarUrl, esAdmin }
// }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function iniciales(nombre: string, apellidos: string): string {
  const a = (nombre || "").trim()[0] || "";
  const b = (apellidos || "").trim()[0] || "";
  return (a + b).toUpperCase() || "S";
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  if (req.method !== "GET") {
    return errorResponse(req, new ApiError(405, "method_not_allowed", "Use GET"));
  }

  const span = startSpan("get-foro-posts");

  try {
    const url = new URL(req.url);
    const cursoId = url.searchParams.get("cursoId")?.trim();
    if (!cursoId || !UUID_RE.test(cursoId)) {
      throw new ApiError(400, "invalid_curso_id", "cursoId inválido (debe ser UUID)");
    }

    const persona = await requireUser(req);
    const db = getDb();

    // 1. Verificar inscripción al curso
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

    // Paginación: cursor por `fecha` sobre los posts TOP-LEVEL.
    //   ?limit=<n>   (default 50, máx 100)
    //   ?before=<ISO> (trae top-level con fecha < cursor → página más vieja)
    const PAGE_DEFAULT = 50;
    const PAGE_MAX = 100;
    let limit = parseInt(url.searchParams.get("limit") ?? "", 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = PAGE_DEFAULT;
    limit = Math.min(limit, PAGE_MAX);
    const before = url.searchParams.get("before")?.trim() || null;

    const SELECT_POST = `
      id, contenido, fecha, estatus, post_padre_id,
      adjunto_url, adjunto_tipo, adjunto_nombre,
      autor:personas!autor_id (
        id, nombre, apellidos, avatar_url, rol
      )
    `;

    // 2a. Página de posts TOP-LEVEL (post_padre_id IS NULL), fecha desc.
    //     Pedimos limit+1 para saber si hay más páginas (evita un count extra).
    let topQuery = db
      .from("posts")
      .select(SELECT_POST)
      .eq("curso_id", cursoId)
      .is("post_padre_id", null)
      .in("estatus", ["activo", "eliminado"])
      .order("fecha", { ascending: false })
      .limit(limit + 1);
    if (before) topQuery = topQuery.lt("fecha", before);

    const { data: topRaw, error: tErr } = await topQuery;
    if (tErr) throw new ApiError(500, "db_error", tErr.message);

    const topAll = topRaw ?? [];
    const hasMore = topAll.length > limit;
    const topPage = topAll.slice(0, limit);
    const nextCursor = topPage.length > 0
      ? (topPage[topPage.length - 1].fecha ?? null)
      : null;

    // 2b. Comentarios SOLO de los posts top-level de esta página.
    const topIds = topPage.map((p: any) => p.id);
    let comentariosRaw: any[] = [];
    if (topIds.length > 0) {
      const { data: cRaw, error: cErr } = await db
        .from("posts")
        .select(SELECT_POST)
        .eq("curso_id", cursoId)
        .in("post_padre_id", topIds)
        .in("estatus", ["activo", "eliminado"]);
      if (cErr) throw new ApiError(500, "db_error", cErr.message);
      comentariosRaw = cRaw ?? [];
    }

    const posts = [...topPage, ...comentariosRaw];

    // 3. Mapear a la forma del frontend
    type Mapped = {
      id: string;
      contenido: string;
      adjuntoUrl: string;
      adjuntoTipo: string;
      adjuntoNombre: string;
      fechaISO: string;
      eliminado: boolean;
      esAutor: boolean;
      parentId: string | null;
      autor: {
        id: string; nombre: string; apellidos: string;
        iniciales: string; avatarUrl: string; rol: string;
      };
    };

    function mapPost(p: any): Mapped {
      const eliminado = p.estatus === "eliminado";
      const autor = p.autor || {};

      if (eliminado) {
        // Privacy: tombstone sin contenido ni autor
        return {
          id: p.id,
          contenido: "",
          adjuntoUrl: "",
          adjuntoTipo: "",
          adjuntoNombre: "",
          fechaISO: p.fecha ?? "",
          eliminado: true,
          esAutor: false,
          parentId: p.post_padre_id ?? null,
          autor: { id: "", nombre: "", apellidos: "", iniciales: "·", avatarUrl: "", rol: "" },
        };
      }

      return {
        id: p.id,
        contenido: p.contenido ?? "",
        adjuntoUrl: p.adjunto_url ?? "",
        adjuntoTipo: p.adjunto_tipo ?? "",
        adjuntoNombre: p.adjunto_nombre ?? "",
        fechaISO: p.fecha ?? "",
        eliminado: false,
        esAutor: autor.id === persona.id,
        parentId: p.post_padre_id ?? null,
        autor: {
          id: autor.id ?? "",
          nombre: autor.nombre ?? "",
          apellidos: autor.apellidos ?? "",
          iniciales: iniciales(autor.nombre ?? "", autor.apellidos ?? ""),
          avatarUrl: autor.avatar_url ?? "",
          rol: autor.rol ?? "",
        },
      };
    }

    const mapped = posts.map(mapPost);

    // 4. Separar top-level y comentarios; comentarios eliminados se ocultan,
    //    top-level eliminados se conservan solo si tienen comentarios vivos.
    const topLevel = mapped.filter((p) => !p.parentId);
    const comentariosPorPadre = new Map<string, Mapped[]>();
    for (const c of mapped) {
      if (c.parentId && !c.eliminado) {
        const arr = comentariosPorPadre.get(c.parentId) ?? [];
        arr.push(c);
        comentariosPorPadre.set(c.parentId, arr);
      }
    }
    // Comentarios oldest-first (lectura natural de hilo)
    for (const arr of comentariosPorPadre.values()) {
      arr.sort((a, b) => (a.fechaISO ?? "").localeCompare(b.fechaISO ?? ""));
    }

    const out = topLevel
      .map((p) => ({
        ...p,
        parentId: undefined,
        comentarios: (comentariosPorPadre.get(p.id) ?? []).map((c) => ({
          ...c,
          parentId: undefined,
        })),
      }))
      .filter((p) => !p.eliminado || p.comentarios.length > 0);

    span.end({ persona: persona.id, curso: cursoId, posts: out.length, hasMore });
    return jsonResponse(req, {
      posts: out,
      hasMore,
      nextCursor,
      yo: {
        personaPortalId: persona.id,
        nombre: persona.nombre,
        apellidos: persona.apellidos,
        iniciales: iniciales(persona.nombre, persona.apellidos),
        avatarUrl: persona.avatar_url ?? "",
        esAdmin: persona.rol === "admin",
      },
    });
  } catch (err) {
    span.end({ error: true });
    return errorResponse(req, err);
  }
});
