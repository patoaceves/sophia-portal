// SOPHIA Portal · delete-entrega-archivo
//
// Quita UN archivo del array `Archivos` de la entrega de tarea de un alumno.
// Si era el último archivo y no hay comentario, el registro se mantiene
// pero `Completado` se pone en false. No borra el archivo del Storage para
// no perder histórico (cleanup-orphan-uploads lo limpiará después).
//
// Endpoint:   POST /delete-entrega-archivo
// Headers:    Authorization: Bearer <jwt>
// Body JSON:  { leccionId, inscripcionId, attachmentId }
//
// Response 200: { ok: true, archivos: [...] }
// Response 4xx/5xx: { ok: false, error, code? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const BASES = {
  PORTAL: "app0S6GrJQ8YatvCc",
  CRM: "app1SbOC98k2OP5m1",
} as const;

const TABLES = {
  INSCRIPCIONES: "tblIT40GILMUHhLKK",
  ACTIVIDADES: "tbllM76FnC50EHRCx",
  PERSONAS_PORTAL: "tblwo4xOFhmx2TznJ",
} as const;

const FIELDS = {
  INSCRIPCIONES: { PERSONA: "fldsgcanUDaXzX20x" },
  ACTIVIDADES: {
    LECCION: "fldD7y3DXBGUnKOpa",
    INSCRIPCION: "fldoZwq6JeRdjm3gj",
    ARCHIVOS: "fldbUYXX6v8m4oLIv",
    COMENTARIO: "fldLLBYOl8SPkCDmA",
    COMPLETADO: "fldLWVj1bLsPtS3wI",
    FECHA: "fldE610Bqq0mMOLnz",
  },
  PERSONAS_PORTAL: {
    AUTH_USER_ID: "fldSKACBNXloxYRBc",
    EMAIL: "fldnRbi4mJRtfuAmV",
  },
} as const;

const AIRTABLE_API = "https://api.airtable.com/v0";

interface AirtableAttachment {
  id?: string;
  url: string;
  filename: string;
  size?: number;
  type?: string;
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

const ALLOWED_ORIGINS = [
  "https://portal.sophiamx.org",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5500",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : "https://portal.sophiamx.org";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
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

function getAirtablePAT(): string {
  const pat = Deno.env.get("AIRTABLE_PAT");
  if (!pat) throw new Error("AIRTABLE_PAT not configured");
  return pat;
}

async function listRecords(
  baseId: string,
  tableId: string,
  options: { filterByFormula?: string; maxRecords?: number } = {},
): Promise<AirtableRecord[]> {
  const pat = getAirtablePAT();
  const params = new URLSearchParams();
  params.set("returnFieldsByFieldId", "true");
  if (options.filterByFormula) params.set("filterByFormula", options.filterByFormula);
  if (options.maxRecords) params.set("maxRecords", String(options.maxRecords));
  const res = await fetch(`${AIRTABLE_API}/${baseId}/${tableId}?${params}`, {
    headers: { Authorization: `Bearer ${pat}` },
  });
  if (!res.ok) {
    throw new Error(`Airtable list failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()).records ?? [];
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
    headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields, returnFieldsByFieldId: true }),
  });
  if (!res.ok) {
    throw new Error(`Airtable update failed: ${res.status} ${await res.text()}`);
  }
  return await res.json();
}

function eqFormula(fieldId: string, value: string): string {
  return `{${fieldId}} = '${value.replace(/'/g, "\\'")}'`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return errorResponse(req, "Method not allowed", 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(req, "Missing Authorization header", 401, "no_auth");
    }
    const jwt = authHeader.slice("Bearer ".length);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey);
    const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !userData.user) {
      return errorResponse(req, "Invalid JWT", 401, "invalid_jwt");
    }
    const authUserId = userData.user.id;
    const email = (userData.user.email ?? "").trim().toLowerCase();

    let body: { leccionId?: string; inscripcionId?: string; attachmentId?: string };
    try {
      body = await req.json();
    } catch {
      return errorResponse(req, "Body inválido", 400, "bad_body");
    }
    const { leccionId, inscripcionId, attachmentId } = body;
    if (!leccionId || !inscripcionId || !attachmentId) {
      return errorResponse(req, "leccionId, inscripcionId, attachmentId requeridos", 400);
    }

    // Resolver persona portal
    const pp = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
      filterByFormula: eqFormula(FIELDS.PERSONAS_PORTAL.AUTH_USER_ID, authUserId),
      maxRecords: 1,
    });
    let personaPortalId = pp[0]?.id;
    if (!personaPortalId && email) {
      const byEmail = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
        filterByFormula: `LOWER(TRIM({${FIELDS.PERSONAS_PORTAL.EMAIL}})) = '${email.replace(/'/g, "\\'")}'`,
        maxRecords: 1,
      });
      personaPortalId = byEmail[0]?.id;
    }
    if (!personaPortalId) {
      return errorResponse(req, "Persona no encontrada", 403, "no_persona");
    }

    // Validar ownership de la inscripción
    const insc = await listRecords(BASES.PORTAL, TABLES.INSCRIPCIONES, {
      filterByFormula: `RECORD_ID()='${inscripcionId}'`,
      maxRecords: 1,
    });
    if (insc.length === 0) {
      return errorResponse(req, "Inscripción no existe", 404, "no_insc");
    }
    const owner = (insc[0].fields[FIELDS.INSCRIPCIONES.PERSONA] as string[]) ?? [];
    if (!owner.includes(personaPortalId)) {
      return errorResponse(req, "No autorizado", 403, "forbidden");
    }

    // Buscar el registro de entrega
    const previas = await listRecords(BASES.PORTAL, TABLES.ACTIVIDADES, {
      filterByFormula:
        `AND(` +
          `SEARCH('${leccionId}', ARRAYJOIN({${FIELDS.ACTIVIDADES.LECCION}})),` +
          `SEARCH('${inscripcionId}', ARRAYJOIN({${FIELDS.ACTIVIDADES.INSCRIPCION}}))` +
        `)`,
      maxRecords: 1,
    });
    if (previas.length === 0) {
      return errorResponse(req, "Entrega no encontrada", 404, "no_entrega");
    }
    const rec = previas[0];
    const existing =
      (rec.fields[FIELDS.ACTIVIDADES.ARCHIVOS] as AirtableAttachment[]) ?? [];

    const remaining = existing
      .filter((a) => a.id !== attachmentId)
      .map((a) => ({ url: a.url, filename: a.filename }));

    if (remaining.length === existing.length) {
      return errorResponse(req, "Archivo no encontrado en la entrega", 404, "no_attachment");
    }

    const updated = await updateRecord(BASES.PORTAL, TABLES.ACTIVIDADES, rec.id, {
      [FIELDS.ACTIVIDADES.ARCHIVOS]: remaining,
      [FIELDS.ACTIVIDADES.COMPLETADO]: remaining.length > 0,
      [FIELDS.ACTIVIDADES.FECHA]: new Date().toISOString(),
    });

    const finalAttachments =
      (updated.fields[FIELDS.ACTIVIDADES.ARCHIVOS] as AirtableAttachment[]) ?? remaining;

    return jsonResponse(req, {
      ok: true,
      archivos: finalAttachments.map((a) => ({
        id: a.id,
        url: a.url,
        filename: a.filename,
        size: a.size,
        type: a.type,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("delete-entrega-archivo fatal:", msg);
    return errorResponse(req, msg, 500, "fatal");
  }
});
