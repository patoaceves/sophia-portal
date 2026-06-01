// ============================================================================
// SOPHIA Portal · Script de migración Airtable → Postgres
// ============================================================================
// Lee todos los registros de Airtable y los inserta en Postgres respetando
// el orden de dependencias (FKs). Es IDEMPOTENTE: puedes correrlo varias
// veces sin duplicar datos, porque hace UPSERT por airtable_id.
//
// USO:
//   AIRTABLE_API_KEY=patXXX...    \
//   SUPABASE_URL=https://...       \
//   SUPABASE_SERVICE_ROLE_KEY=...  \
//   deno run --allow-net --allow-env scripts/migrate-from-airtable.ts
//
// Opcionalmente, --dry-run no escribe nada, solo reporta qué haría:
//   deno run --allow-net --allow-env scripts/migrate-from-airtable.ts --dry-run
//
// ESTRATEGIA:
//   1) Personas (CRM + Portal colapsadas a una sola tabla)
//   2) Cursos → Módulos → Lecciones (cascada de contenido)
//   3) Cohortes → Invitaciones
//   4) Inscripciones → Progreso de lecciones
//   5) Posts del foro (con padres resueltos en 2da pasada)
//   6) Actividades polimórficas separadas en tablas tipadas
//
// Cada paso construye un mapa { airtable_id -> postgres_uuid } que el
// siguiente paso usa para resolver FKs.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ── Config ──────────────────────────────────────────────────────────────────
const AIRTABLE_API_KEY = Deno.env.get("AIRTABLE_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const DRY_RUN = Deno.args.includes("--dry-run");

if (!AIRTABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Falta AIRTABLE_API_KEY, SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  Deno.exit(1);
}

// IDs reales de Airtable (sacados del código de Edge Functions).
const BASES = {
  PORTAL: "app0S6GrJQ8YatvCc",
  CRM: "app1SbOC98k2OP5m1",
} as const;

const TABLES = {
  PERSONAS_CRM: "tbl5XKtg0mRfLeFYH",        // en base CRM
  PERSONAS_PORTAL: "tblwo4xOFhmx2TznJ",     // en base PORTAL (synced)
  CURSOS: "tblJpUGeBsLNkk9UO",
  MODULOS: "tblFHDXmg47igVihD",
  LECCIONES: "tblBjfch6rc5ey7nn",
  COHORTES: "tblMwkKfk6U7a75Ja",
  INVITACIONES: "tblzNARG9ahLsKR9c",
  INSCRIPCIONES: "tblIT40GILMUHhLKK",
  PROGRESO_LECCIONES: "tbllSrA7i4RxR6rqD",
  POSTS: "tblmLVl9ySzTXb2OK",
  ACTIVIDADES: "tbllM76FnC50EHRCx",
  RESPUESTAS_AUTOEVAL: "tblNhTCikXms43AJz",
  EVALUACIONES_SESION: "tblkXSuFWbvkDVSo2",
} as const;

// Cliente Supabase con service_role (bypassea RLS, único momento que
// hacemos esto fuera de las Edge Functions).
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Helper: paginate Airtable ───────────────────────────────────────────────
interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime: string;
}

