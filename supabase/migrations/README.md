# SOPHIA Portal · Esquema Postgres (migraciones)

**Actualizado: 2026-06-01 — migración Airtable → Postgres COMPLETADA.**

Estos archivos son un **snapshot autoritativo del esquema que corre hoy en
producción** (project `ajvjyisplqsrjsessayo`), generado directamente desde la
base viva. Reemplazan al borrador inicial que tenían (que aún listaba la tabla
`tests_autoconocimiento`, ya eliminada, y un enum `persona_rol` desactualizado
con `'alumno'`).

## Archivos

- **`20260601_001_initial_schema.sql`** — extensiones, `set_updated_at()`,
  los 14 enums, las 14 tablas, constraints (PK/UNIQUE/CHECK/FK), 26 índices,
  14 triggers de `updated_at`, y la vista `inscripciones_con_progreso`.
  Idempotente donde es posible (`if not exists`, `do $$ ... duplicate_object`).
- **`20260601_002_rls_policies.sql`** — el helper `persona_id_of_auth_user()`,
  habilita RLS en las 14 tablas, y crea las 13 políticas de SELECT del patrón
  híbrido. SIN políticas de INSERT/UPDATE/DELETE: las escrituras pasan por Edge
  Functions con `service_role` (que hace bypass de RLS).

## Estado del modelo (vivo, 2026-06-01)

- 14 tablas, 14 enums, 26 índices, 14 triggers, 1 vista.
- `PERSONAS_CRM` + `PERSONAS_PORTAL` colapsadas en `personas` (merge por email).
- Autoconocimiento unificado en `respuestas_autoeval` (la tabla
  `tests_autoconocimiento` fue eliminada).
- Columna de puntajes unificada a `resultados` (era `puntajes`).
- Cada tabla conserva `airtable_id` (trazabilidad del periodo de gracia).

## Aplicación

Desde el SQL Editor de Supabase, pega `001` y luego `002`. Como son snapshots
idempotentes del estado actual, aplicarlos sobre la base ya migrada no debería
cambiar nada; sirven para **reconstruir desde cero** si hiciera falta.

## Periodo de gracia / retiro de Airtable

Airtable se mantiene read-only ~1 mes como respaldo y luego se congela. Cuando
se cumpla, una migración final puede retirar las columnas `airtable_id`:

```sql
-- Ejemplo (correr SOLO al cortar Airtable):
alter table public.personas      drop column if exists airtable_crm_id,    drop column if exists airtable_portal_id;
alter table public.cursos         drop column if exists airtable_id;
alter table public.modulos        drop column if exists airtable_id;
alter table public.lecciones      drop column if exists airtable_id;
alter table public.cohortes       drop column if exists airtable_id;
alter table public.invitaciones   drop column if exists airtable_id;
alter table public.inscripciones  drop column if exists airtable_id;
alter table public.progreso_lecciones drop column if exists airtable_id;
alter table public.posts          drop column if exists airtable_id;
alter table public.entregas_tarea drop column if exists airtable_id;
alter table public.respuestas_quiz     drop column if exists airtable_id;
alter table public.respuestas_autoeval drop column if exists airtable_id;
alter table public.tests_felicidad     drop column if exists airtable_id;
alter table public.evaluaciones_sesion drop column if exists airtable_id;
```

## Rollback (vaciar datos sin tirar el esquema)

```sql
truncate table
  evaluaciones_sesion, tests_felicidad,
  respuestas_autoeval, respuestas_quiz, entregas_tarea,
  posts, progreso_lecciones, inscripciones, invitaciones,
  cohortes, lecciones, modulos, cursos, personas
restart identity cascade;
```

## Edge Functions

El estado de sincronización de las funciones (repo vs prod) está documentado en
`../functions/_SYNC_STATUS.md`.
