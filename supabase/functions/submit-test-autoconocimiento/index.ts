// SOPHIA Portal · submit-test-autoconocimiento (inlined for dashboard deploy)
//
// Recibe las 24 respuestas Likert (1-5) de la autoevaluación VIA de
// fortalezas de carácter (Peterson & Seligman, 2004). Calcula:
//   - score por fortaleza (1-5, igual al valor Likert porque hay 1 pregunta por fortaleza)
//   - ranking de las 24 fortalezas ordenadas descendentemente
//   - top 5 = signature strengths
//   - promedio por virtud (6 virtudes) + banda Alto/Medio/Bajo + análisis textual
//
// Empaqueta todo en RespuestasAutoeval.respuestasJSON.
//
// POST /submit-test-autoconocimiento
// Body: { inscripcionId: string, respuestas: { S1..T5: number 1..5 } }
// Headers: Authorization: Bearer <supabase_jwt>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ============================================================================
// AIRTABLE CONSTANTS & HELPERS
// ============================================================================

const BASES = {
  PORTAL: "app0S6GrJQ8YatvCc",
  CRM: "app1SbOC98k2OP5m1",
} as const;

const TABLES = {
  INSCRIPCIONES: "tblIT40GILMUHhLKK",
  RESPUESTAS_AUTOEVAL: "tblNhTCikXms43AJz",
  PERSONAS: "tbl5XKtg0mRfLeFYH",
  PERSONAS_PORTAL: "tblwo4xOFhmx2TznJ",
} as const;

const FIELDS = {
  INSCRIPCIONES: {
    PERSONA: "fldsgcanUDaXzX20x",
  },
  RESPUESTAS_AUTOEVAL: {
    INSCRIPCION: "fldu7jj4hqe1dCIMZ",
    AUTOEVALUACION: "fldnf5Mi14PrPmQ7q",
    FECHA_ENTREGA: "fldTwTB4Vdgoqay8y",
    RESPUESTAS_JSON: "fldOJGIxOvZtW5h5h",
  },
  PERSONAS_CRM: {
    AUTH_USER_ID: "fldg3kYs6c4xOoYkq",
    EMAIL: "fldJlxMp6NKCpvAuv",
    NOMBRE: "fldEbEI3pLEAmlYAe",
    APELLIDOS: "fldCnRa0XFvH1FtfQ",
    ROL: "fldOF0bnjfErxEOCO",
  },
  PERSONAS_PORTAL: {
    NOMBRE: "fldhTiwmmXtIIS8dD",
    EMAIL: "fldnRbi4mJRtfuAmV",
    AUTH_USER_ID: "fldSKACBNXloxYRBc",
  },
} as const;

// ⚠️ Pega aquí el record ID del registro en la tabla `Autoevaluaciones`
// con Título "Autoevaluación VIA: Fortalezas de carácter" y Tipo "autoconocimiento".
// Mientras esté en placeholder, NO pasa validación de Airtable (linked field
// con id inválido falla al crear el record), así que la function devuelve 500.
// Crear el registro, copiar su `rec...` ID, pegarlo aquí, re-deploy.
const KNOWN_IDS = {
  AUTOCONOCIMIENTO_VIA: "recDLCMOgTZChS6Yf",
} as const;

const AIRTABLE_API = "https://api.airtable.com/v0";

interface AirtableRecord {
  id: string;
  createdTime?: string;
  fields: Record<string, unknown>;
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

function getAirtablePAT(): string {
  const pat = Deno.env.get("AIRTABLE_PAT");
  if (!pat) throw new Error("AIRTABLE_PAT not configured");
  return pat;
}

async function listRecords(
  baseId: string,
  tableId: string,
  options: {
    filterByFormula?: string;
    fields?: string[];
    maxRecords?: number;
    pageSize?: number;
  } = {},
): Promise<AirtableRecord[]> {
  const pat = getAirtablePAT();
  const all: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("returnFieldsByFieldId", "true");
    if (options.filterByFormula) params.set("filterByFormula", options.filterByFormula);
    if (options.maxRecords) params.set("maxRecords", String(options.maxRecords));
    if (options.pageSize) params.set("pageSize", String(options.pageSize));
    if (offset) params.set("offset", offset);
    options.fields?.forEach((f) => params.append("fields[]", f));

    const res = await fetch(`${AIRTABLE_API}/${baseId}/${tableId}?${params}`, {
      headers: { Authorization: `Bearer ${pat}` },
    });
    if (!res.ok) {
      throw new Error(`Airtable list failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as AirtableListResponse;
    all.push(...data.records);
    offset = data.offset;
    if (options.maxRecords && all.length >= options.maxRecords) break;
  } while (offset);

  return all;
}

async function createRecord(
  baseId: string,
  tableId: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  const pat = getAirtablePAT();
  const res = await fetch(`${AIRTABLE_API}/${baseId}/${tableId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields, returnFieldsByFieldId: true }),
  });
  if (!res.ok) {
    throw new Error(`Airtable create failed: ${res.status} ${await res.text()}`);
  }
  return await res.json();
}

