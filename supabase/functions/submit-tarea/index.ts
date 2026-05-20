// SOPHIA Portal · submit-tarea
//
// Recibe N archivos (multipart/form-data, campo "file" repetido) + comentario
// opcional para una lección tipo `tarea`. Sube todos los archivos a Supabase
// Storage en una sola request y los agrega como attachments al registro de
// "Actividades en Clase" para esta (Lección × Inscripción). Si ya existe un
// registro, hace merge con los archivos previos. Si es la primera entrega,
// crea el registro.
//
// Endpoint:   POST /submit-tarea
// Headers:    Authorization: Bearer <jwt>
// Body:       multipart/form-data
//   file:           File (binary)  — puede repetirse para varios archivos
//   leccionId:      string (recXXX)
//   inscripcionId:  string (recXXX)
//   comentario:     string (opcional)
//
// Response 200:
//   { ok: true, respuestaId, archivos: [{ url, filename, size }, ...], comentario }
// Response 4xx/5xx:
//   { ok: false, error, code? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ============================================================================
// CONFIG
// ============================================================================

const STORAGE_BUCKET = "sophia-portal-uploads";
const MAX_FILE_BYTES = 20 * 1024 * 1024;  // 20 MB por archivo
const MAX_COMMENT_LEN = 4000;

const BASES = {
  PORTAL: "app0S6GrJQ8YatvCc",
  CRM: "app1SbOC98k2OP5m1",
} as const;

const TABLES = {
  INSCRIPCIONES: "tblIT40GILMUHhLKK",
  ACTIVIDADES: "tbllM76FnC50EHRCx",
  PERSONAS: "tbl5XKtg0mRfLeFYH",
  PERSONAS_PORTAL: "tblwo4xOFhmx2TznJ",
} as const;

const FIELDS = {
  INSCRIPCIONES: {
    PERSONA: "fldsgcanUDaXzX20x",
  },
  ACTIVIDADES: {
    RESUMEN: "fldU52Cyxu7zoeHKj",
    ACTIVIDAD: "fldumUkw9GPp8gF9A",
    LECCION: "fldD7y3DXBGUnKOpa",
    INSCRIPCION: "fldoZwq6JeRdjm3gj",
    RESPUESTAS_JSON: "flduVXSkzzUCjB6ks",
    FECHA: "fldE610Bqq0mMOLnz",
    COMPLETADO: "fldLWVj1bLsPtS3wI",
    ARCHIVOS: "fldbUYXX6v8m4oLIv",      // multipleAttachments
    COMENTARIO: "fldLLBYOl8SPkCDmA",    // multilineText
  },
  PERSONAS_CRM: {
    AUTH_USER_ID: "fldg3kYs6c4xOoYkq",
    EMAIL: "fldJlxMp6NKCpvAuv",
  },
  PERSONAS_PORTAL: {
    EMAIL: "fldnRbi4mJRtfuAmV",
    AUTH_USER_ID: "fldSKACBNXloxYRBc",
  },
} as const;

const AIRTABLE_API = "https://api.airtable.com/v0";

interface AirtableAttachment {
  id?: string;
  url: string;
  filename: string;
  size?: number;
  type?: string;
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

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
    Vary: "Origin",
  };
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
// Airtable helpers
// ============================================================================

function getAirtablePAT(): string {
  const pat = Deno.env.get("AIRTABLE_PAT");
  if (!pat) throw new Error("AIRTABLE_PAT not configured");
  return pat;
}

async function listRecords(
  baseId: string,
  tableId: string,
  options: { filterByFormula?: string; fields?: string[]; maxRecords?: number } = {},
): Promise<AirtableRecord[]> {
  const pat = getAirtablePAT();
  const params = new URLSearchParams();
  params.set("returnFieldsByFieldId", "true");
  if (options.filterByFormula) params.set("filterByFormula", options.filterByFormula);
  if (options.maxRecords) params.set("maxRecords", String(options.maxRecords));
  options.fields?.forEach((f) => params.append("fields[]", f));

  const res = await fetch(`${AIRTABLE_API}/${baseId}/${tableId}?${params}`, {
    headers: { Authorization: `Bearer ${pat}` },
  });
  if (!res.ok) {
    throw new Error(`Airtable list failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.records ?? [];
}

async function createRecord(
  baseId: string,
  tableId: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  const pat = getAirtablePAT();
  const res = await fetch(`${AIRTABLE_API}/${baseId}/${tableId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields, returnFieldsByFieldId: true }),
  });
  if (!res.ok) {
    throw new Error(`Airtable create failed: ${res.status} ${await res.text()}`);
  }
  return await res.json();
}

