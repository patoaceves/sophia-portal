// SOPHIA Portal · submit-tarea (Postgres, inlined)
//
// Recibe N archivos (multipart/form-data) + comentario opcional para una
// leccion tipo `tarea`. Sube archivos a Supabase Storage y hace merge con
// el registro existente en entregas_tarea (si existe).
//
// POST /submit-tarea (multipart/form-data)
//   file:          File (puede repetirse)
//   leccionId:     <UUID>
//   inscripcionId: <UUID>
//   comentario:    string (opcional, max 4000)
//
// Hardening (v6):
//   - Guard de Content-Length: rechazo temprano (413) antes de parsear el body
//     si la peticion excede MAX_TOTAL_BYTES.
//   - Tope de cantidad de archivos (MAX_FILES) y de tamano total (MAX_TOTAL_BYTES),
//     ademas del limite por archivo (MAX_FILE_BYTES).
//   Nota: req.formData() aun materializa el body; el guard acota el peor caso.
//
// Response 200: { ok: true, respuestaId, archivos: [{id,url,filename,size},...], comentario }
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STORAGE_BUCKET = "sophia-portal-uploads";
const MAX_FILE_BYTES = 20 * 1024 * 1024;    // 20 MB por archivo
const MAX_FILES = 10;                        // tope de cantidad de archivos
const MAX_TOTAL_BYTES = 60 * 1024 * 1024;    // 60 MB total por entrega
const MAX_COMMENT_LEN = 4000;

function sanitizeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 200) || "archivo";
}