async function updateRecord(
  baseId: string,
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  const pat = getAirtablePAT();
  const res = await fetch(`${AIRTABLE_API}/${baseId}/${tableId}/${recordId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields, returnFieldsByFieldId: true }),
  });
  if (!res.ok) {
    throw new Error(`Airtable update failed: ${res.status} ${await res.text()}`);
  }
  return await res.json();
}

function eqFormula(fieldId: string, value: string): string {
  const escaped = value.replace(/'/g, "\\'");
  return `{${fieldId}} = '${escaped}'`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ============================================================================
// CORS
// ============================================================================

const ALLOWED_ORIGINS = [
  "https://portal.sophiamx.org",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5500",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin =
    ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
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
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

function errorResponse(req: Request, message: string, status = 400): Response {
  return jsonResponse(req, { error: message }, status);
}

// ============================================================================
// AUTH HELPER
// ============================================================================

interface AuthedUser {
  authUserId: string;
  email: string;
  personaId: string;
  personaPortalId: string;
  rol: string;
  nombre: string;
  apellidos: string;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

async function requireAuth(req: Request): Promise<AuthedUser> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing Authorization header");
  }
  const jwt = authHeader.slice("Bearer ".length);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseKey) {
    throw new HttpError(500, "Supabase env not configured");
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: userData, error } = await supabase.auth.getUser(jwt);
  if (error || !userData.user) {
    throw new HttpError(401, "Invalid JWT");
  }

  const authUserId = userData.user.id;
  const email = normalizeEmail(userData.user.email ?? "");
  if (!email) throw new HttpError(401, "User has no email");

  let personas = await listRecords(BASES.CRM, TABLES.PERSONAS, {
    filterByFormula: eqFormula(FIELDS.PERSONAS_CRM.AUTH_USER_ID, authUserId),
    maxRecords: 1,
  });

  if (personas.length === 0) {
    personas = await listRecords(BASES.CRM, TABLES.PERSONAS, {
      filterByFormula: `LOWER(TRIM({${FIELDS.PERSONAS_CRM.EMAIL}})) = '${email.replace(/'/g, "\\'")}'`,
      maxRecords: 1,
    });

    if (personas.length > 0 && !personas[0].fields[FIELDS.PERSONAS_CRM.AUTH_USER_ID]) {
      await updateRecord(BASES.CRM, TABLES.PERSONAS, personas[0].id, {
        [FIELDS.PERSONAS_CRM.AUTH_USER_ID]: authUserId,
      });
    }
  }

  if (personas.length === 0) {
    throw new HttpError(403, "No Persona record found. Run auth-bootstrap first.");
  }

  const p = personas[0];
  const rol = (p.fields[FIELDS.PERSONAS_CRM.ROL] as string) ?? "participante";

  const personasPortal = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
    filterByFormula: eqFormula(FIELDS.PERSONAS_PORTAL.AUTH_USER_ID, authUserId),
    maxRecords: 1,
  });
  let personaPortalId = personasPortal[0]?.id;
  if (!personaPortalId) {
    const byEmail = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
      filterByFormula: `LOWER(TRIM({${FIELDS.PERSONAS_PORTAL.EMAIL}})) = '${email.replace(/'/g, "\\'")}'`,
      maxRecords: 1,
    });
    personaPortalId = byEmail[0]?.id;
  }
  if (!personaPortalId) {
    throw new HttpError(
      403,
      "Persona no encontrada en sync de Portal. Espera unos minutos a que Airtable sincronice CRM→Portal o contacta a soporte.",
    );
  }

  return {
    authUserId,
    email,
    personaId: p.id,
    personaPortalId,
    rol,
    nombre: (p.fields[FIELDS.PERSONAS_CRM.NOMBRE] as string) ?? "",
    apellidos: (p.fields[FIELDS.PERSONAS_CRM.APELLIDOS] as string) ?? "",
  };
}

