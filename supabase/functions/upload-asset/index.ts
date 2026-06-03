// SOPHIA Portal · upload-asset
//
// Recibe un archivo (multipart/form-data), valida tamaño + MIME según
// `kind`, y lo sube a Supabase Storage usando la service role key.
// Devuelve la URL pública lista para guardar en la base de datos (Postgres).
//
// Kinds soportados:
//   - "avatar"            · foto de perfil (imagen, max 5 MB)
//   - "foro-attachment"   · adjunto en post del foro (imagen 5MB, video 50MB, archivo 20MB)
//
// Endpoint:   POST /upload-asset
// Headers:    Authorization: Bearer <jwt>
// Body:       multipart/form-data
//   file:     File (binary)
//   kind:     "avatar" | "foro-attachment"
//   cursoId:  string  · requerido si kind=foro-attachment
//
// Response 200:
//   { ok: true, asset: { url, path, kind, attachmentType, mimeType, size, originalName } }
// Response 4xx/5xx:
//   { ok: false, error, code? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ============================================================================
// CONFIG
// ============================================================================

const STORAGE_BUCKET = "sophia-portal-uploads";

// UUID v4 (Postgres). Los cursoId ahora son UUID, ya no rec... de Airtable.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Guard de Content-Length: rechazo temprano (413) antes de materializar el body.
// El máximo real por tipo se valida después con file.size; este tope cubre el
// caso más grande (video 50 MB) más el overhead del multipart.
const MAX_REQUEST_BYTES = 55 * 1024 * 1024;   // 55 MB

// Límites por tipo
const LIMITS = {
  avatar: {
    maxBytes: 5 * 1024 * 1024,           // 5 MB
    allowedMimes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  },
  foroImage: {
    maxBytes: 5 * 1024 * 1024,           // 5 MB
    allowedMimes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  },
  foroVideo: {
    maxBytes: 50 * 1024 * 1024,          // 50 MB
    allowedMimes: ["video/mp4", "video/webm", "video/quicktime"],
  },
  foroFile: {
    maxBytes: 20 * 1024 * 1024,          // 20 MB
    allowedMimes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
      "application/zip",
      "application/x-zip-compressed",
    ],
  },
} as const;

// ============================================================================
// CORS
// ============================================================================

const ALLOWED_ORIGINS = [
  "https://portal.sophiamx.org",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5500",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : "https://portal.sophiamx.org";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
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

function errorResponse(req: Request, message: string, status = 400, code?: string): Response {
  return jsonResponse(req, { ok: false, error: message, code }, status);
}

// ============================================================================
// HELPERS
// ============================================================================

/** Determina si un MIME es de tipo imagen / video / archivo. */
function classifyMime(mime: string): "imagen" | "video" | "archivo" | null {
  if (LIMITS.foroImage.allowedMimes.includes(mime as never)) return "imagen";
  if (LIMITS.foroVideo.allowedMimes.includes(mime as never)) return "video";
  if (LIMITS.foroFile.allowedMimes.includes(mime as never)) return "archivo";
  return null;
}

/** Sanitiza un filename: solo letras/números/guiones/punto, max 80 chars. */
function sanitizeFilename(name: string): string {
  const lower = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return lower
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80) || "file";
}

/** Devuelve la extensión del filename, o vacío. */
function extname(name: string): string {
  const m = name.match(/\.([a-z0-9]{1,8})$/i);
  return m ? `.${m[1].toLowerCase()}` : "";
}

// ============================================================================
// MAIN
// ============================================================================

