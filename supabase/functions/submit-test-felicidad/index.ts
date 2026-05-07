// SOPHIA Portal — submit-test-felicidad (inlined for dashboard deploy)
// Receives the 16 Likert (1-5) answers, computes per-pillar scores
// (range 2-10), bands them (Alto/Medio/Bajo) → 24 hardcoded analysis
// blurbs, packs everything into RespuestasAutoeval.respuestasJSON.
//
// POST /submit-test-felicidad
// Body: { inscripcionId: string, respuestas: { AC1..FF2: number 1..5 } }
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

const KNOWN_IDS = {
  TEST_FELICIDAD: "recjMR4P4TFLvFQ4A",
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
  const isVercelPreview = /^https:\/\/sophia-portal[\w-]*\.vercel\.app$/.test(origin);
  const allowedOrigin =
    ALLOWED_ORIGINS.includes(origin) || isVercelPreview ? origin : ALLOWED_ORIGINS[0];
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

  // Lookup adicional: la tabla synced de Personas en Portal (tblwo4xOFhmx2TznJ).
  // Inscripciones.persona linkea a ESTA tabla, no a CRM, así que necesitamos
  // su record ID (distinto al de CRM) para filtrar Inscripciones.
  const personasPortal = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
    filterByFormula: eqFormula(FIELDS.PERSONAS_PORTAL.AUTH_USER_ID, authUserId),
    maxRecords: 1,
  });
  let personaPortalId = personasPortal[0]?.id;
  if (!personaPortalId) {
    // Fallback: buscar por email (la sync de CRM→Portal puede tardar)
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
// TEST DE FELICIDAD MODEL
// ============================================================================

const PILARES = [
  "autoconocimiento",
  "bienestar_emocional",
  "bienestar_fisico",
  "presencia_consciente",
  "vinculos_vitales",
  "trabajo_proposito",
  "estetica_existencial",
  "fe_filosofia",
] as const;
type Pilar = typeof PILARES[number];

const PREFIX: Record<Pilar, string> = {
  autoconocimiento: "AC",
  bienestar_emocional: "BE",
  bienestar_fisico: "BF",
  presencia_consciente: "PC",
  vinculos_vitales: "VV",
  trabajo_proposito: "TP",
  estetica_existencial: "EE",
  fe_filosofia: "FF",
};

const NOMBRE: Record<Pilar, string> = {
  autoconocimiento: "Autoconocimiento",
  bienestar_emocional: "Bienestar Emocional",
  bienestar_fisico: "Bienestar Físico",
  presencia_consciente: "Presencia Consciente",
  vinculos_vitales: "Vínculos Vitales",
  trabajo_proposito: "Trabajo con Propósito",
  estetica_existencial: "Estética Existencial",
  fe_filosofia: "Fe y Filosofía de Vida",
};

const ANALISIS: Record<Pilar, { Alto: string; Medio: string; Bajo: string }> = {
  autoconocimiento: {
    Alto: "Autoconocimiento sólido. Sabes nombrar lo que te pasa, reconocer tus patrones y ajustar tus decisiones con realismo y propósito. Mantén este músculo activo: usa una fortaleza de manera nueva cada día y registra tres cosas buenas cada noche.",
    Medio: "Vas en buen camino. Ya tienes claridad en varios aspectos pero hay momentos de duda o automatismo. Es el mejor punto para sistematizar hábitos: escribe tu Mejor Yo Posible (15 min) y revisa una fortaleza por semana.",
    Bajo: "Punto de partida claro. Hoy cuesta leer tus estados internos y orientar decisiones desde ahí. La buena noticia: el autoconocimiento se entrena con prácticas breves y consistentes. Empieza con tres cosas buenas al día y un experimento diario con una fortaleza.",
  },
  bienestar_emocional: {
    Alto: "Tu vida emocional está bien orquestada. Identificas, regulas y expresas lo que sientes con flexibilidad. Sigue cultivando lo positivo: gratitud diaria, conversaciones significativas y micro-celebraciones de tus logros.",
    Medio: "Reconoces tus emociones la mayor parte del tiempo, pero a veces las dejas dictar tus decisiones. Practica la pausa de tres respiraciones antes de reaccionar y nombra la emoción en voz alta — eso baja su intensidad de inmediato.",
    Bajo: "Ahora cuesta diferenciar entre lo que sientes, piensas y haces — y eso desgasta. No es debilidad, es falta de entrenamiento. Empieza por algo simple: un check-in emocional dos veces al día (mañana/noche) usando una rueda de emociones.",
  },
  bienestar_fisico: {
    Alto: "Tu cuerpo está al servicio de tu vida. Te mueves, descansas y comes con sentido. Mantén la consistencia: pequeños hábitos sostenidos vencen a la disciplina extrema y al heroísmo de fin de semana.",
    Medio: "Sabes lo que deberías hacer y a veces lo haces. La brecha entre intención y acción es lo que toca cerrar. Elige UN hábito ancla (ej. caminar 30 min diarios) y sostenlo 8 semanas antes de añadir otro.",
    Bajo: "Tu cuerpo te está pidiendo atención. No es necesario un plan ambicioso — basta con dormir 30 min más, beber un vaso de agua al despertar, y caminar 10 min al día. Lo simple, sostenido, transforma.",
  },
  presencia_consciente: {
    Alto: "Habitas el presente con cierta naturalidad. Ese es un activo valioso en un mundo distraído. Profundiza con prácticas formales (5–10 min de meditación al día) y momentos de silencio sin pantallas.",
    Medio: "Tienes destellos de presencia, pero la mente se va al futuro o al pasado con frecuencia. Empieza con anclajes cotidianos: respirar antes de cada comida, sentir los pies al caminar, escuchar sin pensar la respuesta.",
    Bajo: "El piloto automático domina muchos de tus días. No es problema mientras sea consciente — el reto es cuando ni te das cuenta. Prueba 3 minutos de atención plena al día durante 21 días y observa qué cambia.",
  },
  vinculos_vitales: {
    Alto: "Tus vínculos te nutren y tú los nutres. Eso es uno de los predictores más sólidos de una vida feliz. Cuida la calidad sobre la cantidad: una llamada larga vale más que diez likes.",
    Medio: "Tienes relaciones importantes, pero hay áreas para profundizar. Identifica una persona con quien quieras estar más cerca este mes y agenda algo concreto — la intencionalidad es el ingrediente que falta.",
    Bajo: "La soledad o los vínculos rotos pesan más de lo que admites. Reconectar empieza con un mensaje, no con una conversación entera. Escribe a alguien hoy sin esperar respuesta inmediata. Lo importante es abrir la puerta.",
  },
  trabajo_proposito: {
    Alto: "Tu trabajo se siente como expresión de quién eres, no como peso. Cuídalo: integra descanso, varía retos, y comparte el conocimiento que has acumulado con quienes empiezan.",
    Medio: "Hay días en que tu trabajo conecta con algo más grande y otros en que es solo obligación. Intenta articular en una frase qué impacto tiene tu trabajo en otros — esa claridad cambia la experiencia diaria.",
    Bajo: "Hoy tu trabajo se siente más como un trámite que como un camino. No tiene que ser un cambio drástico: encuentra un proyecto chico, voluntario o personal, donde tus habilidades sirvan a algo que te importe genuinamente.",
  },
  estetica_existencial: {
    Alto: "Vives con estética: cultivas la belleza, la creatividad y el detalle en lo cotidiano. Eso es vivir con dignidad humana plena. Comparte tu mirada — el mundo necesita más personas que vean belleza donde otros ven solo función.",
    Medio: "Aprecias lo bello cuando aparece, pero podrías invitarlo más a tu vida. Escucha música con atención plena, camina por un jardín sin teléfono, lee poesía 10 minutos. La belleza alimenta capas del alma que la productividad no toca.",
    Bajo: "La belleza está en pausa en tu vida — quizá por urgencia, quizá por hábito. Empieza pequeño: un objeto bello en tu escritorio, una canción que te conmueva al iniciar el día. La belleza no es lujo, es nutrición existencial.",
  },
  fe_filosofia: {
    Alto: "Tienes un marco que da sentido a tu vida — espiritual, filosófico, o ambos. Eso te ancla cuando las circunstancias se mueven. Sigue alimentándolo: lectura contemplativa, conversaciones profundas, prácticas regulares.",
    Medio: 'Tienes algunas convicciones, pero no del todo articuladas. Reservar tiempo para preguntas grandes — escribir 20 min sobre "qué creo realmente sobre X" — te ayudará a clarificar y comprometerte.',
    Bajo: "Las preguntas últimas — sentido, muerte, trascendencia — están aplazadas. No es defecto, es invitación. Lecturas, conversaciones o tradiciones contemplativas pueden abrir camino. No tienes que tener todas las respuestas; basta empezar a hacerte mejores preguntas.",
  },
};

function bandFor(score: number): "Alto" | "Medio" | "Bajo" {
  if (score >= 8) return "Alto";
  if (score >= 5) return "Medio";
  return "Bajo";
}

function nivelLabel(b: "Alto" | "Medio" | "Bajo"): string {
  return b === "Alto" ? "Fortaleza" : b === "Medio" ? "En crecimiento" : "Vulnerable";
}

function validateAnswers(
  respuestas: Record<string, unknown>,
): { ok: true } | { ok: false; error: string } {
  for (const pilar of PILARES) {
    for (const n of [1, 2]) {
      const key = `${PREFIX[pilar]}${n}`;
      const v = respuestas[key];
      if (typeof v !== "number" || v < 1 || v > 5 || !Number.isInteger(v)) {
        return { ok: false, error: `Respuesta inválida o faltante: ${key}` };
      }
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
    // RECORD_ID() filter works, but persona check has to be client-side.
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

    // 2. Compute scores, niveles, and analysis
    const scores: Record<string, number> = {};
    const niveles: Record<string, string> = {};
    const analisis: Record<string, string> = {};
    for (const pilar of PILARES) {
      const score =
        (respuestas[`${PREFIX[pilar]}1`] || 0) + (respuestas[`${PREFIX[pilar]}2`] || 0);
      const band = bandFor(score);
      scores[pilar] = score;
      niveles[pilar] = nivelLabel(band);
      analisis[pilar] = ANALISIS[pilar][band];
    }
    const completedAt = new Date().toISOString();

    // 3. Pack answers + computed results into a single JSON payload
    const payload = {
      version: 1,
      answers: respuestas,
      scores,
      niveles,
      analisis,
      pilarNombres: NOMBRE,
      completedAt,
    };

    // 4. Save in RespuestasAutoeval
    const rec = await createRecord(BASES.PORTAL, TABLES.RESPUESTAS_AUTOEVAL, {
      [FIELDS.RESPUESTAS_AUTOEVAL.INSCRIPCION]: [inscripcionId],
      [FIELDS.RESPUESTAS_AUTOEVAL.AUTOEVALUACION]: [KNOWN_IDS.TEST_FELICIDAD],
      [FIELDS.RESPUESTAS_AUTOEVAL.FECHA_ENTREGA]: completedAt,
      [FIELDS.RESPUESTAS_AUTOEVAL.RESPUESTAS_JSON]: JSON.stringify(payload),
    });

    return jsonResponse(req, {
      respuestaId: rec.id,
      scores,
      niveles,
      analisis,
      completedAt,
    });
  } catch (e) {
    if (e instanceof HttpError) {
      return errorResponse(req, e.message, e.status);
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("submit-test-felicidad error:", msg);
    return errorResponse(req, msg, 500);
  }
});
