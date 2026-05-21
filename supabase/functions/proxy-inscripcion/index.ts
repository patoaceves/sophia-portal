// SOPHIA Portal · proxy-inscripcion
//
// Proxy server-side para el webhook de Airtable Automations.
// El browser NO puede llamar hooks.airtable.com directamente porque
// Airtable no incluye headers CORS — este edge function actúa de puente.
//
// POST /proxy-inscripcion
// Body: { token, enviadoEn, cohorteId, cohorteNombre, participantes[] }
// Response 200: { ok: true, mensaje: "N participantes recibidos" }
//
// Seguridad: valida IMPORT_PUBLIC_TOKEN antes de reenviar.
// No requiere JWT de Supabase Auth (equipo de ventas no tiene login).

const AIRTABLE_WEBHOOK_URL = Deno.env.get("AIRTABLE_INSCRIPCION_WEBHOOK") ?? "";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Método no permitido" }, 405);

  try {
    // ── 1. Leer y parsear body ──────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ ok: false, error: "Body inválido – se esperaba JSON" }, 400);
    }

    // ── 2. Validar token estático ───────────────────────────────────────
    const expectedToken = Deno.env.get("IMPORT_PUBLIC_TOKEN");
    if (!expectedToken) {
      console.error("IMPORT_PUBLIC_TOKEN no configurado en Supabase secrets");
      return jsonResponse({ ok: false, error: "Configuración incompleta del servidor" }, 500);
    }
    if (body.token !== expectedToken) {
      console.warn("proxy-inscripcion: token inválido recibido");
      return jsonResponse({ ok: false, error: "Token inválido" }, 401);
    }

    // ── 3. Validar que vengan participantes ────────────────────────────
    const participantes = body.participantes;
    if (!Array.isArray(participantes) || participantes.length === 0) {
      return jsonResponse({ ok: false, error: "No se recibieron participantes" }, 400);
    }
    if (participantes.length > 15) {
      return jsonResponse({ ok: false, error: "Máximo 15 participantes por envío" }, 400);
    }

    // ── 4. Validar que exista webhook destino ──────────────────────────
    if (!AIRTABLE_WEBHOOK_URL) {
      console.error("AIRTABLE_INSCRIPCION_WEBHOOK no configurado en Supabase secrets");
      return jsonResponse({ ok: false, error: "Webhook de destino no configurado" }, 500);
    }

    // ── 5. Reenviar a Airtable (server-side, sin CORS issues) ──────────
    const forwardRes = await fetch(AIRTABLE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!forwardRes.ok) {
      const errText = await forwardRes.text().catch(() => "(sin respuesta)");
      console.error(`proxy-inscripcion: Airtable devolvió ${forwardRes.status}: ${errText}`);
      return jsonResponse(
        { ok: false, error: `Error del servidor de destino (${forwardRes.status})` },
        502,
      );
    }

    const count = participantes.length;
    console.log(`proxy-inscripcion: ${count} participante(s) enviados a Airtable OK`);
    return jsonResponse({
      ok: true,
      mensaje: `${count} participante${count !== 1 ? "s" : ""} recibido${count !== 1 ? "s" : ""} correctamente`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("proxy-inscripcion fatal:", msg);
    return jsonResponse({ ok: false, error: "Error interno del servidor" }, 500);
  }
});
