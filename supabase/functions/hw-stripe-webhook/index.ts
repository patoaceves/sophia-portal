// SOPHIA · hw-stripe-webhook
// Endpoint público (--no-verify-jwt; la seguridad es la firma Stripe).
// Activa el acceso en el portal SOLO cuando un pago se confirma
// (evento payment_intent.succeeded del Payment Element nativo).
//   1) marca el pedido como pagado
//   2) crea/encuentra la persona por email
//   3) crea una invitación con token (estatus 'activa', origen 'alta-ventas')
//   4) dispara el correo de bienvenida vía GHL con el link ?invite=TOKEN
// Idempotente: cada evento se registra una sola vez en stripe_eventos (PK=event.id).
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, GHL_WEBHOOK_URL (opcional)

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";

const PORTAL_BASE = "https://portal.sophiamx.org";
const GHL_WEBHOOK = Deno.env.get("GHL_WEBHOOK_URL") ??
  "https://services.leadconnectorhq.com/hooks/ek1LQvM0Kyj7fll9nDO7/webhook-trigger/845cecc4-28cd-4408-99b3-fd6622365af3";

let _db: SupabaseClient | null = null;
function getDb(): SupabaseClient {
  if (_db) return _db;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE env");
  _db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });
  return _db;
}

function newInvitationToken(): string {
  const hex = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  return `inv_${hex}`;
}
function normalizeEmail(s: string): string { return String(s ?? "").trim().toLowerCase(); }
function calcIniciales(fullName: string): string {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "SC";
  return ((parts[0][0] || "") + (parts[1] ? parts[1][0] : "")).toUpperCase();
}
function formatFechaEs(isoDate: string): string {
  if (!isoDate) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return isoDate;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12, 0, 0));
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${dias[d.getUTCDay()]}, ${d.getUTCDate()} de ${meses[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

type Ctx = {
  email: string; nombre: string; apellidos: string;
  telefonoNumero: string | null; telefonoPais: string | null;
  pedidoId: string | null; paymentIntentId: string | null;
  amount: number | null; currency: string | null;
};

async function activar(db: SupabaseClient, ctx: Ctx): Promise<void> {
  const { email } = ctx;
  if (!email) { console.error("webhook: evento sin email"); return; }

  let cursoId: string | null = null;
  if (ctx.pedidoId) {
    const { data: ped } = await db.from("pedidos").select("id, curso_id").eq("id", ctx.pedidoId).maybeSingle();
    cursoId = ped?.curso_id ?? null;
    await db.from("pedidos").update({
      estatus: "pagado",
      stripe_payment_intent: ctx.paymentIntentId,
      monto_centavos: ctx.amount,
      moneda: ctx.currency,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", ctx.pedidoId);
  }
  if (!cursoId) {
    const { data: curso } = await db.from("cursos").select("id").eq("slug", "happiness-workshop-digital").maybeSingle();
    cursoId = curso?.id ?? null;
  }
  if (!cursoId) { console.error("webhook: sin curso para activar"); return; }

  const { data: existingPersona } = await db.from("personas").select("id").eq("email", email).maybeSingle();
  let personaId = existingPersona?.id ?? null;
  if (!personaId) {
    const { data: created, error: pErr } = await db.from("personas").insert({
      email, nombre: ctx.nombre, apellidos: ctx.apellidos, rol: "participante", estatus: "activo", origen: "integración",
      telefono_numero: ctx.telefonoNumero, telefono_pais: ctx.telefonoPais, perfil_completado: false,
    }).select("id").single();
    if (pErr) { console.error("webhook: persona", pErr.message); return; }
    personaId = created.id;
  }

  let token: string;
  let invitacionId: string | null = null;
  const { data: invExist } = await db.from("invitaciones").select("id, token")
    .eq("curso_id", cursoId).eq("email_destinatario", email)
    .in("estatus", ["activa", "pendiente"]).limit(1).maybeSingle();
  if (invExist) {
    token = invExist.token; invitacionId = invExist.id;
  } else {
    token = newInvitationToken();
    const expira = new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString();
    const { data: invNew, error: iErr } = await db.from("invitaciones").insert({
      token, curso_id: cursoId, email_destinatario: email,
      origen: "alta-ventas", estatus: "activa", persona_id: personaId, expira_el: expira,
    }).select("id").single();
    if (iErr) { console.error("webhook: invitacion", iErr.message); return; }
    invitacionId = invNew.id;
  }

  if (ctx.pedidoId) {
    await db.from("pedidos").update({ persona_id: personaId, invitacion_id: invitacionId, updated_at: new Date().toISOString() }).eq("id", ctx.pedidoId);
  }

  const { data: curso } = await db.from("cursos")
    .select("titulo, fecha_inicio, hora_sesion, facilitador_nombre, facilitador_email, facilitador_telefono, facilitador_avatar_url, facilitador_mensaje")
    .eq("id", cursoId).maybeSingle();
  const linkInvitacion = `${PORTAL_BASE}/?invite=${token}`;
  try {
    await fetch(GHL_WEBHOOK, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email, nombre: ctx.nombre, apellidos: ctx.apellidos, rol: "participante",
        cursoNombre: "Happiness Workshop Digital",
        primeraSesionFecha: formatFechaEs(String(curso?.fecha_inicio ?? "")),
        primeraSesionHora: String(curso?.hora_sesion ?? ""),
        linkInvitacion,
        coordinadorNombre: String(curso?.facilitador_nombre ?? ""),
        coordinadorEmail: String(curso?.facilitador_email ?? ""),
        coordinadorWhatsapp: String(curso?.facilitador_telefono ?? ""),
        coordinadorFotoUrl: String(curso?.facilitador_avatar_url ?? ""),
        coordinadorMensaje: String(curso?.facilitador_mensaje ?? ""),
        coordinadorIniciales: calcIniciales(String(curso?.facilitador_nombre ?? "")),
      }),
    });
  } catch (e) {
    console.error("webhook: GHL falló", e instanceof Error ? e.message : String(e));
  }
  console.log(`webhook: activado ${email} (invite ${token})`);
}

function ctxFromPaymentIntent(pi: any): Ctx {
  const md = pi.metadata ?? {};
  return {
    email: normalizeEmail(md.email ?? pi.receipt_email ?? ""),
    nombre: String(md.nombre ?? "").trim(),
    apellidos: String(md.apellidos ?? "").trim(),
    telefonoNumero: String(md.telefono_numero ?? "").trim() || null,
    telefonoPais: String(md.telefono_pais ?? "").trim() || null,
    pedidoId: String(md.pedido_id ?? "") || null,
    paymentIntentId: pi.id ?? null,
    amount: pi.amount ?? pi.amount_received ?? null,
    currency: pi.currency ?? null,
  };
}

function ctxFromSession(s: any): Ctx {
  const md = s.metadata ?? {};
  return {
    email: normalizeEmail(s.customer_details?.email ?? md.email ?? ""),
    nombre: String(md.nombre ?? "").trim(),
    apellidos: String(md.apellidos ?? "").trim(),
    telefonoNumero: String(md.telefono_numero ?? "").trim() || null,
    telefonoPais: String(md.telefono_pais ?? "").trim() || null,
    pedidoId: String(md.pedido_id ?? s.client_reference_id ?? "") || null,
    paymentIntentId: typeof s.payment_intent === "string" ? s.payment_intent : null,
    amount: s.amount_total ?? null,
    currency: s.currency ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });

  const secret = Deno.env.get("STRIPE_SECRET_KEY");
  const whSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret || !whSecret) return new Response("config incompleta", { status: 500 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("sin firma", { status: 400 });

  const raw = await req.text();
  const stripe = new Stripe(secret, { apiVersion: "2024-06-20", httpClient: Stripe.createFetchHttpClient() });

  let event: any;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, whSecret, undefined, Stripe.createSubtleCryptoProvider());
  } catch (e) {
    console.error("webhook: firma inválida", e instanceof Error ? e.message : String(e));
    return new Response("firma inválida", { status: 400 });
  }

  const db = getDb();

  const { error: insErr } = await db.from("stripe_eventos").insert({ id: event.id, tipo: event.type, payload: event });
  if (insErr) {
    if ((insErr as any).code === "23505") return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    console.error("webhook: log evento", insErr.message);
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      await activar(db, ctxFromPaymentIntent(event.data.object));
    } else if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      if (s.payment_status === "paid" || s.status === "complete") await activar(db, ctxFromSession(s));
    }
    await db.from("stripe_eventos").update({ procesado: true }).eq("id", event.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("webhook: proceso", msg);
    await db.from("stripe_eventos").update({ error: msg }).eq("id", event.id);
    return new Response("error interno", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
});
