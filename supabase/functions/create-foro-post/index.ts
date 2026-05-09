// SOPHIA Portal · create-foro-post
// Crea un post (o comentario) en el foro de un curso.
//
// POST /create-foro-post
// Headers: Authorization: Bearer <supabase_jwt>
// Body: {
//   cursoId: "recXXX",
//   contenido: "texto plano, max 4000 chars",
//   imagenUrl?: "https://...",          // opcional
//   parentPostId?: "recXXX"             // opcional, hace que sea comentario
// }
//
// Returns 200: { ok: true, post: { id, contenido, imagenUrl, fechaISO, autor } }
// Errors:
//   400 validación
//   401 invalid/missing JWT
//   403 no enrolled in course
//   404 parent post not found / not in same course
//   500 unexpected

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ============================================================================
// AIRTABLE CONSTANTS
// Ver docs/foro-airtable-schema.md
// ============================================================================

const BASES = {
  PORTAL: "app0S6GrJQ8YatvCc",
  CRM: "app1SbOC98k2OP5m1",
} as const;

const TABLES = {
  PERSONAS_CRM: "tbl5XKtg0mRfLeFYH",
  PERSONAS_PORTAL: "tblwo4xOFhmx2TznJ",
  INSCRIPCIONES: "tblIT40GILMUHhLKK",
  CURSOS: "tblJpUGeBsLNkk9UO",
  POSTS: "tblmLVl9ySzTXb2OK",
} as const;

const FIELDS = {
  PERSONAS_CRM: {
    AUTH_USER_ID: "fldg3kYs6c4xOoYkq",
    EMAIL: "fldJlxMp6NKCpvAuv",
    ROL: "fldOF0bnjfErxEOCO",
  },
  PERSONAS_PORTAL: {
    NOMBRE: "fldhTiwmmXtIIS8dD",
    APELLIDOS: "fldvZE8Y5Y4rVCOKa",
    EMAIL: "fldnRbi4mJRtfuAmV",
    AUTH_USER_ID: "fldSKACBNXloxYRBc",
  },
  INSCRIPCIONES: {
    PERSONA: "fldsgcanUDaXzX20x",
    CURSO: "fldTjcS2GiOe3Q9N0",
    ESTATUS: "flduEWS1l327elsD6",
  },
  POSTS: {
    AUTOR: "fldjOVXCAkwoNENnX",
    CURSO: "fldFiySrT6wjout5k",
    CONTENIDO: "fldPmHX3Pt0f4r1pv",
    IMAGEN_URL: "fldmMwKgVz0lP3BO8",
    POST_PADRE: "fldq82v7aJfKlu6i1",
    ESTATUS: "fldy88bnFeG7QEIQN",
    FECHA: "fldPzXu1gkRN4YSYQ",
  },
} as const;

const AIRTABLE_API = "https://api.airtable.com/v0";

