// SOPHIA Portal · marcar-leccion (inlined for dashboard deploy)
// Marks a lesson as completed for the authenticated user. Idempotent:
// preserves the original completion timestamp on repeat calls.
//
// POST /marcar-leccion
// Body: { leccionId: string, inscripcionId: string, videoPctCompletado?: number }
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
  PROGRESO_LECCIONES: "tbllSrA7i4RxR6rqD",
  PERSONAS: "tbl5XKtg0mRfLeFYH",
  PERSONAS_PORTAL: "tblwo4xOFhmx2TznJ",
} as const;

const FIELDS = {
  INSCRIPCIONES: {
    PERSONA: "fldsgcanUDaXzX20x",
  },
  PROGRESO_LECCIONES: {
    INSCRIPCION: "fld5osGXDLBrvgW63",
    LECCION: "fldftZaLhQcHyKrBo",
    COMPLETADO: "fldtGaRMNd69jcK3D",
    COMPLETADO_EN: "fldEImFE2Osckh2wZ",
    VIDEO_PCT_COMPLETADO: "fldAF7BPLaPsFXi5j",
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

  // Lookup adicional: la tabla synced de Personas en Portal (tblwo4xOFhmx2TznJ).
  // Inscripciones.persona linkea a ESTA tabla, no a CRM, así que necesitamos
  // su record ID (distinto al de CRM) para filtrar Inscripciones.
  const personasPortal = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
    filterByFormula: eqFormula(FIELDS.PERSONAS_PORTAL.AUTH_USER_ID, authUserId),
    maxRecords: 1,
  });
  let personaPortalId = personasPortal[0]?.id;
  if (!personaPortalId) {
    // Fallback: buscar por email (la sync de CRM→Portal puede tardar)
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

  if (req.method !== "POST") {
    return errorResponse(req, "Method not allowed", 405);
  }

  try {
    const user = await requireAuth(req);

    let body: {
      leccionId?: string;
      inscripcionId?: string;
      videoPctCompletado?: number;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(req, "Invalid JSON body", 400);
    }

    const { leccionId, inscripcionId, videoPctCompletado } = body;
    if (!leccionId || !inscripcionId) {
      return errorResponse(req, "leccionId and inscripcionId are required", 400);
    }

    // 1. Validate that the Inscripción belongs to this user.
    // RECORD_ID() filter works, but persona check has to be client-side.
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

    // 2. Find existing progreso record (filter client-side: Airtable can't
    // match record IDs in linked-record fields via filterByFormula).
    const allProgresos = await listRecords(BASES.PORTAL, TABLES.PROGRESO_LECCIONES, {
      fields: [
        FIELDS.PROGRESO_LECCIONES.INSCRIPCION,
        FIELDS.PROGRESO_LECCIONES.LECCION,
        FIELDS.PROGRESO_LECCIONES.COMPLETADO,
        FIELDS.PROGRESO_LECCIONES.COMPLETADO_EN,
      ],
    });
    const existing = allProgresos.filter((p) => {
      const ins = (p.fields[FIELDS.PROGRESO_LECCIONES.INSCRIPCION] as string[]) ?? [];
      const lec = (p.fields[FIELDS.PROGRESO_LECCIONES.LECCION] as string[]) ?? [];
      return ins.includes(inscripcionId) && lec.includes(leccionId);
    });

    const nowISO = new Date().toISOString();
    const baseFields: Record<string, unknown> = {
      [FIELDS.PROGRESO_LECCIONES.COMPLETADO]: true,
      [FIELDS.PROGRESO_LECCIONES.COMPLETADO_EN]: nowISO,
    };
    if (typeof videoPctCompletado === "number") {
      baseFields[FIELDS.PROGRESO_LECCIONES.VIDEO_PCT_COMPLETADO] = videoPctCompletado;
    }

    if (existing.length > 0) {
      const rec = existing[0];
      // Idempotent: preserve original completion timestamp
      if (rec.fields[FIELDS.PROGRESO_LECCIONES.COMPLETADO]) {
        return jsonResponse(req, {
          ok: true,
          progresoId: rec.id,
          completada: true,
          completadaEn:
            (rec.fields[FIELDS.PROGRESO_LECCIONES.COMPLETADO_EN] as string) ?? null,
          alreadyDone: true,
        });
      }
      await updateRecord(BASES.PORTAL, TABLES.PROGRESO_LECCIONES, rec.id, baseFields);
      return jsonResponse(req, {
        ok: true,
        progresoId: rec.id,
        completada: true,
        completadaEn: nowISO,
      });
    }

    const created = await createRecord(BASES.PORTAL, TABLES.PROGRESO_LECCIONES, {
      [FIELDS.PROGRESO_LECCIONES.INSCRIPCION]: [inscripcionId],
      [FIELDS.PROGRESO_LECCIONES.LECCION]: [leccionId],
      ...baseFields,
    });
    return jsonResponse(req, {
      ok: true,
      progresoId: created.id,
      completada: true,
      completadaEn: nowISO,
    });
  } catch (e) {
    if (e instanceof HttpError) {
      return errorResponse(req, e.message, e.status);
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("marcar-leccion error:", msg);
    return errorResponse(req, msg, 500);
  }
});
