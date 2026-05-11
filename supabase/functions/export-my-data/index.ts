// SOPHIA Portal · export-my-data
//
// Derecho ARCO "A" (Acceso) bajo LFPDPPP. Devuelve TODOS los datos
// personales que tenemos del usuario autenticado, en formato JSON
// descargable.
//
// GET /export-my-data
// Headers: Authorization: Bearer <jwt>
//
// Response 200:
// {
//   ok: true,
//   exportadoEn: "2026-05-11T15:00:00Z",
//   persona: { ...todos los campos de Persona CRM },
//   personaPortal: { ...campos de Persona Portal (synced) },
//   inscripciones: [...],
//   progreso: [...],
//   posts: [...],          // foro: posts + comentarios del usuario
//   respuestasTest: [...], // test de felicidad histórico
//   evaluacionesSesion: [...], // evaluaciones a ponentes
//   metadatos: { authUserId, email, exportFormatVersion: "1.0" }
// }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ============================================================================
// CONSTANTS
// ============================================================================

const BASES = { CRM: "app1SbOC98k2OP5m1", PORTAL: "app0S6GrJQ8YatvCc" } as const;
const TABLES = {
  PERSONAS_CRM: "tbl5XKtg0mRfLeFYH",       // CRM
  PERSONAS_PORTAL: "tblwo4xOFhmx2TznJ",     // PORTAL (synced)
  INSCRIPCIONES: "tblIT40GILMUHhLKK",
  PROGRESO_LECCIONES: "tbllSrA7i4RxR6rqD",
  POSTS: "tblmLVl9ySzTXb2OK",
  EVALUACIONES_SESION: "tblkXSuFWbvkDVSo2",
  RESPUESTAS_AUTOEVAL: "tblNhTCikXms43AJz",
} as const;
const FIELDS = {
  PERSONAS_CRM: {
    AUTH_USER_ID: "fldg3kYs6c4xOoYkq",
    EMAIL: "fldJlxMp6NKCpvAuv",
  },
  PERSONAS_PORTAL: {
    AUTH_USER_ID: "fldSKACBNXloxYRBc",
    EMAIL: "fldnRbi4mJRtfuAmV",
  },
  INSCRIPCIONES: {
    PERSONA: "fldsgcanUDaXzX20x",
  },
  PROGRESO_LECCIONES: {
    INSCRIPCION: "fld5osGXDLBrvgW63",
  },
  POSTS: {
    AUTOR: "fldjOVXCAkwoNENnX",
  },
  EVALUACIONES_SESION: {
    PERSONA_PORTAL: "fldpjGURyFV8NhL4y",
  },
  RESPUESTAS_AUTOEVAL: {
    INSCRIPCION: "fldu7jj4hqe1dCIMZ",
  },
} as const;
const AIRTABLE_API = "https://api.airtable.com/v0";

// ============================================================================
// CORS
// ============================================================================
const ALLOWED_ORIGINS = [
  "https://portal.sophiamx.org",
  "http://localhost:3000", "http://localhost:5173", "http://localhost:5500",
];
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const isVercelPreview = /^https:\/\/sophia-portal-[a-z0-9-]+\.vercel\.app$/.test(origin);
  const allowed = ALLOWED_ORIGINS.includes(origin) || isVercelPreview ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  return null;
}
function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}
function errorResponse(req: Request, msg: string, status = 400, code?: string): Response {
  return jsonResponse(req, { ok: false, error: msg, code }, status);
}

// ============================================================================
// AIRTABLE
// ============================================================================
interface AirtableRecord { id: string; createdTime?: string; fields: Record<string, unknown> }
async function airtableFetch(path: string, init?: RequestInit) {
  const pat = Deno.env.get("AIRTABLE_PAT");
  if (!pat) throw new Error("AIRTABLE_PAT env var missing");
  const res = await fetch(`${AIRTABLE_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  return res.json();
}
async function listRecords(
  baseId: string, tableId: string,
  opts: { filterByFormula?: string; pageSize?: number } = {},
): Promise<AirtableRecord[]> {
  const params = new URLSearchParams();
  params.set("returnFieldsByFieldId", "true");
  if (opts.filterByFormula) params.set("filterByFormula", opts.filterByFormula);
  if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
  const all: AirtableRecord[] = [];
  let offset: string | undefined = undefined;
  do {
    const url = `/${baseId}/${tableId}?${params}${offset ? `&offset=${offset}` : ""}`;
    const data = await airtableFetch(url);
    all.push(...(data.records as AirtableRecord[]));
    offset = data.offset;
  } while (offset);
  return all;
}
function eqFormula(fieldId: string, value: string): string {
  return `{${fieldId}} = '${value.replace(/'/g, "\\'")}'`;
}

// ============================================================================
// MAIN
// ============================================================================

