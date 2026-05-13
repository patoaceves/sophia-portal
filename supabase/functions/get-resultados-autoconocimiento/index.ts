// SOPHIA Portal · get-resultados-autoconocimiento (inlined for dashboard deploy)
//
// Devuelve los resultados de la Autoevaluación VIA. Tres modos (igual que
// get-resultados-test para el Test de Felicidad):
//   GET /get-resultados-autoconocimiento?id=<respuestaRecordId>     (intento específico)
//   GET /get-resultados-autoconocimiento?inscripcion=<respuestaId>  (legacy alias)
//   GET /get-resultados-autoconocimiento                             (último intento del usuario)
//
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
  RESPUESTAS_AUTOEVAL: "tblNhTCikXms43AJz",
  PERSONAS: "tbl5XKtg0mRfLeFYH",
  PERSONAS_PORTAL: "tblwo4xOFhmx2TznJ",
} as const;

const FIELDS = {
  INSCRIPCIONES: {
    PERSONA: "fldsgcanUDaXzX20x",
  },
  RESPUESTAS_AUTOEVAL: {
    INSCRIPCION: "fldu7jj4hqe1dCIMZ",
    AUTOEVALUACION: "fldnf5Mi14PrPmQ7q",
    FECHA_ENTREGA: "fldTwTB4Vdgoqay8y",
    RESPUESTAS_JSON: "fldOJGIxOvZtW5h5h",
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

// ⚠️ Pega aquí el mismo record ID que en submit-test-autoconocimiento.
const KNOWN_IDS = {
  AUTOCONOCIMIENTO_VIA: "recDLCMOgTZChS6Yf",
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

async function getRecord(
  baseId: string,
  tableId: string,
  recordId: string,
): Promise<AirtableRecord | null> {
  const pat = getAirtablePAT();
  const res = await fetch(
    `${AIRTABLE_API}/${baseId}/${tableId}/${recordId}?returnFieldsByFieldId=true`,
    { headers: { Authorization: `Bearer ${pat}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Airtable get failed: ${res.status} ${await res.text()}`);
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
    const respuestaId =
      url.searchParams.get("id") ?? url.searchParams.get("inscripcion") ?? "";

    let rec: AirtableRecord | null = null;

    if (respuestaId) {
      rec = await getRecord(BASES.PORTAL, TABLES.RESPUESTAS_AUTOEVAL, respuestaId);
      if (!rec) throw new HttpError(404, "Respuesta not found");
    } else {
      // Latest attempt of this autoeval for this user
      const allInscripciones = await listRecords(BASES.PORTAL, TABLES.INSCRIPCIONES, {
        fields: [FIELDS.INSCRIPCIONES.PERSONA],
      });
      const inscripciones = allInscripciones.filter((ins) => {
        const ps = (ins.fields[FIELDS.INSCRIPCIONES.PERSONA] as string[]) ?? [];
        return ps.includes(user.personaPortalId);
      });
      if (inscripciones.length === 0) {
        return jsonResponse(req, { tieneResultados: false });
      }

      const allRespuestas = await listRecords(BASES.PORTAL, TABLES.RESPUESTAS_AUTOEVAL, {});
      const myInscripcionIds = new Set(inscripciones.map((i) => i.id));
      const respuestas = allRespuestas.filter((r) => {
        const inscLinks =
          (r.fields[FIELDS.RESPUESTAS_AUTOEVAL.INSCRIPCION] as string[]) ?? [];
        const autoLinks =
          (r.fields[FIELDS.RESPUESTAS_AUTOEVAL.AUTOEVALUACION] as string[]) ?? [];
        return (
          inscLinks.some((id) => myInscripcionIds.has(id)) &&
          autoLinks.includes(KNOWN_IDS.AUTOCONOCIMIENTO_VIA)
        );
      });
      if (respuestas.length === 0) {
        return jsonResponse(req, { tieneResultados: false });
      }
      respuestas.sort((a, b) => {
        const da = (a.fields[FIELDS.RESPUESTAS_AUTOEVAL.FECHA_ENTREGA] as string) ?? "";
        const db = (b.fields[FIELDS.RESPUESTAS_AUTOEVAL.FECHA_ENTREGA] as string) ?? "";
        return db.localeCompare(da);
      });
      rec = respuestas[0];
    }

    // Validate ownership
    const inscLinks =
      (rec.fields[FIELDS.RESPUESTAS_AUTOEVAL.INSCRIPCION] as string[]) ?? [];
    const inscripcionId = inscLinks[0];
    if (inscripcionId) {
      const owns = await listRecords(BASES.PORTAL, TABLES.INSCRIPCIONES, {
        filterByFormula: `RECORD_ID()='${inscripcionId}'`,
        maxRecords: 1,
      });
      if (owns.length === 0) throw new HttpError(404, "Inscripción not found");
      const ownerPersonas =
        (owns[0].fields[FIELDS.INSCRIPCIONES.PERSONA] as string[]) ?? [];
      if (!ownerPersonas.includes(user.personaPortalId)) {
        throw new HttpError(403, "Not authorized");
      }
    }

    // Validate this respuesta actually corresponds to the autoconocimiento
    // autoeval (defensive: if called with ?id pointing at a felicidad
    // respuesta, return 404).
    const autoLinks =
      (rec.fields[FIELDS.RESPUESTAS_AUTOEVAL.AUTOEVALUACION] as string[]) ?? [];
    if (!autoLinks.includes(KNOWN_IDS.AUTOCONOCIMIENTO_VIA)) {
      throw new HttpError(404, "Respuesta no corresponde a la autoeval VIA");
    }

    // Parse the JSON payload packed by submit-test-autoconocimiento
    let payload: {
      version?: number;
      tipo?: string;
      answers?: Record<string, number>;
      ranking?: Array<{ id: string; fortaleza: string; virtud: string; score: number }>;
      signatureStrengths?: Array<{ id: string; fortaleza: string; virtud: string; score: number }>;
      virtudes?: Record<string, { promedio: number; banda: string; analisis: string }>;
      virtudNombres?: Record<string, string>;
      completedAt?: string;
    } = {};
    try {
      const raw = rec.fields[FIELDS.RESPUESTAS_AUTOEVAL.RESPUESTAS_JSON] as
        | string
        | undefined;
      if (raw) payload = JSON.parse(raw);
    } catch {
      payload = {};
    }

    return jsonResponse(req, {
      tieneResultados: true,
      respuestaId: rec.id,
      inscripcionId: inscripcionId ?? null,
      completedAt:
        payload.completedAt ??
        (rec.fields[FIELDS.RESPUESTAS_AUTOEVAL.FECHA_ENTREGA] as string) ??
        null,
      ranking: payload.ranking ?? [],
      signatureStrengths: payload.signatureStrengths ?? [],
      virtudes: payload.virtudes ?? {},
      virtudNombres: payload.virtudNombres ?? null,
      respuestas: payload.answers ?? null,
    });
  } catch (e) {
    if (e instanceof HttpError) {
      return errorResponse(req, e.message, e.status);
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("get-resultados-autoconocimiento error:", msg);
    return errorResponse(req, msg, 500);
  }
});
