// SOPHIA Portal · submit-quiz (inlined for dashboard deploy)
//
// Guarda las respuestas de una actividad en clase (quiz) en la tabla
// Airtable "Actividades en Clase". A diferencia de las autoevaluaciones,
// los quizzes NO puntúan: solo se registran las respuestas tal cual.
//
// POST /submit-quiz
// Body: { leccionId: string, inscripcionId?: string, actividad: string,
//         respuestas: Record<string, string> }
// Headers: Authorization: Bearer <supabase_jwt>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ============================================================================
// AIRTABLE CONSTANTS & HELPERS
// ============================================================================

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
  },
  PERSONAS_CRM: {
    AUTH_USER_ID: "fldg3kYs6c4xOoYkq",
    EMAIL: "fldJlxMp6NKCpvAuv",
    NOMBRE: "fldEbEI3pLEAmlYAe",
    APELLIDOS: "fldCnRa0XFvH1FtfQ",
    ROL: "fldOF0bnjfErxEOCO",
  },
  PERSONAS_PORTAL: {
    NOMBRE: "fldhTiwmmXtIIS8dD",
    EMAIL: "fldnRbi4mJRtfuAmV",
    AUTH_USER_ID: "fldSKACBNXloxYRBc",
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

function getAirtablePAT(): string {
  const pat = Deno.env.get("AIRTABLE_PAT");
  if (!pat) throw new Error("AIRTABLE_PAT not configured");
  return pat;
}

async function listRecords(
  baseId: string,
  tableId: string,
  options: {
    filterByFormula?: string;
    fields?: string[];
    maxRecords?: number;
    pageSize?: number;
  } = {},
): Promise<AirtableRecord[]> {
  const pat = getAirtablePAT();
  const all: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("returnFieldsByFieldId", "true");
    if (options.filterByFormula) params.set("filterByFormula", options.filterByFormula);
    if (options.maxRecords) params.set("maxRecords", String(options.maxRecords));
    if (options.pageSize) params.set("pageSize", String(options.pageSize));
    if (offset) params.set("offset", offset);
    options.fields?.forEach((f) => params.append("fields[]", f));

    const res = await fetch(`${AIRTABLE_API}/${baseId}/${tableId}?${params}`, {
      headers: { Authorization: `Bearer ${pat}` },
    });
    if (!res.ok) {
      throw new Error(`Airtable list failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as AirtableListResponse;
    all.push(...data.records);
    offset = data.offset;
    if (options.maxRecords && all.length >= options.maxRecords) break;
  } while (offset);

  return all;
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
  const allowedOrigin =
    ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
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
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

function errorResponse(req: Request, message: string, status = 400): Response {
  return jsonResponse(req, { error: message }, status);
}

// ============================================================================
// AUTH HELPER
// ============================================================================

interface AuthedUser {
  authUserId: string;
  email: string;
  personaId: string;
  personaPortalId: string;
  rol: string;
  nombre: string;
  apellidos: string;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

async function requireAuth(req: Request): Promise<AuthedUser> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing Authorization header");
  }
  const jwt = authHeader.slice("Bearer ".length);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseKey) {
    throw new HttpError(500, "Supabase env not configured");
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: userData, error } = await supabase.auth.getUser(jwt);
  if (error || !userData.user) {
    throw new HttpError(401, "Invalid JWT");
  }

  const authUserId = userData.user.id;
  const email = normalizeEmail(userData.user.email ?? "");
  if (!email) throw new HttpError(401, "User has no email");

  let personas = await listRecords(BASES.CRM, TABLES.PERSONAS, {
    filterByFormula: eqFormula(FIELDS.PERSONAS_CRM.AUTH_USER_ID, authUserId),
    maxRecords: 1,
  });

  if (personas.length === 0) {
    personas = await listRecords(BASES.CRM, TABLES.PERSONAS, {
      filterByFormula: `LOWER(TRIM({${FIELDS.PERSONAS_CRM.EMAIL}})) = '${email.replace(/'/g, "\\'")}'`,
      maxRecords: 1,
    });

    if (personas.length > 0 && !personas[0].fields[FIELDS.PERSONAS_CRM.AUTH_USER_ID]) {
      await updateRecord(BASES.CRM, TABLES.PERSONAS, personas[0].id, {
        [FIELDS.PERSONAS_CRM.AUTH_USER_ID]: authUserId,
      });
    }
  }

  if (personas.length === 0) {
    throw new HttpError(403, "No Persona record found. Run auth-bootstrap first.");
  }

  const p = personas[0];
  const rol = (p.fields[FIELDS.PERSONAS_CRM.ROL] as string) ?? "participante";

  const personasPortal = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
    filterByFormula: eqFormula(FIELDS.PERSONAS_PORTAL.AUTH_USER_ID, authUserId),
    maxRecords: 1,
  });
  let personaPortalId = personasPortal[0]?.id;
  if (!personaPortalId) {
    const byEmail = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
      filterByFormula: `LOWER(TRIM({${FIELDS.PERSONAS_PORTAL.EMAIL}})) = '${email.replace(/'/g, "\\'")}'`,
      maxRecords: 1,
    });
    personaPortalId = byEmail[0]?.id;
  }
  if (!personaPortalId) {
    throw new HttpError(
      403,
      "Persona no encontrada en sync de Portal. Espera unos minutos a que Airtable sincronice CRM→Portal o contacta a soporte.",
    );
  }

  return {
    authUserId,
    email,
    personaId: p.id,
    personaPortalId,
    rol,
    nombre: (p.fields[FIELDS.PERSONAS_CRM.NOMBRE] as string) ?? "",
    apellidos: (p.fields[FIELDS.PERSONAS_CRM.APELLIDOS] as string) ?? "",
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

// Las respuestas de un quiz son un objeto { preguntaId: string }. No
// puntuamos ni validamos contra un esquema fijo (las preguntas viven en el
// front-end); solo exigimos que sea un objeto plano de strings y acotamos
// el tamaño para evitar payloads abusivos.
function validateRespuestas(
  respuestas: unknown,
): { ok: true; clean: Record<string, string> } | { ok: false; error: string } {
  if (!respuestas || typeof respuestas !== "object" || Array.isArray(respuestas)) {
    return { ok: false, error: "respuestas debe ser un objeto" };
  }
  const entries = Object.entries(respuestas as Record<string, unknown>);
  if (entries.length === 0) {
    return { ok: false, error: "respuestas está vacío" };
  }
  if (entries.length > 100) {
    return { ok: false, error: "demasiadas respuestas" };
  }
  const clean: Record<string, string> = {};
  for (const [k, v] of entries) {
    if (typeof v !== "string") {
      return { ok: false, error: `respuesta inválida para ${k}` };
    }
    if (v.length > 4000) {
      return { ok: false, error: `respuesta demasiado larga para ${k}` };
    }
    clean[k] = v;
  }
  return { ok: true, clean };
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
    const user = await requireAuth(req);

    let body: {
      leccionId?: string;
      inscripcionId?: string;
      actividad?: string;
      respuestas?: Record<string, unknown>;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(req, "Invalid JSON body", 400);
    }

    const { leccionId, inscripcionId, actividad, respuestas } = body;
    if (!leccionId) return errorResponse(req, "leccionId is required", 400);
    if (!actividad) return errorResponse(req, "actividad is required", 400);
    if (!respuestas) return errorResponse(req, "respuestas is required", 400);
    // inscripcionId es OBLIGATORIO: get-resultados-quiz solo encuentra
    // registros que tienen un link de inscripción del usuario. Sin él, el
    // registro queda huérfano (invisible al chequeo de "ya completaste").
    if (!inscripcionId) return errorResponse(req, "inscripcionId is required", 400);

    const valid = validateRespuestas(respuestas);
    if (!valid.ok) return errorResponse(req, valid.error, 400);

    // Validar ownership de la inscripción
    const insc = await listRecords(BASES.PORTAL, TABLES.INSCRIPCIONES, {
      filterByFormula: `RECORD_ID()='${inscripcionId}'`,
      maxRecords: 1,
    });
    if (insc.length === 0) {
      throw new HttpError(404, "Inscripción not found");
    }
    const ownerPersonas =
      (insc[0].fields[FIELDS.INSCRIPCIONES.PERSONA] as string[]) ?? [];
    if (!ownerPersonas.includes(user.personaPortalId)) {
      throw new HttpError(403, "Inscripción does not belong to this user");
    }

    const completedAt = new Date().toISOString();
    const fechaCorta = completedAt.slice(0, 10);

    const payload = {
      version: 1,
      actividad,
      respuestas: valid.clean,
      completedAt,
    };

    const fields: Record<string, unknown> = {
      [FIELDS.ACTIVIDADES.RESUMEN]: `${actividad} · ${fechaCorta}`,
      [FIELDS.ACTIVIDADES.ACTIVIDAD]: actividad,
      [FIELDS.ACTIVIDADES.LECCION]: [leccionId],
      [FIELDS.ACTIVIDADES.INSCRIPCION]: [inscripcionId],
      [FIELDS.ACTIVIDADES.RESPUESTAS_JSON]: JSON.stringify(payload),
      [FIELDS.ACTIVIDADES.FECHA]: completedAt,
      [FIELDS.ACTIVIDADES.COMPLETADO]: true,
    };

    const rec = await createRecord(BASES.PORTAL, TABLES.ACTIVIDADES, fields);

    return jsonResponse(req, {
      ok: true,
      respuestaId: rec.id,
      completedAt,
    });
  } catch (e) {
    if (e instanceof HttpError) {
      return errorResponse(req, e.message, e.status);
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("submit-quiz error:", msg);
    return errorResponse(req, msg, 500);
  }
});
