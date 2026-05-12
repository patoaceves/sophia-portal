// SOPHIA Portal · auth-bootstrap (defensive version)
// Creates a Persona in CRM. If Airtable rejects optional fields,
// retries with only essential fields.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ============================================================================
// AIRTABLE CONSTANTS & HELPERS
// ============================================================================

const BASES = {
  CRM: "app1SbOC98k2OP5m1",
  PORTAL: "app0S6GrJQ8YatvCc",
} as const;

const TABLES = {
  PERSONAS: "tbl5XKtg0mRfLeFYH",
  INVITACIONES: "tblzNARG9ahLsKR9c",
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
    TELEFONO_PAIS: "fld0psZVirGYHs2AQ",
    TELEFONO_NUMERO: "fld3fDQA1tfiNPXN5",
    PERFIL_COMPLETADO: "fldB98L7JqQM27Z9I",
    AVISO_VERSION: "fld7RdS5XJump9Evw",
    AVISO_ACEPTADO_EN: "fldOg6BzestB8kRqg",
    AVISO_IP_HASH: "fldS7KySdOGP7BTXA",
  },
  INVITACIONES: {
    TOKEN: "fldn1D8JFG7n2RYfA",
    EMAIL_DESTINATARIO: "fldZK5s5m208cR5r6",
    ESTATUS: "fldHtt9NUtcU0795f",
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

function errorResponse(req: Request, message: string, status = 400, details?: unknown): Response {
  return jsonResponse(req, { error: message, details }, status);
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

interface BootstrapBody {
  nombre?: string;
  apellidos?: string;
  telefonoPais?: string;
  telefonoNumero?: string;
  avatarUrl?: string;
  /** Si es true, indica que el caller acaba de completar el onboarding.
   *  El backend respeta los valores del body como overrides
   *  (incluso si la Persona ya los tenía con valor) — solo en este caso.
   */
  perfilCompletado?: boolean;
  /** Aviso de privacidad LFPDPPP. Se persiste solo si la Persona NO tiene
   *  aún registro (no sobreescribimos el timestamp original). */
  avisoVersion?: string;
  avisoAceptadoEn?: string;
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

    // Hash truncado de la IP para evidencia del consentimiento (LFPDPPP).
    // No guardamos la IP completa: tomamos SHA-256 y nos quedamos con 16 chars.
    // Esto permite probar que "alguien desde ese origen aceptó" sin almacenar
    // el dato personal completo.
    let clientIpHash = "";
    try {
      const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim()
              || req.headers.get("cf-connecting-ip")
              || "unknown";
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
      const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
      clientIpHash = hex.slice(0, 16);
    } catch {
      clientIpHash = "";
    }

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

    // Helper: construye el response uniforme desde un Persona record.
    // ASYNC porque hace lookup de Invitaciones pendientes por email.
    async function buildResponse(p: AirtableRecord, isNew: boolean) {
      // Reconciliación de invitaciones huérfanas: si el usuario tiene Invitaciones
      // pendientes con su email destinatario (porque ventas las creó pero el
      // usuario no canjeó el link y entró por flujo normal), devolvemos el primer
      // token. El frontend lo guarda en sessionStorage y dispara tryClaimPendingInvite,
      // resolviendo el problema de "me inscribí en ventas pero no veo mi curso".
      //
      // Bounded a 5s con AbortController: si Airtable está lento, no bloqueamos
      // el bootstrap entero (el reconcile es best-effort; si falla, claim-by-email
      // server-side y la propia ruta del invite token URL cubren el caso).
      let pendingInviteToken = "";
      try {
        const personaEmail = (p.fields[FIELDS.PERSONAS_CRM.EMAIL] ?? email) as string;
        if (personaEmail) {
          const params = new URLSearchParams();
          params.set("returnFieldsByFieldId", "true");
          params.set("maxRecords", "1");
          params.set(
            "filterByFormula",
            `AND(` +
              `LOWER(TRIM({${FIELDS.INVITACIONES.EMAIL_DESTINATARIO}})) = '${personaEmail.toLowerCase().replace(/'/g, "\\'")}',` +
              `{${FIELDS.INVITACIONES.ESTATUS}} = 'pendiente'` +
            `)`,
          );
          params.append("fields[]", FIELDS.INVITACIONES.TOKEN);
          params.append("fields[]", FIELDS.INVITACIONES.ESTATUS);
          const reconcileController = new AbortController();
          const reconcileTimeout = setTimeout(() => reconcileController.abort(), 5000);
          const res = await fetch(
            `${AIRTABLE_API}/${BASES.PORTAL}/${TABLES.INVITACIONES}?${params}`,
            {
              headers: { Authorization: `Bearer ${Deno.env.get("AIRTABLE_PAT") ?? ""}` },
              signal: reconcileController.signal,
            },
          );
          clearTimeout(reconcileTimeout);
          if (res.ok) {
            const data = await res.json();
            const record = (data.records ?? [])[0];
            if (record) {
              const token = (record.fields?.[FIELDS.INVITACIONES.TOKEN] as string) ?? "";
              if (token) {
                pendingInviteToken = token;
                console.log(`Invitación huérfana detectada para ${personaEmail}: ${token}`);
              }
            }
          }
        }
      } catch (e) {
        // Reconciliación es best-effort — si falla o se aborta por timeout,
        // no rompe el flow de login.
        console.warn("Pending invite lookup failed or timed out:", e);
      }

      return jsonResponse(req, {
        personaId: p.id,
        rol: (p.fields[FIELDS.PERSONAS_CRM.ROL] ?? DEFAULT_ROL) as string,
        nombre: (p.fields[FIELDS.PERSONAS_CRM.NOMBRE] ?? "") as string,
        apellidos: (p.fields[FIELDS.PERSONAS_CRM.APELLIDOS] ?? "") as string,
        email: (p.fields[FIELDS.PERSONAS_CRM.EMAIL] ?? email) as string,
        avatarUrl: (p.fields[FIELDS.PERSONAS_CRM.AVATAR_URL] ?? "") as string,
        telefonoPais: (p.fields[FIELDS.PERSONAS_CRM.TELEFONO_PAIS] ?? "") as string,
        telefonoNumero: (p.fields[FIELDS.PERSONAS_CRM.TELEFONO_NUMERO] ?? "") as string,
        perfilCompletado: !!p.fields[FIELDS.PERSONAS_CRM.PERFIL_COMPLETADO],
        avisoVersion: (p.fields[FIELDS.PERSONAS_CRM.AVISO_VERSION] ?? "") as string,
        isNew,
        pendingInviteToken,
      });
    }

    // Helper: aplica updates al record. Si perfilCompletado=true, los body
    // values OVERRIDEAN los existentes (modo edición, incluyendo "" para
    // borrar). Si no, solo se llenan campos vacíos (modo backfill).
    function buildUpdates(p: AirtableRecord, opts: { force: boolean }): Record<string, unknown> {
      const updates: Record<string, unknown> = {};
      const setProfileField = (fieldId: string, value: unknown) => {
        if (value === undefined || value === null) return;
        if (opts.force) {
          // En modo force, permitimos "" para borrar el campo (ej. quitar foto)
          updates[fieldId] = value;
        } else if (!p.fields[fieldId] && value !== "") {
          updates[fieldId] = value;
        }
      };

      // Sistema (siempre rellenar si vacío, nunca override)
      if (!p.fields[FIELDS.PERSONAS_CRM.ROL])      updates[FIELDS.PERSONAS_CRM.ROL]      = DEFAULT_ROL;
      if (!p.fields[FIELDS.PERSONAS_CRM.PRODUCTOS]) updates[FIELDS.PERSONAS_CRM.PRODUCTOS] = ["portal"];
      if (!p.fields[FIELDS.PERSONAS_CRM.ORIGEN])    updates[FIELDS.PERSONAS_CRM.ORIGEN]    = "signup";
      if (!p.fields[FIELDS.PERSONAS_CRM.ESTATUS])   updates[FIELDS.PERSONAS_CRM.ESTATUS]   = "activo";

      // Datos de perfil (force=true sobrescribe; force=false solo backfill)
      setProfileField(FIELDS.PERSONAS_CRM.NOMBRE,           body.nombre);
      setProfileField(FIELDS.PERSONAS_CRM.APELLIDOS,        body.apellidos);
      setProfileField(FIELDS.PERSONAS_CRM.AVATAR_URL,       body.avatarUrl ?? (opts.force ? undefined : avatarUrl));
      setProfileField(FIELDS.PERSONAS_CRM.TELEFONO_PAIS,    body.telefonoPais);
      setProfileField(FIELDS.PERSONAS_CRM.TELEFONO_NUMERO,  body.telefonoNumero);

      // Si el caller explicitó perfilCompletado=true, lo seteamos
      if (body.perfilCompletado) {
        updates[FIELDS.PERSONAS_CRM.PERFIL_COMPLETADO] = true;
      }

      // Aviso de privacidad LFPDPPP — registramos UNA SOLA VEZ, solo si la
      // Persona no tiene aún consentimiento registrado. No sobreescribimos
      // el timestamp original aunque el cliente vuelva a mandar el body.
      if (body.avisoVersion && body.avisoAceptadoEn && !p.fields[FIELDS.PERSONAS_CRM.AVISO_VERSION]) {
        updates[FIELDS.PERSONAS_CRM.AVISO_VERSION] = String(body.avisoVersion).slice(0, 20);
        updates[FIELDS.PERSONAS_CRM.AVISO_ACEPTADO_EN] = String(body.avisoAceptadoEn);
        if (clientIpHash) {
          updates[FIELDS.PERSONAS_CRM.AVISO_IP_HASH] = clientIpHash;
        }
      }

      return updates;
    }

    // 1. Lookup by Auth User ID
    let personas = await listRecords(BASES.CRM, TABLES.PERSONAS, {
      filterByFormula: eqFormula(FIELDS.PERSONAS_CRM.AUTH_USER_ID, authUserId),
      maxRecords: 1,
    });

    if (personas.length > 0) {
      const p = personas[0];
      const updates = buildUpdates(p, { force: !!body.perfilCompletado });
      if (Object.keys(updates).length > 0) {
        await updateRecord(BASES.CRM, TABLES.PERSONAS, p.id, updates).catch((e) =>
          console.warn("Backfill (auth_id) failed:", e),
        );
        Object.assign(p.fields, updates);
      }
      return await buildResponse(p, false);
    }

    // 2. Lookup by email
    personas = await listRecords(BASES.CRM, TABLES.PERSONAS, {
      filterByFormula: `LOWER(TRIM({${FIELDS.PERSONAS_CRM.EMAIL}})) = '${email.replace(/'/g, "\\'")}'`,
      maxRecords: 1,
    });

    if (personas.length > 0) {
      const p = personas[0];
      const updates = buildUpdates(p, { force: !!body.perfilCompletado });
      // Siempre asegurar el AUTH_USER_ID (vínculo entre auth y CRM)
      updates[FIELDS.PERSONAS_CRM.AUTH_USER_ID] = authUserId;
      await updateRecord(BASES.CRM, TABLES.PERSONAS, p.id, updates).catch((e) =>
        console.warn("Backfill (email) failed:", e),
      );
      Object.assign(p.fields, updates);
      return await buildResponse(p, false);
    }

        // 3. Create new Persona · defensive: try full, fall back to essentials
    const fullFields: Record<string, unknown> = {
      [FIELDS.PERSONAS_CRM.NOMBRE]: nombre || "Sin nombre",
      [FIELDS.PERSONAS_CRM.APELLIDOS]: apellidos,
      [FIELDS.PERSONAS_CRM.EMAIL]: email,
      [FIELDS.PERSONAS_CRM.AUTH_USER_ID]: authUserId,
      [FIELDS.PERSONAS_CRM.AVATAR_URL]: body.avatarUrl ?? avatarUrl,
      [FIELDS.PERSONAS_CRM.ROL]: DEFAULT_ROL,
      [FIELDS.PERSONAS_CRM.ORIGEN]: "signup",
      [FIELDS.PERSONAS_CRM.ESTATUS]: "activo",
      [FIELDS.PERSONAS_CRM.PRODUCTOS]: ["portal"],
    };
    if (body.telefonoPais)    fullFields[FIELDS.PERSONAS_CRM.TELEFONO_PAIS]    = body.telefonoPais;
    if (body.telefonoNumero)  fullFields[FIELDS.PERSONAS_CRM.TELEFONO_NUMERO]  = body.telefonoNumero;
    if (body.perfilCompletado) fullFields[FIELDS.PERSONAS_CRM.PERFIL_COMPLETADO] = true;

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

    return await buildResponse(newPersona, true);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("auth-bootstrap fatal:", msg);
    return errorResponse(req, msg, 500);
  }
});
