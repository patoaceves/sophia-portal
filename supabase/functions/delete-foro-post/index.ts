// SOPHIA Portal · delete-foro-post
// Soft-delete de un post del foro. Solo el autor o un admin pueden borrar.
// El campo Estatus pasa a "eliminado"; el record persiste para auditoría.
//
// POST /delete-foro-post
// Headers: Authorization: Bearer <supabase_jwt>
// Body: { postId: "recXXX" }
//
// Returns 200: { ok: true, postId }
// Errors:
//   400 validación
//   401 invalid/missing JWT
//   403 no autor / no admin
//   404 post not found
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
  POSTS: "tblmLVl9ySzTXb2OK",
} as const;

const FIELDS = {
  PERSONAS_CRM: {
    AUTH_USER_ID: "fldg3kYs6c4xOoYkq",
    EMAIL: "fldJlxMp6NKCpvAuv",
    ROL: "fldOF0bnjfErxEOCO",
  },
  PERSONAS_PORTAL: {
    EMAIL: "fldnRbi4mJRtfuAmV",
    AUTH_USER_ID: "fldSKACBNXloxYRBc",
  },
  POSTS: {
    AUTOR: "fldjOVXCAkwoNENnX",
    ESTATUS: "fldy88bnFeG7QEIQN",
  },
} as const;

const AIRTABLE_API = "https://api.airtable.com/v0";

interface AirtableRecord {
  id: string;
  createdTime?: string;
  fields: Record<string, unknown>;
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
  options: { filterByFormula?: string; fields?: string[]; maxRecords?: number } = {},
): Promise<AirtableRecord[]> {
  const pat = getAirtablePAT();
  const params = new URLSearchParams();
  params.set("returnFieldsByFieldId", "true");
  if (options.filterByFormula) params.set("filterByFormula", options.filterByFormula);
  if (options.maxRecords) params.set("maxRecords", String(options.maxRecords));
  options.fields?.forEach((f) => params.append("fields[]", f));

  const res = await fetch(`${AIRTABLE_API}/${baseId}/${tableId}?${params}`, {
    headers: { Authorization: `Bearer ${pat}` },
  });
  if (!res.ok) {
    throw new Error(`Airtable list failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.records;
}

async function getRecord(
  baseId: string,
  tableId: string,
  recordId: string,
): Promise<AirtableRecord> {
  const pat = getAirtablePAT();
  const res = await fetch(
    `${AIRTABLE_API}/${baseId}/${tableId}/${recordId}?returnFieldsByFieldId=true`,
    { headers: { Authorization: `Bearer ${pat}` } },
  );
  if (!res.ok) {
    throw new Error(`Airtable get failed (${res.status}): ${await res.text()}`);
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
    headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
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
  const allowedOrigin =
    ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
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

class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

function isValidRecordId(s: unknown): s is string {
  return typeof s === "string" && /^rec[A-Za-z0-9]{14,}$/.test(s);
}

interface AuthedUser {
  authUserId: string;
  email: string;
  personaPortalId: string;
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
    throw new HttpError(403, "Persona no encontrada en sync de Portal");
  }

  const personasCRM = await listRecords(BASES.CRM, TABLES.PERSONAS_CRM, {
    filterByFormula: eqFormula(FIELDS.PERSONAS_CRM.AUTH_USER_ID, authUserId),
    maxRecords: 1,
  });
  const rol = (personasCRM[0]?.fields[FIELDS.PERSONAS_CRM.ROL] as string) ?? "participante";

  return {
    authUserId,
    email,
    personaPortalId: personasPortal[0].id,
    rol,
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

interface Body { postId?: string }

Deno.serve(async (req) => {
  const optionsRes = handleOptions(req);
  if (optionsRes) return optionsRes;

  if (req.method !== "POST") {
    return errorResponse(req, "Method not allowed", 405);
  }

  try {
    const me = await authenticate(req);
    const body: Body = await req.json().catch(() => ({}));
    const postId = body.postId;
    if (!isValidRecordId(postId)) {
      return errorResponse(req, "postId inválido", 400, "invalid_post_id");
    }

    const post = await getRecord(BASES.PORTAL, TABLES.POSTS, postId).catch(() => null);
    if (!post) {
      return errorResponse(req, "Post no encontrado", 404, "not_found");
    }

    // Permisos: autor o admin
    const autorLinks = (post.fields[FIELDS.POSTS.AUTOR] as string[]) ?? [];
    const esAutor = autorLinks.includes(me.personaPortalId);
    const esAdmin = me.rol === "admin";
    if (!esAutor && !esAdmin) {
      return errorResponse(req, "No tienes permiso para borrar este post", 403, "forbidden");
    }

    // Si ya está marcado como eliminado, idempotent OK
    const estatus = post.fields[FIELDS.POSTS.ESTATUS] as string | { name?: string } | undefined;
    const estatusName = typeof estatus === "string" ? estatus : estatus?.name;
    if (estatusName === "eliminado") {
      return jsonResponse(req, { ok: true, postId, alreadyDeleted: true });
    }

    await updateRecord(BASES.PORTAL, TABLES.POSTS, postId, {
      [FIELDS.POSTS.ESTATUS]: "eliminado",
    });

    return jsonResponse(req, { ok: true, postId });
  } catch (e) {
    if (e instanceof HttpError) {
      return errorResponse(req, e.message, e.status, e.code);
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("delete-foro-post fatal:", msg);
    return errorResponse(req, msg, 500);
  }
});
