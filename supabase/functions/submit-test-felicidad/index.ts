// SOPHIA Portal · submit-test-felicidad (Postgres, clean)
//
// Recibe las 16 respuestas Likert (1-5), calcula scores por pilar (rango 2-10),
// banda (Alto/Medio/Bajo), 24 blurbs de análisis. Guarda en tests_felicidad.
//
// POST /submit-test-felicidad
// Body: { inscripcionId: <UUID>, respuestas: { AC1..FF2: 1..5 } }
// Returns: { respuestaId, scores, niveles, analisis, completedAt }

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

type Persona = {
  id: string; auth_user_id: string; email: string;
  nombre: string; apellidos: string; rol: string; avatar_url: string | null;
};

function normalizeEmail(email: string): string { return email.trim().toLowerCase(); }

async function requireUser(req: Request): Promise<Persona> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new ApiError(401, "missing_auth", "Falta header Authorization");

  const url = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !publicKey) throw new ApiError(500, "config_error", "Supabase env no configurado");

  const authClient = createClient(url, publicKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) throw new ApiError(401, "invalid_token", "Token inválido o expirado");

  const email = normalizeEmail(user.email ?? "");
  if (!email) throw new ApiError(401, "no_email", "El usuario no tiene email");

  const db = getDb();
  let { data: persona, error: pErr } = await db
    .from("personas")
    .select("id, auth_user_id, email, nombre, apellidos, rol, avatar_url")
    .eq("auth_user_id", user.id).maybeSingle();
  if (pErr) throw new ApiError(500, "db_error", pErr.message);

  if (!persona) {
    const { data: byEmail, error: eErr } = await db
      .from("personas")
      .select("id, auth_user_id, email, nombre, apellidos, rol, avatar_url")
      .eq("email", email).maybeSingle();
    if (eErr) throw new ApiError(500, "db_error", eErr.message);
    if (!byEmail) throw new ApiError(403, "no_persona", "No hay persona vinculada a este email");
    if (!byEmail.auth_user_id) {
      const { error: uErr } = await db.from("personas").update({ auth_user_id: user.id }).eq("id", byEmail.id);
      if (uErr) throw new ApiError(500, "db_error", uErr.message);
      byEmail.auth_user_id = user.id;
    } else if (byEmail.auth_user_id !== user.id) {
      throw new ApiError(409, "email_conflict", "Email ya vinculado a otra cuenta");
    }
    persona = byEmail;
  }
  return persona as Persona;
}

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PILARES = [
  "autoconocimiento", "bienestar_emocional", "bienestar_fisico",
  "presencia_consciente", "vinculos_vitales", "trabajo_proposito",
  "estetica_existencial", "fe_filosofia",
] as const;
type Pilar = typeof PILARES[number];

const PREFIX: Record<Pilar, string> = {
  autoconocimiento: "AC", bienestar_emocional: "BE", bienestar_fisico: "BF",
  presencia_consciente: "PC", vinculos_vitales: "VV", trabajo_proposito: "TP",
  estetica_existencial: "EE", fe_filosofia: "FF",
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
    Medio: "Reconoces tus emociones la mayor parte del tiempo, pero a veces las dejas dictar tus decisiones. Practica la pausa de tres respiraciones antes de reaccionar y nombra la emoción en voz alta, eso baja su intensidad de inmediato.",
    Bajo: "Ahora cuesta diferenciar entre lo que sientes, piensas y haces, y eso desgasta. No es debilidad, es falta de entrenamiento. Empieza por algo simple: un check-in emocional dos veces al día (mañana/noche) usando una rueda de emociones.",
  },
  bienestar_fisico: {
    Alto: "Tu cuerpo está al servicio de tu vida. Te mueves, descansas y comes con sentido. Mantén la consistencia: pequeños hábitos sostenidos vencen a la disciplina extrema y al heroísmo de fin de semana.",
    Medio: "Sabes lo que deberías hacer y a veces lo haces. La brecha entre intención y acción es lo que toca cerrar. Elige UN hábito ancla (ej. caminar 30 min diarios) y sosténlo 8 semanas antes de añadir otro.",
    Bajo: "Tu cuerpo te está pidiendo atención. No es necesario un plan ambicioso, basta con dormir 30 min más, beber un vaso de agua al despertar, y caminar 10 min al día. Lo simple, sostenido, transforma.",
  },
  presencia_consciente: {
    Alto: "Habitas el presente con cierta naturalidad. Ese es un activo valioso en un mundo distraído. Profundiza con prácticas formales (5–10 min de meditación al día) y momentos de silencio sin pantallas.",
    Medio: "Tienes destellos de presencia, pero la mente se va al futuro o al pasado con frecuencia. Empieza con anclajes cotidianos: respirar antes de cada comida, sentir los pies al caminar, escuchar sin pensar la respuesta.",
    Bajo: "El piloto automático domina muchos de tus días. No es problema mientras sea consciente, el reto es cuando ni te das cuenta. Prueba 3 minutos de atención plena al día durante 21 días y observa qué cambia.",
  },
  vinculos_vitales: {
    Alto: "Tus vínculos te nutren y tú los nutres. Eso es uno de los predictores más sólidos de una vida feliz. Cuida la calidad sobre la cantidad: una llamada larga vale más que diez likes.",
    Medio: "Tienes relaciones importantes, pero hay áreas para profundizar. Identifica una persona con quien quieras estar más cerca este mes y agenda algo concreto, la intencionalidad es el ingrediente que falta.",
    Bajo: "La soledad o los vínculos rotos pesan más de lo que admites. Reconectar empieza con un mensaje, no con una conversación entera. Escribe a alguien hoy sin esperar respuesta inmediata. Lo importante es abrir la puerta.",
  },
  trabajo_proposito: {
    Alto: "Tu trabajo se siente como expresión de quién eres, no como peso. Cuídalo: integra descanso, varía retos, y comparte el conocimiento que has acumulado con quienes empiezan.",
    Medio: "Hay días en que tu trabajo conecta con algo más grande y otros en que es solo obligación. Intenta articular en una frase qué impacto tiene tu trabajo en otros, esa claridad cambia la experiencia diaria.",
    Bajo: "Hoy tu trabajo se siente más como un trámite que como un camino. No tiene que ser un cambio drástico: encuentra un proyecto chico, voluntario o personal, donde tus habilidades sirvan a algo que te importe genuinamente.",
  },
  estetica_existencial: {
    Alto: "Vives con estética: cultivas la belleza, la creatividad y el detalle en lo cotidiano. Eso es vivir con dignidad humana plena. Comparte tu mirada, el mundo necesita más personas que vean belleza donde otros ven solo función.",
    Medio: "Aprecias lo bello cuando aparece, pero podrías invitarlo más a tu vida. Escucha música con atención plena, camina por un jardín sin teléfono, lee poesía 10 minutos. La belleza alimenta capas del alma que la productividad no toca.",
    Bajo: "La belleza está en pausa en tu vida, quizá por urgencia, quizá por hábito. Empieza pequeño: un objeto bello en tu escritorio, una canción que te conmueva al iniciar el día. La belleza no es lujo, es nutrición existencial.",
  },
  fe_filosofia: {
    Alto: "Tienes un marco que da sentido a tu vida, espiritual, filosófico, o ambos. Eso te ancla cuando las circunstancias se mueven. Sigue alimentándolo: lectura contemplativa, conversaciones profundas, prácticas regulares.",
    Medio: 'Tienes algunas convicciones, pero no del todo articuladas. Reservar tiempo para preguntas grandes, escribir 20 min sobre "qué creo realmente sobre X", te ayudará a clarificar y comprometerte.',
    Bajo: "Las preguntas últimas, sentido, muerte, trascendencia, están aplazadas. No es defecto, es invitación. Lecturas, conversaciones o tradiciones contemplativas pueden abrir camino. No tienes que tener todas las respuestas; basta empezar a hacerte mejores preguntas.",
  },
};

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

