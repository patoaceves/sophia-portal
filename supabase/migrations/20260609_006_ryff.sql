-- ============================================================================
-- SOPHIA Portal · Escala RYFF de Bienestar Psicologico
-- ============================================================================
-- Autoevaluacion a nivel PERSONA (no por curso): mide las 6 dimensiones del
-- bienestar psicologico de Ryff a partir de la version corta de 18 reactivos
-- (3 por dimension), escala Likert 1-6. Igual que tests_felicidad, el
-- resultado es de la persona y se muestra en el Resumen de todos sus cursos.
--
-- El backend (submit-ryff) valida, invierte los reactivos negativos, suma por
-- dimension y calcula bandas. Solo guarda numeros + etiquetas de banda; todo
-- el texto (reactivos, leads, pasos) vive en el frontend (ryff-defs.js).
-- ============================================================================

create table if not exists public.respuestas_ryff (
  id uuid not null default gen_random_uuid(),
  persona_id uuid not null,
  respuestas jsonb not null default '{}'::jsonb,
  resultados jsonb,
  completado_en timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== CONSTRAINTS =====
alter table public.respuestas_ryff drop constraint if exists respuestas_ryff_pkey;
alter table public.respuestas_ryff add constraint respuestas_ryff_pkey PRIMARY KEY (id);

alter table public.respuestas_ryff drop constraint if exists respuestas_ryff_persona_id_fkey;
alter table public.respuestas_ryff add constraint respuestas_ryff_persona_id_fkey
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE;

-- ===== INDICES =====
create index if not exists respuestas_ryff_persona_idx
  on public.respuestas_ryff using btree (persona_id);
create index if not exists respuestas_ryff_persona_fecha_idx
  on public.respuestas_ryff using btree (persona_id, completado_en desc);

-- ===== TRIGGER updated_at =====
drop trigger if exists respuestas_ryff_set_updated_at on public.respuestas_ryff;
create trigger respuestas_ryff_set_updated_at
  before update on public.respuestas_ryff
  for each row execute function public.set_updated_at();

-- ===== RLS =====
alter table public.respuestas_ryff enable row level security;

drop policy if exists respuestas_ryff_self_select on public.respuestas_ryff;
create policy respuestas_ryff_self_select on public.respuestas_ryff
  for select to authenticated
  using ((persona_id = persona_id_of_auth_user()));
