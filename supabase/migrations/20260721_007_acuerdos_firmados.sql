-- ============================================================================
-- SOPHIA Portal - 007 - acuerdos_firmados (firma digital de acuerdos)
-- ============================================================================
-- Registro de consentimiento y firma electronica simple de un acuerdo de
-- participacion (por ejemplo el del Anxiety Workshop).
--
-- Modelo hibrido, igual que el resto del portal:
--   * Escrituras: solo via edge function firmar-acuerdo (service_role, bypass RLS).
--   * Lectura propia del participante: via politica SELECT de RLS.
--
-- El registro guarda quien firmo, cuando, que version del documento, las
-- casillas confirmadas y datos de contexto (ip, user_agent, hash del PDF) para
-- darle valor probatorio a la firma.
-- ============================================================================

create table if not exists public.acuerdos_firmados (
  id uuid not null default gen_random_uuid(),
  inscripcion_id uuid not null,
  curso_id uuid,
  leccion_id uuid,
  documento_clave text not null,
  nombre_firma text not null,
  casillas jsonb not null default '{}'::jsonb,
  pdf_sha256 text,
  ip inet,
  user_agent text,
  firmado_en timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== CONSTRAINTS =====
alter table public.acuerdos_firmados drop constraint if exists acuerdos_firmados_pkey;
alter table public.acuerdos_firmados add constraint acuerdos_firmados_pkey primary key (id);

-- Un participante firma una sola vez cada version del documento.
alter table public.acuerdos_firmados drop constraint if exists acuerdos_firmados_unico;
alter table public.acuerdos_firmados add constraint acuerdos_firmados_unico unique (inscripcion_id, documento_clave);

alter table public.acuerdos_firmados drop constraint if exists acuerdos_firmados_inscripcion_fkey;
alter table public.acuerdos_firmados add constraint acuerdos_firmados_inscripcion_fkey
  foreign key (inscripcion_id) references public.inscripciones(id) on delete cascade;

alter table public.acuerdos_firmados drop constraint if exists acuerdos_firmados_curso_fkey;
alter table public.acuerdos_firmados add constraint acuerdos_firmados_curso_fkey
  foreign key (curso_id) references public.cursos(id) on delete set null;

alter table public.acuerdos_firmados drop constraint if exists acuerdos_firmados_leccion_fkey;
alter table public.acuerdos_firmados add constraint acuerdos_firmados_leccion_fkey
  foreign key (leccion_id) references public.lecciones(id) on delete set null;

create index if not exists idx_acuerdos_firmados_inscripcion on public.acuerdos_firmados(inscripcion_id);
create index if not exists idx_acuerdos_firmados_curso on public.acuerdos_firmados(curso_id);

-- ===== RLS =====
alter table public.acuerdos_firmados enable row level security;

-- Lectura propia: el participante ve solo sus firmas (via su inscripcion).
drop policy if exists acuerdos_firmados_self_select on public.acuerdos_firmados;
create policy acuerdos_firmados_self_select on public.acuerdos_firmados
  for select to authenticated
  using (exists (
    select 1 from public.inscripciones i
    where i.id = acuerdos_firmados.inscripcion_id
      and i.persona_id = public.persona_id_of_auth_user()
  ));

-- ===== GRANTS =====
-- Sin escrituras para anon/authenticated (todo pasa por la edge function).
revoke all on public.acuerdos_firmados from public;
revoke all on public.acuerdos_firmados from anon;
grant select on public.acuerdos_firmados to authenticated;
grant all on public.acuerdos_firmados to service_role;
