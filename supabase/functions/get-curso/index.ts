// SOPHIA Portal · get-curso (inlined for dashboard deploy)
// Returns full course detail (by slug) including chapters, lessons,
// the user's enrollment, and per-lesson completion state.
//
// GET /get-curso?slug=happiness-workshop
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
  LECCIONES: "tblBjfch6rc5ey7nn",
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
    DESCRIPCION_LARGA: "fldxvb0leR5o2MaH1",
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
    TITULO: "fldyuVY3I4StxA5Fe",
    CURSO: "fldYXfwCaNILYPhkV",
    ORDEN: "fldRzPBGYxP7lkiaZ",
    DESCRIPCION: "fldw8UGWMUY5FHv0s",
    LECCIONES: "fld6zL7apr0D82dgJ",
    PONENTE: "flduzlxs03hIYGhXi",
  },
  LECCIONES: {
    TITULO: "fldMtiOdTsLzqa7Zc",
    ORDEN: "fldCbdktDhca3mwJs",
    TIPO: "fldALQfCvsjblaV2f",
    ETIQUETA: "fld9ooqaUifHmUaG5",
  },
  INSCRIPCIONES: {
    PERSONA: "fldsgcanUDaXzX20x",
    CURSO: "fldTjcS2GiOe3Q9N0",
    ESTATUS: "flduEWS1l327elsD6",
    FECHA_INSCRIPCION: "fldrfWGCdo6KZZhQz",
    PROGRESO_PCT: "fldLoqPH7FVUgBm4T",
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
    const slug = url.searchParams.get("slug");
    if (!slug) return errorResponse(req, "Missing slug parameter", 400);

    // 1. Fetch curso by slug
    const cursos = await listRecords(BASES.PORTAL, TABLES.CURSOS, {
      filterByFormula: eqFormula(FIELDS.CURSOS.SLUG, slug),
      maxRecords: 1,
    });
    if (cursos.length === 0) {
      throw new HttpError(404, `Curso not found: ${slug}`);
    }
    const curso = cursos[0];

    // 2. Validate that user is enrolled (filter client-side: Airtable can't
    // match record IDs in linked-record fields via filterByFormula).
    const allInscripciones = await listRecords(BASES.PORTAL, TABLES.INSCRIPCIONES, {});
    const inscripciones = allInscripciones.filter((ins) => {
      const ps = (ins.fields[FIELDS.INSCRIPCIONES.PERSONA] as string[]) ?? [];
      const cs = (ins.fields[FIELDS.INSCRIPCIONES.CURSO] as string[]) ?? [];
      return ps.includes(user.personaPortalId) && cs.includes(curso.id);
    });
    if (inscripciones.length === 0) {
      throw new HttpError(403, "Not enrolled in this course");
    }
    const inscripcion = inscripciones[0];

    // 3. Capítulos for this course
    const capituloIds = (curso.fields[FIELDS.CURSOS.CAPITULOS] as string[]) ?? [];
    const capitulos = capituloIds.length
      ? await listRecords(BASES.PORTAL, TABLES.CAPITULOS, {
          filterByFormula: `OR(${capituloIds.map((id) => `RECORD_ID()='${id}'`).join(",")})`,
        })
      : [];
    capitulos.sort((a, b) => {
      const oa = (a.fields[FIELDS.CAPITULOS.ORDEN] as number) ?? 0;
      const ob = (b.fields[FIELDS.CAPITULOS.ORDEN] as number) ?? 0;
      return oa - ob;
    });

    // 4. Lecciones for all chapters (one batched query)
    const allLeccionIds: string[] = [];
    for (const c of capitulos) {
      const ids = (c.fields[FIELDS.CAPITULOS.LECCIONES] as string[]) ?? [];
      ids.forEach((id) => allLeccionIds.push(id));
    }
    const lecciones = allLeccionIds.length
      ? await listRecords(BASES.PORTAL, TABLES.LECCIONES, {
          filterByFormula: `OR(${allLeccionIds.map((id) => `RECORD_ID()='${id}'`).join(",")})`,
          fields: [
            FIELDS.LECCIONES.TITULO,
            FIELDS.LECCIONES.ORDEN,
            FIELDS.LECCIONES.TIPO,
            FIELDS.LECCIONES.ETIQUETA,
          ],
        })
      : [];
    const leccionById = new Map(lecciones.map((l) => [l.id, l]));

    // 5. Progreso for this inscripción (filter client-side: Airtable can't
    // match record IDs in linked-record fields via filterByFormula).
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
      return ins.includes(inscripcion.id);
    });
    const progresoByLeccion = new Map<
      string,
      { completada: boolean; completadaEn: string | null }
    >();
    for (const p of progresos) {
      const links = (p.fields[FIELDS.PROGRESO_LECCIONES.LECCION] as string[]) ?? [];
      const id = links[0];
      if (!id) continue;
      progresoByLeccion.set(id, {
        completada: Boolean(p.fields[FIELDS.PROGRESO_LECCIONES.COMPLETADO]),
        completadaEn:
          (p.fields[FIELDS.PROGRESO_LECCIONES.COMPLETADO_EN] as string) ?? null,
      });
    }

    // 6. Build response
    const capitulosOut = capitulos.map((c) => {
      const leccLinks = (c.fields[FIELDS.CAPITULOS.LECCIONES] as string[]) ?? [];
      const leccionesOut = leccLinks
        .map((id) => leccionById.get(id))
        .filter((l): l is AirtableRecord => Boolean(l))
        .map((l) => {
          const prog = progresoByLeccion.get(l.id);
          return {
            id: l.id,
            titulo: (l.fields[FIELDS.LECCIONES.TITULO] as string) ?? "",
            orden: (l.fields[FIELDS.LECCIONES.ORDEN] as number) ?? 0,
            tipo: (l.fields[FIELDS.LECCIONES.TIPO] as string) ?? "texto",
            etiqueta: (l.fields[FIELDS.LECCIONES.ETIQUETA] as string) ?? "",
            completada: prog?.completada ?? false,
            completadaEn: prog?.completadaEn ?? null,
          };
        })
        .sort((a, b) => a.orden - b.orden);

      return {
        id: c.id,
        titulo: (c.fields[FIELDS.CAPITULOS.TITULO] as string) ?? "",
        orden: (c.fields[FIELDS.CAPITULOS.ORDEN] as number) ?? 0,
        descripcion: (c.fields[FIELDS.CAPITULOS.DESCRIPCION] as string) ?? "",
        ponente: (c.fields[FIELDS.CAPITULOS.PONENTE] as string) ?? "",
        lecciones: leccionesOut,
      };
    });

    const cf = curso.fields;
    const coverAttachments = cf[FIELDS.CURSOS.COVER_IMAGE] as
      | { url: string }[]
      | undefined;
    const coverUrl = coverAttachments?.[0]?.url ?? null;

    return jsonResponse(req, {
      curso: {
        id: curso.id,
        slug: (cf[FIELDS.CURSOS.SLUG] as string) ?? slug,
        titulo: (cf[FIELDS.CURSOS.TITULO] as string) ?? "",
        descripcionCorta: (cf[FIELDS.CURSOS.DESCRIPCION_CORTA] as string) ?? "",
        descripcionLarga: (cf[FIELDS.CURSOS.DESCRIPCION_LARGA] as string) ?? "",
        coverUrl,
        instructor: (cf[FIELDS.CURSOS.INSTRUCTOR] as string) ?? "",
        colorPrimario: (cf[FIELDS.CURSOS.COLOR_PRIMARIO] as string) ?? "",
        modalidad: (cf[FIELDS.CURSOS.MODALIDAD] as string) ?? "",
        fechaInicio: cf[FIELDS.CURSOS.FECHA_INICIO] ?? null,
        fechaFin: cf[FIELDS.CURSOS.FECHA_FIN] ?? null,
        estatus: (cf[FIELDS.CURSOS.ESTATUS] as string) ?? "",
      },
      inscripcion: {
        id: inscripcion.id,
        estatus:
          (inscripcion.fields[FIELDS.INSCRIPCIONES.ESTATUS] as string) ?? "",
        fechaInscripcion:
          inscripcion.fields[FIELDS.INSCRIPCIONES.FECHA_INSCRIPCION] ?? null,
        progresoPct:
          (inscripcion.fields[FIELDS.INSCRIPCIONES.PROGRESO_PCT] as number) ?? 0,
      },
      capitulos: capitulosOut,
    });
  } catch (e) {
    if (e instanceof HttpError) {
      return errorResponse(req, e.message, e.status);
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("get-curso error:", msg);
    return errorResponse(req, msg, 500);
  }
});
