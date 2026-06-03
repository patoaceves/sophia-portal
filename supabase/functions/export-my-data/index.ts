// SOPHIA Portal · export-my-data (Postgres)
//
// Derecho ARCO "A" (Acceso) bajo LFPDPPP. Devuelve TODOS los datos
// personales del usuario autenticado, en JSON descargable.
//
// GET /export-my-data
// Response 200: { ok, exportadoEn, metadatos, persona, inscripciones, progreso,
//   posts, entregasTarea, evaluacionesSesion, respuestasQuiz, respuestasAutoeval,
//   testsFelicidad, invitaciones }

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ALLOWED_ORIGINS = [
  "https://portal.sophiamx.org",
  "http://localhost:3000", "http://localhost:5173", "http://localhost:5500",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const isVercelPreview = /^https:\/\/sophia-portal-[a-z0-9-]+\.vercel\.app$/.test(origin);
  const allowed = ALLOWED_ORIGINS.includes(origin) || isVercelPreview ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  return null;
}

function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
}

function errorResponse(req: Request, msg: string, status = 400, code?: string): Response {
  return jsonResponse(req, { ok: false, error: msg, code }, status);
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
  const optionsRes = handleOptions(req);
  if (optionsRes) return optionsRes;
  if (req.method !== "GET") return errorResponse(req, "Method not allowed", 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorResponse(req, "Missing Authorization", 401, "no_auth");
    const jwt = authHeader.slice("Bearer ".length);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, anonKey);
    const { data: userData, error: authErr } = await supabaseAuth.auth.getUser(jwt);
    if (authErr || !userData.user) return errorResponse(req, "Invalid JWT", 401, "invalid_jwt");
    const authUserId = userData.user.id;
    const email = (userData.user.email ?? "").toLowerCase();

    const db = getDb();

    // 1) Persona
    let { data: persona } = await db
      .from("personas").select("*").eq("auth_user_id", authUserId).maybeSingle();
    if (!persona && email) {
      const { data: byEmail } = await db.from("personas").select("*").eq("email", email).maybeSingle();
      persona = byEmail;
    }
    if (!persona) return errorResponse(req, "No persona found", 404, "no_persona");
    const personaId = persona.id;

    // 2) Inscripciones (con curso embedded)
    const { data: inscripciones } = await db
      .from("inscripciones")
      .select("*, cursos:cursos!inner(id, slug, titulo, descripcion_corta)")
      .eq("persona_id", personaId);
    const inscripcionIds = (inscripciones ?? []).map(i => i.id);

    // 3) Progreso lecciones (via inscripciones)
    const { data: progreso } = inscripcionIds.length > 0
      ? await db.from("progreso_lecciones").select("*").in("inscripcion_id", inscripcionIds)
      : { data: [] };

    // 4) Posts del foro (autor)
    const { data: posts } = await db.from("posts").select("*").eq("autor_id", personaId);

    // 5) Entregas de tarea
    const { data: entregasTarea } = inscripcionIds.length > 0
      ? await db.from("entregas_tarea").select("*").in("inscripcion_id", inscripcionIds)
      : { data: [] };

    // 6) Evaluaciones de sesión
    const { data: evaluacionesSesion } = inscripcionIds.length > 0
      ? await db.from("evaluaciones_sesion").select("*").in("inscripcion_id", inscripcionIds)
      : { data: [] };

    // 7) Respuestas quiz
    const { data: respuestasQuiz } = inscripcionIds.length > 0
      ? await db.from("respuestas_quiz").select("*").in("inscripcion_id", inscripcionIds)
      : { data: [] };

    // 8) Respuestas autoeval (incl. autoconocimiento)
    const { data: respuestasAutoeval } = inscripcionIds.length > 0
      ? await db.from("respuestas_autoeval").select("*").in("inscripcion_id", inscripcionIds)
      : { data: [] };

    // 9) Tests felicidad (por persona_id)
    const { data: testsFelicidad } = await db
      .from("tests_felicidad").select("*").eq("persona_id", personaId);

    // 10) Invitaciones por email
    const { data: invitaciones } = email
      ? await db.from("invitaciones").select("*").eq("email_destinatario", email)
      : { data: [] };

    return jsonResponse(req, {
      ok: true,
      exportadoEn: new Date().toISOString(),
      metadatos: {
        authUserId, email,
        exportFormatVersion: "2.0-postgres",
        avisoLegal: "Datos personales en SOPHIA bajo LFPDPPP Art. 22 (Derecho de Acceso). Para Rectificación, Cancelación u Oposición: privacidad@sophiamx.org.",
      },
      persona,
      inscripciones: inscripciones ?? [],
      progreso: progreso ?? [],
      posts: posts ?? [],
      entregasTarea: entregasTarea ?? [],
      evaluacionesSesion: evaluacionesSesion ?? [],
      respuestasQuiz: respuestasQuiz ?? [],
      respuestasAutoeval: respuestasAutoeval ?? [],
      testsFelicidad: testsFelicidad ?? [],
      invitaciones: invitaciones ?? [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("export-my-data fatal:", msg);
    return errorResponse(req, "Error interno al exportar datos", 500, "fatal");
  }
});