// ============================================================================
// MODELO VIA · 24 fortalezas, 6 virtudes
// ============================================================================

// IDs de preguntas (deben coincidir EXACTAMENTE con los del wizard en
// assets/js/test-autoconocimiento.js → PREGUNTAS).
const FORTALEZAS: Array<{ id: string; virtud: Virtud; nombre: string }> = [
  // I. Sabiduría
  { id: "S1", virtud: "sabiduria", nombre: "Creatividad" },
  { id: "S2", virtud: "sabiduria", nombre: "Curiosidad" },
  { id: "S3", virtud: "sabiduria", nombre: "Apertura de mente" },
  { id: "S4", virtud: "sabiduria", nombre: "Deseo de aprender" },
  { id: "S5", virtud: "sabiduria", nombre: "Perspectiva" },
  // II. Coraje
  { id: "C1", virtud: "coraje", nombre: "Valentía" },
  { id: "C2", virtud: "coraje", nombre: "Persistencia" },
  { id: "C3", virtud: "coraje", nombre: "Integridad" },
  { id: "C4", virtud: "coraje", nombre: "Vitalidad" },
  // III. Humanidad
  { id: "H1", virtud: "humanidad", nombre: "Amor" },
  { id: "H2", virtud: "humanidad", nombre: "Amabilidad" },
  { id: "H3", virtud: "humanidad", nombre: "Inteligencia social" },
  // IV. Justicia
  { id: "J1", virtud: "justicia", nombre: "Ciudadanía" },
  { id: "J2", virtud: "justicia", nombre: "Justicia" },
  { id: "J3", virtud: "justicia", nombre: "Liderazgo" },
  // V. Moderación
  { id: "M1", virtud: "moderacion", nombre: "Perdón y compasión" },
  { id: "M2", virtud: "moderacion", nombre: "Humildad" },
  { id: "M3", virtud: "moderacion", nombre: "Prudencia" },
  { id: "M4", virtud: "moderacion", nombre: "Autorregulación" },
  // VI. Trascendencia
  { id: "T1", virtud: "trascendencia", nombre: "Apreciación de la belleza" },
  { id: "T2", virtud: "trascendencia", nombre: "Gratitud" },
  { id: "T3", virtud: "trascendencia", nombre: "Esperanza" },
  { id: "T4", virtud: "trascendencia", nombre: "Sentido del humor" },
  { id: "T5", virtud: "trascendencia", nombre: "Espiritualidad" },
];

type Virtud = "sabiduria" | "coraje" | "humanidad" | "justicia" | "moderacion" | "trascendencia";

const VIRTUDES: Virtud[] = ["sabiduria", "coraje", "humanidad", "justicia", "moderacion", "trascendencia"];

const VIRTUD_NOMBRES: Record<Virtud, string> = {
  sabiduria:     "Sabiduría y Conocimiento",
  coraje:        "Coraje",
  humanidad:     "Humanidad",
  justicia:      "Justicia",
  moderacion:    "Moderación",
  trascendencia: "Trascendencia",
};

