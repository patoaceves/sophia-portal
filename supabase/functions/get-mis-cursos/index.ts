// SOPHIA Portal — get-mis-cursos (inlined for dashboard deploy)
// Returns the list of courses the authenticated user is enrolled in,
// with computed progress %.
//
// GET /get-mis-cursos
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
  CURSOS: "tblJpUGeBsLNkk9UO",
  CAPITULOS: "tblFHDXmg47igVihD",
  INSCRIPCIONES: "tblIT40GILMUHhLKK",
  PROGRESO_LECCIONES: "tbllSrA7i4RxR6rqD",
  PERSONAS: "tbl5XKtg0mRfLeFYH",
  PERSONAS_PORTAL: "tblwo4xOFhmx2TznJ",
} as const;

const FIELDS = {
  CURSOS: {
    TITULO: "fldrskH4P70JPikaS",
    SLUG: "fldnbvTXzNFOGxOYs",
    DESCRIPCION_CORTA: "fldUyd2c5OJjRjPz0",
    COVER_IMAGE: "fld6kHgjdRxGfswko",
    INSTRUCTOR: "fldja8z8xNZCz7gd6",
    COLOR_PRIMARIO: "fldF45BjJoMU90jUP",
    MODALIDAD: "fldwRC5bsmiwqsUlP",
    FECHA_INICIO: "fldENsivuaLfgVUXW",
    FECHA_FIN: "fldXjIbSIno6D2XD1",
    ESTATUS: "fld6yNo5RZiHHWO8X",
    CAPITULOS: "fldAkJ8rPjrZr2llL",
  },
  CAPITULOS: {
    CURSO: "fldYXfwCaNILYPhkV",
    LECCIONES: "fld6zL7apr0D82dgJ",
  },
  INSCRIPCIONES: {
    PERSONA: "fldsgcanUDaXzX20x",
    CURSO: "fldTjcS2GiOe3Q9N0",
    ESTATUS: "flduEWS1l327elsD6",
    FECHA_INSCRIPCION: "fldrfWGCdo6KZZhQz",
    PROGRESO_LECCIONES: "fldhghcOlF7dSZzFn",
    PROGRESO_PCT: "fldLoqPH7FVUgBm4T",
  },
  PROGRESO_LECCIONES: {
    INSCRIPCION: "fld5osGXDLBrvgW63",
    COMPLETADO: "fldtGaRMNd69jcK3D",
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

    // 1. Get all Inscripciones, then filter in JS by personaPortalId.
    // (Airtable filterByFormula on linked-record fields can't match record IDs;
    // ARRAYJOIN returns primary field values, not IDs.)
    const allInscripciones = await listRecords(BASES.PORTAL, TABLES.INSCRIPCIONES, {
      fields: [
        FIELDS.INSCRIPCIONES.PERSONA,
        FIELDS.INSCRIPCIONES.CURSO,
        FIELDS.INSCRIPCIONES.ESTATUS,
        FIELDS.INSCRIPCIONES.FECHA_INSCRIPCION,
        FIELDS.INSCRIPCIONES.PROGRESO_LECCIONES,
        FIELDS.INSCRIPCIONES.PROGRESO_PCT,
      ],
    });
    const inscripciones = allInscripciones.filter((ins) => {
      const ps = (ins.fields[FIELDS.INSCRIPCIONES.PERSONA] as string[]) ?? [];
      return ps.includes(user.personaPortalId);
    });

    if (inscripciones.length === 0) {
      return jsonResponse(req, { cursos: [] });
    }

    // Collect unique Curso IDs
    const cursoIds = new Set<string>();
    for (const ins of inscripciones) {
      const cursos = (ins.fields[FIELDS.INSCRIPCIONES.CURSO] as string[]) ?? [];
      cursos.forEach((id) => cursoIds.add(id));
    }

    // 2. Fetch Cursos
    const allCursos = await listRecords(BASES.PORTAL, TABLES.CURSOS, {
      fields: [
        FIELDS.CURSOS.TITULO,
        FIELDS.CURSOS.SLUG,
        FIELDS.CURSOS.DESCRIPCION_CORTA,
        FIELDS.CURSOS.COVER_IMAGE,
        FIELDS.CURSOS.INSTRUCTOR,
        FIELDS.CURSOS.COLOR_PRIMARIO,
        FIELDS.CURSOS.MODALIDAD,
        FIELDS.CURSOS.FECHA_INICIO,
        FIELDS.CURSOS.FECHA_FIN,
        FIELDS.CURSOS.ESTATUS,
        FIELDS.CURSOS.CAPITULOS,
      ],
    });
    const cursosById = new Map<string, AirtableRecord>();
    for (const c of allCursos) {
      if (cursoIds.has(c.id)) cursosById.set(c.id, c);
    }

    // 3. Count total Lecciones per Curso (via Capítulos)
    const allCapitulos = await listRecords(BASES.PORTAL, TABLES.CAPITULOS, {
      fields: [FIELDS.CAPITULOS.CURSO, FIELDS.CAPITULOS.LECCIONES],
    });
    const leccionesCountPorCurso = new Map<string, number>();
    for (const cap of allCapitulos) {
      const cursoLinks = (cap.fields[FIELDS.CAPITULOS.CURSO] as string[]) ?? [];
      const lecciones = (cap.fields[FIELDS.CAPITULOS.LECCIONES] as string[]) ?? [];
      for (const cursoId of cursoLinks) {
        if (!cursoIds.has(cursoId)) continue;
        leccionesCountPorCurso.set(
          cursoId,
          (leccionesCountPorCurso.get(cursoId) ?? 0) + lecciones.length,
        );
      }
    }

    // 4. Count completed lessons per Inscripción (filter client-side: Airtable
    // can't match record IDs in linked-record fields via filterByFormula).
    // The boolean COMPLETADO check works fine in Airtable, but we still need
    // to filter by inscripcion in JS.
    const inscripcionIds = new Set(inscripciones.map((i) => i.id));
    const allProgresos = await listRecords(BASES.PORTAL, TABLES.PROGRESO_LECCIONES, {
      filterByFormula: `{${FIELDS.PROGRESO_LECCIONES.COMPLETADO}}`,
      fields: [
        FIELDS.PROGRESO_LECCIONES.INSCRIPCION,
        FIELDS.PROGRESO_LECCIONES.COMPLETADO,
      ],
    });
    const progresos = allProgresos.filter((p) => {
      const ins = (p.fields[FIELDS.PROGRESO_LECCIONES.INSCRIPCION] as string[]) ?? [];
      return ins.some((id) => inscripcionIds.has(id));
    });

    const completadasPorInscripcion = new Map<string, number>();
    for (const p of progresos) {
      const insLinks = (p.fields[FIELDS.PROGRESO_LECCIONES.INSCRIPCION] as string[]) ?? [];
      for (const insId of insLinks) {
        completadasPorInscripcion.set(insId, (completadasPorInscripcion.get(insId) ?? 0) + 1);
      }
    }

    // 5. Assemble response
    const cursos = inscripciones
      .map((ins) => {
        const cursoLinks = (ins.fields[FIELDS.INSCRIPCIONES.CURSO] as string[]) ?? [];
        const cursoId = cursoLinks[0];
        if (!cursoId) return null;
        const c = cursosById.get(cursoId);
        if (!c) return null;

        const totalLecciones = leccionesCountPorCurso.get(cursoId) ?? 0;
        const completadas = completadasPorInscripcion.get(ins.id) ?? 0;
        const progresoPct = totalLecciones > 0
          ? Math.round((completadas / totalLecciones) * 100)
          : 0;

        const coverAttachments = c.fields[FIELDS.CURSOS.COVER_IMAGE] as
          | { url: string }[]
          | undefined;
        const coverUrl = coverAttachments?.[0]?.url ?? null;

        return {
          id: cursoId,
          inscripcionId: ins.id,
          slug: c.fields[FIELDS.CURSOS.SLUG] ?? "",
          titulo: c.fields[FIELDS.CURSOS.TITULO] ?? "",
          descripcionCorta: c.fields[FIELDS.CURSOS.DESCRIPCION_CORTA] ?? "",
          coverUrl,
          instructor: c.fields[FIELDS.CURSOS.INSTRUCTOR] ?? "",
          colorPrimario: c.fields[FIELDS.CURSOS.COLOR_PRIMARIO] ?? "",
          modalidad: c.fields[FIELDS.CURSOS.MODALIDAD] ?? "",
          fechaInicio: c.fields[FIELDS.CURSOS.FECHA_INICIO] ?? null,
          fechaFin: c.fields[FIELDS.CURSOS.FECHA_FIN] ?? null,
          estatus: c.fields[FIELDS.CURSOS.ESTATUS] ?? "",
          inscripcionEstatus: ins.fields[FIELDS.INSCRIPCIONES.ESTATUS] ?? "",
          fechaInscripcion: ins.fields[FIELDS.INSCRIPCIONES.FECHA_INSCRIPCION] ?? null,
          progresoPct,
          totalLecciones,
          leccionesCompletadas: completadas,
        };
      })
      .filter((x) => x !== null);

    return jsonResponse(req, { cursos });
  } catch (e) {
    if (e instanceof HttpError) {
      return errorResponse(req, e.message, e.status);
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("get-mis-cursos error:", msg);
    return errorResponse(req, msg, 500);
  }
});
