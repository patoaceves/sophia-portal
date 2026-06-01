// SOPHIA Portal · auth-bootstrap (Postgres, inlined)
//
// Garantiza que existe una Persona vinculada al auth user. Crea si no existe,
// vincula por email si existe sin auth_user_id, aplica updates al perfil,
// registra aviso de privacidad, y busca invitaciones pendientes por email.
//
// POST /auth-bootstrap
// Body (todos opcionales):
//   nombre, apellidos, telefonoPais, telefonoNumero, avatarUrl
//   perfilCompletado: bool  // si true, body overridea valores existentes
//   avisoAceptado: bool     // si true y aún no aceptado, registra timestamp + IP hash
//   avisoVersion: string
//
// Response: { personaId, rol, nombre, apellidos, email, avatarUrl,
//             telefonoPais, telefonoNumero, perfilCompletado,
//             avisoVersion, isNew, pendingInviteToken }

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
  console.error("[edge] unhandled error:", msg, err);
  return jsonResponse(req, { error: msg, code: "internal_error" }, 500);
}

let _db: SupabaseClient | null = null;
function getDb(): SupabaseClient {
  if (_db) return _db;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  _db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });
  return _db;
}

function normalizeEmail(email: string): string { return email.trim().toLowerCase(); }

const SLOW_THRESHOLD_MS = 2000;
function startSpan(name: string, extra: Record<string, unknown> = {}) {
  const t0 = performance.now();
  return {
    end(more: Record<string, unknown> = {}) {
      const ms = Math.round(performance.now() - t0);
      const slow = ms > SLOW_THRESHOLD_MS;
      console.log(JSON.stringify({
        span: name, ms, ...(slow ? { slow: true } : {}),
        ts: new Date().toISOString(), ...extra, ...more,
      }));
      return ms;
    },
  };
}

const DEFAULT_ROL = "participante";
const DEFAULT_ESTATUS = "activo";
const DEFAULT_ORIGEN = "signup";

interface BootstrapBody {
  nombre?: string;
  apellidos?: string;
  telefonoPais?: string;
  telefonoNumero?: string;
  avatarUrl?: string;
  perfilCompletado?: boolean;
  avisoAceptado?: boolean;
  avisoVersion?: string;
}

