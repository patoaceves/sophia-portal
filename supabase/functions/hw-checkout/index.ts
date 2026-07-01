// SOPHIA · hw-checkout (Stripe Payment Element NATIVO + MSI)
// Endpoint público (--no-verify-jwt). Crea un pedido (pendiente) y un PaymentIntent
// con meses sin intereses habilitados. Devuelve client_secret para el Payment Element.
// La activación ocurre en hw-stripe-webhook (payment_intent.succeeded).
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_ID  (+ SUPABASE_* del runtime)

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";

const CURSO_SLUG = "happiness-workshop-digital";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "86400",
  };
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

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

function normalizeEmail(s: string): string { return String(s ?? "").trim().toLowerCase(); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405);

  try {
    const secret = Deno.env.get("STRIPE_SECRET_KEY");
    const priceId = Deno.env.get("STRIPE_PRICE_ID");
    if (!secret || !priceId) {
      return json({ ok: false, error: "Configuración de pago incompleta en el servidor" }, 500);
    }

    let body: any;
    try { body = await req.json(); } catch { return json({ ok: false, error: "Body inválido" }, 400); }

    const nombre = String(body.nombre ?? "").trim();
    const apellidos = String(body.apellidos ?? "").trim();
    const email = normalizeEmail(body.email ?? "");
    const telefonoNumero = String(body.telefono_numero ?? "").trim() || null;
    const telefonoPais = String(body.telefono_pais ?? "").trim() || null;
    const aviso = body.aviso === true || body.aviso === "true";

    if (!nombre) return json({ ok: false, error: "Falta tu nombre" }, 400);
    if (!email || !email.includes("@")) return json({ ok: false, error: "Correo inválido" }, 400);

    const db = getDb();

    const { data: curso, error: cErr } = await db
      .from("cursos").select("id").eq("slug", CURSO_SLUG).maybeSingle();
    if (cErr) return json({ ok: false, error: cErr.message }, 500);
    if (!curso) return json({ ok: false, error: "Curso no encontrado" }, 500);

    const { data: pedido, error: pErr } = await db.from("pedidos").insert({
      email, nombre, apellidos,
      telefono_pais: telefonoPais, telefono_numero: telefonoNumero,
      curso_id: curso.id,
      estatus: "pendiente", aviso_aceptado: aviso,
      metadata: { origen: "landing" },
    }).select("id").single();
    if (pErr) return json({ ok: false, error: "No se pudo crear el pedido" }, 500);

    const stripe = new Stripe(secret, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const price = await stripe.prices.retrieve(priceId);
    const amount = price.unit_amount ?? 0;
    const currency = price.currency ?? "mxn";
    if (!amount) return json({ ok: false, error: "Precio inválido" }, 500);

    const pi = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
      payment_method_options: { card: { installments: { enabled: true } } },
      receipt_email: email,
      description: `Happiness Workshop Digital · ${email}`,
      metadata: {
        pedido_id: pedido.id, curso_slug: CURSO_SLUG,
        nombre, apellidos, email,
        telefono_pais: telefonoPais ?? "", telefono_numero: telefonoNumero ?? "",
      },
    }, { idempotencyKey: `hw-${pedido.id}` });

    await db.from("pedidos").update({
      stripe_payment_intent: pi.id, monto_centavos: amount, moneda: currency,
      updated_at: new Date().toISOString(),
    }).eq("id", pedido.id);

    return json({ ok: true, client_secret: pi.client_secret, amount, currency });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("hw-checkout error:", msg);
    return json({ ok: false, error: "Error al iniciar el pago" }, 500);
  }
});