interface ArchivoEntry { id: string; url: string; filename: string; size?: number; }

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, error: "Use POST", code: "method_not_allowed" }, 405);
  }

  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return jsonResponse(req, { ok: false, error: "Esperado multipart/form-data", code: "bad_content_type" }, 400);
    }

    // Guard de Content-Length: rechazo temprano antes de materializar el body.
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_TOTAL_BYTES) {
      const maxMB = Math.round(MAX_TOTAL_BYTES / 1024 / 1024);
      return jsonResponse(req, { ok: false, error: `La petición excede ${maxMB} MB`, code: "request_too_large" }, 413);
    }

    const formData = await req.formData();
    const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
    const leccionId = String(formData.get("leccionId") ?? "");
    const inscripcionId = String(formData.get("inscripcionId") ?? "");
    const comentarioRaw = formData.get("comentario");
    const comentario = comentarioRaw == null ? null : String(comentarioRaw).slice(0, MAX_COMMENT_LEN);

    if (!UUID_RE.test(leccionId)) {
      return jsonResponse(req, { ok: false, error: "leccionId inválido", code: "bad_leccion" }, 400);
    }
    if (!UUID_RE.test(inscripcionId)) {
      return jsonResponse(req, { ok: false, error: "inscripcionId inválido", code: "bad_inscripcion" }, 400);
    }
    if (files.length > MAX_FILES) {
      return jsonResponse(req, { ok: false, error: `Máximo ${MAX_FILES} archivos por entrega`, code: "too_many_files" }, 400);
    }
    let totalBytes = 0;
    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) {
        return jsonResponse(req, { ok: false, error: `Archivo '${f.name}' excede 20 MB`, code: "file_too_large" }, 400);
      }
      totalBytes += f.size;
    }
    if (totalBytes > MAX_TOTAL_BYTES) {
      const maxMB = Math.round(MAX_TOTAL_BYTES / 1024 / 1024);
      return jsonResponse(req, { ok: false, error: `El total de archivos excede ${maxMB} MB`, code: "total_too_large" }, 400);
    }

    const persona = await requireUser(req);
    const db = getDb();

    const { data: insc, error: iErr } = await db
      .from("inscripciones").select("id, persona_id")
      .eq("id", inscripcionId).maybeSingle();
    if (iErr) return jsonResponse(req, { ok: false, error: iErr.message, code: "db_error" }, 500);
    if (!insc) return jsonResponse(req, { ok: false, error: "Inscripción no encontrada", code: "no_inscripcion" }, 404);
    if (insc.persona_id !== persona.id) {
      return jsonResponse(req, { ok: false, error: "No autorizado", code: "not_owner" }, 403);
    }

    const { data: lec, error: lErr } = await db
      .from("lecciones").select("id, tipo").eq("id", leccionId).maybeSingle();
    if (lErr) return jsonResponse(req, { ok: false, error: lErr.message, code: "db_error" }, 500);
    if (!lec) return jsonResponse(req, { ok: false, error: "Lección no encontrada", code: "no_leccion" }, 404);

    const newFiles: ArchivoEntry[] = [];
    for (const f of files) {
      const safeName = sanitizeFilename(f.name || "archivo");
      const fileId = crypto.randomUUID();
      const storagePath = `tareas/${leccionId}/${persona.id}/${fileId}-${safeName}`;
      const arrayBuffer = await f.arrayBuffer();
      const { error: uploadErr } = await db.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, arrayBuffer, {
          contentType: f.type || "application/octet-stream",
          cacheControl: "31536000", upsert: false,
        });
      if (uploadErr) {
        console.error("[submit-tarea] storage upload failed:", uploadErr);
        return jsonResponse(req, { ok: false, error: "No se pudo subir uno o más archivos", code: "upload_failed" }, 500);
      }
      const { data: urlData } = db.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
      newFiles.push({ id: fileId, url: urlData.publicUrl, filename: f.name || safeName, size: f.size });
    }

    if (newFiles.length === 0 && (comentario == null || comentario.trim() === "")) {
      return jsonResponse(req, { ok: false, error: "Debes adjuntar al menos un archivo o un comentario", code: "empty_submission" }, 400);
    }

    const { data: existing, error: eErr } = await db
      .from("entregas_tarea")
      .select("id, archivos, comentario")
      .eq("leccion_id", leccionId)
      .eq("inscripcion_id", inscripcionId)
      .maybeSingle();
    if (eErr) return jsonResponse(req, { ok: false, error: eErr.message, code: "db_error" }, 500);

    const finalComentario = comentario != null ? comentario : (existing?.comentario ?? "");
    const prevArchivos: ArchivoEntry[] = Array.isArray(existing?.archivos) ? existing!.archivos : [];
    const finalArchivos = [...prevArchivos, ...newFiles];

    let respuestaId: string;
    if (existing) {
      const { error: uErr } = await db
        .from("entregas_tarea")
        .update({ archivos: finalArchivos, comentario: finalComentario, fecha_entrega: new Date().toISOString() })
        .eq("id", existing.id);
      if (uErr) return jsonResponse(req, { ok: false, error: uErr.message, code: "db_error" }, 500);
      respuestaId = existing.id;
    } else {
      const { data: created, error: cErr } = await db
        .from("entregas_tarea")
        .insert({
          inscripcion_id: inscripcionId,
          leccion_id: leccionId,
          archivos: finalArchivos,
          comentario: finalComentario,
          fecha_entrega: new Date().toISOString(),
        })
        .select("id").single();
      if (cErr) return jsonResponse(req, { ok: false, error: cErr.message, code: "db_error" }, 500);
      respuestaId = created.id;
    }

    const { error: pErr } = await db
      .from("progreso_lecciones")
      .upsert({
        inscripcion_id: inscripcionId,
        leccion_id: leccionId,
        completado: true,
        completado_en: new Date().toISOString(),
      }, { onConflict: "inscripcion_id,leccion_id" });
    if (pErr) console.warn("[submit-tarea] progreso upsert warning:", pErr.message);

    return jsonResponse(req, { ok: true, respuestaId, archivos: finalArchivos, comentario: finalComentario });
  } catch (err) {
    if (err instanceof ApiError) {
      return jsonResponse(req, { ok: false, error: err.message, code: err.code }, err.status);
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[submit-tarea] unhandled:", msg);
    return jsonResponse(req, { ok: false, error: msg, code: "internal_error" }, 500);
  }
});
