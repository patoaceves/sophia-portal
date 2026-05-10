// SOPHIA Portal · submit-evaluacion
//
// Recibe las respuestas del wizard de evaluación de sesión y las escribe
// en la tabla "Evaluaciones Sesión" de Airtable.
//
// Endpoint:   POST /submit-evaluacion
// Headers:    Authorization: Bearer <jwt>
// Body:
//   {
//     leccionId:     "recXXX",                // Lección de tipo Evaluación
//     inscripcionId: "recXXX",                // Inscripción al curso
//     respuestas: {
//       profesor_preparado:    1..5,
//       contenido_relevante:   1..5,
//       fomento_participacion: 1..5,
//       ideas_aplicables:      1..5,
//       profesor_general:      1..5,
//       comentarios:           "string"       // opcional
//     }
//   }
//
// Response 200: { ok: true, evaluacionId }
// Response 4xx/5xx: { ok: false, error, code? }
//
// Idempotencia: si ya existe una evaluación para esta (Lección + Persona),
// devolvemos { ok: true, evaluacionId } sin crear duplicado.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

// ============================================================================
// AIRTABLE CONSTANTS
// ============================================================================

const BASES = {
  PORTAL: "app0S6GrJQ8YatvCc",
} as const;

const TABLES = {
  EVALUACIONES: "tblkXSuFWbvkDVSo2",
  PERSONAS_PORTAL: "tblwo4xOFhmx2TznJ",
  INSCRIPCIONES: "tblIT40GILMUHhLKK",
  LECCIONES: "tblBjfch6rc5ey7nn",
} as const;

const FIELDS = {
  EVALUACIONES: {
    ID: "fldciMYIbhIscjdHW",
    LECCION: "fldOoKIe9bXY2QHrf",
    INSCRIPCION: "fld9cQHSYtGC04RFI",
    PERSONA_PORTAL: "fldpjGURyFV8NhL4y",
    PROFESOR_PREPARADO: "fldK7aTyiN15BFoZA",
    CONTENIDO_RELEVANTE: "fldrSYlol0BbhpyD9",
    FOMENTO_PARTICIPACION: "fldgs8y6OZLf08c0w",
    IDEAS_APLICABLES: "fldytK60Kj9XmxLGy",
    PROFESOR_GENERAL: "fldPqhuz1K959i8Sg",
    COMENTARIOS: "flduq0TEXgqAfGFKD",
    RESPUESTAS_JSON: "fldaikLfvoouzLHi9",
    COMPLETADO_EN: "fldPtR0AOMM3yHoKg",
  },
  PERSONAS_PORTAL: {
    AUTH_USER_ID: "fldSKACBNXloxYRBc",
    EMAIL: "fldnRbi4mJRtfuAmV",
  },
} as const;

const AIRTABLE_API = "https://api.airtable.com/v0";

// ============================================================================
// CORS
// ============================================================================

const ALLOWED_ORIGINS = [
  "https://portal.sophiamx.org",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5500",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const isVercelPreview = /^https:\/\/sophia-portal-[a-z0-9-]+\.vercel\.app$/.test(origin);
  const allowed = ALLOWED_ORIGINS.includes(origin) || isVercelPreview ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
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
  return jsonResponse(req, { ok: false, error: message, code }, status);
}

// ============================================================================
// AIRTABLE HELPERS
// ============================================================================

interface AirtableRecord {
  id: string;
  createdTime?: string;
  fields: Record<string, unknown>;
}

async function airtableFetch(path: string, init?: RequestInit) {
  const pat = Deno.env.get("AIRTABLE_PAT");
  if (!pat) throw new Error("AIRTABLE_PAT env var missing");
  const res = await fetch(`${AIRTABLE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Airtable error ${res.status}: ${txt}`);
  }
  return res.json();
}

async function listRecords(
  baseId: string,
  tableId: string,
  opts: { filterByFormula?: string; fields?: string[]; pageSize?: number } = {},
): Promise<AirtableRecord[]> {
  const params = new URLSearchParams();
  params.set("returnFieldsByFieldId", "true");
  if (opts.filterByFormula) params.set("filterByFormula", opts.filterByFormula);
  if (opts.fields) opts.fields.forEach((f) => params.append("fields[]", f));
  if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
  const data = await airtableFetch(`/${baseId}/${tableId}?${params}`);
  return data.records as AirtableRecord[];
}

async function createRecord(baseId: string, tableId: string, fields: Record<string, unknown>): Promise<AirtableRecord> {
  const data = await airtableFetch(`/${baseId}/${tableId}?returnFieldsByFieldId=true`, {
    method: "POST",
    body: JSON.stringify({ fields, typecast: true }),
  });
  return data as AirtableRecord;
}

// ============================================================================
// VALIDATION
// ============================================================================

interface RespuestasBody {
  profesor_preparado?: number;
  contenido_relevante?: number;
  fomento_participacion?: number;
  ideas_aplicables?: number;
  profesor_general?: number;
  comentarios?: string;
}

interface Body {
  leccionId?: string;
  inscripcionId?: string;
  respuestas?: RespuestasBody;
}

function isValidRecordId(s: unknown): s is string {
  return typeof s === "string" && /^rec[A-Za-z0-9]{14,}$/.test(s);
}

function isValidRating(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5;
}

