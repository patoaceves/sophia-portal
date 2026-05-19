// SOPHIA Portal · submit-autoeval (inlined for dashboard deploy)
//
// Edge function GENÉRICA para las 8 autoevaluaciones del modelo SOPHIA.
// Reemplaza a submit-test-autoconocimiento (que era de un solo pilar).
//
// Recibe las 8 respuestas Likert (1-5) de UNA autoevaluación. Las 8 preguntas
// corresponden a los 8 niveles de integración del modelo SOPHIA:
//   adecuadamente, disfrute, emociones_pos, compromiso, logro, satisfaccion,
//   sentido, trascendencia
//
// Calcula (mismo modelo para los 8 pilares):
//   - total: suma (rango 8-40)
//   - pct:   ((total-8)/32)*100  (rango 0-100)
//   - banda: Fortaleza Actual / Zona de Crecimiento / Área de Atención / Área Vulnerable
//
// NO guarda texto: el contenido (preguntas, textos de banda, color) vive en
// el front-end (assets/js/autoeval-defs.js). El payload guardado lleva
// `autoevalKey` como discriminador del pilar.
//
// POST /submit-autoeval
// Body: { inscripcionId: string, autoevalKey: string,
//         respuestas: { adecuadamente..trascendencia: 1..5 } }
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

// Record IDs en la tabla `Autoevaluaciones` (base Portal). Si un pilar tiene
// un registro creado, se enlaza en RespuestasAutoeval para reportería; si no,
// se omite el enlace (el `autoevalKey` del payload basta como discriminador).
// Conforme se creen los registros de los otros 7 pilares, agrégalos aquí.
const KNOWN_AUTOEVAL_RECORDS: Record<string, string> = {
  autoconocimiento: "recDLCMOgTZChS6Yf",
};

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
// MODELO · 8 niveles de integración SOPHIA (compartido por los 8 pilares)
// ============================================================================

// IDs de pregunta válidos. Deben coincidir con NIVELES de autoeval-defs.js.
const NIVELES = [
  "adecuadamente",
  "disfrute",
  "emociones_pos",
  "compromiso",
  "logro",
  "satisfaccion",
  "sentido",
  "trascendencia",
] as const;

// Claves de pilar válidas. Deben coincidir con AUTOEVALS de autoeval-defs.js.
const AUTOEVAL_KEYS = [
  "autoconocimiento",
  "bienestar_emocional",
  "bienestar_fisico",
  "presencia_consciente",
  "trabajo_proposito",
  "vinculos_vitales",
  "estetica_existencial",
  "fe_filosofia",
] as const;

// Banda a partir de la suma total (8-40). Mismo criterio para los 8 pilares.
function bandaForTotal(total: number): string {
  if (total >= 31) return "Fortaleza Actual";
  if (total >= 21) return "Zona de Crecimiento";
  if (total >= 11) return "Área de Atención";
  return "Área Vulnerable";
}

function pctFromTotal(total: number): number {
  return Math.max(0, Math.min(100, Math.round(((total - 8) / 32) * 100)));
}

function validateAnswers(
  respuestas: Record<string, unknown>,
): { ok: true } | { ok: false; error: string } {
  for (const id of NIVELES) {
    const v = respuestas[id];
    if (typeof v !== "number" || v < 1 || v > 5 || !Number.isInteger(v)) {
      return { ok: false, error: `Respuesta inválida o faltante: ${id}` };
    }
  }
  return { ok: true };
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
      inscripcionId?: string;
      autoevalKey?: string;
      respuestas?: Record<string, number>;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(req, "Invalid JSON body", 400);
    }

    const { inscripcionId, autoevalKey, respuestas } = body;
    if (!inscripcionId) return errorResponse(req, "inscripcionId is required", 400);
    if (!autoevalKey) return errorResponse(req, "autoevalKey is required", 400);
    if (!respuestas) return errorResponse(req, "respuestas is required", 400);

    if (!(AUTOEVAL_KEYS as readonly string[]).includes(autoevalKey)) {
      return errorResponse(req, `autoevalKey inválido: ${autoevalKey}`, 400);
    }

    const valid = validateAnswers(respuestas);
    if (!valid.ok) return errorResponse(req, valid.error, 400);

    // Validate ownership of the Inscripción
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

    // Compute total, pct, banda
    const total = NIVELES.reduce((s, id) => s + (respuestas[id] ?? 0), 0);
    const pct = pctFromTotal(total);
    const banda = bandaForTotal(total);
    const completedAt = new Date().toISOString();

    // Payload: solo números + discriminador. El texto vive en el front.
    const payload = {
      version: 2,
      autoevalKey,
      answers: respuestas,
      total,
      pct,
      banda,
      completedAt,
    };

    const recordFields: Record<string, unknown> = {
      [FIELDS.RESPUESTAS_AUTOEVAL.INSCRIPCION]: [inscripcionId],
      [FIELDS.RESPUESTAS_AUTOEVAL.FECHA_ENTREGA]: completedAt,
      [FIELDS.RESPUESTAS_AUTOEVAL.RESPUESTAS_JSON]: JSON.stringify(payload),
    };
    // Enlaza el registro de Autoevaluación si el pilar tiene uno creado.
    const autoevalRecordId = KNOWN_AUTOEVAL_RECORDS[autoevalKey];
    if (autoevalRecordId) {
      recordFields[FIELDS.RESPUESTAS_AUTOEVAL.AUTOEVALUACION] = [autoevalRecordId];
    }

    const rec = await createRecord(
      BASES.PORTAL,
      TABLES.RESPUESTAS_AUTOEVAL,
      recordFields,
    );

    return jsonResponse(req, {
      respuestaId: rec.id,
      autoevalKey,
      total,
      pct,
      banda,
      completedAt,
    });
  } catch (e) {
    if (e instanceof HttpError) {
      return errorResponse(req, e.message, e.status);
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("submit-autoeval error:", msg);
    return errorResponse(req, msg, 500);
  }
});
