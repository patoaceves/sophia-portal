-- ============================================================================
-- SOPHIA Portal · Migración inicial a Postgres
-- ============================================================================
-- Este archivo crea todo el esquema desde cero. Es la fuente de verdad del
-- modelo. Asume Postgres 15+ (Supabase usa 15).
--
-- Convenciones:
--   • Tablas en snake_case plural (cursos, lecciones, inscripciones)
--   • PKs son UUID generados por gen_random_uuid() (estándar pgcrypto)
--   • Toda tabla incluye created_at, updated_at (timestamptz) con triggers
--   • FKs en CASCADE solo cuando borrar el padre debe borrar al hijo
--     (ej. borrar un curso borra sus módulos). En todo lo demás, RESTRICT.
--   • Cada tabla conserva un campo opcional `airtable_id TEXT UNIQUE` para
--     trazabilidad en el periodo de gracia (1 mes). Al cortar, se eliminan
--     todos esos campos en una migration de limpieza.
--   • RLS está HABILITADO en todas las tablas. Las políticas concretas
--     viven al final.
-- ============================================================================

-- pgcrypto da gen_random_uuid()
create extension if not exists "pgcrypto";

-- Helper para auto-actualizar updated_at en cada UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- ENUMS (tipos correctos en vez de strings sueltos)
-- ============================================================================

create type curso_estatus as enum ('draft', 'published', 'archived');
create type curso_visibilidad as enum ('privado', 'oculto', 'público');
create type curso_modalidad as enum ('online', 'presencial', 'híbrido');
create type curso_tema as enum ('light', 'dark');

create type leccion_tipo as enum (
  'texto', 'video', 'pdf', 'audio', 'enlace', 'descarga',
  'quiz', 'autoeval', 'tarea', 'sesion_live'
);

create type inscripcion_estatus as enum (
  'activa', 'finalizada', 'cancelada', 'pendiente'
);

create type cohorte_estatus as enum (
  'planeada', 'abierta', 'cerrada', 'completada'
);

create type invitacion_estatus as enum (
  'activa', 'canjeada', 'expirada', 'revocada', 'pendiente'
);

create type post_estatus as enum ('activo', 'oculto', 'eliminado');

create type persona_rol as enum ('alumno', 'instructor', 'admin');

-- ============================================================================
-- PERSONAS — unificada (antes CRM + Portal)
-- ============================================================================
-- Una sola fila por persona. auth_user_id es FK a auth.users de Supabase
-- (puede ser NULL si la persona existe en CRM pero aún no se ha registrado).
-- ============================================================================

