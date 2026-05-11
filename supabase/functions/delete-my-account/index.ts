// SOPHIA Portal · delete-my-account
//
// Derecho ARCO "C" (Cancelación) bajo LFPDPPP. Elimina permanentemente
// la cuenta del usuario y todos sus datos personales asociados.
//
// POST /delete-my-account
// Headers: Authorization: Bearer <jwt>
// Body: { confirmacion: "ELIMINAR MI CUENTA" }  ← string exacto, para evitar accidentes
//
// Comportamiento:
// 1. Borra Storage: avatares + adjuntos de foro del usuario
// 2. Borra Airtable: Respuestas Test, Evaluaciones Sesión, Progreso, Posts,
//    Inscripciones, Persona Portal, Persona CRM (en ese orden, hijos primero)
// 3. Borra Supabase Auth user (irreversible)
//
// NOTA sobre posts del foro:
//   Hard-deleteamos solo los TOP-LEVEL posts del usuario (eliminados son
//   visibles como tombstone). Los comentarios del usuario los anonimizamos
//   (vaciamos contenido + autor null) para no romper hilos de OTROS usuarios.
//   Esto es defensible bajo LFPDPPP porque el dato personal queda cancelado
//   (el contenido), aunque el record persista por integridad referencial.
//
// IRREVERSIBLE. Después de esta llamada el JWT queda inválido.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ============================================================================
// CONSTANTS
// ============================================================================

const BASES = { CRM: "app1SbOC98k2OP5m1", PORTAL: "app0S6GrJQ8YatvCc" } as const;
const TABLES = {
  PERSONAS_CRM: "tbl5XKtg0mRfLeFYH",
  PERSONAS_PORTAL: "tblwo4xOFhmx2TznJ",
  INSCRIPCIONES: "tblIT40GILMUHhLKK",
  PROGRESO_LECCIONES: "tbllSrA7i4RxR6rqD",
  POSTS: "tblmLVl9ySzTXb2OK",
  EVALUACIONES_SESION: "tblkXSuFWbvkDVSo2",
  RESPUESTAS_AUTOEVAL: "tblNhTCikXms43AJz",
} as const;
const FIELDS = {
  PERSONAS_CRM: {
    AUTH_USER_ID: "fldg3kYs6c4xOoYkq",
    EMAIL: "fldJlxMp6NKCpvAuv",
  },
  PERSONAS_PORTAL: {
    AUTH_USER_ID: "fldSKACBNXloxYRBc",
    EMAIL: "fldnRbi4mJRtfuAmV",
  },
  INSCRIPCIONES: {
    PERSONA: "fldsgcanUDaXzX20x",
  },
  PROGRESO_LECCIONES: {
    INSCRIPCION: "fld5osGXDLBrvgW63",
  },
  POSTS: {
    AUTOR: "fldjOVXCAkwoNENnX",
    CONTENIDO: "fldPmHX3Pt0f4r1pv",
    ADJUNTO_URL: "fldmMwKgVz0lP3BO8",
    ADJUNTO_NOMBRE: "fldpswnHcsl5He8M2",
    ESTATUS: "fldy88bnFeG7QEIQN",
    POST_PADRE: "fldq82v7aJfKlu6i1",
  },
  EVALUACIONES_SESION: {
    PERSONA_PORTAL: "fldpjGURyFV8NhL4y",
  },
  RESPUESTAS_AUTOEVAL: {
    INSCRIPCION: "fldu7jj4hqe1dCIMZ",
  },
} as const;

const AIRTABLE_API = "https://api.airtable.com/v0";
const STORAGE_BUCKET = "sophia-portal-uploads";
const EXPECTED_CONFIRMATION = "ELIMINAR MI CUENTA";

// ============================================================================
// CORS
// ============================================================================
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
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}
function errorResponse(req: Request, msg: string, status = 400, code?: string): Response {
  return jsonResponse(req, { ok: false, error: msg, code }, status);
}

// ============================================================================
// AIRTABLE
// ============================================================================
interface AirtableRecord { id: string; createdTime?: string; fields: Record<string, unknown> }
async function airtableFetch(path: string, init?: RequestInit) {
  const pat = Deno.env.get("AIRTABLE_PAT");
  if (!pat) throw new Error("AIRTABLE_PAT env var missing");
  const res = await fetch(`${AIRTABLE_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  return res.json();
}
async function listRecords(
  baseId: string, tableId: string,
  opts: { filterByFormula?: string; pageSize?: number } = {},
): Promise<AirtableRecord[]> {
  const params = new URLSearchParams();
  params.set("returnFieldsByFieldId", "true");
  if (opts.filterByFormula) params.set("filterByFormula", opts.filterByFormula);
  if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
  const all: AirtableRecord[] = [];
  let offset: string | undefined = undefined;
  do {
    const url = `/${baseId}/${tableId}?${params}${offset ? `&offset=${offset}` : ""}`;
    const data = await airtableFetch(url);
    all.push(...(data.records as AirtableRecord[]));
    offset = data.offset;
  } while (offset);
  return all;
}
async function deleteRecords(baseId: string, tableId: string, ids: string[]) {
  // Airtable acepta máximo 10 IDs por delete request
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    const params = batch.map(id => `records[]=${id}`).join("&");
    await airtableFetch(`/${baseId}/${tableId}?${params}`, { method: "DELETE" });
  }
}
async function updateRecords(baseId: string, tableId: string, updates: { id: string; fields: Record<string, unknown> }[]) {
  for (let i = 0; i < updates.length; i += 10) {
    const batch = updates.slice(i, i + 10);
    await airtableFetch(`/${baseId}/${tableId}`, {
      method: "PATCH",
      body: JSON.stringify({ records: batch, returnFieldsByFieldId: true }),
    });
  }
}
function eqFormula(fieldId: string, value: string): string {
  return `{${fieldId}} = '${value.replace(/'/g, "\\'")}'`;
}

