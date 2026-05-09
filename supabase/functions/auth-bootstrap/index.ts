// SOPHIA Portal · auth-bootstrap (defensive version)
// Creates a Persona in CRM. If Airtable rejects optional fields,
// retries with only essential fields.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ============================================================================
// AIRTABLE CONSTANTS & HELPERS
// ============================================================================

const BASES = {
  CRM: "app1SbOC98k2OP5m1",
} as const;

const TABLES = {
  PERSONAS: "tbl5XKtg0mRfLeFYH",
} as const;

const FIELDS = {
  PERSONAS_CRM: {
    NOMBRE: "fldEbEI3pLEAmlYAe",
    APELLIDOS: "fldCnRa0XFvH1FtfQ",
    EMAIL: "fldJlxMp6NKCpvAuv",
    AVATAR_URL: "fldVctJnKuTRUGcIn",
    AUTH_USER_ID: "fldg3kYs6c4xOoYkq",
    ROL: "fldOF0bnjfErxEOCO",
    PRODUCTOS: "fldzj1HkWzIHZwdyn",
    ORIGEN: "fldR2ZD5Pi8Qsnm3i",
    ESTATUS: "fld8Ig1z8qSAzVo3M",
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
  if (!pat) throw new Error("AIRTABLE_PAT not configured in Supabase secrets");
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
    throw new Error(`Airtable list failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as AirtableListResponse;
  return data.records;
}

async function createRecord(
  baseId: string,
  tableId: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  const pat = getAirtablePAT();
  const res = await fetch(
    `${AIRTABLE_API}/${baseId}/${tableId}?returnFieldsByFieldId=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ records: [{ fields }] }),
    },
  );
  if (!res.ok) {
    throw new Error(`Airtable create failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.records[0];
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
    throw new Error(`Airtable update failed (${res.status}): ${await res.text()}`);
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
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function errorResponse(req: Request, message: string, status = 400, details?: unknown): Response {
  return jsonResponse(req, { error: message, details }, status);
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

interface BootstrapBody {
  nombre?: string;
  apellidos?: string;
}

const DEFAULT_ROL = "participante";

Deno.serve(async (req) => {
  const optionsRes = handleOptions(req);
  if (optionsRes) return optionsRes;

  if (req.method !== "POST") {
    return errorResponse(req, "Method not allowed", 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(req, "Missing Authorization header", 401);
    }
    const jwt = authHeader.slice("Bearer ".length);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: userData, error } = await supabase.auth.getUser(jwt);
    if (error || !userData.user) {
      return errorResponse(req, "Invalid JWT", 401, error?.message);
    }

    const authUserId = userData.user.id;
    const email = normalizeEmail(userData.user.email ?? "");
    if (!email) return errorResponse(req, "User has no email", 400);

    const meta = userData.user.user_metadata ?? {};
    const body: BootstrapBody = await req.json().catch(() => ({}));

    // Try to get name from various sources (Google/MS provider metadata)
    const fullName = (meta.full_name as string) ?? (meta.name as string) ?? "";
    const [firstFromFull, ...restFromFull] = fullName.split(" ");
    const lastFromFull = restFromFull.join(" ");

    const nombre =
      body.nombre ||
      (meta.given_name as string) ||
      (meta.first_name as string) ||
      firstFromFull ||
      "";
    const apellidos =
      body.apellidos ||
      (meta.family_name as string) ||
      (meta.last_name as string) ||
      lastFromFull ||
      "";
    const avatarUrl = (meta.avatar_url as string) ?? (meta.picture as string) ?? "";

    // 1. Lookup by Auth User ID
    let personas = await listRecords(BASES.CRM, TABLES.PERSONAS, {
      filterByFormula: eqFormula(FIELDS.PERSONAS_CRM.AUTH_USER_ID, authUserId),
      maxRecords: 1,
    });

    if (personas.length > 0) {
      const p = personas[0];

      // Backfill any missing fields so Airtable stays complete
      const missing: Record<string, unknown> = {};
      if (!p.fields[FIELDS.PERSONAS_CRM.ROL])      missing[FIELDS.PERSONAS_CRM.ROL]      = DEFAULT_ROL;
      if (!p.fields[FIELDS.PERSONAS_CRM.PRODUCTOS]) missing[FIELDS.PERSONAS_CRM.PRODUCTOS] = ["portal"];
      if (!p.fields[FIELDS.PERSONAS_CRM.ORIGEN])    missing[FIELDS.PERSONAS_CRM.ORIGEN]    = "signup";
      if (!p.fields[FIELDS.PERSONAS_CRM.ESTATUS])   missing[FIELDS.PERSONAS_CRM.ESTATUS]   = "activo";
      if (!p.fields[FIELDS.PERSONAS_CRM.AVATAR_URL] && avatarUrl) missing[FIELDS.PERSONAS_CRM.AVATAR_URL] = avatarUrl;
      // Si el body trae nombre/apellidos (caller explícito, ej. onboarding form)
      // y la persona los tiene vacíos, completarlos.
      if (body.nombre && !p.fields[FIELDS.PERSONAS_CRM.NOMBRE])     missing[FIELDS.PERSONAS_CRM.NOMBRE]     = body.nombre;
      if (body.apellidos && !p.fields[FIELDS.PERSONAS_CRM.APELLIDOS]) missing[FIELDS.PERSONAS_CRM.APELLIDOS] = body.apellidos;
      if (Object.keys(missing).length > 0) {
        await updateRecord(BASES.CRM, TABLES.PERSONAS, p.id, missing).catch((e) =>
          console.warn("Backfill (auth_id) failed:", e),
        );
        // Reflejar lo que acabamos de escribir en el record en memoria
        // para que el response devuelva los valores nuevos.
        Object.assign(p.fields, missing);
      }

      return jsonResponse(req, {
        personaId: p.id,
        rol: (p.fields[FIELDS.PERSONAS_CRM.ROL] ?? DEFAULT_ROL) as string,
        nombre: (p.fields[FIELDS.PERSONAS_CRM.NOMBRE] ?? "") as string,
        apellidos: (p.fields[FIELDS.PERSONAS_CRM.APELLIDOS] ?? "") as string,
        isNew: false,
      });
    }

    // 2. Lookup by email
    personas = await listRecords(BASES.CRM, TABLES.PERSONAS, {
      filterByFormula: `LOWER(TRIM({${FIELDS.PERSONAS_CRM.EMAIL}})) = '${email.replace(/'/g, "\\'")}'`,
      maxRecords: 1,
    });

    if (personas.length > 0) {
      const p = personas[0];

      // Backfill: always write AUTH_USER_ID + any missing fields
      const updateFields: Record<string, unknown> = {
        [FIELDS.PERSONAS_CRM.AUTH_USER_ID]: authUserId,
      };
      if (!p.fields[FIELDS.PERSONAS_CRM.ROL])      updateFields[FIELDS.PERSONAS_CRM.ROL]      = DEFAULT_ROL;
      if (!p.fields[FIELDS.PERSONAS_CRM.PRODUCTOS]) updateFields[FIELDS.PERSONAS_CRM.PRODUCTOS] = ["portal"];
      if (!p.fields[FIELDS.PERSONAS_CRM.ORIGEN])    updateFields[FIELDS.PERSONAS_CRM.ORIGEN]    = "signup";
      if (!p.fields[FIELDS.PERSONAS_CRM.ESTATUS])   updateFields[FIELDS.PERSONAS_CRM.ESTATUS]   = "activo";
      if (!p.fields[FIELDS.PERSONAS_CRM.AVATAR_URL] && avatarUrl) updateFields[FIELDS.PERSONAS_CRM.AVATAR_URL] = avatarUrl;
      if (body.nombre && !p.fields[FIELDS.PERSONAS_CRM.NOMBRE])     updateFields[FIELDS.PERSONAS_CRM.NOMBRE]     = body.nombre;
      if (body.apellidos && !p.fields[FIELDS.PERSONAS_CRM.APELLIDOS]) updateFields[FIELDS.PERSONAS_CRM.APELLIDOS] = body.apellidos;
      await updateRecord(BASES.CRM, TABLES.PERSONAS, p.id, updateFields).catch((e) =>
        console.warn("Backfill (email) failed:", e),
      );
      Object.assign(p.fields, updateFields);

      return jsonResponse(req, {
        personaId: p.id,
        rol: (p.fields[FIELDS.PERSONAS_CRM.ROL] ?? DEFAULT_ROL) as string,
        nombre: (p.fields[FIELDS.PERSONAS_CRM.NOMBRE] ?? nombre) as string,
        apellidos: (p.fields[FIELDS.PERSONAS_CRM.APELLIDOS] ?? apellidos) as string,
        isNew: false,
      });
    }

        // 3. Create new Persona · defensive: try full, fall back to essentials
    const fullFields: Record<string, unknown> = {
      [FIELDS.PERSONAS_CRM.NOMBRE]: nombre || "Sin nombre",
      [FIELDS.PERSONAS_CRM.APELLIDOS]: apellidos,
      [FIELDS.PERSONAS_CRM.EMAIL]: email,
      [FIELDS.PERSONAS_CRM.AUTH_USER_ID]: authUserId,
      [FIELDS.PERSONAS_CRM.AVATAR_URL]: avatarUrl,
      [FIELDS.PERSONAS_CRM.ROL]: DEFAULT_ROL,
      [FIELDS.PERSONAS_CRM.ORIGEN]: "signup",
      [FIELDS.PERSONAS_CRM.ESTATUS]: "activo",
      [FIELDS.PERSONAS_CRM.PRODUCTOS]: ["portal"],
    };

    let newPersona: AirtableRecord;
    try {
      newPersona = await createRecord(BASES.CRM, TABLES.PERSONAS, fullFields);
    } catch (firstErr) {
      console.warn("Full create failed, retrying with essentials:", firstErr);

      const essentialFields: Record<string, unknown> = {
        [FIELDS.PERSONAS_CRM.NOMBRE]: nombre || "Sin nombre",
        [FIELDS.PERSONAS_CRM.APELLIDOS]: apellidos,
        [FIELDS.PERSONAS_CRM.EMAIL]: email,
        [FIELDS.PERSONAS_CRM.AUTH_USER_ID]: authUserId,
      };
      try {
        newPersona = await createRecord(BASES.CRM, TABLES.PERSONAS, essentialFields);
      } catch (secondErr) {
        const msg = secondErr instanceof Error ? secondErr.message : String(secondErr);
        console.error("Essentials create also failed:", msg);
        return errorResponse(
          req,
          "Failed to create Persona record. Verify Airtable schema and PAT.",
          500,
          { firstError: String(firstErr), secondError: msg },
        );
      }

      // Rescue PATCH: set rol + productos that were missing from essentials
      try {
        await updateRecord(BASES.CRM, TABLES.PERSONAS, newPersona.id, {
          [FIELDS.PERSONAS_CRM.ROL]: DEFAULT_ROL,
          [FIELDS.PERSONAS_CRM.PRODUCTOS]: ["portal"],
          [FIELDS.PERSONAS_CRM.ORIGEN]: "signup",
          [FIELDS.PERSONAS_CRM.ESTATUS]: "activo",
          ...(avatarUrl ? { [FIELDS.PERSONAS_CRM.AVATAR_URL]: avatarUrl } : {}),
        });
      } catch (patchErr) {
        // Non-fatal: log and continue, persona already exists
        console.warn("Rescue PATCH failed:", patchErr);
      }
    }

    return jsonResponse(req, {
      personaId: newPersona.id,
      rol: DEFAULT_ROL,
      nombre,
      apellidos,
      isNew: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("auth-bootstrap fatal:", msg);
    return errorResponse(req, msg, 500);
  }
});
