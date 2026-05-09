// SOPHIA Portal · get-foro-posts
// Devuelve los posts del foro de un curso, con sus comentarios anidados.
// Solo lo ven los inscritos al curso (verificación vía Inscripciones).
//
// GET /get-foro-posts?cursoId=recXXXXXXXX
// Headers: Authorization: Bearer <supabase_jwt>
//
// Returns 200:
// {
//   posts: [
//     {
//       id, contenido, imagenUrl, fechaISO, esAutor,
//       autor: { id, nombre, apellidos, iniciales },
//       comentarios: [ { id, contenido, fechaISO, esAutor, autor: {...} } ]
//     }, ...
//   ],
//   yo: { personaPortalId, nombre, apellidos, iniciales, esAdmin }
// }
//
// Errors:
//   401 invalid/missing JWT
//   403 no enrolled in course
//   404 course not found
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
  options: { filterByFormula?: string; fields?: string[]; maxRecords?: number; sort?: { field: string; direction: "asc" | "desc" }[] } = {},
): Promise<AirtableRecord[]> {
  const pat = getAirtablePAT();
  const params = new URLSearchParams();
  params.set("returnFieldsByFieldId", "true");
  if (options.filterByFormula) params.set("filterByFormula", options.filterByFormula);
  if (options.maxRecords) params.set("maxRecords", String(options.maxRecords));
  options.fields?.forEach((f) => params.append("fields[]", f));
  options.sort?.forEach((s, i) => {
    params.append(`sort[${i}][field]`, s.field);
    params.append(`sort[${i}][direction]`, s.direction);
  });

  const all: AirtableRecord[] = [];
  let offset: string | undefined = undefined;
  do {
    const url = new URL(`${AIRTABLE_API}/${baseId}/${tableId}`);
    params.forEach((v, k) => url.searchParams.append(k, v));
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${pat}` } });
    if (!res.ok) {
      throw new Error(`Airtable list failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as AirtableListResponse;
    all.push(...data.records);
    offset = data.offset;
  } while (offset);
  return all;
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
  rol: string;
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

  // Lookup PersonaPortal (lo necesitamos para Inscripciones y como autor de posts)
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

  // Lookup persona CRM solo para obtener el rol
  const personasCRM = await listRecords(BASES.CRM, TABLES.PERSONAS_CRM, {
    filterByFormula: eqFormula(FIELDS.PERSONAS_CRM.AUTH_USER_ID, authUserId),
    maxRecords: 1,
  });
  const rol = (personasCRM[0]?.fields[FIELDS.PERSONAS_CRM.ROL] as string) ?? "participante";

  return {
    authUserId,
    email,
    personaPortalId: pp.id,
    nombre: (pp.fields[FIELDS.PERSONAS_PORTAL.NOMBRE] as string) ?? "",
    apellidos: (pp.fields[FIELDS.PERSONAS_PORTAL.APELLIDOS] as string) ?? "",
    rol,
  };
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function verifyEnrollment(personaPortalId: string, cursoId: string): Promise<void> {
  // Lista las inscripciones del usuario, filtra en JS por cursoId
  const inscripciones = await listRecords(BASES.PORTAL, TABLES.INSCRIPCIONES, {
    fields: [FIELDS.INSCRIPCIONES.PERSONA, FIELDS.INSCRIPCIONES.CURSO, FIELDS.INSCRIPCIONES.ESTATUS],
  });
  const enrolled = inscripciones.some((ins) => {
    const personas = (ins.fields[FIELDS.INSCRIPCIONES.PERSONA] as string[]) ?? [];
    const cursos = (ins.fields[FIELDS.INSCRIPCIONES.CURSO] as string[]) ?? [];
    return personas.includes(personaPortalId) && cursos.includes(cursoId);
  });
  if (!enrolled) {
    throw new HttpError(403, "No estás inscrito a este curso");
  }
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
    const url = new URL(req.url);
    const cursoId = url.searchParams.get("cursoId");
    if (!cursoId || !/^rec[A-Za-z0-9]{14,}$/.test(cursoId)) {
      return errorResponse(req, "cursoId inválido o faltante", 400, "invalid_curso_id");
    }

    const me = await authenticate(req);
    await verifyEnrollment(me.personaPortalId, cursoId);

    // 1. Cargar posts del foro (cualquier curso) con estatus activo o eliminado.
    //    NOTA: filtramos por cursoId en JS, no en formula. ARRAYJOIN({Curso})
    //    devuelve los display names ("Happiness Workshop"), no los record IDs,
    //    así que SEARCH(cursoId, ARRAYJOIN(...)) nunca matchea. Mejor cargar
    //    todos los activos+eliminados y filtrar en memoria. Si el volumen
    //    crece >1000 records, agregar un lookup field "Curso ID" y filtrar
    //    por ahí.
    const allPostsRaw = await listRecords(BASES.PORTAL, TABLES.POSTS, {
      filterByFormula: `OR({${FIELDS.POSTS.ESTATUS}} = 'activo', {${FIELDS.POSTS.ESTATUS}} = 'eliminado')`,
      sort: [{ field: FIELDS.POSTS.FECHA, direction: "desc" }],
    });

    const allPosts = allPostsRaw.filter((rec) => {
      const links = (rec.fields[FIELDS.POSTS.CURSO] as string[]) ?? [];
      return links.includes(cursoId);
    });

    // 2. Obtener IDs de autores únicos (solo de posts activos; en eliminados
    //    no exponemos al autor)
    const autorIds = new Set<string>();
    for (const p of allPosts) {
      const estatusRaw = p.fields[FIELDS.POSTS.ESTATUS] as string | { name?: string } | undefined;
      const estatusName = typeof estatusRaw === "string" ? estatusRaw : estatusRaw?.name;
      if (estatusName === "eliminado") continue;
      const links = (p.fields[FIELDS.POSTS.AUTOR] as string[]) ?? [];
      links.forEach((id) => autorIds.add(id));
    }

    // 3. Cargar info de autores en batch
    const autoresById = new Map<string, { nombre: string; apellidos: string; iniciales: string }>();
    if (autorIds.size > 0) {
      const idsArray = Array.from(autorIds);
      // Airtable formula con OR(RECORD_ID() = '...', ...) tiene límite de longitud,
      // así que cargamos toda la tabla con maxRecords prudente y filtramos en JS
      const personas = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
        fields: [FIELDS.PERSONAS_PORTAL.NOMBRE, FIELDS.PERSONAS_PORTAL.APELLIDOS],
      });
      for (const p of personas) {
        if (idsArray.includes(p.id)) {
          const nombre = (p.fields[FIELDS.PERSONAS_PORTAL.NOMBRE] as string) ?? "";
          const apellidos = (p.fields[FIELDS.PERSONAS_PORTAL.APELLIDOS] as string) ?? "";
          autoresById.set(p.id, {
            nombre,
            apellidos,
            iniciales: iniciales(nombre, apellidos),
          });
        }
      }
    }

    // 4. Mapear cada post a la forma frontend.
    //    Los eliminados pierden contenido/autor (privacy) pero conservan
    //    fechaISO y un flag `eliminado: true` para que el frontend renderice
    //    el tombstone.
    function mapPost(rec: AirtableRecord) {
      const estatusRaw = rec.fields[FIELDS.POSTS.ESTATUS] as string | { name?: string } | undefined;
      const estatusName = typeof estatusRaw === "string" ? estatusRaw : estatusRaw?.name;
      const eliminado = estatusName === "eliminado";

      const autorLinks = (rec.fields[FIELDS.POSTS.AUTOR] as string[]) ?? [];
      const autorId = autorLinks[0];
      const autor = autorId ? autoresById.get(autorId) : null;
      const parentLinks = (rec.fields[FIELDS.POSTS.POST_PADRE] as string[]) ?? [];

      if (eliminado) {
        return {
          id: rec.id,
          eliminado: true,
          contenido: "",
          imagenUrl: "",
          fechaISO: (rec.fields[FIELDS.POSTS.FECHA] as string) ?? rec.createdTime ?? "",
          esAutor: false,
          parentId: parentLinks[0] ?? null,
          autor: { id: "", nombre: "", apellidos: "", iniciales: "·" },
        };
      }

      return {
        id: rec.id,
        eliminado: false,
        contenido: (rec.fields[FIELDS.POSTS.CONTENIDO] as string) ?? "",
        imagenUrl: (rec.fields[FIELDS.POSTS.IMAGEN_URL] as string) ?? "",
        fechaISO: (rec.fields[FIELDS.POSTS.FECHA] as string) ?? rec.createdTime ?? "",
        esAutor: autorId === me.personaPortalId,
        parentId: parentLinks[0] ?? null,
        autor: {
          id: autorId ?? "",
          nombre: autor?.nombre ?? "",
          apellidos: autor?.apellidos ?? "",
          iniciales: autor?.iniciales ?? "?",
        },
      };
    }

    const mapped = allPosts.map(mapPost);

    // 5. Separar top-level y comentarios, anidar.
    //    Comentarios eliminados: se ocultan completamente.
    //    Posts top-level eliminados: se conservan SOLO si tienen comentarios
    //    activos (para mostrar el tombstone como contexto del hilo).
    const topLevel = mapped.filter((p) => !p.parentId);
    const comentariosPorPadre = new Map<string, ReturnType<typeof mapPost>[]>();
    for (const c of mapped) {
      if (c.parentId && !c.eliminado) {
        if (!comentariosPorPadre.has(c.parentId)) {
          comentariosPorPadre.set(c.parentId, []);
        }
        comentariosPorPadre.get(c.parentId)!.push(c);
      }
    }
    // Comentarios ordenados oldest-first (lectura natural de hilo)
    for (const arr of comentariosPorPadre.values()) {
      arr.sort((a, b) => (a.fechaISO ?? "").localeCompare(b.fechaISO ?? ""));
    }

    const posts = topLevel
      .map((p) => ({
        ...p,
        parentId: undefined,
        comentarios: (comentariosPorPadre.get(p.id) ?? []).map((c) => ({
          ...c,
          parentId: undefined,
        })),
      }))
      // Drop tombstones huérfanos (eliminados sin comentarios vivos)
      .filter((p) => !p.eliminado || p.comentarios.length > 0);

    return jsonResponse(req, {
      posts,
      yo: {
        personaPortalId: me.personaPortalId,
        nombre: me.nombre,
        apellidos: me.apellidos,
        iniciales: iniciales(me.nombre, me.apellidos),
        esAdmin: me.rol === "admin",
      },
    });
  } catch (e) {
    if (e instanceof HttpError) {
      return errorResponse(req, e.message, e.status);
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("get-foro-posts fatal:", msg);
    return errorResponse(req, msg, 500);
  }
});
