// SOPHIA Portal · list-cursos-publico
//
// Lista pública de cohortes ABIERTAS para alimentar el dropdown de la
// página /embed/importar-participantes. Validada por un token estático
// que se comparte con la página HTML (no JWT, no Supabase Auth — esta
// página NO requiere login del portal).
//
// GET /list-cursos-publico?token=...
// Response 200: { ok: true, cursos: [{id, nombre, fechaInicio, fechaFin}] }
//
// Internamente devuelve "Cohortes" (la edición del curso con fecha) pero
// al equipo de ventas le llamamos "Curso" porque es el nombre humano que
// les hace sentido (no saben la jerarquía Curso → Cohorte interna).

const BASES = { PORTAL: "app0S6GrJQ8YatvCc" } as const;
const TABLES = { COHORTES: "tblMwkKfk6U7a75Ja" } as const;
const FIELDS = {
  COHORTES: {
    NOMBRE: "fldbp3zZdJr03jCVD",
    ESTATUS: "fld87QVcZl6GvQg2k",
    FECHA_INICIO: "fldoqWrG9zEdeKWGt",
    FECHA_FIN: "fldnm9B7nvIjyKZre",
    HORA_INICIO: "fld65dDf16bS1wR25",
  },
} as const;

const AIRTABLE_API = "https://api.airtable.com/v0";

// CORS abierto para que pueda llamarse desde cualquier dominio donde se
// embeba la página (GHL, etc.). El token estático es la única defensa.
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
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

function errorResponse(msg: string, status = 400, code?: string): Response {
  return jsonResponse({ ok: false, error: msg, code }, status);
}

async function airtableFetch(path: string) {
  const pat = Deno.env.get("AIRTABLE_PAT");
  if (!pat) throw new Error("AIRTABLE_PAT env var missing");
  const res = await fetch(`${AIRTABLE_API}${path}`, {
    headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.method !== "GET") return errorResponse("Method not allowed", 405);

  try {
    // Validar token estático compartido con la página /embed/
    const expectedToken = Deno.env.get("IMPORT_PUBLIC_TOKEN");
    if (!expectedToken) {
      console.error("IMPORT_PUBLIC_TOKEN env var missing — configurar en Supabase");
      return errorResponse("Configuration error", 500, "no_token_configured");
    }
    const url = new URL(req.url);
    const receivedToken = url.searchParams.get("token") ?? "";
    if (receivedToken !== expectedToken) {
      return errorResponse("Token inválido", 401, "invalid_token");
    }

    // Listar cohortes con estatus "abierta"
    const params = new URLSearchParams();
    params.set("returnFieldsByFieldId", "true");
    params.set("filterByFormula", `{${FIELDS.COHORTES.ESTATUS}} = 'abierta'`);
    params.append("fields[]", FIELDS.COHORTES.NOMBRE);
    params.append("fields[]", FIELDS.COHORTES.ESTATUS);
    params.append("fields[]", FIELDS.COHORTES.FECHA_INICIO);
    params.append("fields[]", FIELDS.COHORTES.FECHA_FIN);
    params.append("fields[]", FIELDS.COHORTES.HORA_INICIO);

    const data = await airtableFetch(`/${BASES.PORTAL}/${TABLES.COHORTES}?${params}`);
    const records = (data.records ?? []) as Array<{ id: string; fields: Record<string, unknown> }>;

    const cursos = records.map(r => ({
      id: r.id,
      nombre: (r.fields[FIELDS.COHORTES.NOMBRE] as string) ?? "",
      fechaInicio: (r.fields[FIELDS.COHORTES.FECHA_INICIO] as string) ?? "",
      fechaFin: (r.fields[FIELDS.COHORTES.FECHA_FIN] as string) ?? "",
      horaInicio: (r.fields[FIELDS.COHORTES.HORA_INICIO] as string) ?? "",
    }));

    // Orden alfabético por nombre (que típicamente tiene fecha al final)
    cursos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    return jsonResponse({ ok: true, cursos });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("list-cursos-publico fatal:", msg);
    return errorResponse("Error interno", 500, "fatal");
  }
});