const REQUIRED_RATINGS = [
  "profesor_preparado",
  "contenido_relevante",
  "fomento_participacion",
  "ideas_aplicables",
  "profesor_general",
] as const;

const MAX_COMENTARIOS_LEN = 2000;

// ============================================================================
// MAIN
// ============================================================================

Deno.serve(async (req) => {
  const optionsRes = handleOptions(req);
  if (optionsRes) return optionsRes;

  if (req.method !== "POST") {
    return errorResponse(req, "Method not allowed", 405);
  }

  try {
    // ── Auth ─────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(req, "Missing Authorization header", 401, "no_auth");
    }
    const jwt = authHeader.slice("Bearer ".length);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, anonKey);
    const { data: userData, error: authErr } = await supabaseAuth.auth.getUser(jwt);
    if (authErr || !userData.user) {
      return errorResponse(req, "Invalid JWT", 401, "invalid_jwt");
    }
    const authUserId = userData.user.id;
    const email = userData.user.email ?? "";

    // ── Parse body ───────────────────────────────────────────────────
    const body: Body = await req.json().catch(() => ({}));
    const leccionId = body.leccionId;
    const inscripcionId = body.inscripcionId;
    const respuestas = body.respuestas ?? {};

    if (!isValidRecordId(leccionId)) {
      return errorResponse(req, "leccionId inválido", 400, "invalid_leccion_id");
    }
    if (inscripcionId !== undefined && !isValidRecordId(inscripcionId)) {
      return errorResponse(req, "inscripcionId inválido", 400, "invalid_inscripcion_id");
    }

    // Validar las 5 ratings obligatorias
    for (const key of REQUIRED_RATINGS) {
      if (!isValidRating(respuestas[key])) {
        return errorResponse(req, `respuesta inválida para ${key} (debe ser 1-5)`, 400, "invalid_rating");
      }
    }

    const comentariosRaw = (respuestas.comentarios ?? "").trim().slice(0, MAX_COMENTARIOS_LEN);

    // ── Resolver Persona Portal del usuario autenticado ──────────────
    let personasPortal = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
      filterByFormula: `{${FIELDS.PERSONAS_PORTAL.AUTH_USER_ID}} = '${authUserId.replace(/'/g, "\\'")}'`,
      fields: [FIELDS.PERSONAS_PORTAL.AUTH_USER_ID],
      pageSize: 1,
    });
    if (personasPortal.length === 0 && email) {
      personasPortal = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
        filterByFormula: `LOWER(TRIM({${FIELDS.PERSONAS_PORTAL.EMAIL}})) = '${email.toLowerCase().replace(/'/g, "\\'")}'`,
        fields: [FIELDS.PERSONAS_PORTAL.EMAIL],
        pageSize: 1,
      });
    }
    if (personasPortal.length === 0) {
      return errorResponse(req, "No encontramos tu perfil. Cierra sesión y vuelve a entrar.", 404, "no_persona");
    }
    const personaPortalId = personasPortal[0].id;

    // ── Idempotencia: ya hay evaluación de esta lección por esta persona? ───
    const existing = await listRecords(BASES.PORTAL, TABLES.EVALUACIONES, {
      filterByFormula: `AND(SEARCH('${leccionId}', ARRAYJOIN({${FIELDS.EVALUACIONES.LECCION}})), SEARCH('${personaPortalId}', ARRAYJOIN({${FIELDS.EVALUACIONES.PERSONA_PORTAL}})))`,
      fields: [FIELDS.EVALUACIONES.ID],
      pageSize: 1,
    });
    if (existing.length > 0) {
      return jsonResponse(req, { ok: true, evaluacionId: existing[0].id, alreadySubmitted: true });
    }

    // ── Crear el record ──────────────────────────────────────────────
    const nowISO = new Date().toISOString();
    const idValue = `${leccionId}-${personaPortalId}-${Date.now()}`;

    const fields: Record<string, unknown> = {
      [FIELDS.EVALUACIONES.ID]: idValue,
      [FIELDS.EVALUACIONES.LECCION]: [leccionId],
      [FIELDS.EVALUACIONES.PERSONA_PORTAL]: [personaPortalId],
      [FIELDS.EVALUACIONES.PROFESOR_PREPARADO]: respuestas.profesor_preparado,
      [FIELDS.EVALUACIONES.CONTENIDO_RELEVANTE]: respuestas.contenido_relevante,
      [FIELDS.EVALUACIONES.FOMENTO_PARTICIPACION]: respuestas.fomento_participacion,
      [FIELDS.EVALUACIONES.IDEAS_APLICABLES]: respuestas.ideas_aplicables,
      [FIELDS.EVALUACIONES.PROFESOR_GENERAL]: respuestas.profesor_general,
      [FIELDS.EVALUACIONES.COMENTARIOS]: comentariosRaw,
      [FIELDS.EVALUACIONES.RESPUESTAS_JSON]: JSON.stringify(respuestas),
      [FIELDS.EVALUACIONES.COMPLETADO_EN]: nowISO,
    };
    if (inscripcionId) {
      fields[FIELDS.EVALUACIONES.INSCRIPCION] = [inscripcionId];
    }

    const created = await createRecord(BASES.PORTAL, TABLES.EVALUACIONES, fields);

    return jsonResponse(req, { ok: true, evaluacionId: created.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("submit-evaluacion fatal:", msg);
    return errorResponse(req, msg, 500, "fatal");
  }
});
