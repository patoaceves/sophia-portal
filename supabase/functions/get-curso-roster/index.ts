// SOPHIA Portal · get-curso-roster
//
// Devuelve la lista de personas inscritas a un curso (Persona Portal info).
// Usado por el autocomplete de menciones en el composer del foro.
//
// Endpoint: GET /get-curso-roster?cursoId=recXXX
// Headers:  Authorization: Bearer <jwt>
//
// Response 200:
// {
//   ok: true,
//   roster: [
//     { id, nombre, apellidos, iniciales, avatarUrl, rol }
//   ]
// }
//
// Política: solo usuarios inscritos al curso pueden ver el roster.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

// ============================================================================
// CONSTANTS
// ============================================================================

const BASES = { CRM: "app1SbOC98k2OP5m1", PORTAL: "app0S6GrJQ8YatvCc" } as const;
const TABLES = {
  PERSONAS_PORTAL: "tblwo4xOFhmx2TznJ",
  INSCRIPCIONES: "tblIT40GILMUHhLKK",
} as const;
const FIELDS = {
  PERSONAS_PORTAL: {
    NOMBRE: "fldhTiwmmXtIIS8dD",
    APELLIDOS: "fldvZE8Y5Y4rVCOKa",
    EMAIL: "fldnRbi4mJRtfuAmV",
    AUTH_USER_ID: "fldSKACBNXloxYRBc",
    AVATAR_URL: "fldvi4xBiYc6tPbar",
    ROL: "fldRcBDK58Mu2tkWj",
  },
  INSCRIPCIONES: {
    PERSONA: "fldsgcanUDaXzX20x",
    CURSO: "fldTjcS2GiOe3Q9N0",
    ESTATUS: "flduEWS1l327elsD6",
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
function errorResponse(req: Request, message: string, status = 400, code?: string): Response {
  return jsonResponse(req, { ok: false, error: message, code }, status);
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
  if (!res.ok) throw new Error(`Airtable error ${res.status}: ${await res.text()}`);
  return res.json();
}
async function listRecords(
  baseId: string, tableId: string,
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
function eqFormula(fieldId: string, value: string): string {
  return `{${fieldId}} = '${value.replace(/'/g, "\\'")}'`;
}
function iniciales(nombre: string, apellidos: string): string {
  const a = (nombre || "").trim()[0] || "";
  const b = (apellidos || "").trim()[0] || "";
  return ((a + b).toUpperCase() || "?");
}
function isValidRecordId(s: unknown): s is string {
  return typeof s === "string" && /^rec[A-Za-z0-9]{14,}$/.test(s);
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
    const email = userData.user.email ?? "";

    // Param
    const url = new URL(req.url);
    const cursoId = url.searchParams.get("cursoId");
    if (!isValidRecordId(cursoId)) return errorResponse(req, "cursoId inválido", 400, "invalid_curso_id");

    // Resolver Persona Portal del caller
    let mePortal = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
      filterByFormula: eqFormula(FIELDS.PERSONAS_PORTAL.AUTH_USER_ID, authUserId),
      fields: [FIELDS.PERSONAS_PORTAL.AUTH_USER_ID],
      pageSize: 1,
    });
    if (mePortal.length === 0 && email) {
      mePortal = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
        filterByFormula: `LOWER(TRIM({${FIELDS.PERSONAS_PORTAL.EMAIL}})) = '${email.toLowerCase().replace(/'/g, "\\'")}'`,
        fields: [FIELDS.PERSONAS_PORTAL.EMAIL],
        pageSize: 1,
      });
    }
    if (mePortal.length === 0) return errorResponse(req, "Sin perfil", 404, "no_persona");
    const meId = mePortal[0].id;

    // Verificar que el caller esté inscrito al curso
    const inscripciones = await listRecords(BASES.PORTAL, TABLES.INSCRIPCIONES, {
      filterByFormula: `AND(SEARCH('${cursoId}', ARRAYJOIN({${FIELDS.INSCRIPCIONES.CURSO}})), SEARCH('${meId}', ARRAYJOIN({${FIELDS.INSCRIPCIONES.PERSONA}})))`,
      fields: [FIELDS.INSCRIPCIONES.PERSONA],
      pageSize: 1,
    });
    if (inscripciones.length === 0) return errorResponse(req, "No estás inscrito a este curso", 403, "not_enrolled");

    // Cargar TODAS las inscripciones al curso
    const allEnrollments = await listRecords(BASES.PORTAL, TABLES.INSCRIPCIONES, {
      filterByFormula: `SEARCH('${cursoId}', ARRAYJOIN({${FIELDS.INSCRIPCIONES.CURSO}}))`,
      fields: [FIELDS.INSCRIPCIONES.PERSONA, FIELDS.INSCRIPCIONES.ESTATUS],
    });
    const enrolledPersonaIds = new Set<string>();
    for (const ins of allEnrollments) {
      const personas = (ins.fields[FIELDS.INSCRIPCIONES.PERSONA] as string[]) ?? [];
      for (const pid of personas) enrolledPersonaIds.add(pid);
    }

    if (enrolledPersonaIds.size === 0) {
      return jsonResponse(req, { ok: true, roster: [] });
    }

    // Cargar info de las Personas Portal correspondientes
    const personas = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
      fields: [
        FIELDS.PERSONAS_PORTAL.NOMBRE,
        FIELDS.PERSONAS_PORTAL.APELLIDOS,
        FIELDS.PERSONAS_PORTAL.AVATAR_URL,
        FIELDS.PERSONAS_PORTAL.ROL,
      ],
    });
    const roster = personas
      .filter((p) => enrolledPersonaIds.has(p.id))
      .map((p) => {
        const nombre = (p.fields[FIELDS.PERSONAS_PORTAL.NOMBRE] as string) ?? "";
        const apellidos = (p.fields[FIELDS.PERSONAS_PORTAL.APELLIDOS] as string) ?? "";
        const avatarUrl = (p.fields[FIELDS.PERSONAS_PORTAL.AVATAR_URL] as string) ?? "";
        const rolRaw = p.fields[FIELDS.PERSONAS_PORTAL.ROL] as string | { name?: string } | undefined;
        const rol = typeof rolRaw === "string" ? rolRaw : rolRaw?.name ?? "participante";
        return {
          id: p.id,
          nombre,
          apellidos,
          iniciales: iniciales(nombre, apellidos),
          avatarUrl,
          rol,
        };
      })
      // Excluir al propio usuario del autocomplete (no se menciona a sí mismo)
      .filter((p) => p.id !== meId)
      // Orden alfabético
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    return jsonResponse(req, { ok: true, roster });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("get-curso-roster fatal:", msg);
    return errorResponse(req, msg, 500, "fatal");
  }
});
