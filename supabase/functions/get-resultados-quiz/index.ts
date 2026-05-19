// SOPHIA Portal · get-resultados-quiz (inlined for dashboard deploy)
//
// Devuelve la última respuesta del usuario autenticado a una actividad en
// clase (quiz), dada la lección. Si el alumno aún no la completó, devuelve
// { tieneResultados: false }.
//
// GET /get-resultados-quiz?leccionId=...
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
    ACTIVIDAD: "fldumUkw9GPp8gF9A",
    LECCION: "fldD7y3DXBGUnKOpa",
    INSCRIPCION: "fldoZwq6JeRdjm3gj",
    RESPUESTAS_JSON: "flduVXSkzzUCjB6ks",
    FECHA: "fldE610Bqq0mMOLnz",
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
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  const optionsRes = handleOptions(req);
  if (optionsRes) return optionsRes;

  if (req.method !== "GET") {
    return errorResponse(req, "Method not allowed", 405);
  }

  try {
    const user = await requireAuth(req);

    const url = new URL(req.url);
    const leccionId = url.searchParams.get("leccionId") ?? "";
    if (!leccionId) return errorResponse(req, "leccionId is required", 400);

    // Inscripciones del usuario
    const allInscripciones = await listRecords(BASES.PORTAL, TABLES.INSCRIPCIONES, {
      fields: [FIELDS.INSCRIPCIONES.PERSONA],
    });
    const myInscripcionIds = new Set(
      allInscripciones
        .filter((ins) => {
          const ps = (ins.fields[FIELDS.INSCRIPCIONES.PERSONA] as string[]) ?? [];
          return ps.includes(user.personaPortalId);
        })
        .map((i) => i.id),
    );

    if (myInscripcionIds.size === 0) {
      return jsonResponse(req, { tieneResultados: false });
    }

    // Respuestas de actividades en clase ligadas a esta lección. Filtramos
    // server-side por el link de Lección (con field ID, ver regla de oro) y
    // luego en JS por inscripción del usuario.
    const all = await listRecords(BASES.PORTAL, TABLES.ACTIVIDADES, {
      filterByFormula: `FIND('${leccionId.replace(/'/g, "\\'")}', ARRAYJOIN({${FIELDS.ACTIVIDADES.LECCION}}))`,
    });
    const mine = all.filter((r) => {
      const leccionLinks = (r.fields[FIELDS.ACTIVIDADES.LECCION] as string[]) ?? [];
      const inscLinks = (r.fields[FIELDS.ACTIVIDADES.INSCRIPCION] as string[]) ?? [];
      return (
        leccionLinks.includes(leccionId) &&
        inscLinks.some((id) => myInscripcionIds.has(id))
      );
    });

    if (mine.length === 0) {
      return jsonResponse(req, { tieneResultados: false });
    }

    // Más reciente primero
    mine.sort((a, b) => {
      const da = (a.fields[FIELDS.ACTIVIDADES.FECHA] as string) ?? "";
      const db = (b.fields[FIELDS.ACTIVIDADES.FECHA] as string) ?? "";
      return db.localeCompare(da);
    });
    const rec = mine[0];

    let payload: {
      version?: number;
      actividad?: string;
      respuestas?: Record<string, string>;
      completedAt?: string;
    } = {};
    try {
      const raw = rec.fields[FIELDS.ACTIVIDADES.RESPUESTAS_JSON] as string | undefined;
      if (raw) payload = JSON.parse(raw);
    } catch {
      payload = {};
    }

    return jsonResponse(req, {
      tieneResultados: true,
      respuestaId: rec.id,
      actividad:
        payload.actividad ??
        (rec.fields[FIELDS.ACTIVIDADES.ACTIVIDAD] as string) ??
        "",
      respuestas: payload.respuestas ?? {},
      completedAt:
        payload.completedAt ??
        (rec.fields[FIELDS.ACTIVIDADES.FECHA] as string) ??
        null,
    });
  } catch (e) {
    if (e instanceof HttpError) {
      return errorResponse(req, e.message, e.status);
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("get-resultados-quiz error:", msg);
    return errorResponse(req, msg, 500);
  }
});