interface AirtableRecord {
  id: string;
  createdTime?: string;
  fields: Record<string, unknown>;
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

// ============================================================================
// AIRTABLE HELPERS
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
    throw new Error(`Airtable list failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as AirtableListResponse;
  return data.records;
}

async function getRecord(
  baseId: string,
  tableId: string,
  recordId: string,
): Promise<AirtableRecord> {
  const pat = getAirtablePAT();
  const res = await fetch(
    `${AIRTABLE_API}/${baseId}/${tableId}/${recordId}?returnFieldsByFieldId=true`,
    { headers: { Authorization: `Bearer ${pat}` } },
  );
  if (!res.ok) {
    throw new Error(`Airtable get failed (${res.status}): ${await res.text()}`);
  }
  return await res.json();
}

async function createRecord(
  baseId: string,
  tableId: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  const pat = getAirtablePAT();
  const res = await fetch(`${AIRTABLE_API}/${baseId}/${tableId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      records: [{ fields }],
      returnFieldsByFieldId: true,
    }),
  });
  if (!res.ok) {
    throw new Error(`Airtable create failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.records[0];
}

function eqFormula(fieldId: string, value: string): string {
  const escaped = value.replace(/'/g, "\\'");
  return `{${fieldId}} = '${escaped}'`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ============================================================================
// CORS
// ============================================================================

const ALLOWED_ORIGINS = [
  "https://portal.sophiamx.org",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5500",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const isVercelPreview = /^https:\/\/sophia-portal[\w-]*\.vercel\.app$/.test(origin);
  const allowedOrigin =
    ALLOWED_ORIGINS.includes(origin) || isVercelPreview ? origin : ALLOWED_ORIGINS[0];
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

function errorResponse(req: Request, message: string, status = 400, code?: string): Response {
  return jsonResponse(req, { error: message, code }, status);
}

// ============================================================================
// HELPERS
// ============================================================================

class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

function iniciales(nombre: string, apellidos: string): string {
  const a = (nombre || "").trim()[0] || "";
  const b = (apellidos || "").trim()[0] || "";
  return (a + b).toUpperCase() || "S";
}

interface AuthedUser {
  authUserId: string;
  email: string;
  personaPortalId: string;
  nombre: string;
  apellidos: string;
}

async function authenticate(req: Request): Promise<AuthedUser> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing Authorization header");
  }
  const jwt = authHeader.slice("Bearer ".length);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey =
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: userData, error } = await supabase.auth.getUser(jwt);
  if (error || !userData.user) throw new HttpError(401, "Invalid JWT");

  const authUserId = userData.user.id;
  const email = normalizeEmail(userData.user.email ?? "");
  if (!email) throw new HttpError(401, "User has no email");

  let personasPortal = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
    filterByFormula: eqFormula(FIELDS.PERSONAS_PORTAL.AUTH_USER_ID, authUserId),
    maxRecords: 1,
  });
  if (personasPortal.length === 0) {
    personasPortal = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
      filterByFormula: `LOWER(TRIM({${FIELDS.PERSONAS_PORTAL.EMAIL}})) = '${email.replace(/'/g, "\\'")}'`,
      maxRecords: 1,
    });
  }
  if (personasPortal.length === 0) {
    throw new HttpError(403, "Persona no encontrada en sync de Portal. Vuelve a intentar en unos segundos.");
  }
  const pp = personasPortal[0];

  return {
    authUserId,
    email,
    personaPortalId: pp.id,
    nombre: (pp.fields[FIELDS.PERSONAS_PORTAL.NOMBRE] as string) ?? "",
    apellidos: (pp.fields[FIELDS.PERSONAS_PORTAL.APELLIDOS] as string) ?? "",
  };
}

