// SOPHIA Portal · claim-invitation
// Canjea una invitación tokenizada y crea (si no existe) la inscripción
// del usuario a la cohorte correspondiente.
//
// POST /claim-invitation
// Headers: Authorization: Bearer <supabase_jwt>
// Body: { token: "inv_xxxxxxxx" }
//
// Returns:
//   200 { ok: true, cursoSlug, cohorteId, inscripcionId, isNew, alreadyClaimed }
//   400 invitación inválida / expirada / revocada / email no coincide
//   404 token no encontrado
//   425 sync de Persona pendiente · el frontend debe reintentar
//   500 error inesperado

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ============================================================================
// AIRTABLE CONSTANTS
// ============================================================================

const BASES = {
  CRM: "app1SbOC98k2OP5m1",
  PORTAL: "app0S6GrJQ8YatvCc",
} as const;

const TABLES = {
  // CRM
  PERSONAS_CRM: "tbl5XKtg0mRfLeFYH",
  // PORTAL
  PERSONAS_PORTAL: "tblwo4xOFhmx2TznJ",
  COHORTES: "tblMwkKfk6U7a75Ja",
  INVITACIONES: "tblzNARG9ahLsKR9c",
  INSCRIPCIONES: "tblIT40GILMUHhLKK",
  CURSOS: "tblJpUGeBsLNkk9UO",
} as const;

const FIELDS = {
  PERSONAS_CRM: {
    AUTH_USER_ID: "fldg3kYs6c4xOoYkq",
    EMAIL: "fldJlxMp6NKCpvAuv",
    NOMBRE: "fldEbEI3pLEAmlYAe",
    APELLIDOS: "fldCnRa0XFvH1FtfQ",
  },
  PERSONAS_PORTAL: {
    NOMBRE: "fldhTiwmmXtIIS8dD",
    EMAIL: "fldnRbi4mJRtfuAmV",
    AUTH_USER_ID: "fldSKACBNXloxYRBc",
  },
  COHORTES: {
    NOMBRE: "fldbp3zZdJr03jCVD",
    CURSO: "fldj0pnwgY14VNtqI",
    ESTATUS: "fld87QVcZl6GvQg2k",
  },
  INVITACIONES: {
    TOKEN: "fldn1D8JFG7n2RYfA",
    COHORTE: "fldKDSCMDaJgHKZ60",
    EMAIL_DESTINATARIO: "fldZK5s5m208cR5r6",
    ORIGEN: "fldw4WgogSTJamWsq",
    ESTATUS: "fldHtt9NUtcU0795f",
    PERSONA: "fldXW2phqZuQyQnFj",
    FECHA_CANJE: "fld5bV3P0iNSJpaBV",
    EXPIRA_EL: "fldQQSYSLabCd9eeP",
    NOTAS: "fldtrTgvBPmUiOkdh",
  },
  INSCRIPCIONES: {
    PERSONA: "fldsgcanUDaXzX20x",
    CURSO: "fldTjcS2GiOe3Q9N0",
    COHORTE: "fldeML5okrUfcNBM3",
    ESTATUS: "flduEWS1l327elsD6",
    FECHA_INSCRIPCION: "fldrfWGCdo6KZZhQz",
  },
  CURSOS: {
    SLUG: "fldnbvTXzNFOGxOYs",
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
  const data = (await res.json()) as AirtableListResponse;
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

async function createRecord(
  baseId: string,
  tableId: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  const pat = getAirtablePAT();
  const res = await fetch(`${AIRTABLE_API}/${baseId}/${tableId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      records: [{ fields }],
      returnFieldsByFieldId: true,
    }),
  });
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

function errorResponse(
  req: Request,
  message: string,
  status = 400,
  code?: string,
): Response {
  return jsonResponse(req, { error: message, code }, status);
}

// ============================================================================
// HELPERS
// ============================================================================

const TOKEN_RE = /^inv_[A-Za-z0-9_-]{4,40}$/;

function isValidToken(t: unknown): t is string {
  return typeof t === "string" && TOKEN_RE.test(t);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowISOZ(): string {
  return new Date().toISOString();
}

/**
 * Looks up the PersonaPortal record for this auth user.
 * Retries with backoff in case the CRM→Portal sync hasn't propagated yet.
 * Returns null if not found after all retries.
 */
async function findPersonaPortal(
  authUserId: string,
  email: string,
): Promise<AirtableRecord | null> {
  const tries = [0, 1500, 3000]; // total ~4.5s wait
  for (const delay of tries) {
    if (delay) await new Promise((r) => setTimeout(r, delay));

    const byId = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
      filterByFormula: eqFormula(FIELDS.PERSONAS_PORTAL.AUTH_USER_ID, authUserId),
      maxRecords: 1,
    });
    if (byId[0]) return byId[0];

    const byEmail = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
      filterByFormula: `LOWER(TRIM({${FIELDS.PERSONAS_PORTAL.EMAIL}})) = '${email.replace(/'/g, "\\'")}'`,
      maxRecords: 1,
    });
    if (byEmail[0]) return byEmail[0];
  }
  return null;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