Deno.serve(async (req) => {
  const optionsRes = handleOptions(req);
  if (optionsRes) return optionsRes;

  if (req.method !== "POST") {
    return errorResponse(req, "Method not allowed", 405);
  }

  // Guard de Content-Length: rechazo temprano antes de materializar el body.
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    const maxMB = Math.round(MAX_REQUEST_BYTES / 1024 / 1024);
    return errorResponse(req, `La petición excede ${maxMB} MB`, 413, "request_too_large");
  }

  try {
    // ── Auth ─────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(req, "Missing Authorization header", 401, "no_auth");
    }
    const jwt = authHeader.slice("Bearer ".length);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!serviceKey) {
      return errorResponse(req, "Server misconfigured: SERVICE_ROLE_KEY missing", 500);
    }

    // Verificar JWT con anon key (validación de identidad solamente)
    const supabaseAuth = createClient(supabaseUrl, anonKey);
    const { data: userData, error: authErr } = await supabaseAuth.auth.getUser(jwt);
    if (authErr || !userData.user) {
      return errorResponse(req, "Invalid JWT", 401, "invalid_jwt");
    }
    const authUserId = userData.user.id;

    // ── Parse multipart ──────────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return errorResponse(req, "Cuerpo inválido. Esperaba multipart/form-data.", 400, "bad_body");
    }

    const file = formData.get("file");
    const kind = String(formData.get("kind") ?? "");
    const cursoId = String(formData.get("cursoId") ?? "");

    if (!(file instanceof File)) {
      return errorResponse(req, "Falta el archivo (campo 'file').", 400, "no_file");
    }
    if (!kind) {
      return errorResponse(req, "Falta el campo 'kind'.", 400, "no_kind");
    }

    // ── Validación según kind ────────────────────────────────────────
    let storagePath: string;
    let attachmentType: "imagen" | "video" | "archivo" = "imagen";

    if (kind === "avatar") {
      if (!LIMITS.avatar.allowedMimes.includes(file.type as never)) {
        return errorResponse(
          req,
          `Tipo de archivo no permitido para foto de perfil. Usa JPG, PNG, WebP o GIF.`,
          400,
          "bad_mime",
        );
      }
      if (file.size > LIMITS.avatar.maxBytes) {
        return errorResponse(
          req,
          `La foto pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. El máximo es 5 MB.`,
          400,
          "too_large",
        );
      }
      attachmentType = "imagen";
      const ext = extname(file.name) || ".jpg";
      storagePath = `avatars/${crypto.randomUUID()}${ext}`;
    } else if (kind === "foro-attachment") {
      if (!cursoId || !UUID_RE.test(cursoId)) {
        return errorResponse(req, "Falta cursoId válido para adjuntos del foro.", 400, "no_curso");
      }
      const classified = classifyMime(file.type);
      if (!classified) {
        return errorResponse(
          req,
          `Tipo de archivo no permitido. Imágenes (JPG/PNG/WebP/GIF), videos (MP4/WebM) o archivos (PDF/Word/Excel/PowerPoint/TXT/ZIP).`,
          400,
          "bad_mime",
        );
      }
      attachmentType = classified;

      const limits =
        classified === "imagen" ? LIMITS.foroImage :
        classified === "video" ? LIMITS.foroVideo :
        LIMITS.foroFile;

      if (file.size > limits.maxBytes) {
        const maxMB = limits.maxBytes / 1024 / 1024;
        const sizeMB = (file.size / 1024 / 1024).toFixed(1);
        return errorResponse(
          req,
          `El archivo pesa ${sizeMB} MB. El máximo para ${classified} es ${maxMB} MB.`,
          400,
          "too_large",
        );
      }

      const safeName = sanitizeFilename(file.name);
      storagePath = `foro/${cursoId}/${crypto.randomUUID()}-${safeName}`;
    } else {
      return errorResponse(req, `kind "${kind}" no reconocido.`, 400, "bad_kind");
    }

    // ── Upload con service role ──────────────────────────────────────
    // Pasamos el File (Blob) directo en vez de file.arrayBuffer() para no
    // crear una segunda copia completa en memoria. El guard de Content-Length
    // de arriba acota el peor caso (mismo enfoque que submit-tarea).
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { error: uploadErr } = await supabaseAdmin
      .storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        cacheControl: "31536000", // 1 año
        upsert: false,
      });

    if (uploadErr) {
      console.error("Storage upload failed:", uploadErr);
      return errorResponse(
        req,
        `No pudimos guardar el archivo. ${uploadErr.message}`,
        500,
        "upload_failed",
      );
    }

    // Public URL (asume que el bucket es público)
    const { data: urlData } = supabaseAdmin
      .storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    return jsonResponse(req, {
      ok: true,
      asset: {
        url: urlData.publicUrl,
        path: storagePath,
        kind,
        attachmentType,
        mimeType: file.type,
        size: file.size,
        originalName: file.name,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("upload-asset fatal:", msg);
    return errorResponse(req, msg, 500, "fatal");
  }
});
