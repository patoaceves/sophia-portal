// SOPHIA Portal · claim-by-email
//
// Para usuarios que se registran SIN haber hecho click en el invite link
// (entraron directo via magic link o Google a la página principal). El
// flujo de claim-invitation requiere un token en sessionStorage; si la
// persona perdió ese link o entró por otra ruta, su invitación queda
// pendiente para siempre y nunca aparece inscrita al curso.
//
// Este endpoint resuelve eso: dado el JWT del usuario, busca todas las
// Invitaciones con email = user.email AND estatus = "pendiente", y para
// cada una crea la Inscripción correspondiente. Procesa N invitaciones
// (puede tener varios cursos pendientes a la vez).
//
// POST /claim-by-email
// Headers: Authorization: Bearer <jwt>
//
// Response:
//   { ok: true, claimed: N, alreadyEnrolled: M, errors: [], invites: [...] }
//
// Se llama desde el frontend después del login (en callback.html y cursos.js)
// SIEMPRE, sin depender de si hay token en sessionStorage.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ============================================================================
// CONSTANTS
// ============================================================================

const BASES = { CRM: "app1SbOC98k2OP5m1", PORTAL: "app0S6GrJQ8YatvCc" } as const;
const TABLES = {
  PERSONAS_CRM: "tbl5XKtg0mRfLeFYH",
  PERSONAS_PORTAL: "tblwo4xOFhmx2TznJ",
  INVITACIONES: "tblzNARG9ahLsKR9c",
  INSCRIPCIONES: "tblIT40GILMUHhLKK",
  COHORTES: "tblMwkKfk6U7a75Ja",
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
  INVITACIONES: {
    TOKEN: "fldn1D8JFG7n2RYfA",
    COHORTE: "fldKDSCMDaJgHKZ60",
    EMAIL_DESTINATARIO: "fldZK5s5m208cR5r6",
    ESTATUS: "fldHtt9NUtcU0795f",
    PERSONA: "fldXW2phqZuQyQnFj",
    FECHA_CANJE: "fld5bV3P0iNSJpaBV",
  },
  INSCRIPCIONES: {
    PERSONA: "fldsgcanUDaXzX20x",
    CURSO: "fldTjcS2GiOe3Q9N0",
    COHORTE: "fldeML5okrUfcNBM3",
    ESTATUS: "flduEWS1l327elsD6",
    FECHA_INSCRIPCION: "fldrfWGCdo6KZZhQz",
  },
  COHORTES: {
    CURSO: "fldj0pnwgY14VNtqI", // link a Cursos
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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
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
  opts: { filterByFormula?: string; pageSize?: number; fields?: string[] } = {},
): Promise<AirtableRecord[]> {
  const params = new URLSearchParams();
  params.set("returnFieldsByFieldId", "true");
  if (opts.filterByFormula) params.set("filterByFormula", opts.filterByFormula);
  if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
  if (opts.fields) opts.fields.forEach(f => params.append("fields[]", f));
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
async function createRecord(baseId: string, tableId: string, fields: Record<string, unknown>) {
  const data = await airtableFetch(`/${baseId}/${tableId}`, {
    method: "POST",
    body: JSON.stringify({ records: [{ fields }], returnFieldsByFieldId: true, typecast: true }),
  });
  return data.records[0] as AirtableRecord;
}
async function updateRecord(baseId: string, tableId: string, recordId: string, fields: Record<string, unknown>) {
  await airtableFetch(`/${baseId}/${tableId}/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify({ fields, returnFieldsByFieldId: true, typecast: true }),
  });
}
function escapeAt(s: string): string { return s.replace(/'/g, "\\'"); }
function todayISO(): string { return new Date().toISOString().slice(0, 10); }
function nowISOZ(): string { return new Date().toISOString(); }

// ============================================================================
// MAIN
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return errorResponse(req, "Method not allowed", 405);

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

    const email = (userData.user.email ?? "").toLowerCase().trim();
    if (!email) return errorResponse(req, "User has no email", 400, "no_email");

    // 1) Buscar Invitaciones pendientes para este email
    const pendingInvites = await listRecords(BASES.PORTAL, TABLES.INVITACIONES, {
      filterByFormula: `AND(LOWER(TRIM({${FIELDS.INVITACIONES.EMAIL_DESTINATARIO}})) = '${escapeAt(email)}', {${FIELDS.INVITACIONES.ESTATUS}} = 'pendiente')`,
    });

    if (pendingInvites.length === 0) {
      return jsonResponse(req, { ok: true, claimed: 0, alreadyEnrolled: 0, invites: [], message: "No hay invitaciones pendientes" });
    }

    // 2) Buscar Persona Portal por email (necesaria para crear Inscripción)
    const personasPortal = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
      filterByFormula: `LOWER(TRIM({${FIELDS.PERSONAS_PORTAL.EMAIL}})) = '${escapeAt(email)}'`,
      pageSize: 1,
    });

    if (personasPortal.length === 0) {
      // Sync de CRM→Portal aún no completó. El cliente debe retry más tarde.
      return jsonResponse(req, {
        ok: true,
        claimed: 0,
        alreadyEnrolled: 0,
        invites: pendingInvites.length,
        retry: true,
        message: "Persona Portal aún no sincroniza desde CRM. Retry en 30s.",
      }, 200);
    }
    const personaPortalId = personasPortal[0].id;

    // 3) Cargar todas las inscripciones existentes de esta persona (para no duplicar)
    const allInscripciones = await listRecords(BASES.PORTAL, TABLES.INSCRIPCIONES, {
      fields: [FIELDS.INSCRIPCIONES.PERSONA, FIELDS.INSCRIPCIONES.COHORTE],
    });
    const enrolledCohorteIds = new Set<string>();
    for (const ins of allInscripciones) {
      const personas = (ins.fields[FIELDS.INSCRIPCIONES.PERSONA] as string[]) ?? [];
      if (personas.includes(personaPortalId)) {
        const cohortes = (ins.fields[FIELDS.INSCRIPCIONES.COHORTE] as string[]) ?? [];
        cohortes.forEach(c => enrolledCohorteIds.add(c));
      }
    }

    // 4) Procesar cada invitación pendiente
    let claimed = 0;
    let alreadyEnrolled = 0;
    const errors: { invitationId: string; reason: string }[] = [];
    const processed: { invitationId: string; cohorteId: string; created: boolean }[] = [];

    for (const inv of pendingInvites) {
      try {
        const cohorteLinks = (inv.fields[FIELDS.INVITACIONES.COHORTE] as string[]) ?? [];
        const cohorteId = cohorteLinks[0];
        if (!cohorteId) {
          errors.push({ invitationId: inv.id, reason: "Invitación sin cohorte" });
          continue;
        }

        let created = false;
        if (!enrolledCohorteIds.has(cohorteId)) {
          // Buscar curso de la cohorte (para llenar Inscripciones.CURSO por backwards compat)
          const cohorteRes = await airtableFetch(`/${BASES.PORTAL}/${TABLES.COHORTES}/${cohorteId}?returnFieldsByFieldId=true`);
          const cursoLinks = (cohorteRes.fields[FIELDS.COHORTES.CURSO] as string[]) ?? [];
          const cursoId = cursoLinks[0];

          const fields: Record<string, unknown> = {
            [FIELDS.INSCRIPCIONES.PERSONA]: [personaPortalId],
            [FIELDS.INSCRIPCIONES.COHORTE]: [cohorteId],
            [FIELDS.INSCRIPCIONES.ESTATUS]: "activa",
            [FIELDS.INSCRIPCIONES.FECHA_INSCRIPCION]: todayISO(),
          };
          if (cursoId) fields[FIELDS.INSCRIPCIONES.CURSO] = [cursoId];

          await createRecord(BASES.PORTAL, TABLES.INSCRIPCIONES, fields);
          enrolledCohorteIds.add(cohorteId); // evita duplicar en mismo loop
          created = true;
          claimed++;
        } else {
          alreadyEnrolled++;
        }

        // Marcar invitación como canjeada (incluso si ya estaba inscrito por otro medio)
        await updateRecord(BASES.PORTAL, TABLES.INVITACIONES, inv.id, {
          [FIELDS.INVITACIONES.ESTATUS]: "canjeada",
          [FIELDS.INVITACIONES.PERSONA]: [personaPortalId],
          [FIELDS.INVITACIONES.FECHA_CANJE]: nowISOZ(),
        });

        processed.push({ invitationId: inv.id, cohorteId, created });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`claim-by-email error on invite ${inv.id}:`, msg);
        errors.push({ invitationId: inv.id, reason: msg });
      }
    }

    return jsonResponse(req, {
      ok: true,
      claimed,
      alreadyEnrolled,
      total: pendingInvites.length,
      errors,
      invites: processed,
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("claim-by-email fatal:", msg);
    return errorResponse(req, "Error interno al canjear invitaciones", 500, "fatal");
  }
});
