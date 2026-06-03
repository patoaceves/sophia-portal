// SOPHIA Portal · delete-my-account (Postgres)
//
// Derecho ARCO "C" (Cancelación) bajo LFPDPPP. Elimina permanentemente
// la cuenta del usuario y todos sus datos personales.
//
// POST /delete-my-account
// Body: { confirmacion: "ELIMINAR MI CUENTA" }
//
// Comportamiento (hijos → padres):
//   1. progreso_lecciones, entregas_tarea, evaluaciones_sesion,
//      respuestas_quiz, respuestas_autoeval, tests_felicidad
//   2. Posts: top-level delete, comments anonimizar (autor_id=null, contenido='', estatus='eliminado')
//   3. inscripciones
//   4. invitaciones (por email)
//   5. persona
//   6. Storage: avatars/{authUserId}/, foro/*/{authUserId}/, tareas/*/{personaId}/
//   7. supabase.auth.admin.deleteUser
//
// IRREVERSIBLE.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STORAGE_BUCKET = "sophia-portal-uploads";
const EXPECTED_CONFIRMATION = "ELIMINAR MI CUENTA";

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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

async function listStorageRecursive(sb: SupabaseClient, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 3) return [];
  const out: string[] = [];
  const { data, error } = await sb.storage.from(STORAGE_BUCKET).list(prefix, { limit: 1000 });
  if (error) return [];
  for (const item of data ?? []) {
    if (!item.name) continue;
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    const isFolder = !item.id;
    if (isFolder) {
      out.push(...await listStorageRecursive(sb, fullPath, depth + 1));
    } else {
      out.push(fullPath);
    }
  }
  return out;
}

