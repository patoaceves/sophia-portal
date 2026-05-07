// SOPHIA Portal — get-leccion (inlined for dashboard deploy)
// Returns full lesson content + prev/next IDs within the same chapter.
// Validates that the user is enrolled in the parent course.
//
// GET /get-leccion?id=<leccionRecordId>
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
  CAPITULOS: "tblFHDXmg47igVihD",
  LECCIONES: "tblBjfch6rc5ey7nn",
  INSCRIPCIONES: "tblIT40GILMUHhLKK",
  PROGRESO_LECCIONES: "tbllSrA7i4RxR6rqD",
  PERSONAS: "tbl5XKtg0mRfLeFYH",
  PERSONAS_PORTAL: "tblwo4xOFhmx2TznJ",
} as const;

const FIELDS = {
  CAPITULOS: {
    CURSO: "fldYXfwCaNILYPhkV",
    LECCIONES: "fld6zL7apr0D82dgJ",
  },
  LECCIONES: {
    TITULO: "fldMtiOdTsLzqa7Zc",
    CAPITULO: "fld1olLdvNSup3YMc",
    ORDEN: "fldCbdktDhca3mwJs",
    TIPO: "fldALQfCvsjblaV2f",
    ETIQUETA: "fld9ooqaUifHmUaG5",
    CONTENIDO_HTML: "fldcvY2ABPzRp7pVS",
    URL_VIDEO: "flddWqscYL9rkANQu",
    URL_EXTERNA: "fldPfVk0nKaVV8Yik",
    ARCHIVO: "fldsFIihdWWiUntYx",
    AUTOEVAL: "fldYjgZCQLAFUCW1u",
  },
  INSCRIPCIONES: {
    PERSONA: "fldsgcanUDaXzX20x",
    CURSO: "fldTjcS2GiOe3Q9N0",
  },
  PROGRESO_LECCIONES: {
    INSCRIPCION: "fld5osGXDLBrvgW63",
    LECCION: "fldftZaLhQcHyKrBo",
    COMPLETADO: "fldtGaRMNd69jcK3D",
    COMPLETADO_EN: "fldEImFE2Osckh2wZ",
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

  if (req.method !== "GET") {
    return errorResponse(req, "Method not allowed", 405);
  }

  try {
    const user = await requireAuth(req);

    const url = new URL(req.url);
    const leccionId = url.searchParams.get("id");
    if (!leccionId) return errorResponse(req, "Missing id parameter", 400);

    // 1. Fetch the lesson
    const leccion = await getRecord(BASES.PORTAL, TABLES.LECCIONES, leccionId);
    if (!leccion) throw new HttpError(404, "Lección not found");
    const lf = leccion.fields;

    // 2. Walk up: leccion -> capitulo
    const capituloLinks = (lf[FIELDS.LECCIONES.CAPITULO] as string[]) ?? [];
    const capituloId = capituloLinks[0];
    if (!capituloId) throw new HttpError(422, "Lección has no capítulo");

    const capitulo = await getRecord(BASES.PORTAL, TABLES.CAPITULOS, capituloId);
    if (!capitulo) throw new HttpError(404, "Capítulo not found");
    const cf = capitulo.fields;

    // 3. Walk up: capitulo -> curso
    const cursoLinks = (cf[FIELDS.CAPITULOS.CURSO] as string[]) ?? [];
    const cursoId = cursoLinks[0];
    if (!cursoId) throw new HttpError(422, "Capítulo has no curso");

    // 4. Validate enrollment (filter client-side: Airtable can't match record
    // IDs in linked-record fields via filterByFormula).
    const allInscripciones = await listRecords(BASES.PORTAL, TABLES.INSCRIPCIONES, {});
    const inscripciones = allInscripciones.filter((ins) => {
      const ps = (ins.fields[FIELDS.INSCRIPCIONES.PERSONA] as string[]) ?? [];
      const cs = (ins.fields[FIELDS.INSCRIPCIONES.CURSO] as string[]) ?? [];
      return ps.includes(user.personaPortalId) && cs.includes(cursoId);
    });
    if (inscripciones.length === 0) {
      throw new HttpError(403, "Not enrolled in this course");
    }
    const inscripcionId = inscripciones[0].id;

    // 5. Sibling lessons (same chapter) for prev/next
    const siblingIds = (cf[FIELDS.CAPITULOS.LECCIONES] as string[]) ?? [];
    const sibRows = siblingIds.length
      ? await listRecords(BASES.PORTAL, TABLES.LECCIONES, {
          filterByFormula: `OR(${siblingIds.map((id) => `RECORD_ID()='${id}'`).join(",")})`,
          fields: [FIELDS.LECCIONES.ORDEN],
        })
      : [];
    sibRows.sort((a, b) => {
      const oa = (a.fields[FIELDS.LECCIONES.ORDEN] as number) ?? 0;
      const ob = (b.fields[FIELDS.LECCIONES.ORDEN] as number) ?? 0;
      return oa - ob;
    });
    const idxHere = sibRows.findIndex((r) => r.id === leccionId);
    const prevId = idxHere > 0 ? sibRows[idxHere - 1].id : null;
    const nextId =
      idxHere >= 0 && idxHere < sibRows.length - 1 ? sibRows[idxHere + 1].id : null;

    // 6. Progreso for this lesson (filter client-side: Airtable can't match
    // record IDs in linked-record fields via filterByFormula).
    const allProgresos = await listRecords(BASES.PORTAL, TABLES.PROGRESO_LECCIONES, {
      fields: [
        FIELDS.PROGRESO_LECCIONES.INSCRIPCION,
        FIELDS.PROGRESO_LECCIONES.LECCION,
        FIELDS.PROGRESO_LECCIONES.COMPLETADO,
        FIELDS.PROGRESO_LECCIONES.COMPLETADO_EN,
      ],
    });
    const progresos = allProgresos.filter((p) => {
      const ins = (p.fields[FIELDS.PROGRESO_LECCIONES.INSCRIPCION] as string[]) ?? [];
      const lec = (p.fields[FIELDS.PROGRESO_LECCIONES.LECCION] as string[]) ?? [];
      return ins.includes(inscripcionId) && lec.includes(leccionId);
    });
    const completada = progresos[0]
      ? Boolean(progresos[0].fields[FIELDS.PROGRESO_LECCIONES.COMPLETADO])
      : false;
    const completadaEn = progresos[0]
      ? ((progresos[0].fields[FIELDS.PROGRESO_LECCIONES.COMPLETADO_EN] as string) ??
        null)
      : null;

    // 7. Attachments / autoeval link
    const arr = lf[FIELDS.LECCIONES.ARCHIVO] as
      | { url: string; filename?: string }[]
      | undefined;
    const archivoUrl = arr?.[0]?.url ?? null;
    const archivoNombre = arr?.[0]?.filename ?? null;

    const autoevalLinks = (lf[FIELDS.LECCIONES.AUTOEVAL] as string[]) ?? [];
    const autoevalId = autoevalLinks[0] ?? null;

    return jsonResponse(req, {
      leccion: {
        id: leccion.id,
        titulo: (lf[FIELDS.LECCIONES.TITULO] as string) ?? "",
        orden: (lf[FIELDS.LECCIONES.ORDEN] as number) ?? 0,
        tipo: (lf[FIELDS.LECCIONES.TIPO] as string) ?? "texto",
        etiqueta: (lf[FIELDS.LECCIONES.ETIQUETA] as string) ?? "",
        contenidoHTML: (lf[FIELDS.LECCIONES.CONTENIDO_HTML] as string) ?? "",
        urlVideo: (lf[FIELDS.LECCIONES.URL_VIDEO] as string) ?? null,
        urlExterna: (lf[FIELDS.LECCIONES.URL_EXTERNA] as string) ?? null,
        archivoUrl,
        archivoNombre,
        autoevalId,
        completada,
        completadaEn,
      },
      capituloId,
      cursoId,
      inscripcionId,
      prevId,
      nextId,
    });
  } catch (e) {
    if (e instanceof HttpError) {
      return errorResponse(req, e.message, e.status);
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("get-leccion error:", msg);
    return errorResponse(req, msg, 500);
  }
});
