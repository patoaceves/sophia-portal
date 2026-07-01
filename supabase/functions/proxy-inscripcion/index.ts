// SOPHIA Portal · proxy-inscripcion (Postgres)
//
// Reemplaza por completo la automation de Airtable "Alta participantes desde
// ventas" (webhook → script "Crear invitación SOPHIA"). Para cada participante:
// - crea/encuentra persona por email (con su rol; queda pendiente de login)
// - crea invitación con token único, estatus='activa', origen='alta-ventas'
//   (si ya existe invitación activa/pendiente para ese curso+email, la reusa)
// - notifica a GHL con el mismo payload que mandaba el script de Airtable
//   (link de invitación + datos de curso y facilitador). GHL no bloquea:
//   si falla, la invitación ya quedó y solo se reporta en `warnings`.
//
// POST /proxy-inscripcion
// Body: { token, enviadoEn, cursoId, cursoNombre,
//         primeraSesionFecha?, primeraSesionHora?, participantes[] }
//   (transicional: cohorteId/cohorteNombre de formularios viejos se aceptan
//    y se resuelven a su curso; el fallback se retira en la fase de limpieza)
//   participantes[]: { nombre, apellidos, email, rol?, telefono? }
// Response 200: { ok: true, mensaje, invitaciones: [{email, token}],
//                 errors: [], warnings: [] }

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

// Webhook de GHL que dispara el mensaje de bienvenida con el link de
// invitación. Override opcional vía secret GHL_WEBHOOK_URL.
const GHL_WEBHOOK =
  Deno.env.get("GHL_WEBHOOK_URL") ??
  "https://services.leadconnectorhq.com/hooks/ek1LQvM0Kyj7fll9nDO7/webhook-trigger/845cecc4-28cd-4408-99b3-fd6622365af3";

// Webhook propio del Happiness Workshop Digital (curso autoguiado): dispara su
// mensaje de bienvenida específico. El resto de los cursos usan GHL_WEBHOOK.
// Override opcional vía secret GHL_WEBHOOK_URL_DIGITAL.
const GHL_WEBHOOK_DIGITAL =
  Deno.env.get("GHL_WEBHOOK_URL_DIGITAL") ??
  "https://services.leadconnectorhq.com/hooks/ek1LQvM0Kyj7fll9nDO7/webhook-trigger/08J2Y6Nwy0CYIykxZq3s";

// Curso "Happiness Workshop Digital" (slug happiness-workshop-digital).
const HWD_CURSO_ID = "a17c34f0-1c2a-48a8-8f64-5ff48c1a8b5f";

// Roles válidos (enum persona_rol en Postgres).
const VALID_ROLES = new Set(["participante", "admin", "instructor", "profesor", "facilitador", "coordinador"]);

function newInvitationToken(): string {
  const hex = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  return `inv_${hex}`;
}

function normalizeEmail(s: string): string { return s.trim().toLowerCase(); }

// ─── Helpers portados del script de Airtable (mismo comportamiento) ───

