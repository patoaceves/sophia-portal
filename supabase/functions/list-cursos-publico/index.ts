// SOPHIA Portal · list-cursos-publico (Postgres)
//
// Lista pública de cursos PUBLICADOS para alimentar el dropdown de la
// página /embed/importar-participantes. Validada por IMPORT_PUBLIC_TOKEN.
//
// GET /list-cursos-publico?token=...
// Response 200: { ok: true, cursos: [{id, nombre, fechaInicio, fechaFin, horaInicio}] }

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ALLOWED_ORIGIN_HEADER = "*";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN_HEADER,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(), "Content-Type": "application/json" } });
}

function errorResponse(msg: string, status = 400, code?: string): Response {
  return jsonResponse({ ok: false, error: msg, code }, status);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.method !== "GET") return errorResponse("Method not allowed", 405);

  try {
    const expectedToken = Deno.env.get("IMPORT_PUBLIC_TOKEN");
    if (!expectedToken) {
      console.error("IMPORT_PUBLIC_TOKEN env var missing");
      return errorResponse("Configuration error", 500, "no_token_configured");
    }
    const url = new URL(req.url);
    const receivedToken = url.searchParams.get("token") ?? "";
    if (receivedToken !== expectedToken) {
      return errorResponse("Token inválido", 401, "invalid_token");
    }

    const db = getDb();
    const { data: cursosData, error } = await db
      .from("cursos")
      .select("id, titulo, fecha_inicio, fecha_fin, hora_sesion")
      .eq("estatus", "published")
      .order("titulo", { ascending: true });
    if (error) {
      console.error("list-cursos-publico db error:", error);
      return errorResponse("Error interno", 500, "db_error");
    }

    const cursos = (cursosData ?? []).map(c => ({
      id: c.id,
      nombre: c.titulo ?? "",
      fechaInicio: c.fecha_inicio ?? "",
      fechaFin: c.fecha_fin ?? "",
      horaInicio: c.hora_sesion ?? "",
    }));

    return jsonResponse({ ok: true, cursos });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("list-cursos-publico fatal:", msg);
    return errorResponse("Error interno", 500, "fatal");
  }
});
