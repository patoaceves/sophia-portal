-- ============================================================================
-- SOPHIA Portal · Esquema Postgres (SNAPSHOT DEL ESTADO VIVO)
-- ============================================================================
-- Generado desde la base de produccion (project ajvjyisplqsrjsessayo) el
-- 2026-06-01. Esta es la FUENTE DE VERDAD del modelo: refleja exactamente las
-- 14 tablas, 14 enums, constraints, indices, triggers y la vista que corren
-- hoy en produccion, tras la migracion completa Airtable -> Postgres.
--
-- Reemplaza al borrador previo (que aun listaba tests_autoconocimiento y un
-- enum persona_rol desactualizado). RLS y politicas viven en 002.
--
-- Idempotente donde es posible. Asume Postgres 15 (Supabase).
-- ============================================================================

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


-- ===== ENUMS =====
do $$ begin
  create type curso_estatus as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;
do $$ begin
  create type curso_visibilidad as enum ('privado', 'oculto', 'público');
exception when duplicate_object then null; end $$;
do $$ begin
  create type curso_modalidad as enum ('online', 'presencial', 'híbrido');
exception when duplicate_object then null; end $$;
do $$ begin
  create type curso_tema as enum ('light', 'dark');
exception when duplicate_object then null; end $$;
do $$ begin
  create type leccion_tipo as enum ('texto', 'video', 'pdf', 'audio', 'enlace', 'descarga', 'quiz', 'autoeval', 'tarea', 'sesion_live');
exception when duplicate_object then null; end $$;
do $$ begin
  create type leccion_estatus as enum ('borrador', 'publicada', 'oculta', 'archivada');
exception when duplicate_object then null; end $$;
do $$ begin
  create type inscripcion_estatus as enum ('activa', 'finalizada', 'cancelada', 'pendiente');
exception when duplicate_object then null; end $$;
do $$ begin
  create type cohorte_estatus as enum ('planeada', 'abierta', 'cerrada', 'completada');
exception when duplicate_object then null; end $$;
do $$ begin
  create type invitacion_estatus as enum ('activa', 'canjeada', 'expirada', 'revocada', 'pendiente');
exception when duplicate_object then null; end $$;
do $$ begin
  create type invitacion_origen as enum ('alta-ventas', 'bulk', 'cortesia', 'manual', 'stripe', 'transferencia');
exception when duplicate_object then null; end $$;
do $$ begin
  create type post_estatus as enum ('activo', 'oculto', 'eliminado');
exception when duplicate_object then null; end $$;
do $$ begin
  create type persona_rol as enum ('participante', 'admin', 'instructor', 'profesor', 'facilitador', 'coordinador');
exception when duplicate_object then null; end $$;
do $$ begin
  create type persona_estatus as enum ('activo', 'inactivo', 'baja');
exception when duplicate_object then null; end $$;
do $$ begin
  create type persona_origen as enum ('signup', 'manual', 'import', 'integración');
exception when duplicate_object then null; end $$;