// "2026-05-12" → "Martes, 12 de mayo de 2026". Parseamos a mediodía UTC
// para evitar el shift de zona horaria (MX UTC-6).
function formatFechaEs(isoDate: string): string {
  if (!isoDate) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return isoDate;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${dias[date.getUTCDay()]}, ${date.getUTCDate()} de ${meses[date.getUTCMonth()]} de ${date.getUTCFullYear()}`;
}

// "Natalia Arriaga" → "NA". Fallback para el avatar del email.
function calcIniciales(fullName: string): string {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "SC";
  const first = parts[0][0] || "";
  const second = parts[1] ? parts[1][0] : "";
  return (first + second).toUpperCase();
}

// Solo dígitos (formato wa.me).
function whatsappDigits(phone: string): string {
  return String(phone || "").replace(/[^\d]/g, "");
}

// "+52 81 8011 1608" para números MX típicos; fallback "+<digits>".
function whatsappPretty(phone: string): string {
  const digits = whatsappDigits(phone);
  if (!digits) return "";
  if (digits.startsWith("52") && digits.length === 12) {
    return `+52 ${digits.slice(2, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`;
  }
  if (digits.startsWith("521") && digits.length === 13) {
    return `+52 ${digits.slice(3, 5)} ${digits.slice(5, 9)} ${digits.slice(9, 13)}`;
  }
  if (digits.startsWith("1") && digits.length === 11) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
  }
  return `+${digits}`;
}

interface Participante {
  nombre?: string;
  apellidos?: string;
  email?: string;
  rol?: string;
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
      return jsonResponse({ ok: false, error: "Body inválido, se esperaba JSON" }, 400);
    }

    const expectedToken = Deno.env.get("IMPORT_PUBLIC_TOKEN");
    if (!expectedToken) {
      return jsonResponse({ ok: false, error: "Configuración incompleta del servidor" }, 500);
    }
    if (body.token !== expectedToken) {
      return jsonResponse({ ok: false, error: "Token inválido" }, 401);
    }

    const cursoIdRaw = String(body.cursoId ?? "");
    const legacyCohorteId = String(body.cohorteId ?? "");
    if (!UUID_RE.test(cursoIdRaw) && !UUID_RE.test(legacyCohorteId)) {
      return jsonResponse({ ok: false, error: "cursoId inválido" }, 400);
    }

    const participantes: Participante[] = Array.isArray(body.participantes) ? body.participantes : [];
    if (participantes.length === 0) {
      return jsonResponse({ ok: false, error: "No se recibieron participantes" }, 400);
    }
    if (participantes.length > 15) {
      return jsonResponse({ ok: false, error: "Máximo 15 participantes por envío" }, 400);
    }

    const db = getDb();

    // Resolución transicional: formularios viejos mandan cohorteId; se
    // resuelve a su curso mientras la tabla cohortes exista. Retirar este
    // fallback en la fase de limpieza.
    let cursoId = cursoIdRaw;
    if (!UUID_RE.test(cursoId)) {
      const { data: co } = await db
        .from("cohortes").select("curso_id")
        .eq("id", legacyCohorteId).maybeSingle();
      cursoId = String(co?.curso_id ?? "");
      if (!UUID_RE.test(cursoId)) {
        return jsonResponse({ ok: false, error: "Curso no encontrado" }, 404);
      }
    }

    // Curso: validar que existe + leer datos para el mensaje de bienvenida
    // (fecha/hora de primera sesión y facilitador) que van en el payload GHL.
    const { data: curso, error: cErr } = await db
      .from("cursos")
      .select("id, estatus, titulo, fecha_inicio, hora_sesion, facilitador_nombre, facilitador_email, facilitador_telefono, facilitador_avatar_url, facilitador_mensaje")
      .eq("id", cursoId).maybeSingle();
    if (cErr) return jsonResponse({ ok: false, error: cErr.message }, 500);
    if (!curso) return jsonResponse({ ok: false, error: "Curso no encontrado" }, 404);

    // Routing del webhook: el Happiness Workshop Digital (autoguiado) tiene su
    // propio mensaje de bienvenida; el resto de los cursos usan el default.
    const webhookUrl = curso.id === HWD_CURSO_ID ? GHL_WEBHOOK_DIGITAL : GHL_WEBHOOK;

    const cursoNombre = String(body.cursoNombre ?? body.cohorteNombre ?? "").trim() || (curso.titulo ?? "");
    const primeraSesionFecha = formatFechaEs(String(curso.fecha_inicio ?? body.primeraSesionFecha ?? "").trim());
    const primeraSesionHora = String(curso.hora_sesion ?? body.primeraSesionHora ?? "").trim();
    const coordinadorNombre = String(curso.facilitador_nombre ?? "").trim();
    const coordinadorEmail = String(curso.facilitador_email ?? "").trim();
    const coordinadorWhatsapp = String(curso.facilitador_telefono ?? "").trim();
    const coordinadorFotoUrl = String(curso.facilitador_avatar_url ?? "").trim();
    const coordinadorMensaje = String(curso.facilitador_mensaje ?? "").trim();
    const coordinadorIniciales = calcIniciales(coordinadorNombre);
    const coordinadorWhatsappDigits = whatsappDigits(coordinadorWhatsapp);
    const coordinadorWhatsappPretty = whatsappPretty(coordinadorWhatsapp);

    const invitaciones: Array<{ email: string; token: string }> = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    let notificados = 0;

    for (const p of participantes) {
      const email = normalizeEmail(String(p.email ?? ""));
      const nombre = String(p.nombre ?? "").trim();
      const apellidos = String(p.apellidos ?? "").trim();
      const rolRaw = String(p.rol ?? "").trim().toLowerCase();
      const rol = VALID_ROLES.has(rolRaw) ? rolRaw : "participante";
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
          rol,
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

      // 2) ¿Ya existe invitación activa para este (curso+email)? Reusarla.
      //    El webhook GHL se manda igual: re-importar a alguien sirve para
      //    re-enviarle su link de bienvenida (mismo comportamiento operativo
      //    que la automation vieja, donde cada envío notificaba).
      let token: string;
      const { data: existingInv } = await db
        .from("invitaciones").select("id, token, estatus")
        .eq("curso_id", cursoId).eq("email_destinatario", email)
        .in("estatus", ["activa", "pendiente"])
        .limit(1).maybeSingle();

      if (existingInv) {
        token = existingInv.token;
      } else {
        token = newInvitationToken();
        const { error: iErr } = await db.from("invitaciones").insert({
          token, curso_id: cursoId, email_destinatario: email,
          origen: "alta-ventas", estatus: "activa", persona_id: personaId,
        });
        if (iErr) {
          errors.push(`No se pudo crear invitación para ${email}: ${iErr.message}`);
          continue;
        }
      }
      invitaciones.push({ email, token });

      // 3) Notificar a GHL (mismo payload que el script de Airtable).
      //    No bloquea: la invitación ya quedó. Para el digital se usa su
      //    propio webhook (webhookUrl), para el resto el default.
      const linkInvitacion = `https://portal.sophiamx.org/?invite=${token}`;
      try {
        const ghlRes = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            nombre,
            apellidos,
            rol,
            cursoNombre,
            primeraSesionFecha,
            primeraSesionHora,
            linkInvitacion,
            coordinadorNombre,
            coordinadorEmail,
            coordinadorWhatsapp,
            coordinadorWhatsappDigits,
            coordinadorWhatsappPretty,
            coordinadorFotoUrl,
            coordinadorMensaje,
            coordinadorIniciales,
          }),
        });
        if (!ghlRes.ok) {
          const errText = await ghlRes.text();
          console.error(`GHL webhook error para ${email} (${ghlRes.status}): ${errText.slice(0, 150)}`);
          warnings.push(`Invitación creada pero GHL falló para ${email} (${ghlRes.status})`);
        } else {
          notificados += 1;
          console.log(`GHL notificado para ${email}`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`GHL webhook threw para ${email}: ${msg}`);
        warnings.push(`Invitación creada pero GHL falló para ${email}`);
      }
    }

    const count = invitaciones.length;
    return jsonResponse({
      ok: true,
      mensaje: `${count} invitación${count !== 1 ? "es" : ""} creada${count !== 1 ? "s" : ""}, ${notificados} notificada${notificados !== 1 ? "s" : ""} vía GHL`,
      invitaciones, errors, warnings,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("proxy-inscripcion fatal:", msg);
    return jsonResponse({ ok: false, error: "Error interno del servidor" }, 500);
  }
});
