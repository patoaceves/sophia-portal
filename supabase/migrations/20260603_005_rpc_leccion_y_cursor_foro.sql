-- ════════════════════════════════════════════════════════════════════
-- SOPHIA Portal · 20260603_005_rpc_leccion_y_cursor_foro.sql
-- 1) rpc_get_leccion: colapsa las 5 queries de get-leccion (lección,
--    módulo, inscripción, hermanas para prev/next, progreso) en una
--    sola llamada. La sanitización del HTML se queda en la Edge Function
--    (el RPC regresa contenidoHtmlRaw).
-- 2) Índice (curso_id, fecha desc, id desc) para el cursor compuesto
--    fecha+id de get-foro-posts v12 (tiebreak determinista cuando hay
--    posts en el mismo instante). Reemplaza al índice _visible_idx de la
--    migración 004 (subset, redundante).
-- ════════════════════════════════════════════════════════════════════

-- ── rpc_get_leccion ──────────────────────────────────────────────────
-- p_id acepta UUID o airtable_id (recXXX) para compat con bookmarks.
-- Errores de negocio como { "error": "<code>" }; el edge los mapea a
-- 400/404/403/500.
-- Nota: prev/next ahora ordenan por (orden, id) — antes solo por orden,
-- así que con órdenes duplicados el empate era no-determinista; ahora es
-- estable.

create or replace function public.rpc_get_leccion(
  p_persona_id uuid,
  p_id         text
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_l             public.lecciones%rowtype;
  v_m             public.modulos%rowtype;
  v_insc_id       uuid;
  v_prev          uuid;
  v_next          uuid;
  v_completado    boolean;
  v_completado_en timestamptz;
begin
  if p_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v_l from public.lecciones where id = p_id::uuid;
  elsif p_id ~ '^rec[A-Za-z0-9]{14,}$' then
    select * into v_l from public.lecciones where airtable_id = p_id limit 1;
  else
    return jsonb_build_object('error', 'invalid_id');
  end if;
  if not found then
    return jsonb_build_object('error', 'leccion_not_found');
  end if;

  select * into v_m from public.modulos where id = v_l.modulo_id;
  if not found then
    return jsonb_build_object('error', 'data_error');
  end if;

  select i.id into v_insc_id
  from public.inscripciones i
  where i.persona_id = p_persona_id
    and i.curso_id   = v_m.curso_id
  limit 1;
  if not found then
    return jsonb_build_object('error', 'not_enrolled');
  end if;

  -- Prev/next entre hermanas no archivadas, orden estable (orden, id)
  with hermanas as (
    select id, row_number() over (order by orden, id) as rn
    from public.lecciones
    where modulo_id = v_m.id
      and estatus <> 'archivada'
  ),
  me as (select rn from hermanas where id = v_l.id)
  select
    (select h.id from hermanas h, me where h.rn = me.rn - 1),
    (select h.id from hermanas h, me where h.rn = me.rn + 1)
  into v_prev, v_next;

  select pl.completado, pl.completado_en
  into v_completado, v_completado_en
  from public.progreso_lecciones pl
  where pl.inscripcion_id = v_insc_id
    and pl.leccion_id     = v_l.id
  limit 1;

  return jsonb_build_object(
    'leccion', jsonb_build_object(
      'id',               v_l.id,
      'titulo',           coalesce(v_l.titulo, ''),
      'subtitulo',        coalesce(v_l.subtitulo, ''),
      'orden',            coalesce(v_l.orden, 0),
      'tipo',             coalesce(v_l.tipo::text, 'texto'),
      'etiqueta',         coalesce(v_l.etiqueta, ''),
      'contenidoHtmlRaw', coalesce(v_l.contenido_html, ''),
      'urlVideo',         v_l.url_video,
      'urlExterna',       coalesce(v_l.url_externa, v_l.archivo_url),
      'archivoUrl',       v_l.archivo_url,
      'archivoNombre',    v_l.archivo_nombre,
      'evaluacionRef',    v_l.evaluacion_ref,
      'completada',       coalesce(v_completado, false),
      'completadaEn',     v_completado_en
    ),
    'moduloId', v_m.id,
    'modulo', jsonb_build_object(
      'id',      v_m.id,
      'titulo',  coalesce(v_m.titulo, ''),
      'orden',   coalesce(v_m.orden, 0),
      'ponente', coalesce(v_m.ponente, '')
    ),
    'cursoId',       v_m.curso_id,
    'inscripcionId', v_insc_id,
    'prevId',        v_prev,
    'nextId',        v_next
  );
end;
$$;

revoke all on function public.rpc_get_leccion(uuid, text) from public;
revoke all on function public.rpc_get_leccion(uuid, text) from anon;
revoke all on function public.rpc_get_leccion(uuid, text) from authenticated;
grant execute on function public.rpc_get_leccion(uuid, text) to service_role;


-- ── Índice para el cursor compuesto del foro ─────────────────────────
create index if not exists posts_curso_toplevel_fecha_id_visible_idx
on public.posts (curso_id, fecha desc, id desc)
where post_padre_id is null
  and estatus in ('activo', 'eliminado');

-- El índice de la migración 004 queda subsumido por el de arriba:
drop index if exists public.posts_curso_toplevel_fecha_visible_idx;

-- El índice original (solo 'activo') sigue sin usarse por las queries
-- actuales; retirarlo cuando se valide en prod:
--   drop index if exists public.posts_curso_toplevel_fecha_idx;
