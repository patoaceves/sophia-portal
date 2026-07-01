// SOPHIA Portal · claim-by-email (Postgres, inlined)
//
// Para usuarios que entraron sin click en el invite link. Busca invitaciones
// pendientes/activas con email = user.email y para cada una crea/verifica
// la inscripción.
//
// POST /claim-by-email
// Response: { ok: true, claimed: N, alreadyEnrolled: M, errors: [], invites: [...] }

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

const ALLOWED_ORIGINS = [
  "https://portal.sophiamx.org",
  "http://localhost:3000", "http://localhost:5173",
  "http://127.0.0.1:3000", "http://127.0.0.1:5500",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  return null;
}

function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
}

function errorResponse(req: Request, err: unknown): Response {
  if (err instanceof ApiError) {
    return jsonResponse(req, { error: err.message, code: err.code, details: err.details }, err.status);
  }
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[edge] unhandled:", msg);
  return jsonResponse(req, { error: msg, code: "internal_error" }, 500);
}

let _db: SupabaseClient | null = null;
function getDb(): SupabaseClient {
  if (_db) return _db;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE env");
  _db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: "public" } });
  return _db;
}

type Persona = { id: string; auth_user_id: string; email: string; nombre: string; apellidos: string; rol: string; avatar_url: string | null; };

function normalizeEmail(email: string): string { return email.trim().toLowerCase(); }

async function requireUser(req: Request): Promise<Persona> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new ApiError(401, "missing_auth", "Falta header Authorization");

  const url = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !publicKey) throw new ApiError(500, "config_error", "Supabase env");

  const authClient = createClient(url, publicKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) throw new ApiError(401, "invalid_token", "Token inválido");

  const email = normalizeEmail(user.email ?? "");
  if (!email) throw new ApiError(401, "no_email", "Usuario sin email");

  const db = getDb();
  let { data: persona, error: pErr } = await db
    .from("personas").select("id, auth_user_id, email, nombre, apellidos, rol, avatar_url")
    .eq("auth_user_id", user.id).maybeSingle();
  if (pErr) throw new ApiError(500, "db_error", pErr.message);

  if (!persona) {
    const { data: byEmail, error: eErr } = await db
      .from("personas").select("id, auth_user_id, email, nombre, apellidos, rol, avatar_url")
      .eq("email", email).maybeSingle();
    if (eErr) throw new ApiError(500, "db_error", eErr.message);
    if (!byEmail) throw new ApiError(403, "no_persona", "No hay persona vinculada");
    if (!byEmail.auth_user_id) {
      const { error: uErr } = await db.from("personas").update({ auth_user_id: user.id }).eq("id", byEmail.id);
      if (uErr) throw new ApiError(500, "db_error", uErr.message);
      byEmail.auth_user_id = user.id;
    } else if (byEmail.auth_user_id !== user.id) {
      throw new ApiError(409, "email_conflict", "Email vinculado a otra cuenta");
    }
    persona = byEmail;
  }
  return persona as Persona;
}

function startSpan(name: string, extra: Record<string, unknown> = {}) {
  const t0 = performance.now();
  return {
    end(more: Record<string, unknown> = {}) {
      const ms = Math.round(performance.now() - t0);
      console.log(JSON.stringify({ span: name, ms, ts: new Date().toISOString(), ...extra, ...more }));
      return ms;
    },
  };
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return errorResponse(req, new ApiError(405, "method_not_allowed", "Use POST"));
  }
  const span = startSpan("claim-by-email");

  try {
    const persona = await requireUser(req);
    const email = persona.email.toLowerCase();
    const db = getDb();

    const { data: invitaciones, error: iErr } = await db
      .from("invitaciones")
      .select("id, token, curso_id, expira_el, estatus")
      .eq("email_destinatario", email)
      .in("estatus", ["activa", "pendiente"])
      .order("created_at", { ascending: true });
    if (iErr) return jsonResponse(req, { error: iErr.message, code: "db_error" }, 500);

    let claimed = 0;
    let alreadyEnrolled = 0;
    const errors: string[] = [];
    const invites: any[] = [];
    const now = new Date();

    for (const inv of invitaciones ?? []) {
      if (inv.expira_el && new Date(inv.expira_el) < now) {
        await db.from("invitaciones").update({ estatus: "expirada" }).eq("id", inv.id);
        errors.push(`Invitación ${inv.id} expirada`);
        continue;
      }
      const { data: curso } = await db
        .from("cursos").select("id, slug")
        .eq("id", inv.curso_id).maybeSingle();
      if (!curso) {
        errors.push(`Curso ${inv.curso_id} no encontrado`);
        continue;
      }
      const cursoId = curso.id;
      const cursoSlug = curso.slug ?? "";

      const { data: existing } = await db
        .from("inscripciones").select("id")
        .eq("persona_id", persona.id).eq("curso_id", cursoId)
        .maybeSingle();
      let inscripcionId: string;
      if (existing) {
        inscripcionId = existing.id;
        alreadyEnrolled++;
      } else {
        const { data: created, error: cErr } = await db
          .from("inscripciones").insert({
            persona_id: persona.id, curso_id: cursoId,
            estatus: "activa", fecha_inscripcion: now.toISOString().slice(0, 10),
          }).select("id").single();
        if (cErr) {
          errors.push(`No se pudo inscribir a ${cursoSlug}: ${cErr.message}`);
          continue;
        }
        inscripcionId = created.id;
        claimed++;
      }
      await db.from("invitaciones").update({
        estatus: "canjeada", persona_id: persona.id, fecha_canje: now.toISOString(),
      }).eq("id", inv.id);
      invites.push({ inscripcionId, cursoId: inv.curso_id, cursoSlug });
    }

    span.end({ persona: persona.id, claimed, alreadyEnrolled, errors: errors.length });
    return jsonResponse(req, { ok: true, claimed, alreadyEnrolled, errors, invites });
  } catch (err) {
    span.end({ error: true });
    return errorResponse(req, err);
  }
});