async function fetchAll(baseId: string, tableId: string): Promise<AirtableRecord[]> {
  const out: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
    url.searchParams.set("pageSize", "100");
    // Pedimos los campos por nombre (no field ID) para que el resultado sea
    // legible. La API acepta ambos.
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    });
    if (!res.ok) {
      throw new Error(`Airtable ${tableId} → ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    out.push(...(data.records ?? []));
    offset = data.offset;
  } while (offset);
  return out;
}

// ── Helper: UPSERT en batch por airtable_id ─────────────────────────────────
type Row = Record<string, unknown> & { airtable_id?: string };

async function upsert(
  table: string,
  rows: Row[],
  conflictKey: string = "airtable_id",
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (rows.length === 0) return map;

  console.log(`  → ${rows.length} filas a UPSERT en ${table}`);
  if (DRY_RUN) {
    console.log(`     [DRY RUN] no escribo`);
    return map;
  }

  // Inserción por lotes de 500 para no exceder limits.
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { data, error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: conflictKey, ignoreDuplicates: false })
      .select("id, airtable_id");
    if (error) {
      console.error(`  ✗ Error en ${table} (batch ${i}):`, error.message);
      throw error;
    }
    for (const row of data ?? []) {
      if (row.airtable_id) map.set(row.airtable_id as string, row.id as string);
    }
  }
  console.log(`  ✓ ${table} → ${map.size} filas mapeadas`);
  return map;
}

// ── Helper: leer texto/email de un linked record (toma el primero) ──────────
function firstLink(v: unknown): string | undefined {
  if (Array.isArray(v) && v.length > 0) {
    const first = v[0];
    if (typeof first === "string") return first;
    if (typeof first === "object" && first && "id" in first) {
      return (first as { id: string }).id;
    }
  }
  return undefined;
}

function selValue(v: unknown): string | undefined {
  // singleSelect viene como { id, name, color } o como string plano.
  if (typeof v === "string") return v;
  if (typeof v === "object" && v && "name" in v) {
    return (v as { name: string }).name;
  }
  return undefined;
}

// ── ETAPAS ─────────────────────────────────────────────────────────────────

async function migrarPersonas() {
  console.log("\n[1/6] Personas (CRM + Portal unificados)");

  const crmRecs = await fetchAll(BASES.CRM, TABLES.PERSONAS_CRM);
  const portalRecs = await fetchAll(BASES.PORTAL, TABLES.PERSONAS_PORTAL);
  console.log(`  CRM: ${crmRecs.length} · Portal: ${portalRecs.length}`);

  // Estrategia: una persona se identifica por email (lowercase). Hacemos
  // merge entre CRM y Portal. CRM gana en datos demográficos (nombre,
  // apellidos, rol); Portal aporta avatar y aviso de privacidad.
  type Bundle = {
    email: string;
    crm?: AirtableRecord;
    portal?: AirtableRecord;
  };
  const byEmail = new Map<string, Bundle>();

  for (const r of crmRecs) {
    const email = String(r.fields["Email"] ?? "").trim().toLowerCase();
    if (!email) continue;
    byEmail.set(email, { email, crm: r });
  }
  for (const r of portalRecs) {
    const email = String(r.fields["Email"] ?? "").trim().toLowerCase();
    if (!email) continue;
    const existing = byEmail.get(email) ?? { email };
    existing.portal = r;
    byEmail.set(email, existing);
  }

  const rows: Row[] = [];
  for (const b of byEmail.values()) {
    const crmF = b.crm?.fields ?? {};
    const portalF = b.portal?.fields ?? {};
    rows.push({
      email: b.email,
      nombre: String(crmF["Nombre"] ?? portalF["Nombre"] ?? ""),
      apellidos: String(crmF["Apellidos"] ?? portalF["Apellidos"] ?? ""),
      rol: String(crmF["Rol"] ?? "alumno"),
      auth_user_id: (crmF["Auth User ID"] ?? portalF["Auth User ID"]) || null,
      telefono_pais: crmF["Teléfono país"] ?? null,
      telefono_numero: crmF["Teléfono número"] ?? null,
      avatar_url: portalF["Avatar URL"] ?? null,
      perfil_completado: Boolean(portalF["Perfil completado"]),
      aviso_aceptado_en: portalF["Aviso aceptado en"] ?? null,
      aviso_version: portalF["Aviso versión"] ?? null,
      aviso_ip_hash: portalF["Aviso IP hash"] ?? null,
      airtable_crm_id: b.crm?.id ?? null,
      airtable_portal_id: b.portal?.id ?? null,
    });
  }

  // UPSERT por email (más seguro que airtable_id porque ambos pueden venir).
  if (DRY_RUN) {
    console.log(`  → ${rows.length} personas (DRY RUN)`);
    return { byCrmId: new Map<string, string>(), byPortalId: new Map<string, string>() };
  }

  // Hacemos el upsert manualmente por email (en vez de usar upsert helper)
  // porque conflict key acá es email lowercase, no airtable_id.
  const byCrmId = new Map<string, string>();
  const byPortalId = new Map<string, string>();
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { data, error } = await supabase
      .from("personas")
      .upsert(batch, { onConflict: "email" })
      .select("id, airtable_crm_id, airtable_portal_id");
    if (error) throw error;
    for (const r of data ?? []) {
      if (r.airtable_crm_id) byCrmId.set(r.airtable_crm_id, r.id);
      if (r.airtable_portal_id) byPortalId.set(r.airtable_portal_id, r.id);
    }
  }
  console.log(`  ✓ personas → CRM map=${byCrmId.size} · Portal map=${byPortalId.size}`);
  return { byCrmId, byPortalId };
}

async function migrarCursos() {
  console.log("\n[2/6] Cursos · Módulos · Lecciones");

  const cursos = await fetchAll(BASES.PORTAL, TABLES.CURSOS);
  const cursoRows: Row[] = cursos.map((r) => ({
    airtable_id: r.id,
    slug: String(r.fields["slug"] ?? r.fields["Slug"] ?? r.id.toLowerCase()),
    titulo: String(r.fields["Título"] ?? r.fields["Titulo"] ?? ""),
    descripcion_corta: String(r.fields["Descripción corta"] ?? ""),
    descripcion_larga: String(r.fields["Descripción larga"] ?? ""),
    cover_image: r.fields["Cover image"] ?? null,
    instructor: String(r.fields["Instructor"] ?? ""),
    color_primario: String(r.fields["Color primario"] ?? "#000000"),
    modalidad: selValue(r.fields["Modalidad"]) ?? "online",
    tema: selValue(r.fields["Tema"]) ?? "light",
    visibilidad: selValue(r.fields["Visibilidad"]) ?? "privado",
    estatus: selValue(r.fields["Estatus"]) ?? "draft",
    fecha_inicio: r.fields["Fecha inicio"] ?? null,
    fecha_fin: r.fields["Fecha fin"] ?? null,
  }));
  const cursoMap = await upsert("cursos", cursoRows);

  const modulos = await fetchAll(BASES.PORTAL, TABLES.MODULOS);
  const moduloRows: Row[] = modulos
    .map((r) => {
      const cursoAtId = firstLink(r.fields["Curso"]);
      const cursoId = cursoAtId ? cursoMap.get(cursoAtId) : undefined;
      if (!cursoId) return null;
      return {
        airtable_id: r.id,
        curso_id: cursoId,
        titulo: String(r.fields["Título"] ?? ""),
        descripcion: String(r.fields["Descripción"] ?? ""),
        ponente: r.fields["Ponente"] ?? null,
        orden: Number(r.fields["Orden"] ?? 0),
      } as Row;
    })
    .filter((x): x is Row => x !== null);
  const moduloMap = await upsert("modulos", moduloRows);

  const lecciones = await fetchAll(BASES.PORTAL, TABLES.LECCIONES);
  const leccionRows: Row[] = lecciones
    .map((r) => {
      const modAtId = firstLink(r.fields["Módulo"]);
      const modId = modAtId ? moduloMap.get(modAtId) : undefined;
      if (!modId) return null;
      return {
        airtable_id: r.id,
        modulo_id: modId,
        titulo: String(r.fields["Título"] ?? ""),
        tipo: selValue(r.fields["Tipo"]) ?? "texto",
        etiqueta: r.fields["Etiqueta"] ?? null,
        orden: Number(r.fields["Orden"] ?? 0),
        contenido_html: r.fields["Contenido HTML"] ?? null,
        url_video: r.fields["URL video"] ?? null,
        url_externa: r.fields["URL externa"] ?? null,
      } as Row;
    })
    .filter((x): x is Row => x !== null);
  const leccionMap = await upsert("lecciones", leccionRows);

  return { cursoMap, moduloMap, leccionMap };
}

async function migrarCohortesEInvitaciones(cursoMap: Map<string, string>, personasByPortalId: Map<string, string>) {
  console.log("\n[3/6] Cohortes · Invitaciones");

  const cohortes = await fetchAll(BASES.PORTAL, TABLES.COHORTES);
  const cohorteRows: Row[] = cohortes
    .map((r) => {
      const cursoAtId = firstLink(r.fields["Curso"]);
      const cursoId = cursoAtId ? cursoMap.get(cursoAtId) : undefined;
      if (!cursoId) return null;
      return {
        airtable_id: r.id,
        curso_id: cursoId,
        nombre: String(r.fields["Nombre"] ?? ""),
        estatus: selValue(r.fields["Estatus"]) ?? "planeada",
        fecha_inicio: r.fields["Fecha inicio"] ?? null,
        fecha_fin: r.fields["Fecha fin"] ?? null,
      } as Row;
    })
    .filter((x): x is Row => x !== null);
  const cohorteMap = await upsert("cohortes", cohorteRows);

  const invitaciones = await fetchAll(BASES.PORTAL, TABLES.INVITACIONES);
  const invRows: Row[] = invitaciones
    .map((r) => {
      const cohAtId = firstLink(r.fields["Cohorte"]);
      const cohId = cohAtId ? cohorteMap.get(cohAtId) : undefined;
      if (!cohId) return null;
      const personaAtId = firstLink(r.fields["Persona"]);
      return {
        airtable_id: r.id,
        token: String(r.fields["Token"] ?? r.id),
        cohorte_id: cohId,
        email_destinatario: String(r.fields["Email destinatario"] ?? ""),
        origen: r.fields["Origen"] ?? null,
        estatus: selValue(r.fields["Estatus"]) ?? "activa",
        persona_id: personaAtId ? personasByPortalId.get(personaAtId) ?? null : null,
        fecha_canje: r.fields["Fecha canje"] ?? null,
        expira_el: r.fields["Expira el"] ?? null,
        notas: r.fields["Notas"] ?? null,
      } as Row;
    })
    .filter((x): x is Row => x !== null);
  await upsert("invitaciones", invRows);

  return { cohorteMap };
}

async function migrarInscripcionesYProgreso(
  cursoMap: Map<string, string>,
  cohorteMap: Map<string, string>,
  leccionMap: Map<string, string>,
  personasByPortalId: Map<string, string>,
) {
  console.log("\n[4/6] Inscripciones · Progreso");

  const inscs = await fetchAll(BASES.PORTAL, TABLES.INSCRIPCIONES);
  const inscRows: Row[] = inscs
    .map((r) => {
      const cursoAtId = firstLink(r.fields["Curso"]);
      const cursoId = cursoAtId ? cursoMap.get(cursoAtId) : undefined;
      const personaAtId = firstLink(r.fields["Persona"]);
      const personaId = personaAtId ? personasByPortalId.get(personaAtId) : undefined;
      if (!cursoId || !personaId) return null;
      const cohAtId = firstLink(r.fields["Cohorte"]);
      return {
        airtable_id: r.id,
        persona_id: personaId,
        curso_id: cursoId,
        cohorte_id: cohAtId ? cohorteMap.get(cohAtId) ?? null : null,
        estatus: selValue(r.fields["Estatus"]) ?? "activa",
        fecha_inscripcion: r.fields["Fecha inscripción"] ?? new Date().toISOString().slice(0, 10),
      } as Row;
    })
    .filter((x): x is Row => x !== null);
  const inscMap = await upsert("inscripciones", inscRows);

  const progresos = await fetchAll(BASES.PORTAL, TABLES.PROGRESO_LECCIONES);
  const progRows: Row[] = progresos
    .map((r) => {
      const inscAtId = firstLink(r.fields["Inscripción"]);
      const inscId = inscAtId ? inscMap.get(inscAtId) : undefined;
      const lecAtId = firstLink(r.fields["Lección"]);
      const lecId = lecAtId ? leccionMap.get(lecAtId) : undefined;
      if (!inscId || !lecId) return null;
      return {
        airtable_id: r.id,
        inscripcion_id: inscId,
        leccion_id: lecId,
        completado: Boolean(r.fields["Completado"]),
        completado_en: r.fields["Completado en"] ?? null,
        video_pct: r.fields["Video % completado"] ?? null,
      } as Row;
    })
    .filter((x): x is Row => x !== null);
  await upsert("progreso_lecciones", progRows);

  return { inscMap };
}

async function migrarPosts(
  cursoMap: Map<string, string>,
  personasByPortalId: Map<string, string>,
) {
  console.log("\n[5/6] Posts del foro (2 pasadas: top-level → comentarios)");

  const posts = await fetchAll(BASES.PORTAL, TABLES.POSTS);

  // Pasada 1: insertamos primero los top-level (sin post_padre).
  const topLevel = posts.filter((p) => !firstLink(p.fields["Post padre"]));
  const topRows: Row[] = topLevel
    .map((r) => {
      const cursoAtId = firstLink(r.fields["Curso"]);
      const cursoId = cursoAtId ? cursoMap.get(cursoAtId) : undefined;
      const autorAtId = firstLink(r.fields["Autor"]);
      const autorId = autorAtId ? personasByPortalId.get(autorAtId) : undefined;
      if (!cursoId || !autorId) return null;
      return {
        airtable_id: r.id,
        curso_id: cursoId,
        autor_id: autorId,
        post_padre_id: null,
        contenido: String(r.fields["Contenido"] ?? ""),
        adjunto_url: r.fields["Adjunto URL"] ?? null,
        adjunto_tipo: r.fields["Adjunto tipo"] ?? null,
        adjunto_nombre: r.fields["Adjunto nombre"] ?? null,
        estatus: selValue(r.fields["Estatus"]) ?? "activo",
        fecha: r.fields["Fecha"] ?? r.createdTime,
      } as Row;
    })
    .filter((x): x is Row => x !== null);
  const postMap = await upsert("posts", topRows);

  // Pasada 2: comentarios (post_padre ya migrado en pasada 1).
  const comments = posts.filter((p) => firstLink(p.fields["Post padre"]));
  const commentRows: Row[] = comments
    .map((r) => {
      const cursoAtId = firstLink(r.fields["Curso"]);
      const cursoId = cursoAtId ? cursoMap.get(cursoAtId) : undefined;
      const autorAtId = firstLink(r.fields["Autor"]);
      const autorId = autorAtId ? personasByPortalId.get(autorAtId) : undefined;
      const padreAtId = firstLink(r.fields["Post padre"]);
      const padreId = padreAtId ? postMap.get(padreAtId) : undefined;
      if (!cursoId || !autorId || !padreId) return null;
      return {
        airtable_id: r.id,
        curso_id: cursoId,
        autor_id: autorId,
        post_padre_id: padreId,
        contenido: String(r.fields["Contenido"] ?? ""),
        adjunto_url: r.fields["Adjunto URL"] ?? null,
        adjunto_tipo: r.fields["Adjunto tipo"] ?? null,
        adjunto_nombre: r.fields["Adjunto nombre"] ?? null,
        estatus: selValue(r.fields["Estatus"]) ?? "activo",
        fecha: r.fields["Fecha"] ?? r.createdTime,
      } as Row;
    })
    .filter((x): x is Row => x !== null);
  await upsert("posts", commentRows);
}

async function migrarActividades(
  inscMap: Map<string, string>,
  leccionMap: Map<string, string>,
  personasByPortalId: Map<string, string>,
) {
  console.log("\n[6/6] Actividades polimórficas (separadas por tipo)");

  // ACTIVIDADES en Airtable contiene varios "tipos" de actividad. Separamos
  // en función del campo "Tipo" o (si no existe) por presencia de campos
  // específicos (archivos → entrega, respuestas → quiz/autoeval).
  const actividades = await fetchAll(BASES.PORTAL, TABLES.ACTIVIDADES);

  type Bucket = "entregas_tarea" | "respuestas_quiz" | "respuestas_autoeval" | "otros";
  const buckets: Record<Bucket, Row[]> = {
    entregas_tarea: [],
    respuestas_quiz: [],
    respuestas_autoeval: [],
    otros: [],
  };

  for (const r of actividades) {
    const tipo = selValue(r.fields["Tipo"]) ?? selValue(r.fields["Actividad"]);
    const inscAt = firstLink(r.fields["Inscripción"]);
    const inscId = inscAt ? inscMap.get(inscAt) : undefined;
    const lecAt = firstLink(r.fields["Lección"]);
    const lecId = lecAt ? leccionMap.get(lecAt) : undefined;
    if (!inscId || !lecId) continue;

    const archivos = r.fields["Archivos"];
    const respuestasJson = r.fields["Respuestas JSON"];

    if (tipo === "tarea" || (Array.isArray(archivos) && archivos.length > 0)) {
      buckets.entregas_tarea.push({
        airtable_id: r.id,
        inscripcion_id: inscId,
        leccion_id: lecId,
        comentario: String(r.fields["Comentario"] ?? ""),
        archivos: archivos ?? [],
        fecha_entrega: r.fields["Fecha"] ?? r.createdTime,
      });
    } else if (tipo === "quiz") {
      buckets.respuestas_quiz.push({
        airtable_id: r.id,
        inscripcion_id: inscId,
        leccion_id: lecId,
        respuestas: typeof respuestasJson === "string"
          ? JSON.parse(respuestasJson)
          : respuestasJson ?? {},
        completado_en: r.fields["Fecha"] ?? r.createdTime,
      });
    } else if (tipo === "autoeval") {
      buckets.respuestas_autoeval.push({
        airtable_id: r.id,
        inscripcion_id: inscId,
        leccion_id: lecId,
        respuestas: typeof respuestasJson === "string"
          ? JSON.parse(respuestasJson)
          : respuestasJson ?? {},
        resumen: r.fields["Resumen"] ?? null,
        ideas_aplicables: r.fields["Ideas aplicables"] ?? null,
        contenido_relevante: r.fields["Contenido relevante"] ?? null,
        completado_en: r.fields["Fecha"] ?? r.createdTime,
      });
    } else {
      buckets.otros.push({ airtable_id: r.id, tipo });
    }
  }

  await upsert("entregas_tarea", buckets.entregas_tarea);
  await upsert("respuestas_quiz", buckets.respuestas_quiz);
  await upsert("respuestas_autoeval", buckets.respuestas_autoeval);
  if (buckets.otros.length > 0) {
    console.log(`  ⚠ ${buckets.otros.length} actividades NO clasificadas (tipos: ${
      [...new Set(buckets.otros.map(o => o.tipo))].join(", ")
    })`);
  }

  // Tablas dedicadas: RESPUESTAS_AUTOEVAL (puede traer puntajes), EVALUACIONES_SESION
  const autoeval = await fetchAll(BASES.PORTAL, TABLES.RESPUESTAS_AUTOEVAL);
  const autoevalRows: Row[] = autoeval
    .map((r) => {
      const inscAt = firstLink(r.fields["Inscripción"]);
      const inscId = inscAt ? inscMap.get(inscAt) : undefined;
      const lecAt = firstLink(r.fields["Lección"]);
      const lecId = lecAt ? leccionMap.get(lecAt) : undefined;
      if (!inscId || !lecId) return null;
      const rj = r.fields["Respuestas JSON"];
      return {
        airtable_id: r.id,
        inscripcion_id: inscId,
        leccion_id: lecId,
        respuestas: typeof rj === "string" ? JSON.parse(rj) : rj ?? {},
        resumen: r.fields["Resumen"] ?? null,
        ideas_aplicables: r.fields["Ideas aplicables"] ?? null,
        contenido_relevante: r.fields["Contenido relevante"] ?? null,
        completado_en: r.fields["Fecha"] ?? r.createdTime,
      } as Row;
    })
    .filter((x): x is Row => x !== null);
  await upsert("respuestas_autoeval", autoevalRows);

  // EVALUACIONES_SESION (tabla dedicada)
  const evalsSesion = await fetchAll(BASES.PORTAL, TABLES.EVALUACIONES_SESION);
  const evalRows: Row[] = evalsSesion
    .map((r) => {
      const inscAt = firstLink(r.fields["Inscripción"]);
      const inscId = inscAt ? inscMap.get(inscAt) : undefined;
      if (!inscId) return null;
      const lecAt = firstLink(r.fields["Lección"]);
      const lecId = lecAt ? leccionMap.get(lecAt) ?? null : null;
      const rj = r.fields["Respuestas JSON"];
      return {
        airtable_id: r.id,
        inscripcion_id: inscId,
        leccion_id: lecId,
        respuestas: typeof rj === "string" ? JSON.parse(rj) : rj ?? {},
        fomento_participacion: r.fields["Fomento participación"] ?? null,
        profesor_preparado: r.fields["Profesor preparado"] ?? null,
        profesor_general: r.fields["Profesor general"] ?? null,
        resumen: r.fields["Resumen"] ?? null,
        ideas_aplicables: r.fields["Ideas aplicables"] ?? null,
        completado_en: r.fields["Fecha"] ?? r.createdTime,
      } as Row;
    })
    .filter((x): x is Row => x !== null);
  await upsert("evaluaciones_sesion", evalRows);
}

// ── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("============================================");
  console.log(" SOPHIA · Migración Airtable → Postgres");
  console.log(`  modo: ${DRY_RUN ? "DRY RUN (no escribe)" : "ESCRITURA REAL"}`);
  console.log("============================================");

  const t0 = Date.now();

  const { byPortalId: personasByPortalId } = await migrarPersonas();
  const { cursoMap, leccionMap } = await migrarCursos();
  const { cohorteMap } = await migrarCohortesEInvitaciones(cursoMap, personasByPortalId);
  const { inscMap } = await migrarInscripcionesYProgreso(
    cursoMap, cohorteMap, leccionMap, personasByPortalId,
  );
  await migrarPosts(cursoMap, personasByPortalId);
  await migrarActividades(inscMap, leccionMap, personasByPortalId);

  console.log(`\n✓ Listo en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error("\n✗ Migración FALLÓ:", e);
  Deno.exit(1);
});
