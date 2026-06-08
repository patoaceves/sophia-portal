-- ════════════════════════════════════════════════════════════════════
-- SOPHIA Portal · 20260603_003_rpc_lectura.sql
-- RPCs de lectura para colapsar los N round-trips de get-curso y
-- get-mis-cursos en UNA sola llamada a Postgres.
--
-- Aplicar desde el SQL Editor de Supabase (project ajvjyisplqsrjsessayo).
-- Idempotente: create or replace.
--
-- Seguridad: las Edge Functions llaman estos RPCs con service_role y le
-- pasan el persona_id YA validado por requireUser(). Por eso se revoca
-- EXECUTE a anon/authenticated — si un cliente pudiera llamarlos
-- directo, podría pasar el persona_id de otra persona.
--
-- Nota de consistencia: ambos RPCs excluyen lecciones con estatus
-- 'archivada' del conteo. get-mis-cursos (versión TS) las incluía en el
-- total, por lo que el progresoPct del listado podía diferir del detalle
-- del curso. Ahora ambos cuentan igual.
-- ════════════════════════════════════════════════════════════════════

-- ── rpc_get_curso ────────────────────────────────────────────────────
-- Reemplaza las 5 queries de get-curso (curso, inscripción, módulos,
-- lecciones, progresos) y el armado del árbol en JS.
-- Devuelve el payload final en camelCase, listo para relay.
-- Errores de negocio van como { "error": "<code>" } (el edge los mapea
-- a 404/403); errores reales de DB sí truenan como excepción.

create or replace function public.rpc_get_curso(
  p_persona_id uuid,
  p_slug       text
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_curso        public.cursos%rowtype;
  v_insc         public.inscripciones%rowtype;
  v_modulos      jsonb;
  v_total        bigint;
  v_completadas  bigint;
begin
  select * into v_curso
  from public.cursos
  where slug = p_slug
  limit 1;
  if not found then
    return jsonb_build_object('error', 'curso_not_found');
  end if;

  select * into v_insc
  from public.inscripciones
  where persona_id = p_persona_id
    and curso_id   = v_curso.id
  limit 1;
  if not found then
    return jsonb_build_object('error', 'not_enrolled');
  end if;

  -- Módulos → lecciones (con progreso de ESTA inscripción) en un solo paso.
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',          m.id,
          'titulo',      coalesce(m.titulo, ''),
          'descripcion', coalesce(m.descripcion, ''),
          'orden',       coalesce(m.orden, 0),
          'ponente',     coalesce(m.ponente, ''),
          'lecciones',   lx.lecciones
        )
        order by m.orden
      ),
      '[]'::jsonb
    ),
    coalesce(sum(lx.total), 0),
    coalesce(sum(lx.completadas), 0)
  into v_modulos, v_total, v_completadas
  from public.modulos m
  left join lateral (
    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',           l.id,
            'titulo',       coalesce(l.titulo, ''),
            'orden',        coalesce(l.orden, 0),
            'tipo',         coalesce(l.tipo::text, 'texto'),
            'etiqueta',     coalesce(l.etiqueta, ''),
            'completada',   coalesce(pl.completado, false),
            'completadaEn', pl.completado_en
          )
          order by l.orden
        ),
        '[]'::jsonb
      )                                          as lecciones,
      count(l.id)                                as total,
      count(*) filter (where pl.completado)      as completadas
    from public.lecciones l
    left join public.progreso_lecciones pl
      on pl.leccion_id     = l.id
     and pl.inscripcion_id = v_insc.id
    where l.modulo_id = m.id
      and l.estatus  <> 'archivada'
  ) lx on true
  where m.curso_id = v_curso.id;

  return jsonb_build_object(
    'curso', jsonb_build_object(
      'id',               v_curso.id,
      'slug',             v_curso.slug,
      'titulo',           coalesce(v_curso.titulo, ''),
      'descripcionCorta', coalesce(v_curso.descripcion_corta, ''),
      'descripcionLarga', coalesce(v_curso.descripcion_larga, ''),
      'coverUrl',         v_curso.cover_image,
      'instructor',       coalesce(v_curso.instructor, ''),
      'colorPrimario',    coalesce(v_curso.color_primario, ''),
      'modalidad',        coalesce(v_curso.modalidad::text, ''),
      'fechaInicio',      v_curso.fecha_inicio,
      'fechaFin',         v_curso.fecha_fin,
      'estatus',          coalesce(v_curso.estatus::text, '')
    ),
    'inscripcion', jsonb_build_object(
      'id',               v_insc.id,
      'estatus',          coalesce(v_insc.estatus::text, ''),
      'fechaInscripcion', v_insc.fecha_inscripcion,
      'progresoPct',      case when v_total > 0
                               then round(100.0 * v_completadas / v_total)::int
                               else 0 end
    ),
    'modulos', v_modulos
  );
end;
$$;

revoke all on function public.rpc_get_curso(uuid, text) from public;
revoke all on function public.rpc_get_curso(uuid, text) from anon;
revoke all on function public.rpc_get_curso(uuid, text) from authenticated;
grant execute on function public.rpc_get_curso(uuid, text) to service_role;


-- ── rpc_get_mis_cursos ───────────────────────────────────────────────
-- Reemplaza las 3 queries de get-mis-cursos. Los conteos se hacen con
-- agregados SQL (subqueries escalares sobre índices existentes:
-- modulos_curso_orden_idx, lecciones_modulo_orden_idx,
-- progreso_inscripcion_idx) en vez de traer todas las filas a JS.

create or replace function public.rpc_get_mis_cursos(
  p_persona_id uuid
)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'cursos',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',                  c.id,
          'inscripcionId',       i.id,
          'slug',                coalesce(c.slug, ''),
          'titulo',              coalesce(c.titulo, ''),
          'descripcionCorta',    coalesce(c.descripcion_corta, ''),
          'coverUrl',            c.cover_image,
          'instructor',          coalesce(c.instructor, ''),
          'colorPrimario',       coalesce(c.color_primario, ''),
          'modalidad',           coalesce(c.modalidad::text, ''),
          'fechaInicio',         c.fecha_inicio,
          'fechaFin',            c.fecha_fin,
          'estatus',             coalesce(c.estatus::text, ''),
          'inscripcionEstatus',  coalesce(i.estatus::text, ''),
          'fechaInscripcion',    i.fecha_inscripcion,
          'totalLecciones',      stats.total,
          'leccionesCompletadas', stats.completadas,
          'progresoPct',         case when stats.total > 0
                                      then round(100.0 * stats.completadas / stats.total)::int
                                      else 0 end
        )
        order by i.fecha_inscripcion desc
      ),
      '[]'::jsonb
    )
  )
  from public.inscripciones i
  join public.cursos c on c.id = i.curso_id
  left join lateral (
    select
      (select count(*)
         from public.lecciones l
         join public.modulos m on m.id = l.modulo_id
        where m.curso_id = c.id
          and l.estatus <> 'archivada')                       as total,
      (select count(*)
         from public.progreso_lecciones pl
        where pl.inscripcion_id = i.id
          and pl.completado)                                  as completadas
  ) stats on true
  where i.persona_id = p_persona_id
    and i.estatus in ('activa', 'finalizada');
$$;

revoke all on function public.rpc_get_mis_cursos(uuid) from public;
revoke all on function public.rpc_get_mis_cursos(uuid) from anon;
revoke all on function public.rpc_get_mis_cursos(uuid) from authenticated;
grant execute on function public.rpc_get_mis_cursos(uuid) to service_role;
