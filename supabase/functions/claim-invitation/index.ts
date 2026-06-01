// SOPHIA Portal · claim-invitation (Postgres, inlined)
//
// Canjea una invitación tokenizada y crea (si no existe) la inscripción
// del usuario a la cohorte correspondiente.
//
// POST /claim-invitation
// Body: { token: "inv_xxxxxxxx" }
// Response 200: { ok, cursoSlug, cohorteId, inscripcionId, isNew, alreadyClaimed }

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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  return null;
}

function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function errorResponse(req: Request, err: unknown): Response {
  if (err instanceof ApiError) {
    return jsonResponse(req, { error: err.message, code: err.code, details: err.details }, err.status);
  }
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[edge] unhandled:", msg, err);
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
    if (!byEmail) throw new ApiError(425, "persona_sync_pending", "Sync pendiente, reintenta");
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

const TOKEN_RE = /^[A-Za-z0-9_-]{8,128}$/;

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return errorResponse(req, new ApiError(405, "method_not_allowed", "Use POST"));
  }
  const span = startSpan("claim-invitation");

  try {
    const body = await req.json().catch(() => ({})) as { token?: string };
    const token = body.token?.trim() ?? "";
    if (!TOKEN_RE.test(token)) {
      return jsonResponse(req, { error: "Token inválido", code: "invalid_token" }, 400);
    }

    const persona = await requireUser(req);
    const email = persona.email.toLowerCase();
    const db = getDb();

    const { data: invitacion, error: iErr } = await db
      .from("invitaciones")
      .select("id, token, cohorte_id, email_destinatario, estatus, persona_id, expira_el")
      .eq("token", token).maybeSingle();
    if (iErr) return jsonResponse(req, { error: iErr.message, code: "db_error" }, 500);
    if (!invitacion) return jsonResponse(req, { error: "Invitación no encontrada", code: "not_found" }, 404);

    if (invitacion.estatus === "canjeada" && invitacion.persona_id === persona.id) {
      const { data: cohorte } = await db
        .from("cohortes").select("id, curso_id, cursos!inner(slug)")
        .eq("id", invitacion.cohorte_id).maybeSingle();
      const cursoSlug = (cohorte as any)?.cursos?.slug ?? "";
      return jsonResponse(req, { ok: true, alreadyClaimed: true, cohorteId: invitacion.cohorte_id, cursoSlug });
    }

    if (!["activa", "pendiente"].includes(invitacion.estatus)) {
      return jsonResponse(req, { error: `Invitación ${invitacion.estatus}`, code: invitacion.estatus }, 400);
    }
    if (invitacion.expira_el && new Date(invitacion.expira_el) < new Date()) {
      return jsonResponse(req, { error: "Invitación expirada", code: "expired" }, 400);
    }
    if (invitacion.email_destinatario && invitacion.email_destinatario.toLowerCase() !== email) {
      return jsonResponse(req, { error: "Email no coincide", code: "email_mismatch" }, 400);
    }

    const { data: cohorte, error: cErr } = await db
      .from("cohortes").select("id, curso_id, cursos!inner(id, slug)")
      .eq("id", invitacion.cohorte_id).maybeSingle();
    if (cErr) return jsonResponse(req, { error: cErr.message, code: "db_error" }, 500);
    if (!cohorte) return jsonResponse(req, { error: "Cohorte no encontrada", code: "no_cohort" }, 404);
    const cursoId = cohorte.curso_id;
    const cursoSlug = (cohorte as any).cursos?.slug ?? "";

    let inscripcionId: string;
    let isNew = false;
    const { data: existing } = await db
      .from("inscripciones").select("id")
      .eq("persona_id", persona.id).eq("curso_id", cursoId).eq("cohorte_id", invitacion.cohorte_id)
      .maybeSingle();
    if (existing) {
      inscripcionId = existing.id;
    } else {
      const { data: created, error: insErr } = await db
        .from("inscripciones").insert({
          persona_id: persona.id, curso_id: cursoId, cohorte_id: invitacion.cohorte_id,
          estatus: "activa", fecha_inscripcion: new Date().toISOString().slice(0, 10),
        }).select("id").single();
      if (insErr) return jsonResponse(req, { error: insErr.message, code: "db_error" }, 500);
      inscripcionId = created.id;
      isNew = true;
    }

    await db.from("invitaciones").update({
      estatus: "canjeada", persona_id: persona.id, fecha_canje: new Date().toISOString(),
    }).eq("id", invitacion.id);

    span.end({ persona: persona.id, inscripcion: inscripcionId, isNew });
    return jsonResponse(req, { ok: true, cursoSlug, cohorteId: invitacion.cohorte_id, inscripcionId, isNew, alreadyClaimed: false });
  } catch (err) {
    span.end({ error: true });
    return errorResponse(req, err);
  }
});