async function verifyEnrollment(personaPortalId: string, cursoId: string): Promise<void> {
  const inscripciones = await listRecords(BASES.PORTAL, TABLES.INSCRIPCIONES, {
    fields: [FIELDS.INSCRIPCIONES.PERSONA, FIELDS.INSCRIPCIONES.CURSO, FIELDS.INSCRIPCIONES.ESTATUS],
  });
  const enrolled = inscripciones.some((ins) => {
    const personas = (ins.fields[FIELDS.INSCRIPCIONES.PERSONA] as string[]) ?? [];
    const cursos = (ins.fields[FIELDS.INSCRIPCIONES.CURSO] as string[]) ?? [];
    return personas.includes(personaPortalId) && cursos.includes(cursoId);
  });
  if (!enrolled) {
    throw new HttpError(403, "No estás inscrito a este curso", "not_enrolled");
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

const MAX_CONTENIDO_LEN = 4000;
const MAX_IMAGEN_URL_LEN = 1000;

interface Body {
  cursoId?: string;
  contenido?: string;
  imagenUrl?: string;
  parentPostId?: string;
}

function isValidRecordId(s: unknown): s is string {
  return typeof s === "string" && /^rec[A-Za-z0-9]{14,}$/.test(s);
}

function isValidImageUrl(s: string): boolean {
  if (!s || s.length > MAX_IMAGEN_URL_LEN) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  const optionsRes = handleOptions(req);
  if (optionsRes) return optionsRes;

  if (req.method !== "POST") {
    return errorResponse(req, "Method not allowed", 405);
  }

  try {
    const me = await authenticate(req);

    const body: Body = await req.json().catch(() => ({}));
    const cursoId = body.cursoId;
    const contenidoRaw = (body.contenido ?? "").trim();
    const imagenUrlRaw = (body.imagenUrl ?? "").trim();
    const parentPostId = body.parentPostId;

    if (!isValidRecordId(cursoId)) {
      return errorResponse(req, "cursoId inválido", 400, "invalid_curso_id");
    }
    if (!contenidoRaw && !imagenUrlRaw) {
      return errorResponse(req, "El post no puede estar vacío", 400, "empty_post");
    }
    if (contenidoRaw.length > MAX_CONTENIDO_LEN) {
      return errorResponse(req, `Contenido demasiado largo (max ${MAX_CONTENIDO_LEN} caracteres)`, 400, "too_long");
    }
    if (imagenUrlRaw && !isValidImageUrl(imagenUrlRaw)) {
      return errorResponse(req, "URL de imagen inválida (debe ser http/https)", 400, "invalid_image_url");
    }
    if (parentPostId !== undefined && !isValidRecordId(parentPostId)) {
      return errorResponse(req, "parentPostId inválido", 400, "invalid_parent_id");
    }

    await verifyEnrollment(me.personaPortalId, cursoId);

    // Si es comentario, validar que el padre existe, está activo y es del mismo curso
    if (parentPostId) {
      const parent = await getRecord(BASES.PORTAL, TABLES.POSTS, parentPostId).catch(() => null);
      if (!parent) {
        return errorResponse(req, "El post padre no existe", 404, "parent_not_found");
      }
      const parentEstatus = parent.fields[FIELDS.POSTS.ESTATUS] as string | { name?: string } | undefined;
      const parentEstatusName = typeof parentEstatus === "string" ? parentEstatus : parentEstatus?.name;
      if (parentEstatusName !== "activo") {
        return errorResponse(req, "El post padre no está disponible", 400, "parent_inactive");
      }
      const parentCursoLinks = (parent.fields[FIELDS.POSTS.CURSO] as string[]) ?? [];
      if (!parentCursoLinks.includes(cursoId)) {
        return errorResponse(req, "El post padre es de otro curso", 400, "cross_course");
      }
      // No permitimos comentarios anidados profundos: si el padre ya es comentario, rechazar
      const parentParent = (parent.fields[FIELDS.POSTS.POST_PADRE] as string[]) ?? [];
      if (parentParent.length > 0) {
        return errorResponse(req, "No se permiten respuestas anidadas profundas (max 1 nivel)", 400, "nesting_too_deep");
      }
    }

    // Crear el post. Escribimos Fecha explícitamente porque Airtable no
    // auto-popula campos dateTime, y get-foro-posts ordena por Fecha.
    const nowISO = new Date().toISOString();
    const fields: Record<string, unknown> = {
      [FIELDS.POSTS.AUTOR]: [me.personaPortalId],
      [FIELDS.POSTS.CURSO]: [cursoId],
      [FIELDS.POSTS.CONTENIDO]: contenidoRaw,
      [FIELDS.POSTS.ESTATUS]: "activo",
      [FIELDS.POSTS.FECHA]: nowISO,
    };
    if (imagenUrlRaw) fields[FIELDS.POSTS.IMAGEN_URL] = imagenUrlRaw;
    if (parentPostId) fields[FIELDS.POSTS.POST_PADRE] = [parentPostId];

    const created = await createRecord(BASES.PORTAL, TABLES.POSTS, fields);

    return jsonResponse(req, {
      ok: true,
      post: {
        id: created.id,
        contenido: contenidoRaw,
        imagenUrl: imagenUrlRaw || "",
        fechaISO:
          (created.fields[FIELDS.POSTS.FECHA] as string) ??
          created.createdTime ??
          nowISO,
        parentId: parentPostId || null,
        esAutor: true,
        autor: {
          id: me.personaPortalId,
          nombre: me.nombre,
          apellidos: me.apellidos,
          iniciales: iniciales(me.nombre, me.apellidos),
        },
      },
    });
  } catch (e) {
    if (e instanceof HttpError) {
      return errorResponse(req, e.message, e.status, e.code);
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("create-foro-post fatal:", msg);
    return errorResponse(req, msg, 500);
  }
});
