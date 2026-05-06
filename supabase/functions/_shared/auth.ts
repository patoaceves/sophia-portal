// Resolves a Supabase JWT to a Persona record in Airtable CRM.
// Caches via Auth User ID match first; falls back to email match.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  BASES,
  TABLES,
  FIELDS,
  listRecords,
  updateRecord,
  eqFormula,
  normalizeEmail,
} from "./airtable.ts";

export interface AuthedUser {
  authUserId: string;
  email: string;
  personaId: string;
  rol: "alumno" | "admin" | "instructor";
  nombre: string;
  apellidos: string;
}

/**
 * Verifies the Authorization: Bearer <jwt> header against Supabase auth,
 * then resolves the user to a Persona record in Airtable CRM.
 *
 * Throws if no JWT, invalid JWT, or no Persona found.
 *
 * NOTE: This function does NOT auto-create Personas. Use `auth-bootstrap`
 * Edge Function for first-time signups (which has logic for that).
 */
export async function requireAuth(req: Request): Promise<AuthedUser> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing Authorization header");
  }
  const jwt = authHeader.slice("Bearer ".length);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseKey) {
    throw new HttpError(500, "Supabase env not configured");
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: userData, error } = await supabase.auth.getUser(jwt);
  if (error || !userData.user) {
    throw new HttpError(401, "Invalid JWT");
  }

  const authUserId = userData.user.id;
  const email = normalizeEmail(userData.user.email ?? "");
  if (!email) throw new HttpError(401, "User has no email");

  // Try to find Persona by Auth User ID first (fastest, most reliable)
  let personas = await listRecords(BASES.CRM, TABLES.PERSONAS, {
    filterByFormula: eqFormula(FIELDS.PERSONAS_CRM.AUTH_USER_ID, authUserId),
    maxRecords: 1,
  });

  // Fallback: match by email (first signin path, persona was created via import)
  if (personas.length === 0) {
    personas = await listRecords(BASES.CRM, TABLES.PERSONAS, {
      filterByFormula: `LOWER(TRIM({${FIELDS.PERSONAS_CRM.EMAIL}})) = '${email.replace(/'/g, "\\'")}'`,
      maxRecords: 1,
    });

    // If found by email but no Auth User ID, backfill it
    if (personas.length > 0 && !personas[0].fields[FIELDS.PERSONAS_CRM.AUTH_USER_ID]) {
      await updateRecord(BASES.CRM, TABLES.PERSONAS, personas[0].id, {
        [FIELDS.PERSONAS_CRM.AUTH_USER_ID]: authUserId,
      });
    }
  }

  if (personas.length === 0) {
    throw new HttpError(
      403,
      "No Persona record found. Run auth-bootstrap first or contact admin.",
    );
  }

  const p = personas[0];
  const rol = (p.fields[FIELDS.PERSONAS_CRM.ROL] as string) ?? "alumno";

  return {
    authUserId,
    email,
    personaId: p.id,
    rol: rol as AuthedUser["rol"],
    nombre: (p.fields[FIELDS.PERSONAS_CRM.NOMBRE] as string) ?? "",
    apellidos: (p.fields[FIELDS.PERSONAS_CRM.APELLIDOS] as string) ?? "",
  };
}

/**
 * Helper to enforce admin role. Throws 403 if user is not admin.
 */
export function requireAdmin(user: AuthedUser): void {
  if (user.rol !== "admin") {
    throw new HttpError(403, "Admin role required");
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}
