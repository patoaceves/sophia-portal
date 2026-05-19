// SOPHIA Portal · get-resultados-autoeval (inlined for dashboard deploy)
//
// Edge function GENÉRICA para leer resultados de las 8 autoevaluaciones.
// Reemplaza a get-resultados-autoconocimiento.
//
// GET /get-resultados-autoeval?autoeval=<key>[&id=<respuestaId>]
//   - sin `id`  → último intento del usuario para ese pilar
//   - con `id`  → intento específico
//
// Devuelve solo números (total, pct, banda). El texto de banda lo resuelve
// el front desde autoeval-defs.js. Para registros legacy de Autoconocimiento
// (version 1, con lead/steps embebidos) esos campos se devuelven tal cual
// para no romper resultados ya guardados.

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

// Pilares con registro de Autoevaluación creado (para reconocer datos legacy).
const KNOWN_AUTOEVAL_RECORDS: Record<string, string> = {
  autoconocimiento: "recDLCMOgTZChS6Yf",
};

const AUTOEVAL_KEYS = [
  "autoconocimiento",
  "bienestar_emocional",
  "bienestar_fisico",
  "presencia_consciente",
  "trabajo_proposito",
  "vinculos_vitales",
  "estetica_existencial",
  "fe_filosofia",
];

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
// HELPERS · matching de respuesta ↔ pilar
// ============================================================================

interface AutoevalPayload {
  version?: number;
  autoevalKey?: string;
  tipo?: string;
  answers?: Record<string, number>;
  total?: number;
  pct?: number;
  banda?: string;
  lead?: string;
  steps?: string[];
  note?: string;
  completedAt?: string;
}

function parsePayload(rec: AirtableRecord): AutoevalPayload | null {
  const raw = rec.fields[FIELDS.RESPUESTAS_AUTOEVAL.RESPUESTAS_JSON];
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as AutoevalPayload;
  } catch {
    return null;
  }
}

// ¿La respuesta corresponde al pilar pedido?
// - v2: payload.autoevalKey === autoevalKey
// - legacy (autoconocimiento v1): payload.tipo === "autoconocimiento" o el
//   enlace AUTOEVALUACION apunta al record conocido de ese pilar.
function matchesAutoeval(
  rec: AirtableRecord,
  payload: AutoevalPayload | null,
  autoevalKey: string,
): boolean {
  if (payload?.autoevalKey === autoevalKey) return true;
  if (payload?.tipo && payload.tipo === autoevalKey) return true;
  const knownRecord = KNOWN_AUTOEVAL_RECORDS[autoevalKey];
  if (knownRecord) {
    const autoLinks =
      (rec.fields[FIELDS.RESPUESTAS_AUTOEVAL.AUTOEVALUACION] as string[]) ?? [];
    // Solo cuenta como match legacy si el payload NO declara otro pilar.
    if (autoLinks.includes(knownRecord) && !payload?.autoevalKey) return true;
  }
  return false;
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
    const autoevalKey = (url.searchParams.get("autoeval") ?? "").trim();
    const respuestaId =
      url.searchParams.get("id") ?? url.searchParams.get("inscripcion") ?? "";

    if (!autoevalKey) {
      return errorResponse(req, "autoeval (key) is required", 400);
    }
    if (!AUTOEVAL_KEYS.includes(autoevalKey)) {
      return errorResponse(req, `autoeval inválido: ${autoevalKey}`, 400);
    }

    let rec: AirtableRecord | null = null;

    if (respuestaId) {
      rec = await getRecord(BASES.PORTAL, TABLES.RESPUESTAS_AUTOEVAL, respuestaId);
      if (!rec) throw new HttpError(404, "Respuesta not found");
    } else {
      // Último intento de este pilar para este usuario.
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
        if (!inscLinks.some((id) => myInscripcionIds.has(id))) return false;
        return matchesAutoeval(r, parsePayload(r), autoevalKey);
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

    const payload = parsePayload(rec);
    if (!payload) {
      throw new HttpError(500, "Respuesta sin payload válido");
    }

    // Si se pidió por id, validar que la respuesta sí es del pilar indicado.
    if (respuestaId && !matchesAutoeval(rec, payload, autoevalKey)) {
      throw new HttpError(404, "La respuesta no corresponde a esa autoevaluación");
    }

    return jsonResponse(req, {
      tieneResultados: true,
      respuestaId: rec.id,
      autoevalKey,
      total: payload.total ?? null,
      pct: payload.pct ?? null,
      banda: payload.banda ?? null,
      // Campos legacy (v1): se devuelven si existen; en v2 el front los resuelve.
      lead: payload.lead ?? null,
      steps: payload.steps ?? null,
      note: payload.note ?? null,
      completedAt:
        payload.completedAt ??
        (rec.fields[FIELDS.RESPUESTAS_AUTOEVAL.FECHA_ENTREGA] as string) ??
        null,
    });
  } catch (e) {
    if (e instanceof HttpError) {
      return errorResponse(req, e.message, e.status);
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("get-resultados-autoeval error:", msg);
    return errorResponse(req, msg, 500);
  }
});