Deno.serve(async (req) => {
  const optionsRes = handleOptions(req);
  if (optionsRes) return optionsRes;
  if (req.method !== "GET") return errorResponse(req, "Method not allowed", 405);

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorResponse(req, "Missing Authorization", 401, "no_auth");
    const jwt = authHeader.slice("Bearer ".length);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, anonKey);
    const { data: userData, error: authErr } = await supabaseAuth.auth.getUser(jwt);
    if (authErr || !userData.user) return errorResponse(req, "Invalid JWT", 401, "invalid_jwt");
    const authUserId = userData.user.id;
    const email = (userData.user.email ?? "").toLowerCase();

    // 1) Persona CRM
    let personasCRM = await listRecords(BASES.CRM, TABLES.PERSONAS_CRM, {
      filterByFormula: eqFormula(FIELDS.PERSONAS_CRM.AUTH_USER_ID, authUserId),
      pageSize: 1,
    });
    if (personasCRM.length === 0 && email) {
      personasCRM = await listRecords(BASES.CRM, TABLES.PERSONAS_CRM, {
        filterByFormula: `LOWER(TRIM({${FIELDS.PERSONAS_CRM.EMAIL}})) = '${email.replace(/'/g, "\\'")}'`,
        pageSize: 1,
      });
    }
    if (personasCRM.length === 0) return errorResponse(req, "No persona found", 404, "no_persona");
    const personaCRM = personasCRM[0];
    const personaCRMId = personaCRM.id;

    // 2) Persona Portal (synced)
    let personasPortal = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
      filterByFormula: eqFormula(FIELDS.PERSONAS_PORTAL.AUTH_USER_ID, authUserId),
      pageSize: 1,
    });
    if (personasPortal.length === 0 && email) {
      personasPortal = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
        filterByFormula: `LOWER(TRIM({${FIELDS.PERSONAS_PORTAL.EMAIL}})) = '${email.replace(/'/g, "\\'")}'`,
        pageSize: 1,
      });
    }
    const personaPortal = personasPortal[0] ?? null;
    const personaPortalId = personaPortal?.id ?? "";

    // 3) Inscripciones
    const inscripciones = personaPortalId
      ? await listRecords(BASES.PORTAL, TABLES.INSCRIPCIONES, {
          filterByFormula: `SEARCH('${personaPortalId}', ARRAYJOIN({${FIELDS.INSCRIPCIONES.PERSONA}}))`,
        })
      : [];
    const inscripcionIds = new Set(inscripciones.map(i => i.id));

    // 4) Progreso por lección (filtrado por inscripcionIds en JS por ARRAYJOIN issue)
    const allProgreso = await listRecords(BASES.PORTAL, TABLES.PROGRESO_LECCIONES, {});
    const progreso = allProgreso.filter(p => {
      const inscLinks = (p.fields[FIELDS.PROGRESO_LECCIONES.INSCRIPCION] as string[]) ?? [];
      return inscLinks.some(id => inscripcionIds.has(id));
    });

    // 5) Posts del foro (autor = personaPortal)
    const posts = personaPortalId
      ? await listRecords(BASES.PORTAL, TABLES.POSTS, {
          filterByFormula: `SEARCH('${personaPortalId}', ARRAYJOIN({${FIELDS.POSTS.AUTOR}}))`,
        })
      : [];

    // 6) Evaluaciones de sesión (persona portal)
    const evaluaciones = personaPortalId
      ? await listRecords(BASES.PORTAL, TABLES.EVALUACIONES_SESION, {
          filterByFormula: `SEARCH('${personaPortalId}', ARRAYJOIN({${FIELDS.EVALUACIONES_SESION.PERSONA_PORTAL}}))`,
        })
      : [];

    // 7) Respuestas Test de Felicidad (vía inscripciones)
    const allRespuestas = await listRecords(BASES.PORTAL, TABLES.RESPUESTAS_AUTOEVAL, {});
    const respuestasTest = allRespuestas.filter(r => {
      const inscLinks = (r.fields[FIELDS.RESPUESTAS_AUTOEVAL.INSCRIPCION] as string[]) ?? [];
      return inscLinks.some(id => inscripcionIds.has(id));
    });

    // Componer respuesta
    const payload = {
      ok: true,
      exportadoEn: new Date().toISOString(),
      metadatos: {
        authUserId,
        email,
        exportFormatVersion: "1.0",
        avisoLegal: "Estos datos corresponden a su Persona en SOPHIA, conforme al Derecho de Acceso (LFPDPPP Art. 22). Para ejercer Rectificación, Cancelación u Oposición contacte privacidad@sophiamx.org.",
      },
      persona: { id: personaCRM.id, createdTime: personaCRM.createdTime, fields: personaCRM.fields },
      personaPortal: personaPortal
        ? { id: personaPortal.id, createdTime: personaPortal.createdTime, fields: personaPortal.fields }
        : null,
      inscripciones: inscripciones.map(r => ({ id: r.id, createdTime: r.createdTime, fields: r.fields })),
      progreso: progreso.map(r => ({ id: r.id, createdTime: r.createdTime, fields: r.fields })),
      posts: posts.map(r => ({ id: r.id, createdTime: r.createdTime, fields: r.fields })),
      respuestasTest: respuestasTest.map(r => ({ id: r.id, createdTime: r.createdTime, fields: r.fields })),
      evaluacionesSesion: evaluaciones.map(r => ({ id: r.id, createdTime: r.createdTime, fields: r.fields })),
    };

    return jsonResponse(req, payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("export-my-data fatal:", msg);
    return errorResponse(req, "Error interno al exportar datos", 500, "fatal");
  }
});
