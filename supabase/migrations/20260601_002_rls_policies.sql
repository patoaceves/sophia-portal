-- ============================================================================
-- SOPHIA Portal · Políticas RLS (Row Level Security)
-- ============================================================================
-- Estrategia híbrida: RLS solo para lecturas simples desde el frontend.
-- Las escrituras y lecturas complejas (joins, lógica de negocio) siguen
-- yendo por Edge Functions usando service_role, que IGNORA RLS por diseño.
--
-- Por eso solo definimos políticas de SELECT aquí. Cualquier INSERT/UPDATE/
-- DELETE desde el cliente queda BLOQUEADO por default (RLS denies by default).
--
-- Para que un cliente pueda hacer SELECT debe estar autenticado, y debe
-- aplicar alguna de las políticas de abajo. auth.uid() devuelve el UUID
-- del usuario logueado (de auth.users).
--
-- Helper "yo soy" — convierte auth.uid() a personas.id. Lo usamos en muchas
-- políticas; se marca STABLE para que Postgres pueda cachearlo dentro de
-- la query.
-- ============================================================================

create or replace function public.persona_id_of_auth_user()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.personas where auth_user_id = auth.uid() limit 1;
$$;

-- Habilitar RLS en todas las tablas. Sin políticas, todo SELECT se bloquea.
alter table public.personas              enable row level security;
alter table public.cursos                enable row level security;
alter table public.modulos               enable row level security;
alter table public.lecciones             enable row level security;
alter table public.cohortes              enable row level security;
alter table public.invitaciones          enable row level security;
alter table public.inscripciones         enable row level security;
alter table public.progreso_lecciones    enable row level security;
alter table public.posts                 enable row level security;
alter table public.entregas_tarea        enable row level security;
alter table public.respuestas_quiz       enable row level security;
alter table public.respuestas_autoeval   enable row level security;
alter table public.tests_felicidad       enable row level security;
alter table public.tests_autoconocimiento enable row level security;
alter table public.evaluaciones_sesion   enable row level security;

-- ============================================================================
-- PERSONAS: cada quien ve solo su propia fila
-- ============================================================================
-- Esto es lo que el frontend usa para mostrar "tu perfil". Para ver perfiles
-- ajenos (foro, roster) se sigue pasando por Edge Function que usa
-- service_role y aplica reglas de negocio (rol admin, mismo curso, etc.).
-- ============================================================================

create policy personas_self_select
  on public.personas
  for select to authenticated
  using (auth_user_id = auth.uid());

-- ============================================================================
-- CURSOS: solo cursos publicados (catálogo público).
-- Para ver el detalle de un curso al que estás inscrito, sigue siendo Edge
-- Function (lleva inscripción, módulos, progreso). Esta política sirve
-- para el listado público.
-- ============================================================================

create policy cursos_publicados_select
  on public.cursos
  for select to authenticated, anon
  using (estatus = 'published' and visibilidad = 'público');

-- Adicional: si estás inscrito a un curso, puedes leerlo aunque no sea
-- público. Esto sirve para vistas simples sin Edge Function.
create policy cursos_inscrito_select
  on public.cursos
  for select to authenticated
  using (
    exists (
      select 1
      from public.inscripciones i
      where i.curso_id = cursos.id
        and i.persona_id = public.persona_id_of_auth_user()
        and i.estatus in ('activa', 'pendiente', 'finalizada')
    )
  );

-- ============================================================================
-- MÓDULOS · LECCIONES: visibles si puedes ver el curso padre
-- ============================================================================
-- Usar EXISTS sobre cursos, que ya tiene su política. Esto encadena RLS.
-- ============================================================================

create policy modulos_via_curso_select
  on public.modulos
  for select to authenticated, anon
  using (
    exists (select 1 from public.cursos c where c.id = modulos.curso_id)
  );

create policy lecciones_via_modulo_select
  on public.lecciones
  for select to authenticated, anon
  using (
    exists (
      select 1 from public.modulos m
      join public.cursos c on c.id = m.curso_id
      where m.id = lecciones.modulo_id
    )
  );

-- ============================================================================
-- INSCRIPCIONES · PROGRESO: solo las tuyas
-- ============================================================================

create policy inscripciones_self_select
  on public.inscripciones
  for select to authenticated
  using (persona_id = public.persona_id_of_auth_user());

create policy progreso_self_select
  on public.progreso_lecciones
  for select to authenticated
  using (
    exists (
      select 1 from public.inscripciones i
      where i.id = progreso_lecciones.inscripcion_id
        and i.persona_id = public.persona_id_of_auth_user()
    )
  );

-- ============================================================================
-- POSTS (foro): si estás inscrito al curso, ves los posts activos.
-- Los eliminados los maneja la Edge Function (tombstones con comentarios).
-- ============================================================================

create policy posts_curso_inscrito_select
  on public.posts
  for select to authenticated
  using (
    estatus = 'activo'
    and exists (
      select 1 from public.inscripciones i
      where i.curso_id = posts.curso_id
        and i.persona_id = public.persona_id_of_auth_user()
        and i.estatus in ('activa', 'pendiente', 'finalizada')
    )
  );

-- ============================================================================
-- ACTIVIDADES (entregas, quizzes, etc.): solo las tuyas, vía inscripción
-- ============================================================================

create policy entregas_tarea_self_select on public.entregas_tarea
  for select to authenticated
  using (
    exists (
      select 1 from public.inscripciones i
      where i.id = entregas_tarea.inscripcion_id
        and i.persona_id = public.persona_id_of_auth_user()
    )
  );

create policy respuestas_quiz_self_select on public.respuestas_quiz
  for select to authenticated
  using (
    exists (
      select 1 from public.inscripciones i
      where i.id = respuestas_quiz.inscripcion_id
        and i.persona_id = public.persona_id_of_auth_user()
    )
  );

create policy respuestas_autoeval_self_select on public.respuestas_autoeval
  for select to authenticated
  using (
    exists (
      select 1 from public.inscripciones i
      where i.id = respuestas_autoeval.inscripcion_id
        and i.persona_id = public.persona_id_of_auth_user()
    )
  );

create policy tests_felicidad_self_select on public.tests_felicidad
  for select to authenticated
  using (persona_id = public.persona_id_of_auth_user());

create policy tests_autoconocimiento_self_select on public.tests_autoconocimiento
  for select to authenticated
  using (persona_id = public.persona_id_of_auth_user());

create policy evaluaciones_sesion_self_select on public.evaluaciones_sesion
  for select to authenticated
  using (
    exists (
      select 1 from public.inscripciones i
      where i.id = evaluaciones_sesion.inscripcion_id
        and i.persona_id = public.persona_id_of_auth_user()
    )
  );

-- ============================================================================
-- COHORTES e INVITACIONES: NO se exponen al cliente vía RLS.
-- El claim-invitation pasa por Edge Function que valida tokens y manda
-- emails. No hay caso de uso de "lista de cohortes desde el frontend".
-- Las dejamos con RLS habilitado y SIN políticas → todo SELECT bloqueado
-- desde anon/authenticated, solo accesible vía service_role.
-- ============================================================================