interface Body {
  token?: string;
}

Deno.serve(async (req) => {
  const optionsRes = handleOptions(req);
  if (optionsRes) return optionsRes;

  if (req.method !== "POST") {
    return errorResponse(req, "Method not allowed", 405);
  }

  try {
    // ── 1. Auth ─────────────────────────────────────────────
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
      return errorResponse(req, "Invalid JWT", 401);
    }

    const authUserId = userData.user.id;
    const email = normalizeEmail(userData.user.email ?? "");
    if (!email) return errorResponse(req, "User has no email", 400);

    // ── 2. Body ─────────────────────────────────────────────
    const body: Body = await req.json().catch(() => ({}));
    const token = body.token?.trim();
    if (!isValidToken(token)) {
      return errorResponse(req, "Token inválido", 400, "invalid_token");
    }

    // ── 3. Buscar la invitación ─────────────────────────────
    const invitations = await listRecords(BASES.PORTAL, TABLES.INVITACIONES, {
      filterByFormula: eqFormula(FIELDS.INVITACIONES.TOKEN, token),
      maxRecords: 1,
    });
    const invitation = invitations[0];
    if (!invitation) {
      return errorResponse(req, "Invitación no encontrada", 404, "not_found");
    }

    const estatus = (invitation.fields[FIELDS.INVITACIONES.ESTATUS] as
      | { name?: string }
      | string
      | undefined);
    const estatusName = typeof estatus === "string" ? estatus : estatus?.name;

    // ── 4. Validar la invitación ────────────────────────────
    if (estatusName === "canjeada") {
      // Idempotente: ya fue canjeada por alguien. Si fue por este mismo
      // usuario, devolvemos OK para que el flow no rompa al recargar.
      const personaLinks = (invitation.fields[FIELDS.INVITACIONES.PERSONA] as string[]) ?? [];
      const cohorteLinks = (invitation.fields[FIELDS.INVITACIONES.COHORTE] as string[]) ?? [];
      const cohorteId = cohorteLinks[0];

      // Buscar persona portal para comparar IDs
      const personaPortal = await findPersonaPortal(authUserId, email);
      if (personaPortal && personaLinks.includes(personaPortal.id) && cohorteId) {
        const cohorte = await getRecord(BASES.PORTAL, TABLES.COHORTES, cohorteId);
        const cursoLinks = (cohorte.fields[FIELDS.COHORTES.CURSO] as string[]) ?? [];
        const curso = cursoLinks[0]
          ? await getRecord(BASES.PORTAL, TABLES.CURSOS, cursoLinks[0])
          : null;
        return jsonResponse(req, {
          ok: true,
          alreadyClaimed: true,
          cohorteId,
          cursoSlug: (curso?.fields[FIELDS.CURSOS.SLUG] as string) ?? "",
        });
      }
      return errorResponse(req, "Esta invitación ya fue canjeada", 400, "already_claimed");
    }

    if (estatusName === "expirada" || estatusName === "revocada") {
      return errorResponse(
        req,
        `Esta invitación está ${estatusName}`,
        400,
        estatusName,
      );
    }

    // Validar fecha de expiración
    const expiraEl = invitation.fields[FIELDS.INVITACIONES.EXPIRA_EL] as string | undefined;
    if (expiraEl && expiraEl < todayISO()) {
      // Marcar como expirada para limpieza
      await updateRecord(BASES.PORTAL, TABLES.INVITACIONES, invitation.id, {
        [FIELDS.INVITACIONES.ESTATUS]: "expirada",
      }).catch(() => {});
      return errorResponse(req, "Esta invitación expiró", 400, "expired");
    }

    // Validar email destinatario (si se llenó)
    const emailDest = invitation.fields[FIELDS.INVITACIONES.EMAIL_DESTINATARIO] as
      | string
      | undefined;
    if (emailDest && normalizeEmail(emailDest) !== email) {
      return errorResponse(
        req,
        "Esta invitación es para otro correo. Inicia sesión con la cuenta correcta.",
        403,
        "email_mismatch",
      );
    }

    // Validar cohorte
    const cohorteLinks = (invitation.fields[FIELDS.INVITACIONES.COHORTE] as string[]) ?? [];
    const cohorteId = cohorteLinks[0];
    if (!cohorteId) {
      return errorResponse(req, "La invitación no tiene cohorte asignada", 500, "no_cohort");
    }

    const cohorte = await getRecord(BASES.PORTAL, TABLES.COHORTES, cohorteId);
    const cohorteEstatus = cohorte.fields[FIELDS.COHORTES.ESTATUS] as
      | { name?: string }
      | string
      | undefined;
    const cohorteEstatusName =
      typeof cohorteEstatus === "string" ? cohorteEstatus : cohorteEstatus?.name;
    if (cohorteEstatusName !== "abierta" && cohorteEstatusName !== "planeada") {
      return errorResponse(
        req,
        `La cohorte ya está ${cohorteEstatusName ?? "cerrada"}`,
        400,
        "cohort_closed",
      );
    }

    const cursoLinks = (cohorte.fields[FIELDS.COHORTES.CURSO] as string[]) ?? [];
    const cursoId = cursoLinks[0];
    if (!cursoId) {
      return errorResponse(req, "La cohorte no tiene curso asignado", 500, "no_course");
    }
    const curso = await getRecord(BASES.PORTAL, TABLES.CURSOS, cursoId);
    const cursoSlug = (curso.fields[FIELDS.CURSOS.SLUG] as string) ?? "";

    // ── 5. Encontrar PersonaPortal (con retry para sync delay) ─
    const personaPortal = await findPersonaPortal(authUserId, email);
    if (!personaPortal) {
      // El sync CRM→Portal no se ha completado todavía. El frontend
      // reintentará cuando el usuario navegue a /app/cursos.
      return errorResponse(
        req,
        "Tu cuenta se está sincronizando. Vuelve a intentar en unos segundos.",
        425,
        "sync_pending",
      );
    }

    // ── 6. ¿Ya existe inscripción a esta cohorte? ─────────────
    const allInscripciones = await listRecords(BASES.PORTAL, TABLES.INSCRIPCIONES, {
      fields: [FIELDS.INSCRIPCIONES.PERSONA, FIELDS.INSCRIPCIONES.COHORTE],
    });
    const existingInscripcion = allInscripciones.find((ins) => {
      const personas = (ins.fields[FIELDS.INSCRIPCIONES.PERSONA] as string[]) ?? [];
      const cohortes = (ins.fields[FIELDS.INSCRIPCIONES.COHORTE] as string[]) ?? [];
      return personas.includes(personaPortal.id) && cohortes.includes(cohorteId);
    });

    let inscripcionId: string;
    let isNew = false;

    if (existingInscripcion) {
      inscripcionId = existingInscripcion.id;
    } else {
      // ── 7. Crear inscripción nueva ──────────────────────────
      const newIns = await createRecord(BASES.PORTAL, TABLES.INSCRIPCIONES, {
        [FIELDS.INSCRIPCIONES.PERSONA]: [personaPortal.id],
        [FIELDS.INSCRIPCIONES.COHORTE]: [cohorteId],
        [FIELDS.INSCRIPCIONES.CURSO]: [cursoId], // backwards compat
        [FIELDS.INSCRIPCIONES.ESTATUS]: "activa",
        [FIELDS.INSCRIPCIONES.FECHA_INSCRIPCION]: todayISO(),
      });
      inscripcionId = newIns.id;
      isNew = true;
    }

    // ── 8. Marcar invitación como canjeada ──────────────────
    await updateRecord(BASES.PORTAL, TABLES.INVITACIONES, invitation.id, {
      [FIELDS.INVITACIONES.ESTATUS]: "canjeada",
      [FIELDS.INVITACIONES.PERSONA]: [personaPortal.id],
      [FIELDS.INVITACIONES.FECHA_CANJE]: nowISOZ(),
    });

    return jsonResponse(req, {
      ok: true,
      alreadyClaimed: false,
      isNew,
      cohorteId,
      cursoSlug,
      inscripcionId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("claim-invitation fatal:", msg);
    return errorResponse(req, msg, 500);
  }
});