async function updateRecord(
  baseId: string,
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  const pat = getAirtablePAT();
  const res = await fetch(`${AIRTABLE_API}/${baseId}/${tableId}/${recordId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields, returnFieldsByFieldId: true }),
  });
  if (!res.ok) {
    throw new Error(`Airtable update failed: ${res.status} ${await res.text()}`);
  }
  return await res.json();
}

function eqFormula(fieldId: string, value: string): string {
  return `{${fieldId}} = '${value.replace(/'/g, "\\'")}'`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ============================================================================
// Filename sanitize
// ============================================================================

function sanitizeFilename(name: string): string {
  // Quita path separators, normaliza unicode, limita largo.
  const clean = name
    .normalize("NFKD")
    .replace(/[\/\\]/g, "_")
    .replace(/[^\w.\-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return clean.slice(0, 100) || "archivo";
}

// ============================================================================
// Main handler
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return errorResponse(req, "Method not allowed", 405);
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

    const supabaseAuth = createClient(supabaseUrl, anonKey);
    const { data: userData, error: authErr } = await supabaseAuth.auth.getUser(jwt);
    if (authErr || !userData.user) {
      return errorResponse(req, "Invalid JWT", 401, "invalid_jwt");
    }
    const authUserId = userData.user.id;
    const email = normalizeEmail(userData.user.email ?? "");

    // ── Parse multipart ──────────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return errorResponse(req, "Cuerpo inválido. Esperaba multipart/form-data.", 400, "bad_body");
    }

    const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
    const leccionId = String(formData.get("leccionId") ?? "");
    const inscripcionId = String(formData.get("inscripcionId") ?? "");
    const comentarioRaw = formData.get("comentario");
    const comentario = comentarioRaw == null
      ? null
      : String(comentarioRaw).slice(0, MAX_COMMENT_LEN);

    if (!leccionId.startsWith("rec")) {
      return errorResponse(req, "leccionId inválido", 400, "bad_leccion");
    }
    if (!inscripcionId.startsWith("rec")) {
      return errorResponse(req, "inscripcionId inválido", 400, "bad_inscripcion");
    }

    // ── Resolver personaPortalId ────────────────────────────────────
    const personasPortal = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
      filterByFormula: eqFormula(FIELDS.PERSONAS_PORTAL.AUTH_USER_ID, authUserId),
      maxRecords: 1,
    });
    let personaPortalId = personasPortal[0]?.id;
    if (!personaPortalId && email) {
      const byEmail = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
        filterByFormula: `LOWER(TRIM({${FIELDS.PERSONAS_PORTAL.EMAIL}})) = '${email.replace(/'/g, "\\'")}'`,
        maxRecords: 1,
      });
      personaPortalId = byEmail[0]?.id;
    }
    if (!personaPortalId) {
      return errorResponse(req, "Persona no encontrada. Ejecuta auth-bootstrap primero.", 403, "no_persona");
    }

    // ── Validar ownership de la inscripción ──────────────────────────
    const insc = await listRecords(BASES.PORTAL, TABLES.INSCRIPCIONES, {
      filterByFormula: `RECORD_ID()='${inscripcionId}'`,
      maxRecords: 1,
    });
    if (insc.length === 0) {
      return errorResponse(req, "Inscripción no existe", 404, "no_insc");
    }
    const owner = (insc[0].fields[FIELDS.INSCRIPCIONES.PERSONA] as string[]) ?? [];
    if (!owner.includes(personaPortalId)) {
      return errorResponse(req, "Inscripción no pertenece a este usuario", 403, "forbidden");
    }

    // ── Buscar registro previo (si existe) ──────────────────────────
    const previas = await listRecords(BASES.PORTAL, TABLES.ACTIVIDADES, {
      filterByFormula:
        `AND(` +
          `SEARCH('${leccionId}', ARRAYJOIN({${FIELDS.ACTIVIDADES.LECCION}})),` +
          `SEARCH('${inscripcionId}', ARRAYJOIN({${FIELDS.ACTIVIDADES.INSCRIPCION}}))` +
        `)`,
      maxRecords: 1,
    });
    const existingRec = previas[0] ?? null;
    const existingFiles =
      (existingRec?.fields[FIELDS.ACTIVIDADES.ARCHIVOS] as AirtableAttachment[]) ?? [];

    // ── Subir archivos nuevos (si hay) ──────────────────────────────
    // El frontend puede mandar N archivos en una sola request (campo "file"
    // repetido). Los validamos primero y luego subimos en secuencia. Si uno
    // falla, abortamos y devolvemos error (los previos quedan en Storage
    // pero no se asocian a Airtable — cleanup-orphan-uploads los recoge).
    const newFiles: AirtableAttachment[] = [];
    if (files.length > 0) {
      // Validar todos antes de subir cualquiera
      for (const f of files) {
        if (f.size > MAX_FILE_BYTES) {
          const sizeMB = (f.size / 1024 / 1024).toFixed(1);
          return errorResponse(
            req,
            `El archivo "${f.name}" pesa ${sizeMB} MB. El máximo es 20 MB.`,
            400,
            "too_large",
          );
        }
      }

      const supabaseAdmin = createClient(supabaseUrl, serviceKey);
      for (const f of files) {
        const safeName = sanitizeFilename(f.name || "archivo");
        const storagePath = `tareas/${leccionId}/${personaPortalId}/${crypto.randomUUID()}-${safeName}`;
        const arrayBuffer = await f.arrayBuffer();
        const { error: uploadErr } = await supabaseAdmin
          .storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, arrayBuffer, {
            contentType: f.type || "application/octet-stream",
            cacheControl: "31536000",
            upsert: false,
          });
        if (uploadErr) {
          console.error("Storage upload failed:", uploadErr);
          return errorResponse(
            req,
            `No pudimos guardar "${f.name}". ${uploadErr.message}`,
            500,
            "upload_failed",
          );
        }
        const { data: urlData } = supabaseAdmin
          .storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(storagePath);

        newFiles.push({
          url: urlData.publicUrl,
          filename: f.name || safeName,
        });
      }
    }

    // Si no llegó archivo ni comentario nuevo, no hay nada que hacer.
    if (newFiles.length === 0 && comentario == null) {
      return errorResponse(
        req,
        "Debes adjuntar al menos un archivo o un comentario.",
        400,
        "nothing_to_save",
      );
    }

    // ── Upsert en Airtable ──────────────────────────────────────────
    // Importante: para mantener attachments existentes en multipleAttachments
    // hay que mandar el array completo (existentes + nuevos). Airtable
    // reemplaza el array, no merge.
    const mergedFiles = [
      ...existingFiles.map((f) => ({ url: f.url, filename: f.filename })),
      ...newFiles,
    ];

    const completedAt = new Date().toISOString();
    const fechaCorta = completedAt.slice(0, 10);

    const fields: Record<string, unknown> = {
      [FIELDS.ACTIVIDADES.LECCION]: [leccionId],
      [FIELDS.ACTIVIDADES.INSCRIPCION]: [inscripcionId],
      [FIELDS.ACTIVIDADES.ACTIVIDAD]: "tarea",
      [FIELDS.ACTIVIDADES.RESUMEN]: `tarea · ${fechaCorta}`,
      [FIELDS.ACTIVIDADES.FECHA]: completedAt,
      [FIELDS.ACTIVIDADES.COMPLETADO]: mergedFiles.length > 0,
      [FIELDS.ACTIVIDADES.ARCHIVOS]: mergedFiles,
    };
    if (comentario != null) {
      fields[FIELDS.ACTIVIDADES.COMENTARIO] = comentario;
    }

    let rec: AirtableRecord;
    if (existingRec) {
      rec = await updateRecord(BASES.PORTAL, TABLES.ACTIVIDADES, existingRec.id, fields);
    } else {
      rec = await createRecord(BASES.PORTAL, TABLES.ACTIVIDADES, fields);
    }

    // Devuelve solo los archivos finales (Airtable rellena id/size/type
    // después del upsert; los leemos del response).
    const finalAttachments =
      (rec.fields[FIELDS.ACTIVIDADES.ARCHIVOS] as AirtableAttachment[]) ?? mergedFiles;

    return jsonResponse(req, {
      ok: true,
      respuestaId: rec.id,
      archivos: finalAttachments.map((a) => ({
        id: a.id,
        url: a.url,
        filename: a.filename,
        size: a.size,
        type: a.type,
      })),
      comentario: (rec.fields[FIELDS.ACTIVIDADES.COMENTARIO] as string) ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("submit-tarea fatal:", msg);
    return errorResponse(req, msg, 500, "fatal");
  }
});