function pillarScore(p1: number, p2: number): number { return p1 + p2; }
function getBand(score: number): "Alto" | "Medio" | "Bajo" {
  if (score >= 8) return "Alto";
  if (score >= 5) return "Medio";
  return "Bajo";
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return errorResponse(req, new ApiError(405, "method_not_allowed", "Use POST"));
  }
  const span = startSpan("submit-test-felicidad");

  try {
    const body = await req.json().catch(() => ({})) as {
      inscripcionId?: string; respuestas?: Record<string, number>;
    };
    const { inscripcionId, respuestas } = body;
    if (!inscripcionId || !UUID_RE.test(inscripcionId)) {
      throw new ApiError(400, "invalid_inscripcion_id", "inscripcionId inválido");
    }
    if (!respuestas) throw new ApiError(400, "missing_respuestas", "respuestas requerido");
    const valid = validateAnswers(respuestas);
    if (!valid.ok) throw new ApiError(400, "invalid_respuestas", valid.error);

    const persona = await requireUser(req);
    const db = getDb();

    const { data: insc, error: iErr } = await db
      .from("inscripciones").select("id, persona_id")
      .eq("id", inscripcionId).maybeSingle();
    if (iErr) throw new ApiError(500, "db_error", iErr.message);
    if (!insc) throw new ApiError(404, "inscripcion_not_found", "Inscripción no encontrada");
    if (insc.persona_id !== persona.id) {
      throw new ApiError(403, "not_owner", "Esta inscripción no es tuya");
    }

    const scores: Record<string, number> = {};
    const niveles: Record<string, string> = {};
    const analisis: Record<string, string> = {};
    for (const pilar of PILARES) {
      const p1 = respuestas[`${PREFIX[pilar]}1`] as number;
      const p2 = respuestas[`${PREFIX[pilar]}2`] as number;
      const score = pillarScore(p1, p2);
      const band = getBand(score);
      scores[pilar] = score;
      niveles[pilar] = nivelLabel(band);
      analisis[pilar] = ANALISIS[pilar][band];
    }

    const completedAt = new Date().toISOString();
    const { data: created, error: cErr } = await db
      .from("tests_felicidad")
      .insert({
        persona_id: persona.id,
        respuestas: { answers: respuestas },
        resultados: { version: 1, scores, niveles, analisis, pilarNombres: NOMBRE, completedAt },
        completado_en: completedAt,
      })
      .select("id").single();
    if (cErr) throw new ApiError(500, "db_error", cErr.message);

    span.end({ persona: persona.id, respuesta: created.id });
    return jsonResponse(req, {
      respuestaId: created.id, scores, niveles, analisis, completedAt,
    });
  } catch (err) {
    span.end({ error: true });
    return errorResponse(req, err);
  }
});