create table public.personas (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid unique references auth.users(id) on delete set null,
  email           text not null,
  nombre          text not null default '',
  apellidos       text not null default '',
  rol             persona_rol not null default 'alumno',
  telefono_pais   text,
  telefono_numero text,
  avatar_url      text,
  perfil_completado boolean not null default false,
  aviso_aceptado_en timestamptz,
  aviso_version   text,
  aviso_ip_hash   text,

  -- Trazabilidad temporal (1 mes): si una fila vino de Airtable, aquí queda
  -- el record ID original (CRM o Portal). Se borra al cortar Airtable.
  airtable_crm_id    text unique,
  airtable_portal_id text unique,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Email único case-insensitive (Airtable lo trataba como sensitive, pero
-- emails realmente no lo son).
create unique index personas_email_lower_idx on public.personas (lower(email));
create index personas_auth_user_id_idx on public.personas (auth_user_id);
create index personas_rol_idx on public.personas (rol);

create trigger personas_set_updated_at
  before update on public.personas
  for each row execute function public.set_updated_at();

-- ============================================================================
-- CURSOS · MÓDULOS · LECCIONES (contenido)
-- ============================================================================

create table public.cursos (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  titulo            text not null,
  descripcion_corta text not null default '',
  descripcion_larga text not null default '',
  cover_image       text,
  instructor        text not null default '',
  -- color_primario como hex string (#RRGGBB). Validado por CHECK.
  color_primario    text not null default '#000000'
    check (color_primario ~ '^#[0-9A-Fa-f]{6}$'),
  modalidad         curso_modalidad not null default 'online',
  tema              curso_tema not null default 'light',
  visibilidad       curso_visibilidad not null default 'privado',
  estatus           curso_estatus not null default 'draft',
  fecha_inicio      date,
  fecha_fin         date,
  -- Validación: si ambas fechas existen, inicio <= fin.
  constraint cursos_fechas_ok check (
    fecha_inicio is null or fecha_fin is null or fecha_inicio <= fecha_fin
  ),

  airtable_id       text unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index cursos_estatus_idx on public.cursos (estatus);
create trigger cursos_set_updated_at
  before update on public.cursos
  for each row execute function public.set_updated_at();

create table public.modulos (
  id          uuid primary key default gen_random_uuid(),
  curso_id    uuid not null references public.cursos(id) on delete cascade,
  titulo      text not null,
  descripcion text not null default '',
  ponente     text,
  orden       integer not null default 0,
  airtable_id text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index modulos_curso_orden_idx on public.modulos (curso_id, orden);
create trigger modulos_set_updated_at
  before update on public.modulos
  for each row execute function public.set_updated_at();

create table public.lecciones (
  id          uuid primary key default gen_random_uuid(),
  modulo_id   uuid not null references public.modulos(id) on delete cascade,
  titulo      text not null,
  tipo        leccion_tipo not null default 'texto',
  etiqueta    text,
  orden       integer not null default 0,

  -- Campos del contenido (todos opcionales según el tipo)
  contenido_html        text,
  url_video             text,
  url_externa           text,
  archivo_url           text,
  archivo_nombre        text,

  airtable_id text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index lecciones_modulo_orden_idx on public.lecciones (modulo_id, orden);
create index lecciones_tipo_idx on public.lecciones (tipo);
create trigger lecciones_set_updated_at
  before update on public.lecciones
  for each row execute function public.set_updated_at();

-- ============================================================================
-- COHORTES e INVITACIONES (control de inscripciones)
-- ============================================================================

create table public.cohortes (
  id           uuid primary key default gen_random_uuid(),
  curso_id     uuid not null references public.cursos(id) on delete restrict,
  nombre       text not null,
  estatus      cohorte_estatus not null default 'planeada',
  fecha_inicio date,
  fecha_fin    date,
  airtable_id  text unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index cohortes_curso_idx on public.cohortes (curso_id);
create trigger cohortes_set_updated_at
  before update on public.cohortes
  for each row execute function public.set_updated_at();

create table public.invitaciones (
  id                  uuid primary key default gen_random_uuid(),
  token               text not null unique,
  cohorte_id          uuid not null references public.cohortes(id) on delete restrict,
  email_destinatario  text not null,
  origen              text,
  estatus             invitacion_estatus not null default 'activa',
  persona_id          uuid references public.personas(id) on delete set null,
  fecha_canje         timestamptz,
  expira_el           timestamptz,
  notas               text,
  airtable_id         text unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index invitaciones_token_idx on public.invitaciones (token);
create index invitaciones_email_idx on public.invitaciones (lower(email_destinatario));
create index invitaciones_estatus_idx on public.invitaciones (estatus);
create trigger invitaciones_set_updated_at
  before update on public.invitaciones
  for each row execute function public.set_updated_at();

-- ============================================================================
-- INSCRIPCIONES · PROGRESO
-- ============================================================================

create table public.inscripciones (
  id                 uuid primary key default gen_random_uuid(),
  persona_id         uuid not null references public.personas(id) on delete restrict,
  curso_id           uuid not null references public.cursos(id) on delete restrict,
  cohorte_id         uuid references public.cohortes(id) on delete set null,
  estatus            inscripcion_estatus not null default 'activa',
  fecha_inscripcion  date not null default current_date,
  -- progreso_pct lo calculamos en SQL bajo demanda; no lo guardamos aquí
  -- (era un rollup en Airtable, en Postgres se reemplaza por una vista).
  airtable_id        text unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
-- Una persona no puede tener dos inscripciones activas al mismo curso.
create unique index inscripciones_persona_curso_unique
  on public.inscripciones (persona_id, curso_id)
  where estatus in ('activa', 'pendiente');
create index inscripciones_persona_idx on public.inscripciones (persona_id);
create index inscripciones_curso_idx on public.inscripciones (curso_id);
create index inscripciones_cohorte_idx on public.inscripciones (cohorte_id);
create trigger inscripciones_set_updated_at
  before update on public.inscripciones
  for each row execute function public.set_updated_at();

create table public.progreso_lecciones (
  id              uuid primary key default gen_random_uuid(),
  inscripcion_id  uuid not null references public.inscripciones(id) on delete cascade,
  leccion_id      uuid not null references public.lecciones(id) on delete cascade,
  completado      boolean not null default false,
  completado_en   timestamptz,
  video_pct       numeric(5,2) check (video_pct is null or (video_pct >= 0 and video_pct <= 100)),
  airtable_id     text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- Un progreso por par (inscripción, lección).
create unique index progreso_inscripcion_leccion_unique
  on public.progreso_lecciones (inscripcion_id, leccion_id);
create index progreso_inscripcion_idx on public.progreso_lecciones (inscripcion_id);
create index progreso_leccion_idx on public.progreso_lecciones (leccion_id);
create trigger progreso_set_updated_at
  before update on public.progreso_lecciones
  for each row execute function public.set_updated_at();

-- Vista derivada: porcentaje de progreso por inscripción (reemplaza el rollup
-- de Airtable). El cliente la consulta cuando necesita el número.
create or replace view public.inscripciones_con_progreso as
select
  i.*,
  coalesce(
    round(
      100.0 * count(p.id) filter (where p.completado)
      / nullif(count(l.id), 0),
      2
    ),
    0
  )::numeric(5,2) as progreso_pct,
  count(l.id)::int filter (where true) as total_lecciones,
  count(p.id)::int filter (where p.completado) as lecciones_completadas
from public.inscripciones i
left join public.modulos m on m.curso_id = i.curso_id
left join public.lecciones l on l.modulo_id = m.id
left join public.progreso_lecciones p
  on p.inscripcion_id = i.id and p.leccion_id = l.id
group by i.id;

-- ============================================================================
-- FORO · POSTS (con comentarios anidados, mismo modelo)
-- ============================================================================
-- Un post puede tener un post_padre (un comentario es un post hijo). Esto
-- replica exactamente el modelo actual en Airtable, que ya funciona.
-- ============================================================================

create table public.posts (
  id              uuid primary key default gen_random_uuid(),
  curso_id        uuid not null references public.cursos(id) on delete cascade,
  autor_id        uuid not null references public.personas(id) on delete restrict,
  post_padre_id   uuid references public.posts(id) on delete cascade,
  contenido       text not null default '',
  adjunto_url     text,
  adjunto_tipo    text,
  adjunto_nombre  text,
  estatus         post_estatus not null default 'activo',
  fecha           timestamptz not null default now(),
  airtable_id     text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- Índice clave: hilos top-level de un curso ordenados por fecha desc.
-- (Es la query principal del foro.)
create index posts_curso_toplevel_fecha_idx
  on public.posts (curso_id, fecha desc)
  where post_padre_id is null and estatus = 'activo';
-- Comentarios por padre.
create index posts_padre_idx on public.posts (post_padre_id)
  where post_padre_id is not null;
create index posts_autor_idx on public.posts (autor_id);
create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ACTIVIDADES TIPADAS (antes una sola tabla polimórfica en Airtable)
-- ============================================================================

create table public.entregas_tarea (
  id             uuid primary key default gen_random_uuid(),
  inscripcion_id uuid not null references public.inscripciones(id) on delete cascade,
  leccion_id     uuid not null references public.lecciones(id) on delete restrict,
  comentario     text not null default '',
  archivos       jsonb not null default '[]'::jsonb,  -- [{url, nombre, mime, size}]
  fecha_entrega  timestamptz not null default now(),
  airtable_id    text unique,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- Una entrega por (inscripción, lección). Si se reentrega, se actualiza la
-- misma fila (mismo patrón que el código hoy con upsert por candidato).
create unique index entregas_tarea_inscripcion_leccion_unique
  on public.entregas_tarea (inscripcion_id, leccion_id);
create trigger entregas_tarea_set_updated_at
  before update on public.entregas_tarea
  for each row execute function public.set_updated_at();

create table public.respuestas_quiz (
  id              uuid primary key default gen_random_uuid(),
  inscripcion_id  uuid not null references public.inscripciones(id) on delete cascade,
  leccion_id      uuid not null references public.lecciones(id) on delete restrict,
  respuestas      jsonb not null default '{}'::jsonb,
  score           numeric(5,2),
  completado_en   timestamptz not null default now(),
  airtable_id     text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index respuestas_quiz_inscripcion_idx on public.respuestas_quiz (inscripcion_id);
create trigger respuestas_quiz_set_updated_at
  before update on public.respuestas_quiz
  for each row execute function public.set_updated_at();

create table public.respuestas_autoeval (
  id              uuid primary key default gen_random_uuid(),
  inscripcion_id  uuid not null references public.inscripciones(id) on delete cascade,
  leccion_id      uuid not null references public.lecciones(id) on delete restrict,
  respuestas      jsonb not null default '{}'::jsonb,
  puntajes        jsonb,                       -- resultados por dimensión
  resumen         text,
  ideas_aplicables text,
  contenido_relevante text,
  completado_en   timestamptz not null default now(),
  airtable_id     text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index respuestas_autoeval_inscripcion_idx
  on public.respuestas_autoeval (inscripcion_id);
create trigger respuestas_autoeval_set_updated_at
  before update on public.respuestas_autoeval
  for each row execute function public.set_updated_at();

create table public.tests_felicidad (
  id              uuid primary key default gen_random_uuid(),
  persona_id      uuid not null references public.personas(id) on delete cascade,
  respuestas      jsonb not null default '{}'::jsonb,
  resultados      jsonb,
  completado_en   timestamptz not null default now(),
  airtable_id     text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index tests_felicidad_persona_idx on public.tests_felicidad (persona_id);
create trigger tests_felicidad_set_updated_at
  before update on public.tests_felicidad
  for each row execute function public.set_updated_at();

create table public.tests_autoconocimiento (
  id              uuid primary key default gen_random_uuid(),
  persona_id      uuid not null references public.personas(id) on delete cascade,
  respuestas      jsonb not null default '{}'::jsonb,
  resultados      jsonb,
  completado_en   timestamptz not null default now(),
  airtable_id     text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index tests_autoconocimiento_persona_idx
  on public.tests_autoconocimiento (persona_id);
create trigger tests_autoconocimiento_set_updated_at
  before update on public.tests_autoconocimiento
  for each row execute function public.set_updated_at();

create table public.evaluaciones_sesion (
  id              uuid primary key default gen_random_uuid(),
  inscripcion_id  uuid not null references public.inscripciones(id) on delete cascade,
  leccion_id      uuid references public.lecciones(id) on delete set null,
  respuestas      jsonb not null default '{}'::jsonb,
  fomento_participacion integer,
  profesor_preparado    integer,
  profesor_general      integer,
  resumen          text,
  ideas_aplicables text,
  completado_en   timestamptz not null default now(),
  airtable_id     text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index evaluaciones_sesion_inscripcion_idx
  on public.evaluaciones_sesion (inscripcion_id);
create trigger evaluaciones_sesion_set_updated_at
  before update on public.evaluaciones_sesion
  for each row execute function public.set_updated_at();

-- ============================================================================
-- COMENTARIOS sobre el esquema
-- ============================================================================

comment on table public.personas is
  'Personas registradas. Unifica CRM + Portal de Airtable. auth_user_id ligado a auth.users de Supabase. El campo airtable_* es temporal (1 mes de gracia).';
comment on table public.cursos is
  'Catálogo de cursos. Las relaciones a módulos/lecciones se navegan vía modulo.curso_id y leccion.modulo_id.';
comment on view public.inscripciones_con_progreso is
  'Reemplaza el rollup PROGRESO_PCT de Airtable. Calcula sobre la marcha el % de lecciones completadas.';
comment on table public.posts is
  'Foro. Modelo unificado: un comentario es un post con post_padre_id no nulo. Eliminar un post hace cascade a sus hijos.';