// Análisis textual por virtud y banda (Alto / Medio / Bajo).
// Banda se calcula sobre el promedio (escala 1-5):
//   Alto: >= 4.0
//   Medio: >= 2.6
//   Bajo: < 2.6
const ANALISIS: Record<Virtud, { Alto: string; Medio: string; Bajo: string }> = {
  sabiduria: {
    Alto: "Tu mirada del mundo está nutrida por la curiosidad, el deseo de aprender y la apertura. Eres alguien a quien las preguntas no le pesan — le encienden. Cuida este músculo leyendo cosas que retan tu visión y conversando con personas distintas a ti.",
    Medio: "Tienes una relación viva con el conocimiento, aunque por momentos la rutina la opaca. Reserva ratos cortos para leer algo nuevo, escuchar una idea ajena con genuina curiosidad, o simplemente preguntar más antes de opinar.",
    Bajo: "Hoy las preguntas grandes y la curiosidad están en pausa. No es defecto, es invitación: el conocimiento se vuelve a despertar leyendo un libro corto, viendo una charla sobre algo lejano a tu trabajo, o haciéndote esa pregunta que llevas posponiendo.",
  },
  coraje: {
    Alto: "Tienes una fuerza interior reconocible: persistencia para terminar lo que empiezas, valentía para decir lo incómodo, integridad para sostenerte aunque cueste. Esa firmeza es valiosa — úsala también para defender a otros, no sólo para resistir.",
    Medio: "Cuando algo te importa de verdad, sacas el coraje. Pero hay áreas donde aún te repliegas o postergas. Identifica una conversación pendiente o una meta abandonada y dale el primer paso, aunque sea torpe.",
    Bajo: "Hoy el coraje se siente lejos — quizá por desgaste, miedo o falta de claridad. Empieza pequeño: una verdad dicha sin filtro, un proyecto retomado por 15 minutos. La valentía no aparece esperándola; aparece haciendo.",
  },
  humanidad: {
    Alto: "Eres alguien que ve a las personas — no como funciones, sino como mundos. Esa capacidad de amar, ser amable y leer al otro es uno de los predictores más sólidos de una vida feliz. Cuídala dándole espacio: a veces estar cerca pesa, y eso también hay que honrarlo.",
    Medio: "Tienes vínculos importantes y los cuidas, pero hay momentos en que la prisa o el ego te ganan. Pregúntate qué necesita la otra persona antes de qué quieres tú: a veces eso lo cambia todo.",
    Bajo: "Las relaciones cercanas se sienten lejos o pesadas. No es indiferencia — suele ser desgaste o miedo a abrirse. Reconectar empieza con un mensaje corto a alguien que extrañas, sin esperar respuesta inmediata.",
  },
  justicia: {
    Alto: "Tienes un sentido robusto de lo colectivo: cooperas, lideras, defiendes lo justo. Eres alguien que hace mejor al grupo. Cuida no quemarte cargando lo que otros no quieren cargar; delegar también es justicia.",
    Medio: "Cuando ves una injusticia te incomoda, pero no siempre actúas — o lo haces y te sientes solo. Eso es normal. Busca aliados antes de pelear solo: la justicia sostenida es siempre tarea colectiva.",
    Bajo: "Hoy el sentido del bien común está adormecido. Quizá demasiado peso personal, quizá decepciones. Empieza por algo cerca: un favor genuino a un compañero, una invitación a alguien que se ve excluido.",
  },
  moderacion: {
    Alto: "Sabes cuándo callar, cuándo perdonar, cuándo soltar el impulso. Esa templanza es rara y muy valiosa. Cuida no convertir la moderación en distancia: a veces lo justo es decir lo difícil, no callárselo.",
    Medio: "Tienes momentos de autorregulación y momentos en que el impulso o el orgullo te ganan. Reconócelos sin juicio: la prudencia se entrena con la pausa de tres respiraciones antes de actuar.",
    Bajo: "Hoy te cuesta frenarte — en el consumo, en la palabra, en la reacción emocional. No es debilidad de carácter, es señal de cansancio o de heridas no atendidas. Empieza identificando un disparador específico y poniéndole un plan.",
  },
  trascendencia: {
    Alto: "Vives conectado con algo más grande que tú mismo: la belleza, la gratitud, el humor, el sentido espiritual. Esa apertura te ancla cuando las circunstancias se mueven. Comparte lo que ves — el mundo necesita personas que recuerden lo que está ahí pero pocos miran.",
    Medio: "Tienes destellos de asombro, gratitud y humor, pero la prisa los borra. Reservar tiempo para lo bello y lo silencioso no es lujo: es nutrición. Empieza con 5 min al día sin pantalla, observando algo que normalmente ignoras.",
    Bajo: "La trascendencia está en pausa: la belleza, la gratitud, la pregunta espiritual no aparecen mucho. Es invitación, no defecto. Tres cosas buenas al día, durante 21 días, suelen reabrir la puerta.",
  },
};

function bandFor(promedio: number): "Alto" | "Medio" | "Bajo" {
  if (promedio >= 4.0) return "Alto";
  if (promedio >= 2.6) return "Medio";
  return "Bajo";
}

