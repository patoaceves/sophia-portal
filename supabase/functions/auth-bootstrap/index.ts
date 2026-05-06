// Edge Function: auth-bootstrap
// Called once, right after a user signs in for the first time.
// Creates a Persona in CRM if it doesn't exist, or backfills Auth User ID
// if Persona was pre-created via import.
//
// POST /auth-bootstrap
// Headers: Authorization: Bearer <supabase_jwt>
// Body: { nombre?: string, apellidos?: string }
//
// Returns: { personaId, rol, nombre, apellidos, isNew }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  BASES,
  TABLES,
  FIELDS,
  listRecords,
  createRecords,
  updateRecord,
  eqFormula,
  normalizeEmail,
} from "../_shared/airtable.ts";
import { handleOptions, jsonResponse, errorResponse } from "../_shared/cors.ts";

interface BootstrapBody {
  nombre?: string;
  apellidos?: string;
}

Deno.serve(async (req) => {
  const optionsRes = handleOptions(req);
  if (optionsRes) return optionsRes;

  if (req.method !== "POST") {
    return errorResponse(req, "Method not allowed", 405);
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(req, "Missing Authorization header", 401);
    }
    const jwt = authHeader.slice("Bearer ".length);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: userData, error } = await supabase.auth.getUser(jwt);
    if (error || !userData.user) {
      return errorResponse(req, "Invalid JWT", 401);
    }

    const authUserId = userData.user.id;
    const email = normalizeEmail(userData.user.email ?? "");
    if (!email) return errorResponse(req, "User has no email", 400);

    const meta = userData.user.user_metadata ?? {};
    const body: BootstrapBody = await req.json().catch(() => ({}));

    // Pull name from JWT metadata as fallback (Google/MS providers populate this)
    const nombre =
      body.nombre ??
      (meta.given_name as string) ??
      (meta.first_name as string) ??
      (meta.name as string) ??
      "";
    const apellidos =
      body.apellidos ??
      (meta.family_name as string) ??
      (meta.last_name as string) ??
      "";
    const avatarUrl = (meta.avatar_url as string) ?? (meta.picture as string) ?? "";

    // 1. Check by Auth User ID
    let personas = await listRecords(BASES.CRM, TABLES.PERSONAS, {
      filterByFormula: eqFormula(FIELDS.PERSONAS_CRM.AUTH_USER_ID, authUserId),
      maxRecords: 1,
    });

    if (personas.length > 0) {
      const p = personas[0];
      return jsonResponse(req, {
        personaId: p.id,
        rol: p.fields[FIELDS.PERSONAS_CRM.ROL] ?? "alumno",
        nombre: p.fields[FIELDS.PERSONAS_CRM.NOMBRE] ?? "",
        apellidos: p.fields[FIELDS.PERSONAS_CRM.APELLIDOS] ?? "",
        isNew: false,
      });
    }

    // 2. Check by email (case-insensitive)
    personas = await listRecords(BASES.CRM, TABLES.PERSONAS, {
      filterByFormula: `LOWER(TRIM({${FIELDS.PERSONAS_CRM.EMAIL}})) = '${email.replace(/'/g, "\\'")}'`,
      maxRecords: 1,
    });

    if (personas.length > 0) {
      // Persona exists (probably imported manually). Backfill Auth User ID.
      const p = personas[0];
      const updateFields: Record<string, unknown> = {
        [FIELDS.PERSONAS_CRM.AUTH_USER_ID]: authUserId,
      };
      // Add productos=portal if not already there
      const productosActuales = (p.fields[FIELDS.PERSONAS_CRM.PRODUCTOS] as string[]) ?? [];
      if (!productosActuales.includes("portal")) {
        updateFields[FIELDS.PERSONAS_CRM.PRODUCTOS] = [...productosActuales, "portal"];
      }
      // Backfill avatar if empty
      if (!p.fields[FIELDS.PERSONAS_CRM.AVATAR_URL] && avatarUrl) {
        updateFields[FIELDS.PERSONAS_CRM.AVATAR_URL] = avatarUrl;
      }

      await updateRecord(BASES.CRM, TABLES.PERSONAS, p.id, updateFields);

      return jsonResponse(req, {
        personaId: p.id,
        rol: p.fields[FIELDS.PERSONAS_CRM.ROL] ?? "alumno",
        nombre: p.fields[FIELDS.PERSONAS_CRM.NOMBRE] ?? nombre,
        apellidos: p.fields[FIELDS.PERSONAS_CRM.APELLIDOS] ?? apellidos,
        isNew: false,
      });
    }

    // 3. Create new Persona
    const created = await createRecords(BASES.CRM, TABLES.PERSONAS, [
      {
        fields: {
          [FIELDS.PERSONAS_CRM.NOMBRE]: nombre || "Sin nombre",
          [FIELDS.PERSONAS_CRM.APELLIDOS]: apellidos,
          [FIELDS.PERSONAS_CRM.EMAIL]: email,
          [FIELDS.PERSONAS_CRM.AUTH_USER_ID]: authUserId,
          [FIELDS.PERSONAS_CRM.AVATAR_URL]: avatarUrl,
          [FIELDS.PERSONAS_CRM.ROL]: "alumno",
          [FIELDS.PERSONAS_CRM.ORIGEN]: "signup",
          [FIELDS.PERSONAS_CRM.ESTATUS]: "activo",
          [FIELDS.PERSONAS_CRM.PRODUCTOS]: ["portal"],
        },
      },
    ]);

    const newPersona = created[0];
    return jsonResponse(req, {
      personaId: newPersona.id,
      rol: "alumno",
      nombre,
      apellidos,
      isNew: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("auth-bootstrap error:", msg);
    return errorResponse(req, msg, 500);
  }
});