async function hashIp(ip: string): Promise<string> {
  if (!ip) return "";
  const data = new TextEncoder().encode(ip);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

function pickClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  return xff.split(",")[0]?.trim() || "";
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return errorResponse(req, new ApiError(405, "method_not_allowed", "Use POST"));
  }
  const span = startSpan("auth-bootstrap");

  try {
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

    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const body: BootstrapBody = await req.json().catch(() => ({}));

    const fullName = String(meta.full_name ?? meta.name ?? "");
    const [firstFromFull, ...restFromFull] = fullName.trim().split(/\s+/);
    const lastFromFull = restFromFull.join(" ");
    const derivedNombre = body.nombre || String(meta.given_name ?? meta.first_name ?? firstFromFull ?? "");
    const derivedApellidos = body.apellidos || String(meta.family_name ?? meta.last_name ?? lastFromFull ?? "");
    const derivedAvatar = body.avatarUrl || String(meta.avatar_url ?? meta.picture ?? "");

    const db = getDb();

    let { data: persona } = await db
      .from("personas")
      .select("id, auth_user_id, email, nombre, apellidos, rol, avatar_url, telefono_pais, telefono_numero, perfil_completado, aviso_aceptado_en, aviso_version, estatus, origen")
      .eq("auth_user_id", user.id).maybeSingle();

    let isNew = false;

    if (!persona) {
      const { data: byEmail } = await db
        .from("personas")
        .select("id, auth_user_id, email, nombre, apellidos, rol, avatar_url, telefono_pais, telefono_numero, perfil_completado, aviso_aceptado_en, aviso_version, estatus, origen")
        .eq("email", email).maybeSingle();
      if (byEmail) {
        if (!byEmail.auth_user_id) {
          const { error: uErr } = await db.from("personas")
            .update({ auth_user_id: user.id }).eq("id", byEmail.id);
          if (uErr) throw new ApiError(500, "db_error", uErr.message);
          byEmail.auth_user_id = user.id;
        } else if (byEmail.auth_user_id !== user.id) {
          throw new ApiError(409, "email_conflict", "Email ya vinculado a otra cuenta");
        }
        persona = byEmail;
      } else {
        const { data: created, error: cErr } = await db
          .from("personas")
          .insert({
            auth_user_id: user.id,
            email,
            nombre: derivedNombre || "",
            apellidos: derivedApellidos || "",
            avatar_url: derivedAvatar || null,
            rol: DEFAULT_ROL,
            estatus: DEFAULT_ESTATUS,
            origen: DEFAULT_ORIGEN,
            perfil_completado: false,
          })
          .select("id, auth_user_id, email, nombre, apellidos, rol, avatar_url, telefono_pais, telefono_numero, perfil_completado, aviso_aceptado_en, aviso_version, estatus, origen")
          .single();
        if (cErr) throw new ApiError(500, "db_error", cErr.message);
        persona = created;
        isNew = true;
      }
    }

    const force = body.perfilCompletado === true;
    const updates: Record<string, unknown> = {};
    const setIf = (key: string, current: any, val: any) => {
      if (val === undefined || val === null) return;
      if (force || !current || (typeof current === "string" && current.trim() === "")) {
        updates[key] = val;
      }
    };
    setIf("nombre", persona!.nombre, body.nombre ?? derivedNombre);
    setIf("apellidos", persona!.apellidos, body.apellidos ?? derivedApellidos);
    setIf("telefono_pais", persona!.telefono_pais, body.telefonoPais);
    setIf("telefono_numero", persona!.telefono_numero, body.telefonoNumero);
    setIf("avatar_url", persona!.avatar_url, body.avatarUrl ?? derivedAvatar);
    if (body.perfilCompletado === true) updates.perfil_completado = true;

    if (body.avisoAceptado === true && !persona!.aviso_aceptado_en) {
      updates.aviso_aceptado_en = new Date().toISOString();
      if (body.avisoVersion) updates.aviso_version = body.avisoVersion;
      const ip = pickClientIp(req);
      if (ip) updates.aviso_ip_hash = await hashIp(ip);
    }

    if (Object.keys(updates).length > 0) {
      const { data: updated, error: uErr } = await db
        .from("personas").update(updates).eq("id", persona!.id)
        .select("id, auth_user_id, email, nombre, apellidos, rol, avatar_url, telefono_pais, telefono_numero, perfil_completado, aviso_version")
        .single();
      if (uErr) throw new ApiError(500, "db_error", uErr.message);
      persona = { ...persona!, ...updated };
    }

    const { data: pendingInv } = await db
      .from("invitaciones")
      .select("token")
      .eq("email_destinatario", email)
      .in("estatus", ["activa", "pendiente"])
      .order("created_at", { ascending: true })
      .limit(1).maybeSingle();
    const pendingInviteToken = pendingInv?.token ?? null;

    span.end({ persona: persona!.id, isNew, hasInvite: !!pendingInviteToken });

    return jsonResponse(req, {
      personaId: persona!.id,
      rol: persona!.rol ?? DEFAULT_ROL,
      nombre: persona!.nombre ?? "",
      apellidos: persona!.apellidos ?? "",
      email: persona!.email ?? email,
      avatarUrl: persona!.avatar_url ?? "",
      telefonoPais: persona!.telefono_pais ?? "",
      telefonoNumero: persona!.telefono_numero ?? "",
      perfilCompletado: !!persona!.perfil_completado,
      avisoVersion: persona!.aviso_version ?? "",
      isNew,
      pendingInviteToken,
    });
  } catch (err) {
    span.end({ error: true });
    return errorResponse(req, err);
  }
});
