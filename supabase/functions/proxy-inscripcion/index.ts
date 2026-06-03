// SOPHIA Portal · proxy-inscripcion (Postgres)
//
// Crea invitaciones directamente en `invitaciones` Postgres en vez de
// reenviar a webhook de Airtable Automations. Para cada participante:
// - crea/encuentra persona por email (sin auth_user_id, queda pendiente de login)
// - crea invitación con token único, estatus='activa', origen='alta-ventas'
//
// POST /proxy-inscripcion
// Body: { token, enviadoEn, cohorteId, cohorteNombre, participantes[] }
//   participantes[]: { nombre, apellidos, email, telefono? }
// Response 200: { ok: true, mensaje, invitaciones: [{email, token}], errors: [] }

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(), "Content-Type": "application/json" } });
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function newInvitationToken(): string {
  const hex = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  return `inv_${hex}`;
}

function normalizeEmail(s: string): string { return s.trim().toLowerCase(); }

interface Participante {
  nombre?: string;
  apellidos?: string;
  email?: string;
  telefono?: string;
  telefonoPais?: string;
  telefonoNumero?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Método no permitido" }, 405);

  try {
    let body: any;
    try { body = await req.json(); } catch {
      return jsonResponse({ ok: false, error: "Body inválido — se esperaba JSON" }, 400);
    }

    const expectedToken = Deno.env.get("IMPORT_PUBLIC_TOKEN");
    if (!expectedToken) {
      return jsonResponse({ ok: false, error: "Configuración incompleta del servidor" }, 500);
    }
    if (body.token !== expectedToken) {
      return jsonResponse({ ok: false, error: "Token inválido" }, 401);
    }

    const cohorteId = String(body.cohorteId ?? "");
    if (!UUID_RE.test(cohorteId)) {
      return jsonResponse({ ok: false, error: "cohorteId inválido" }, 400);
    }

    const participantes: Participante[] = Array.isArray(body.participantes) ? body.participantes : [];
    if (participantes.length === 0) {
      return jsonResponse({ ok: false, error: "No se recibieron participantes" }, 400);
    }
    if (participantes.length > 15) {
      return jsonResponse({ ok: false, error: "Máximo 15 participantes por envío" }, 400);
    }

    const db = getDb();

    // Verificar que la cohorte existe
    const { data: cohorte, error: cErr } = await db
      .from("cohortes").select("id, curso_id, estatus").eq("id", cohorteId).maybeSingle();
    if (cErr) return jsonResponse({ ok: false, error: cErr.message }, 500);
    if (!cohorte) return jsonResponse({ ok: false, error: "Cohorte no encontrada" }, 404);

    const invitaciones: Array<{ email: string; token: string }> = [];
    const errors: string[] = [];

    for (const p of participantes) {
      const email = normalizeEmail(String(p.email ?? ""));
      const nombre = String(p.nombre ?? "").trim();
      const apellidos = String(p.apellidos ?? "").trim();
      if (!email || !email.includes("@")) {
        errors.push(`Email inválido: ${p.email ?? "(vacío)"}`);
        continue;
      }

      // 1) Buscar/crear persona por email
      const { data: existingPersona } = await db
        .from("personas").select("id").eq("email", email).maybeSingle();

      let personaId: string | null = existingPersona?.id ?? null;
      if (!personaId) {
        const { data: created, error: pErr } = await db.from("personas").insert({
          email,
          nombre: nombre || "",
          apellidos: apellidos || "",
          rol: "participante",
          estatus: "activo",
          origen: "manual",
          telefono_numero: p.telefonoNumero ?? p.telefono ?? null,
          telefono_pais: p.telefonoPais ?? null,
          perfil_completado: false,
        }).select("id").single();
        if (pErr) {
          errors.push(`No se pudo crear persona ${email}: ${pErr.message}`);
          continue;
        }
        personaId = created.id;
      }

      // 2) ¿Ya existe invitación activa para esta (cohorte+email)?
      const { data: existingInv } = await db
        .from("invitaciones").select("id, token, estatus")
        .eq("cohorte_id", cohorteId).eq("email_destinatario", email)
        .in("estatus", ["activa", "pendiente"])
        .limit(1).maybeSingle();
      if (existingInv) {
        invitaciones.push({ email, token: existingInv.token });
        continue;
      }

      // 3) Crear invitación nueva
      const token = newInvitationToken();
      const { error: iErr } = await db.from("invitaciones").insert({
        token, cohorte_id: cohorteId, email_destinatario: email,
        origen: "alta-ventas", estatus: "activa", persona_id: personaId,
      });
      if (iErr) {
        errors.push(`No se pudo crear invitación para ${email}: ${iErr.message}`);
        continue;
      }
      invitaciones.push({ email, token });
    }

    const count = invitaciones.length;
    return jsonResponse({
      ok: true,
      mensaje: `${count} invitación${count !== 1 ? "es" : ""} creada${count !== 1 ? "s" : ""}`,
      invitaciones, errors,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("proxy-inscripcion fatal:", msg);
    return jsonResponse({ ok: false, error: "Error interno del servidor" }, 500);
  }
});