// ============================================================================
// MAIN
// ============================================================================

Deno.serve(async (req) => {
  const optionsRes = handleOptions(req);
  if (optionsRes) return optionsRes;
  if (req.method !== "POST") return errorResponse(req, "Method not allowed", 405);

  try {
    // Auth
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

    // ──────────────────────────────────────────────────────────────────
    // Recolectar todo lo del usuario (mismo patrón que export-my-data)
    // ──────────────────────────────────────────────────────────────────

    // Persona CRM
    let personasCRM = await listRecords(BASES.CRM, TABLES.PERSONAS_CRM, {
      filterByFormula: eqFormula(FIELDS.PERSONAS_CRM.AUTH_USER_ID, authUserId),
      pageSize: 1,
    });
    if (personasCRM.length === 0 && email) {
      personasCRM = await listRecords(BASES.CRM, TABLES.PERSONAS_CRM, {
        filterByFormula: `LOWER(TRIM({${FIELDS.PERSONAS_CRM.EMAIL}})) = '${email.replace(/'/g, "\\'")}'`,
        pageSize: 1,
      });
    }
    const personaCRMId = personasCRM[0]?.id ?? "";

    // Persona Portal
    let personasPortal = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
      filterByFormula: eqFormula(FIELDS.PERSONAS_PORTAL.AUTH_USER_ID, authUserId),
      pageSize: 1,
    });
    if (personasPortal.length === 0 && email) {
      personasPortal = await listRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, {
        filterByFormula: `LOWER(TRIM({${FIELDS.PERSONAS_PORTAL.EMAIL}})) = '${email.replace(/'/g, "\\'")}'`,
        pageSize: 1,
      });
    }
    const personaPortalId = personasPortal[0]?.id ?? "";

    // Inscripciones
    const inscripciones = personaPortalId
      ? await listRecords(BASES.PORTAL, TABLES.INSCRIPCIONES, {
          filterByFormula: `SEARCH('${personaPortalId}', ARRAYJOIN({${FIELDS.INSCRIPCIONES.PERSONA}}))`,
        })
      : [];
    const inscripcionIds = new Set(inscripciones.map(i => i.id));

    // Progreso
    const allProgreso = await listRecords(BASES.PORTAL, TABLES.PROGRESO_LECCIONES, {});
    const progreso = allProgreso.filter(p => {
      const links = (p.fields[FIELDS.PROGRESO_LECCIONES.INSCRIPCION] as string[]) ?? [];
      return links.some(id => inscripcionIds.has(id));
    });

    // Posts (todos los del usuario; separamos top-level de comments)
    const posts = personaPortalId
      ? await listRecords(BASES.PORTAL, TABLES.POSTS, {
          filterByFormula: `SEARCH('${personaPortalId}', ARRAYJOIN({${FIELDS.POSTS.AUTOR}}))`,
        })
      : [];

    // Evaluaciones de sesión
    const evaluaciones = personaPortalId
      ? await listRecords(BASES.PORTAL, TABLES.EVALUACIONES_SESION, {
          filterByFormula: `SEARCH('${personaPortalId}', ARRAYJOIN({${FIELDS.EVALUACIONES_SESION.PERSONA_PORTAL}}))`,
        })
      : [];

    // Respuestas Test
    const allRespuestas = await listRecords(BASES.PORTAL, TABLES.RESPUESTAS_AUTOEVAL, {});
    const respuestas = allRespuestas.filter(r => {
      const links = (r.fields[FIELDS.RESPUESTAS_AUTOEVAL.INSCRIPCION] as string[]) ?? [];
      return links.some(id => inscripcionIds.has(id));
    });

    // ──────────────────────────────────────────────────────────────────
    // EJECUTAR ELIMINACIÓN (orden importa: hijos → padres)
    // ──────────────────────────────────────────────────────────────────

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // 1) Storage: avatares + adjuntos (best-effort, errores no abortan)
    try {
      // avatares: bucket/avatars/{authUserId}/...
      const avatarsList = await supabaseAdmin.storage.from(STORAGE_BUCKET).list(`avatars/${authUserId}`);
      if (avatarsList.data?.length) {
        const paths = avatarsList.data.map(f => `avatars/${authUserId}/${f.name}`);
        await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(paths);
      }
      // adjuntos del foro: bucket/foro/{cursoId}/{authUserId}/...
      // Recorrer por curso (de inscripciones) y limpiar la carpeta del user
      for (const ins of inscripciones) {
        const cursoLinks = (ins.fields["fldTjcS2GiOe3Q9N0"] as string[]) ?? []; // INSCRIPCIONES.CURSO
        for (const cursoId of cursoLinks) {
          const foroList = await supabaseAdmin.storage.from(STORAGE_BUCKET).list(`foro/${cursoId}/${authUserId}`);
          if (foroList.data?.length) {
            const paths = foroList.data.map(f => `foro/${cursoId}/${authUserId}/${f.name}`);
            await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(paths);
          }
        }
      }
    } catch (e) {
      console.warn("Storage cleanup partial fail:", e);
    }

    // 2) Airtable: Respuestas Test
    if (respuestas.length > 0) {
      await deleteRecords(BASES.PORTAL, TABLES.RESPUESTAS_AUTOEVAL, respuestas.map(r => r.id));
    }

    // 3) Airtable: Evaluaciones Sesión
    if (evaluaciones.length > 0) {
      await deleteRecords(BASES.PORTAL, TABLES.EVALUACIONES_SESION, evaluaciones.map(r => r.id));
    }

    // 4) Airtable: Progreso
    if (progreso.length > 0) {
      await deleteRecords(BASES.PORTAL, TABLES.PROGRESO_LECCIONES, progreso.map(r => r.id));
    }

    // 5) Airtable: Posts del foro
    //    Top-level: hard delete
    //    Comments (con POST_PADRE): anonimizar (autor null, contenido vacío)
    //    para no romper hilos de otros. El record se conserva como tombstone.
    const topLevelPostIds: string[] = [];
    const commentPostIds: string[] = [];
    for (const p of posts) {
      const padre = (p.fields[FIELDS.POSTS.POST_PADRE] as string[]) ?? [];
      if (padre.length > 0) commentPostIds.push(p.id);
      else topLevelPostIds.push(p.id);
    }
    if (topLevelPostIds.length > 0) {
      await deleteRecords(BASES.PORTAL, TABLES.POSTS, topLevelPostIds);
    }
    if (commentPostIds.length > 0) {
      // Anonimizar: vaciar contenido + adjunto + autor + marcar eliminado
      await updateRecords(BASES.PORTAL, TABLES.POSTS, commentPostIds.map(id => ({
        id,
        fields: {
          [FIELDS.POSTS.CONTENIDO]: "",
          [FIELDS.POSTS.ADJUNTO_URL]: "",
          [FIELDS.POSTS.ADJUNTO_NOMBRE]: "",
          [FIELDS.POSTS.AUTOR]: [],
          [FIELDS.POSTS.ESTATUS]: "eliminado",
        },
      })));
    }

    // 6) Airtable: Inscripciones
    if (inscripciones.length > 0) {
      await deleteRecords(BASES.PORTAL, TABLES.INSCRIPCIONES, Array.from(inscripcionIds));
    }

    // 7) Airtable: Persona Portal
    if (personaPortalId) {
      await deleteRecords(BASES.PORTAL, TABLES.PERSONAS_PORTAL, [personaPortalId]);
    }

    // 8) Airtable: Persona CRM
    if (personaCRMId) {
      await deleteRecords(BASES.CRM, TABLES.PERSONAS_CRM, [personaCRMId]);
    }

    // 9) Supabase Auth: borrar usuario (IRREVERSIBLE)
    // Esto invalida todas las sesiones del usuario inmediatamente.
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
    if (deleteErr) {
      console.error("auth.deleteUser failed:", deleteErr);
      // No abortamos: Airtable ya está limpio. Reportamos como warning.
      return jsonResponse(req, {
        ok: true,
        partial: true,
        warning: "Datos eliminados de Airtable. Borrado del usuario Auth falló — contacta soporte.",
        contadores: {
          inscripciones: inscripciones.length,
          progreso: progreso.length,
          postsTopLevel: topLevelPostIds.length,
          postsComentariosAnonimizados: commentPostIds.length,
          respuestasTest: respuestas.length,
          evaluacionesSesion: evaluaciones.length,
        },
      });
    }

    return jsonResponse(req, {
      ok: true,
      mensaje: "Cuenta eliminada permanentemente. Tu sesión ya no es válida.",
      contadores: {
        inscripciones: inscripciones.length,
        progreso: progreso.length,
        postsTopLevel: topLevelPostIds.length,
        postsComentariosAnonimizados: commentPostIds.length,
        respuestasTest: respuestas.length,
        evaluacionesSesion: evaluaciones.length,
      },
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("delete-my-account fatal:", msg);
    return errorResponse(req, "Error interno al eliminar cuenta", 500, "fatal");
  }
});