function validateAnswers(
  respuestas: Record<string, unknown>,
): { ok: true } | { ok: false; error: string } {
  for (const f of FORTALEZAS) {
    const v = respuestas[f.id];
    if (typeof v !== "number" || v < 1 || v > 5 || !Number.isInteger(v)) {
      return { ok: false, error: `Respuesta inválida o faltante: ${f.id}` };
    }
  }
  return { ok: true };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  const optionsRes = handleOptions(req);
  if (optionsRes) return optionsRes;

  if (req.method !== "POST") {
    return errorResponse(req, "Method not allowed", 405);
  }

  try {
    const user = await requireAuth(req);

    let body: { inscripcionId?: string; respuestas?: Record<string, number> };
    try {
      body = await req.json();
    } catch {
      return errorResponse(req, "Invalid JSON body", 400);
    }

    const { inscripcionId, respuestas } = body;
    if (!inscripcionId) return errorResponse(req, "inscripcionId is required", 400);
    if (!respuestas) return errorResponse(req, "respuestas is required", 400);

    const valid = validateAnswers(respuestas);
    if (!valid.ok) return errorResponse(req, valid.error, 400);

    // 1. Validate that the Inscripción belongs to this user.
    const insc = await listRecords(BASES.PORTAL, TABLES.INSCRIPCIONES, {
      filterByFormula: `RECORD_ID()='${inscripcionId}'`,
      maxRecords: 1,
    });
    if (insc.length === 0) {
      throw new HttpError(404, "Inscripción not found");
    }
    const ownerPersonas =
      (insc[0].fields[FIELDS.INSCRIPCIONES.PERSONA] as string[]) ?? [];
    if (!ownerPersonas.includes(user.personaPortalId)) {
      throw new HttpError(403, "Inscripción does not belong to this user");
    }

    // 2. Compute scores + ranking + virtud aggregates + analisis
    const ranking = FORTALEZAS.map((f) => ({
      id: f.id,
      fortaleza: f.nombre,
      virtud: f.virtud,
      score: respuestas[f.id]!,
    }));

    // Sort descending. Estable: rompe empates por orden original (S1, S2, ...
    // = orden VIA canónico).
    ranking.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return FORTALEZAS.findIndex((f) => f.id === a.id) -
             FORTALEZAS.findIndex((f) => f.id === b.id);
    });

    const signatureStrengths = ranking.slice(0, 5);

    const virtudes: Record<string, { promedio: number; banda: string; analisis: string }> = {};
    for (const v of VIRTUDES) {
      const fs = FORTALEZAS.filter((f) => f.virtud === v);
      const sum = fs.reduce((s, f) => s + (respuestas[f.id] ?? 0), 0);
      const prom = fs.length > 0 ? sum / fs.length : 0;
      const banda = bandFor(prom);
      virtudes[v] = {
        promedio: Math.round(prom * 100) / 100,
        banda,
        analisis: ANALISIS[v][banda],
      };
    }

    const completedAt = new Date().toISOString();

    // 3. Pack everything into a JSON payload
    const payload = {
      version: 1,
      tipo: "autoconocimiento",
      answers: respuestas,
      ranking,
      signatureStrengths,
      virtudes,
      virtudNombres: VIRTUD_NOMBRES,
      completedAt,
    };

    // 4. Save in RespuestasAutoeval (reusing the same table as test-felicidad,
    //    but with a different AUTOEVALUACION link so we can filter later).
    const rec = await createRecord(BASES.PORTAL, TABLES.RESPUESTAS_AUTOEVAL, {
      [FIELDS.RESPUESTAS_AUTOEVAL.INSCRIPCION]: [inscripcionId],
      [FIELDS.RESPUESTAS_AUTOEVAL.AUTOEVALUACION]: [KNOWN_IDS.AUTOCONOCIMIENTO_VIA],
      [FIELDS.RESPUESTAS_AUTOEVAL.FECHA_ENTREGA]: completedAt,
      [FIELDS.RESPUESTAS_AUTOEVAL.RESPUESTAS_JSON]: JSON.stringify(payload),
    });

    return jsonResponse(req, {
      respuestaId: rec.id,
      ranking,
      signatureStrengths,
      virtudes,
      virtudNombres: VIRTUD_NOMBRES,
      completedAt,
    });
  } catch (e) {
    if (e instanceof HttpError) {
      return errorResponse(req, e.message, e.status);
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("submit-test-autoconocimiento error:", msg);
    return errorResponse(req, msg, 500);
  }
});
