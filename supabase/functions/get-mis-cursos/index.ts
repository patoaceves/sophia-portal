// Edge Function: get-mis-cursos
// Returns the list of courses the authenticated user is enrolled in,
// with computed progress %.
//
// GET /get-mis-cursos
// Headers: Authorization: Bearer <supabase_jwt>
//
// Returns: { cursos: [{ id, slug, titulo, descripcionCorta, coverUrl,
//   instructor, colorPrimario, modalidad, fechaInicio, fechaFin,
//   estatus, progresoPct, inscripcionId, fechaInscripcion }] }

import {
  BASES,
  TABLES,
  FIELDS,
  listRecords,
  eqFormula,
} from "../_shared/airtable.ts";
import { handleOptions, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth, HttpError } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const optionsRes = handleOptions(req);
  if (optionsRes) return optionsRes;

  if (req.method !== "GET") {
    return errorResponse(req, "Method not allowed", 405);
  }

  try {
    const user = await requireAuth(req);

    // 1. Get all Inscripciones for this Persona
    // The Persona link in Inscripciones points to the SYNCED Personas table in Portal.
    // The synced records keep the SAME record IDs as their CRM source, so user.personaId
    // (which came from CRM) is also the ID of the synced record in Portal.
    const inscripciones = await listRecords(BASES.PORTAL, TABLES.INSCRIPCIONES, {
      filterByFormula: `FIND('${user.personaId}', ARRAYJOIN({${FIELDS.INSCRIPCIONES.PERSONA}}))`,
      fields: [
        FIELDS.INSCRIPCIONES.CURSO,
        FIELDS.INSCRIPCIONES.ESTATUS,
        FIELDS.INSCRIPCIONES.FECHA_INSCRIPCION,
        FIELDS.INSCRIPCIONES.PROGRESO_LECCIONES,
        FIELDS.INSCRIPCIONES.PROGRESO_PCT,
      ],
    });

    if (inscripciones.length === 0) {
      return jsonResponse(req, { cursos: [] });
    }

    // Collect unique Curso IDs
    const cursoIds = new Set<string>();
    for (const ins of inscripciones) {
      const cursos = (ins.fields[FIELDS.INSCRIPCIONES.CURSO] as string[]) ?? [];
      cursos.forEach((id) => cursoIds.add(id));
    }

    // 2. Fetch Cursos in one shot, filter in JS
    const allCursos = await listRecords(BASES.PORTAL, TABLES.CURSOS, {
      fields: [
        FIELDS.CURSOS.TITULO,
        FIELDS.CURSOS.SLUG,
        FIELDS.CURSOS.DESCRIPCION_CORTA,
        FIELDS.CURSOS.COVER_IMAGE,
        FIELDS.CURSOS.INSTRUCTOR,
        FIELDS.CURSOS.COLOR_PRIMARIO,
        FIELDS.CURSOS.MODALIDAD,
        FIELDS.CURSOS.FECHA_INICIO,
        FIELDS.CURSOS.FECHA_FIN,
        FIELDS.CURSOS.ESTATUS,
        FIELDS.CURSOS.CAPITULOS,
      ],
    });
    const cursosById = new Map<string, typeof allCursos[number]>();
    for (const c of allCursos) {
      if (cursoIds.has(c.id)) cursosById.set(c.id, c);
    }

    // 3. For progress calculation: count total Lecciones per Curso.
    // Strategy: traverse Curso → Capítulos → Lecciones once.
    const allCapitulos = await listRecords(BASES.PORTAL, TABLES.CAPITULOS, {
      fields: [FIELDS.CAPITULOS.CURSO, FIELDS.CAPITULOS.LECCIONES],
    });
    const leccionesCountPorCurso = new Map<string, number>();
    for (const cap of allCapitulos) {
      const cursoLinks = (cap.fields[FIELDS.CAPITULOS.CURSO] as string[]) ?? [];
      const lecciones = (cap.fields[FIELDS.CAPITULOS.LECCIONES] as string[]) ?? [];
      for (const cursoId of cursoLinks) {
        if (!cursoIds.has(cursoId)) continue;
        leccionesCountPorCurso.set(
          cursoId,
          (leccionesCountPorCurso.get(cursoId) ?? 0) + lecciones.length,
        );
      }
    }

    // 4. Count completed lessons per Inscripción (already in fields[PROGRESO_LECCIONES] count)
    // For progress %, we need actually-completed ones. Fetch ProgresoLecciones for these inscripciones.
    const inscripcionIds = inscripciones.map((i) => i.id);
    const progresoFilter = inscripcionIds
      .map((id) => `FIND('${id}', ARRAYJOIN({${FIELDS.PROGRESO_LECCIONES.INSCRIPCION}}))`)
      .join(", ");
    const progresoFormula = inscripcionIds.length === 1
      ? progresoFilter
      : `OR(${progresoFilter})`;

    const progresos = await listRecords(BASES.PORTAL, TABLES.PROGRESO_LECCIONES, {
      filterByFormula: `AND(${progresoFormula}, {${FIELDS.PROGRESO_LECCIONES.COMPLETADO}})`,
      fields: [FIELDS.PROGRESO_LECCIONES.INSCRIPCION],
    });

    const completadasPorInscripcion = new Map<string, number>();
    for (const p of progresos) {
      const insLinks = (p.fields[FIELDS.PROGRESO_LECCIONES.INSCRIPCION] as string[]) ?? [];
      for (const insId of insLinks) {
        completadasPorInscripcion.set(
          insId,
          (completadasPorInscripcion.get(insId) ?? 0) + 1,
        );
      }
    }

    // 5. Assemble response
    const cursos = inscripciones
      .map((ins) => {
        const cursoLinks = (ins.fields[FIELDS.INSCRIPCIONES.CURSO] as string[]) ?? [];
        const cursoId = cursoLinks[0];
        if (!cursoId) return null;
        const c = cursosById.get(cursoId);
        if (!c) return null;

        const totalLecciones = leccionesCountPorCurso.get(cursoId) ?? 0;
        const completadas = completadasPorInscripcion.get(ins.id) ?? 0;
        const progresoPct = totalLecciones > 0
          ? Math.round((completadas / totalLecciones) * 100)
          : 0;

        const coverAttachments = c.fields[FIELDS.CURSOS.COVER_IMAGE] as
          | { url: string }[]
          | undefined;
        const coverUrl = coverAttachments?.[0]?.url ?? null;

        return {
          id: cursoId,
          inscripcionId: ins.id,
          slug: c.fields[FIELDS.CURSOS.SLUG] ?? "",
          titulo: c.fields[FIELDS.CURSOS.TITULO] ?? "",
          descripcionCorta: c.fields[FIELDS.CURSOS.DESCRIPCION_CORTA] ?? "",
          coverUrl,
          instructor: c.fields[FIELDS.CURSOS.INSTRUCTOR] ?? "",
          colorPrimario: c.fields[FIELDS.CURSOS.COLOR_PRIMARIO] ?? "",
          modalidad: c.fields[FIELDS.CURSOS.MODALIDAD] ?? "",
          fechaInicio: c.fields[FIELDS.CURSOS.FECHA_INICIO] ?? null,
          fechaFin: c.fields[FIELDS.CURSOS.FECHA_FIN] ?? null,
          estatus: c.fields[FIELDS.CURSOS.ESTATUS] ?? "",
          inscripcionEstatus: ins.fields[FIELDS.INSCRIPCIONES.ESTATUS] ?? "",
          fechaInscripcion: ins.fields[FIELDS.INSCRIPCIONES.FECHA_INSCRIPCION] ?? null,
          progresoPct,
          totalLecciones,
          leccionesCompletadas: completadas,
        };
      })
      .filter((x) => x !== null);

    return jsonResponse(req, { cursos });
  } catch (e) {
    if (e instanceof HttpError) {
      return errorResponse(req, e.message, e.status);
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("get-mis-cursos error:", msg);
    return errorResponse(req, msg, 500);
  }
});
