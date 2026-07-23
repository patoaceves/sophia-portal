-- ============================================================================
-- SOPHIA Portal - 008 - mediciones (instrumentos GAD-7 y WHO-5)
-- ============================================================================
-- Respuestas de los instrumentos de medicion que el participante contesta
-- dentro del curso (linea base al inicio y medicion de cierre al final).
--
-- Mismo modelo hibrido que el resto del portal:
--   * Escrituras: solo via edge function submit-medicion (service_role).
--   * Lectura propia del participante: via politica SELECT de RLS.
--
-- El puntaje NO se confia al cliente: la edge function recalcula a partir de
-- las respuestas crudas y guarda el resultado en `resultados`.
-- ============================================================================

create table if not exists public.mediciones (
  id uuid not null default gen_random_uuid(),
  inscripcion_id uuid not null,
  curso_id uuid,
  leccion_id uuid,
  instrumento_clave text not null,
  momento text not null default 'inicial',
  respuestas jsonb not null default '{}'::jsonb,
  resultados jsonb not null default '{}'::jsonb,
  completado_en timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== CONSTRAINTS =====
alter table public.mediciones drop constraint if exists mediciones_pkey;
alter table public.mediciones add constraint mediciones_pkey primary key (id);

alter table public.mediciones drop constraint if exists mediciones_momento_check;
alter table public.mediciones add constraint mediciones_momento_check
  check (momento in ('inicial', 'final'));

-- Una medicion por participante, instrumento y momento.
alter table public.mediciones drop constraint if exists mediciones_unico;
alter table public.mediciones add constraint mediciones_unico
  unique (inscripcion_id, instrumento_clave, momento);

alter table public.mediciones drop constraint if exists mediciones_inscripcion_fkey;
alter table public.mediciones add constraint mediciones_inscripcion_fkey
  foreign key (inscripcion_id) references public.inscripciones(id) on delete cascade;

alter table public.mediciones drop constraint if exists mediciones_curso_fkey;
alter table public.mediciones add constraint mediciones_curso_fkey
  foreign key (curso_id) references public.cursos(id) on delete set null;

alter table public.mediciones drop constraint if exists mediciones_leccion_fkey;
alter table public.mediciones add constraint mediciones_leccion_fkey
  foreign key (leccion_id) references public.lecciones(id) on delete set null;

create index if not exists idx_mediciones_inscripcion on public.mediciones(inscripcion_id);
create index if not exists idx_mediciones_curso on public.mediciones(curso_id);

-- ===== RLS =====
alter table public.mediciones enable row level security;

drop policy if exists mediciones_self_select on public.mediciones;
create policy mediciones_self_select on public.mediciones
  for select to authenticated
  using (exists (
    select 1 from public.inscripciones i
    where i.id = mediciones.inscripcion_id
      and i.persona_id = public.persona_id_of_auth_user()
  ));

-- ===== GRANTS =====
revoke all on public.mediciones from public;
revoke all on public.mediciones from anon;
grant select on public.mediciones to authenticated;
grant all on public.mediciones to service_role;
