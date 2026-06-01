-- ============================================================================
-- SOPHIA Portal · RLS y politicas (SNAPSHOT DEL ESTADO VIVO)
-- ============================================================================
-- Generado desde produccion el 2026-06-01. Modelo hibrido:
--   * Lecturas simples: via RLS (politicas SELECT de abajo).
--   * Escrituras y lecturas complejas: via Edge Functions con service_role
--     (service_role hace BYPASS de RLS, por eso no hay politicas de escritura).
-- Todas las tablas tienen RLS habilitado (no forzado). El helper
-- persona_id_of_auth_user() resuelve la persona del usuario autenticado.
-- ============================================================================

create or replace function public.persona_id_of_auth_user()
returns uuid
language sql
stable security definer
set search_path to 'public'
as $function$
  select id from public.personas where auth_user_id = auth.uid() limit 1;
$function$;


-- ===== HABILITAR RLS =====
alter table public.cohortes enable row level security;
alter table public.cursos enable row level security;
alter table public.entregas_tarea enable row level security;
alter table public.evaluaciones_sesion enable row level security;
alter table public.inscripciones enable row level security;
alter table public.invitaciones enable row level security;
alter table public.lecciones enable row level security;
alter table public.modulos enable row level security;
alter table public.personas enable row level security;
alter table public.posts enable row level security;
alter table public.progreso_lecciones enable row level security;
alter table public.respuestas_autoeval enable row level security;
alter table public.respuestas_quiz enable row level security;
alter table public.tests_felicidad enable row level security;

-- ===== POLITICAS SELECT =====
drop policy if exists cursos_inscrito_select on public.cursos;
create policy cursos_inscrito_select on public.cursos
  for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM inscripciones i
  WHERE ((i.curso_id = cursos.id) AND (i.persona_id = persona_id_of_auth_user()) AND (i.estatus = ANY (ARRAY['activa'::inscripcion_estatus, 'pendiente'::inscripcion_estatus, 'finalizada'::inscripcion_estatus]))))));
drop policy if exists cursos_publicados_select on public.cursos;
create policy cursos_publicados_select on public.cursos
  for select to anon, authenticated
  using (((estatus = 'published'::curso_estatus) AND (visibilidad = 'público'::curso_visibilidad)));
drop policy if exists entregas_tarea_self_select on public.entregas_tarea;
create policy entregas_tarea_self_select on public.entregas_tarea
  for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM inscripciones i
  WHERE ((i.id = entregas_tarea.inscripcion_id) AND (i.persona_id = persona_id_of_auth_user())))));
drop policy if exists evaluaciones_sesion_self_select on public.evaluaciones_sesion;
create policy evaluaciones_sesion_self_select on public.evaluaciones_sesion
  for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM inscripciones i
  WHERE ((i.id = evaluaciones_sesion.inscripcion_id) AND (i.persona_id = persona_id_of_auth_user())))));
drop policy if exists inscripciones_self_select on public.inscripciones;
create policy inscripciones_self_select on public.inscripciones
  for select to authenticated
  using ((persona_id = persona_id_of_auth_user()));
drop policy if exists lecciones_via_modulo_select on public.lecciones;
create policy lecciones_via_modulo_select on public.lecciones
  for select to anon, authenticated
  using (((estatus = 'publicada'::leccion_estatus) AND (EXISTS ( SELECT 1
   FROM (modulos m
     JOIN cursos c ON ((c.id = m.curso_id)))
  WHERE (m.id = lecciones.modulo_id)))));
drop policy if exists modulos_via_curso_select on public.modulos;
create policy modulos_via_curso_select on public.modulos
  for select to anon, authenticated
  using ((EXISTS ( SELECT 1
   FROM cursos c
  WHERE (c.id = modulos.curso_id))));
drop policy if exists personas_self_select on public.personas;
create policy personas_self_select on public.personas
  for select to authenticated
  using ((auth_user_id = auth.uid()));
drop policy if exists posts_curso_inscrito_select on public.posts;
create policy posts_curso_inscrito_select on public.posts
  for select to authenticated
  using (((estatus = 'activo'::post_estatus) AND (EXISTS ( SELECT 1
   FROM inscripciones i
  WHERE ((i.curso_id = posts.curso_id) AND (i.persona_id = persona_id_of_auth_user()) AND (i.estatus = ANY (ARRAY['activa'::inscripcion_estatus, 'pendiente'::inscripcion_estatus, 'finalizada'::inscripcion_estatus])))))));
drop policy if exists progreso_self_select on public.progreso_lecciones;
create policy progreso_self_select on public.progreso_lecciones
  for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM inscripciones i
  WHERE ((i.id = progreso_lecciones.inscripcion_id) AND (i.persona_id = persona_id_of_auth_user())))));
drop policy if exists respuestas_autoeval_self_select on public.respuestas_autoeval;
create policy respuestas_autoeval_self_select on public.respuestas_autoeval
  for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM inscripciones i
  WHERE ((i.id = respuestas_autoeval.inscripcion_id) AND (i.persona_id = persona_id_of_auth_user())))));
drop policy if exists respuestas_quiz_self_select on public.respuestas_quiz;
create policy respuestas_quiz_self_select on public.respuestas_quiz
  for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM inscripciones i
  WHERE ((i.id = respuestas_quiz.inscripcion_id) AND (i.persona_id = persona_id_of_auth_user())))));
drop policy if exists tests_felicidad_self_select on public.tests_felicidad;
create policy tests_felicidad_self_select on public.tests_felicidad
  for select to authenticated
  using ((persona_id = persona_id_of_auth_user()));