Deno.serve(async (req) => {
  const optionsRes = handleOptions(req);
  if (optionsRes) return optionsRes;
  if (req.method !== "POST") return errorResponse(req, "Method not allowed", 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorResponse(req, "Missing Authorization", 401, "no_auth");
    const jwt = authHeader.slice("Bearer ".length);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, anonKey);
    const { data: userData, error: authErr } = await supabaseAuth.auth.getUser(jwt);
    if (authErr || !userData.user) return errorResponse(req, "Invalid JWT", 401, "invalid_jwt");
    const authUserId = userData.user.id;
    const email = (userData.user.email ?? "").toLowerCase();

    // Confirmación obligatoria
    const body = await req.json().catch(() => ({}));
    if (body.confirmacion !== EXPECTED_CONFIRMATION) {
      return errorResponse(
        req,
        `Falta confirmación. Debes enviar { "confirmacion": "${EXPECTED_CONFIRMATION}" } en el body.`,
        400, "missing_confirmation",
      );
    }

    const db = getDb();
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Encontrar persona
    let { data: persona } = await db
      .from("personas").select("id, email").eq("auth_user_id", authUserId).maybeSingle();
    if (!persona && email) {
      const { data: byEmail } = await db.from("personas").select("id, email").eq("email", email).maybeSingle();
      persona = byEmail;
    }
    if (!persona) return errorResponse(req, "No persona found", 404, "no_persona");
    const personaId = persona.id;

    // Inscripciones del user
    const { data: inscripciones } = await db.from("inscripciones").select("id, curso_id").eq("persona_id", personaId);
    const inscripcionIds = (inscripciones ?? []).map(i => i.id);
    const cursoIds = Array.from(new Set((inscripciones ?? []).map(i => i.curso_id).filter(Boolean)));

    // ========== BORRAR EN ORDEN (hijos → padres) ==========
    const contadores: Record<string, number> = {};

    if (inscripcionIds.length > 0) {
      // 1) progreso_lecciones
      const { count: c1 } = await db.from("progreso_lecciones")
        .delete({ count: "exact" }).in("inscripcion_id", inscripcionIds);
      contadores.progreso = c1 ?? 0;

      // 2) entregas_tarea
      const { count: c2 } = await db.from("entregas_tarea")
        .delete({ count: "exact" }).in("inscripcion_id", inscripcionIds);
      contadores.entregasTarea = c2 ?? 0;

      // 3) evaluaciones_sesion
      const { count: c3 } = await db.from("evaluaciones_sesion")
        .delete({ count: "exact" }).in("inscripcion_id", inscripcionIds);
      contadores.evaluacionesSesion = c3 ?? 0;

      // 4) respuestas_quiz
      const { count: c4 } = await db.from("respuestas_quiz")
        .delete({ count: "exact" }).in("inscripcion_id", inscripcionIds);
      contadores.respuestasQuiz = c4 ?? 0;

      // 5) respuestas_autoeval
      const { count: c5 } = await db.from("respuestas_autoeval")
        .delete({ count: "exact" }).in("inscripcion_id", inscripcionIds);
      contadores.respuestasAutoeval = c5 ?? 0;
    }

    // 6) tests_felicidad (por persona_id)
    const { count: c6 } = await db.from("tests_felicidad")
      .delete({ count: "exact" }).eq("persona_id", personaId);
    contadores.testsFelicidad = c6 ?? 0;

    // 7) Posts del foro
    //    Top-level (post_padre_id IS NULL): hard delete
    //    Comments: anonimizar (autor_id = null, contenido = '', estatus = 'eliminado')
    const { data: misPosts } = await db.from("posts")
      .select("id, post_padre_id").eq("autor_id", personaId);
    const topLevelIds: string[] = [];
    const commentIds: string[] = [];
    for (const p of misPosts ?? []) {
      if (p.post_padre_id) commentIds.push(p.id);
      else topLevelIds.push(p.id);
    }
    if (topLevelIds.length > 0) {
      const { count } = await db.from("posts").delete({ count: "exact" }).in("id", topLevelIds);
      contadores.postsTopLevel = count ?? 0;
    } else {
      contadores.postsTopLevel = 0;
    }
    if (commentIds.length > 0) {
      const { count } = await db.from("posts").update({
        autor_id: null, contenido: "", adjunto_url: null, adjunto_nombre: null,
        adjunto_tipo: null, estatus: "eliminado",
      }, { count: "exact" }).in("id", commentIds);
      contadores.postsAnonimizados = count ?? 0;
    } else {
      contadores.postsAnonimizados = 0;
    }

    // 8) inscripciones
    if (inscripcionIds.length > 0) {
      const { count } = await db.from("inscripciones")
        .delete({ count: "exact" }).in("id", inscripcionIds);
      contadores.inscripciones = count ?? 0;
    } else {
      contadores.inscripciones = 0;
    }

    // 9) invitaciones por email
    if (email) {
      const { count } = await db.from("invitaciones")
        .delete({ count: "exact" }).eq("email_destinatario", email);
      contadores.invitaciones = count ?? 0;
    } else {
      contadores.invitaciones = 0;
    }

    // 10) persona
    const { error: pDelErr } = await db.from("personas").delete().eq("id", personaId);
    if (pDelErr) console.warn("persona delete error:", pDelErr.message);
    contadores.persona = pDelErr ? 0 : 1;

    // 11) Storage: avatars/{authUserId}/*, foro/{cursoId}/{authUserId}/*, tareas/{leccionId}/{personaId}/*
    try {
      const avatarFiles = await listStorageRecursive(supabaseAdmin, `avatars/${authUserId}`);
      if (avatarFiles.length > 0) {
        await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(avatarFiles);
      }
      for (const cursoId of cursoIds) {
        const foroFiles = await listStorageRecursive(supabaseAdmin, `foro/${cursoId}/${authUserId}`);
        if (foroFiles.length > 0) {
          await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(foroFiles);
        }
      }
      // tareas/{leccionId}/{personaId}/* — listar todas las lecciones y limpiar las del user
      const tareasRoot = await listStorageRecursive(supabaseAdmin, "tareas");
      const userTareaFiles = tareasRoot.filter(p => p.includes(`/${personaId}/`));
      if (userTareaFiles.length > 0) {
        await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(userTareaFiles);
      }
    } catch (e) {
      console.warn("Storage cleanup partial fail:", e);
    }

    // 12) Supabase Auth: borrar usuario (IRREVERSIBLE)
    const { error: deleteAuthErr } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
    if (deleteAuthErr) {
      console.error("auth.deleteUser failed:", deleteAuthErr);
      return jsonResponse(req, {
        ok: true, partial: true,
        warning: "Datos eliminados de Postgres. Borrado del usuario Auth falló — contacta soporte.",
        contadores,
      });
    }

    return jsonResponse(req, {
      ok: true,
      mensaje: "Cuenta eliminada permanentemente. Tu sesión ya no es válida.",
      contadores,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("delete-my-account fatal:", msg);
    return errorResponse(req, "Error interno al eliminar cuenta", 500, "fatal");
  }
});