-- ===== TABLAS =====
create table if not exists public.personas (
  id uuid not null default gen_random_uuid(),
  auth_user_id uuid,
  email text not null,
  nombre text not null default ''::text,
  apellidos text not null default ''::text,
  rol persona_rol not null default 'participante'::persona_rol,
  estatus persona_estatus not null default 'activo'::persona_estatus,
  origen persona_origen,
  productos text[] not null default '{}'::text[],
  telefono_pais text,
  telefono_numero text,
  avatar_url text,
  perfil_completado boolean not null default false,
  aviso_aceptado_en timestamptz,
  aviso_version text,
  aviso_ip_hash text,
  airtable_crm_id text,
  airtable_portal_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.cursos (
  id uuid not null default gen_random_uuid(),
  slug text not null,
  titulo text not null,
  descripcion_corta text not null default ''::text,
  descripcion_larga text not null default ''::text,
  cover_image text,
  instructor text not null default ''::text,
  color_primario text not null default '#000000'::text,
  modalidad curso_modalidad not null default 'online'::curso_modalidad,
  tema curso_tema not null default 'light'::curso_tema,
  visibilidad curso_visibilidad not null default 'privado'::curso_visibilidad,
  estatus curso_estatus not null default 'draft'::curso_estatus,
  destacado boolean not null default false,
  fecha_inicio date,
  fecha_fin date,
  airtable_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.modulos (
  id uuid not null default gen_random_uuid(),
  curso_id uuid not null,
  titulo text not null,
  descripcion text not null default ''::text,
  ponente text,
  orden integer not null default 0,
  airtable_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.lecciones (
  id uuid not null default gen_random_uuid(),
  modulo_id uuid not null,
  titulo text not null,
  tipo leccion_tipo not null default 'texto'::leccion_tipo,
  etiqueta text,
  orden integer not null default 0,
  contenido_html text,
  url_video text,
  url_externa text,
  archivo_url text,
  archivo_nombre text,
  airtable_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  estatus leccion_estatus not null default 'borrador'::leccion_estatus,
  subtitulo text,
  evaluacion_ref text
);
create table if not exists public.cohortes (
  id uuid not null default gen_random_uuid(),
  curso_id uuid not null,
  nombre text not null,
  estatus cohorte_estatus not null default 'planeada'::cohorte_estatus,
  fecha_inicio date,
  fecha_fin date,
  airtable_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  facilitador_nombre text,
  facilitador_email text,
  facilitador_telefono text,
  facilitador_avatar_url text,
  facilitador_mensaje text,
  banner_url text,
  hora_sesion text,
  modalidad curso_modalidad,
  capacidad integer,
  notas_internas text
);
create table if not exists public.invitaciones (
  id uuid not null default gen_random_uuid(),
  token text not null,
  cohorte_id uuid not null,
  email_destinatario text not null,
  origen invitacion_origen,
  estatus invitacion_estatus not null default 'activa'::invitacion_estatus,
  persona_id uuid,
  fecha_canje timestamptz,
  expira_el timestamptz,
  notas text,
  airtable_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.inscripciones (
  id uuid not null default gen_random_uuid(),
  persona_id uuid not null,
  curso_id uuid not null,
  cohorte_id uuid,
  estatus inscripcion_estatus not null default 'activa'::inscripcion_estatus,
  fecha_inscripcion date not null default CURRENT_DATE,
  airtable_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.progreso_lecciones (
  id uuid not null default gen_random_uuid(),
  inscripcion_id uuid not null,
  leccion_id uuid not null,
  completado boolean not null default false,
  completado_en timestamptz,
  video_pct numeric,
  airtable_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.posts (
  id uuid not null default gen_random_uuid(),
  curso_id uuid not null,
  autor_id uuid not null,
  post_padre_id uuid,
  contenido text not null default ''::text,
  adjunto_url text,
  adjunto_tipo text,
  adjunto_nombre text,
  estatus post_estatus not null default 'activo'::post_estatus,
  fecha timestamptz not null default now(),
  airtable_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.entregas_tarea (
  id uuid not null default gen_random_uuid(),
  inscripcion_id uuid not null,
  leccion_id uuid not null,
  comentario text not null default ''::text,
  archivos jsonb not null default '[]'::jsonb,
  fecha_entrega timestamptz not null default now(),
  airtable_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.respuestas_quiz (
  id uuid not null default gen_random_uuid(),
  inscripcion_id uuid not null,
  leccion_id uuid not null,
  respuestas jsonb not null default '{}'::jsonb,
  score numeric,
  completado_en timestamptz not null default now(),
  airtable_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.respuestas_autoeval (
  id uuid not null default gen_random_uuid(),
  inscripcion_id uuid not null,
  leccion_id uuid,
  respuestas jsonb not null default '{}'::jsonb,
  resultados jsonb,
  resumen text,
  ideas_aplicables text,
  contenido_relevante text,
  completado_en timestamptz not null default now(),
  airtable_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.tests_felicidad (
  id uuid not null default gen_random_uuid(),
  persona_id uuid not null,
  respuestas jsonb not null default '{}'::jsonb,
  resultados jsonb,
  completado_en timestamptz not null default now(),
  airtable_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.evaluaciones_sesion (
  id uuid not null default gen_random_uuid(),
  inscripcion_id uuid not null,
  leccion_id uuid,
  respuestas jsonb not null default '{}'::jsonb,
  fomento_participacion integer,
  profesor_preparado integer,
  profesor_general integer,
  resumen text,
  ideas_aplicables text,
  completado_en timestamptz not null default now(),
  airtable_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== CONSTRAINTS (PK, UNIQUE, CHECK, FK) =====
alter table public.personas drop constraint if exists personas_pkey;
alter table public.personas add constraint personas_pkey PRIMARY KEY (id);
alter table public.personas drop constraint if exists personas_airtable_crm_id_key;
alter table public.personas add constraint personas_airtable_crm_id_key UNIQUE (airtable_crm_id);
alter table public.personas drop constraint if exists personas_airtable_portal_id_key;
alter table public.personas add constraint personas_airtable_portal_id_key UNIQUE (airtable_portal_id);
alter table public.personas drop constraint if exists personas_auth_user_id_key;
alter table public.personas add constraint personas_auth_user_id_key UNIQUE (auth_user_id);
alter table public.personas drop constraint if exists personas_auth_user_id_fkey;
alter table public.personas add constraint personas_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.cursos drop constraint if exists cursos_pkey;
alter table public.cursos add constraint cursos_pkey PRIMARY KEY (id);
alter table public.cursos drop constraint if exists cursos_airtable_id_key;
alter table public.cursos add constraint cursos_airtable_id_key UNIQUE (airtable_id);
alter table public.cursos drop constraint if exists cursos_slug_key;
alter table public.cursos add constraint cursos_slug_key UNIQUE (slug);
alter table public.cursos drop constraint if exists cursos_color_primario_check;
alter table public.cursos add constraint cursos_color_primario_check CHECK ((color_primario ~ '^#[0-9A-Fa-f]{6}$'::text));
alter table public.cursos drop constraint if exists cursos_fechas_ok;
alter table public.cursos add constraint cursos_fechas_ok CHECK (((fecha_inicio IS NULL) OR (fecha_fin IS NULL) OR (fecha_inicio <= fecha_fin)));
alter table public.modulos drop constraint if exists modulos_pkey;
alter table public.modulos add constraint modulos_pkey PRIMARY KEY (id);
alter table public.modulos drop constraint if exists modulos_airtable_id_key;
alter table public.modulos add constraint modulos_airtable_id_key UNIQUE (airtable_id);
alter table public.modulos drop constraint if exists modulos_curso_id_fkey;
alter table public.modulos add constraint modulos_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE;
alter table public.lecciones drop constraint if exists lecciones_pkey;
alter table public.lecciones add constraint lecciones_pkey PRIMARY KEY (id);
alter table public.lecciones drop constraint if exists lecciones_airtable_id_key;
alter table public.lecciones add constraint lecciones_airtable_id_key UNIQUE (airtable_id);
alter table public.lecciones drop constraint if exists lecciones_modulo_id_fkey;
alter table public.lecciones add constraint lecciones_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES modulos(id) ON DELETE CASCADE;
alter table public.cohortes drop constraint if exists cohortes_pkey;
alter table public.cohortes add constraint cohortes_pkey PRIMARY KEY (id);
alter table public.cohortes drop constraint if exists cohortes_airtable_id_key;
alter table public.cohortes add constraint cohortes_airtable_id_key UNIQUE (airtable_id);
alter table public.cohortes drop constraint if exists cohortes_capacidad_check;
alter table public.cohortes add constraint cohortes_capacidad_check CHECK (((capacidad IS NULL) OR (capacidad > 0)));
alter table public.cohortes drop constraint if exists cohortes_curso_id_fkey;
alter table public.cohortes add constraint cohortes_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE RESTRICT;
alter table public.invitaciones drop constraint if exists invitaciones_pkey;
alter table public.invitaciones add constraint invitaciones_pkey PRIMARY KEY (id);
alter table public.invitaciones drop constraint if exists invitaciones_airtable_id_key;
alter table public.invitaciones add constraint invitaciones_airtable_id_key UNIQUE (airtable_id);
alter table public.invitaciones drop constraint if exists invitaciones_token_key;
alter table public.invitaciones add constraint invitaciones_token_key UNIQUE (token);
alter table public.invitaciones drop constraint if exists invitaciones_cohorte_id_fkey;
alter table public.invitaciones add constraint invitaciones_cohorte_id_fkey FOREIGN KEY (cohorte_id) REFERENCES cohortes(id) ON DELETE RESTRICT;
alter table public.invitaciones drop constraint if exists invitaciones_persona_id_fkey;
alter table public.invitaciones add constraint invitaciones_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE SET NULL;
alter table public.inscripciones drop constraint if exists inscripciones_pkey;
alter table public.inscripciones add constraint inscripciones_pkey PRIMARY KEY (id);
alter table public.inscripciones drop constraint if exists inscripciones_airtable_id_key;
alter table public.inscripciones add constraint inscripciones_airtable_id_key UNIQUE (airtable_id);
alter table public.inscripciones drop constraint if exists inscripciones_cohorte_id_fkey;
alter table public.inscripciones add constraint inscripciones_cohorte_id_fkey FOREIGN KEY (cohorte_id) REFERENCES cohortes(id) ON DELETE SET NULL;
alter table public.inscripciones drop constraint if exists inscripciones_curso_id_fkey;
alter table public.inscripciones add constraint inscripciones_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE RESTRICT;
alter table public.inscripciones drop constraint if exists inscripciones_persona_id_fkey;
alter table public.inscripciones add constraint inscripciones_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE RESTRICT;
alter table public.progreso_lecciones drop constraint if exists progreso_lecciones_pkey;
alter table public.progreso_lecciones add constraint progreso_lecciones_pkey PRIMARY KEY (id);
alter table public.progreso_lecciones drop constraint if exists progreso_lecciones_airtable_id_key;
alter table public.progreso_lecciones add constraint progreso_lecciones_airtable_id_key UNIQUE (airtable_id);
alter table public.progreso_lecciones drop constraint if exists progreso_lecciones_video_pct_check;
alter table public.progreso_lecciones add constraint progreso_lecciones_video_pct_check CHECK (((video_pct IS NULL) OR ((video_pct >= (0)::numeric) AND (video_pct <= (100)::numeric))));
alter table public.progreso_lecciones drop constraint if exists progreso_lecciones_inscripcion_id_fkey;
alter table public.progreso_lecciones add constraint progreso_lecciones_inscripcion_id_fkey FOREIGN KEY (inscripcion_id) REFERENCES inscripciones(id) ON DELETE CASCADE;
alter table public.progreso_lecciones drop constraint if exists progreso_lecciones_leccion_id_fkey;
alter table public.progreso_lecciones add constraint progreso_lecciones_leccion_id_fkey FOREIGN KEY (leccion_id) REFERENCES lecciones(id) ON DELETE CASCADE;
alter table public.posts drop constraint if exists posts_pkey;
alter table public.posts add constraint posts_pkey PRIMARY KEY (id);
alter table public.posts drop constraint if exists posts_airtable_id_key;
alter table public.posts add constraint posts_airtable_id_key UNIQUE (airtable_id);
alter table public.posts drop constraint if exists posts_autor_id_fkey;
alter table public.posts add constraint posts_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES personas(id) ON DELETE RESTRICT;
alter table public.posts drop constraint if exists posts_curso_id_fkey;
alter table public.posts add constraint posts_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE;
alter table public.posts drop constraint if exists posts_post_padre_id_fkey;
alter table public.posts add constraint posts_post_padre_id_fkey FOREIGN KEY (post_padre_id) REFERENCES posts(id) ON DELETE CASCADE;
alter table public.entregas_tarea drop constraint if exists entregas_tarea_pkey;
alter table public.entregas_tarea add constraint entregas_tarea_pkey PRIMARY KEY (id);
alter table public.entregas_tarea drop constraint if exists entregas_tarea_airtable_id_key;
alter table public.entregas_tarea add constraint entregas_tarea_airtable_id_key UNIQUE (airtable_id);
alter table public.entregas_tarea drop constraint if exists entregas_tarea_inscripcion_id_fkey;
alter table public.entregas_tarea add constraint entregas_tarea_inscripcion_id_fkey FOREIGN KEY (inscripcion_id) REFERENCES inscripciones(id) ON DELETE CASCADE;
alter table public.entregas_tarea drop constraint if exists entregas_tarea_leccion_id_fkey;
alter table public.entregas_tarea add constraint entregas_tarea_leccion_id_fkey FOREIGN KEY (leccion_id) REFERENCES lecciones(id) ON DELETE RESTRICT;
alter table public.respuestas_quiz drop constraint if exists respuestas_quiz_pkey;
alter table public.respuestas_quiz add constraint respuestas_quiz_pkey PRIMARY KEY (id);
alter table public.respuestas_quiz drop constraint if exists respuestas_quiz_airtable_id_key;
alter table public.respuestas_quiz add constraint respuestas_quiz_airtable_id_key UNIQUE (airtable_id);
alter table public.respuestas_quiz drop constraint if exists respuestas_quiz_inscripcion_id_fkey;
alter table public.respuestas_quiz add constraint respuestas_quiz_inscripcion_id_fkey FOREIGN KEY (inscripcion_id) REFERENCES inscripciones(id) ON DELETE CASCADE;
alter table public.respuestas_quiz drop constraint if exists respuestas_quiz_leccion_id_fkey;
alter table public.respuestas_quiz add constraint respuestas_quiz_leccion_id_fkey FOREIGN KEY (leccion_id) REFERENCES lecciones(id) ON DELETE RESTRICT;
alter table public.respuestas_autoeval drop constraint if exists respuestas_autoeval_pkey;
alter table public.respuestas_autoeval add constraint respuestas_autoeval_pkey PRIMARY KEY (id);
alter table public.respuestas_autoeval drop constraint if exists respuestas_autoeval_airtable_id_key;
alter table public.respuestas_autoeval add constraint respuestas_autoeval_airtable_id_key UNIQUE (airtable_id);
alter table public.respuestas_autoeval drop constraint if exists respuestas_autoeval_inscripcion_id_fkey;
alter table public.respuestas_autoeval add constraint respuestas_autoeval_inscripcion_id_fkey FOREIGN KEY (inscripcion_id) REFERENCES inscripciones(id) ON DELETE CASCADE;
alter table public.respuestas_autoeval drop constraint if exists respuestas_autoeval_leccion_id_fkey;
alter table public.respuestas_autoeval add constraint respuestas_autoeval_leccion_id_fkey FOREIGN KEY (leccion_id) REFERENCES lecciones(id) ON DELETE RESTRICT;
alter table public.tests_felicidad drop constraint if exists tests_felicidad_pkey;
alter table public.tests_felicidad add constraint tests_felicidad_pkey PRIMARY KEY (id);
alter table public.tests_felicidad drop constraint if exists tests_felicidad_airtable_id_key;
alter table public.tests_felicidad add constraint tests_felicidad_airtable_id_key UNIQUE (airtable_id);
alter table public.tests_felicidad drop constraint if exists tests_felicidad_persona_id_fkey;
alter table public.tests_felicidad add constraint tests_felicidad_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE;
alter table public.evaluaciones_sesion drop constraint if exists evaluaciones_sesion_pkey;
alter table public.evaluaciones_sesion add constraint evaluaciones_sesion_pkey PRIMARY KEY (id);
alter table public.evaluaciones_sesion drop constraint if exists evaluaciones_sesion_airtable_id_key;
alter table public.evaluaciones_sesion add constraint evaluaciones_sesion_airtable_id_key UNIQUE (airtable_id);
alter table public.evaluaciones_sesion drop constraint if exists evaluaciones_sesion_inscripcion_id_fkey;
alter table public.evaluaciones_sesion add constraint evaluaciones_sesion_inscripcion_id_fkey FOREIGN KEY (inscripcion_id) REFERENCES inscripciones(id) ON DELETE CASCADE;
alter table public.evaluaciones_sesion drop constraint if exists evaluaciones_sesion_leccion_id_fkey;
alter table public.evaluaciones_sesion add constraint evaluaciones_sesion_leccion_id_fkey FOREIGN KEY (leccion_id) REFERENCES lecciones(id) ON DELETE SET NULL;

-- ===== INDICES =====
CREATE INDEX IF NOT EXISTS cohortes_curso_idx ON public.cohortes USING btree (curso_id);
CREATE INDEX IF NOT EXISTS cursos_estatus_idx ON public.cursos USING btree (estatus);
CREATE UNIQUE INDEX IF NOT EXISTS entregas_tarea_inscripcion_leccion_unique ON public.entregas_tarea USING btree (inscripcion_id, leccion_id);
CREATE INDEX IF NOT EXISTS evaluaciones_sesion_inscripcion_idx ON public.evaluaciones_sesion USING btree (inscripcion_id);
CREATE INDEX IF NOT EXISTS inscripciones_cohorte_idx ON public.inscripciones USING btree (cohorte_id);
CREATE INDEX IF NOT EXISTS inscripciones_curso_idx ON public.inscripciones USING btree (curso_id);
CREATE UNIQUE INDEX IF NOT EXISTS inscripciones_persona_curso_unique ON public.inscripciones USING btree (persona_id, curso_id) WHERE (estatus = ANY (ARRAY['activa'::inscripcion_estatus, 'pendiente'::inscripcion_estatus]));
CREATE INDEX IF NOT EXISTS inscripciones_persona_idx ON public.inscripciones USING btree (persona_id);
CREATE INDEX IF NOT EXISTS invitaciones_email_idx ON public.invitaciones USING btree (lower(email_destinatario));
CREATE INDEX IF NOT EXISTS invitaciones_estatus_idx ON public.invitaciones USING btree (estatus);
CREATE INDEX IF NOT EXISTS invitaciones_token_idx ON public.invitaciones USING btree (token);
CREATE INDEX IF NOT EXISTS lecciones_modulo_orden_idx ON public.lecciones USING btree (modulo_id, orden);
CREATE INDEX IF NOT EXISTS lecciones_tipo_idx ON public.lecciones USING btree (tipo);
CREATE INDEX IF NOT EXISTS modulos_curso_orden_idx ON public.modulos USING btree (curso_id, orden);
CREATE INDEX IF NOT EXISTS personas_auth_user_id_idx ON public.personas USING btree (auth_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS personas_email_lower_idx ON public.personas USING btree (lower(email));
CREATE INDEX IF NOT EXISTS personas_rol_idx ON public.personas USING btree (rol);
CREATE INDEX IF NOT EXISTS posts_autor_idx ON public.posts USING btree (autor_id);
CREATE INDEX IF NOT EXISTS posts_curso_toplevel_fecha_idx ON public.posts USING btree (curso_id, fecha DESC) WHERE ((post_padre_id IS NULL) AND (estatus = 'activo'::post_estatus));
CREATE INDEX IF NOT EXISTS posts_padre_idx ON public.posts USING btree (post_padre_id) WHERE (post_padre_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS progreso_inscripcion_idx ON public.progreso_lecciones USING btree (inscripcion_id);
CREATE UNIQUE INDEX IF NOT EXISTS progreso_inscripcion_leccion_unique ON public.progreso_lecciones USING btree (inscripcion_id, leccion_id);
CREATE INDEX IF NOT EXISTS progreso_leccion_idx ON public.progreso_lecciones USING btree (leccion_id);
CREATE INDEX IF NOT EXISTS respuestas_autoeval_inscripcion_idx ON public.respuestas_autoeval USING btree (inscripcion_id);
CREATE INDEX IF NOT EXISTS respuestas_quiz_inscripcion_idx ON public.respuestas_quiz USING btree (inscripcion_id);
CREATE INDEX IF NOT EXISTS tests_felicidad_persona_idx ON public.tests_felicidad USING btree (persona_id);

-- ===== TRIGGERS updated_at =====
drop trigger if exists cohortes_set_updated_at on public.cohortes;
create trigger cohortes_set_updated_at before update on public.cohortes for each row execute function public.set_updated_at();
drop trigger if exists cursos_set_updated_at on public.cursos;
create trigger cursos_set_updated_at before update on public.cursos for each row execute function public.set_updated_at();
drop trigger if exists entregas_tarea_set_updated_at on public.entregas_tarea;
create trigger entregas_tarea_set_updated_at before update on public.entregas_tarea for each row execute function public.set_updated_at();
drop trigger if exists evaluaciones_sesion_set_updated_at on public.evaluaciones_sesion;
create trigger evaluaciones_sesion_set_updated_at before update on public.evaluaciones_sesion for each row execute function public.set_updated_at();
drop trigger if exists inscripciones_set_updated_at on public.inscripciones;
create trigger inscripciones_set_updated_at before update on public.inscripciones for each row execute function public.set_updated_at();
drop trigger if exists invitaciones_set_updated_at on public.invitaciones;
create trigger invitaciones_set_updated_at before update on public.invitaciones for each row execute function public.set_updated_at();
drop trigger if exists lecciones_set_updated_at on public.lecciones;
create trigger lecciones_set_updated_at before update on public.lecciones for each row execute function public.set_updated_at();
drop trigger if exists modulos_set_updated_at on public.modulos;
create trigger modulos_set_updated_at before update on public.modulos for each row execute function public.set_updated_at();
drop trigger if exists personas_set_updated_at on public.personas;
create trigger personas_set_updated_at before update on public.personas for each row execute function public.set_updated_at();
drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at before update on public.posts for each row execute function public.set_updated_at();
drop trigger if exists progreso_set_updated_at on public.progreso_lecciones;
create trigger progreso_set_updated_at before update on public.progreso_lecciones for each row execute function public.set_updated_at();
drop trigger if exists respuestas_autoeval_set_updated_at on public.respuestas_autoeval;
create trigger respuestas_autoeval_set_updated_at before update on public.respuestas_autoeval for each row execute function public.set_updated_at();
drop trigger if exists respuestas_quiz_set_updated_at on public.respuestas_quiz;
create trigger respuestas_quiz_set_updated_at before update on public.respuestas_quiz for each row execute function public.set_updated_at();
drop trigger if exists tests_felicidad_set_updated_at on public.tests_felicidad;
create trigger tests_felicidad_set_updated_at before update on public.tests_felicidad for each row execute function public.set_updated_at();

-- ===== VISTA =====
CREATE OR REPLACE VIEW public.inscripciones_con_progreso AS  SELECT i.id,
    i.persona_id,
    i.curso_id,
    i.cohorte_id,
    i.estatus,
    i.fecha_inscripcion,
    i.airtable_id,
    i.created_at,
    i.updated_at,
    COALESCE(round(100.0 * count(p.id) FILTER (WHERE p.completado)::numeric / NULLIF(count(l.id), 0)::numeric, 2), 0::numeric)::numeric(5,2) AS progreso_pct,
    count(l.id)::integer AS total_lecciones,
    count(p.id) FILTER (WHERE p.completado)::integer AS lecciones_completadas
   FROM inscripciones i
     LEFT JOIN modulos m ON m.curso_id = i.curso_id
     LEFT JOIN lecciones l ON l.modulo_id = m.id
     LEFT JOIN progreso_lecciones p ON p.inscripcion_id = i.id AND p.leccion_id = l.id
  GROUP BY i.id;
