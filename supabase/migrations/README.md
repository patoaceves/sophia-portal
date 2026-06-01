# SOPHIA Portal · PR 1: Esquema Postgres + Migración de datos

Este PR contiene **solo el esquema y la migración de datos**, no toca ninguna
Edge Function todavía. Es seguro de aplicar porque Postgres y Airtable
coexistirán durante el periodo de gracia (1 mes).

## Qué hace cada archivo

- **`20260601_001_initial_schema.sql`** — tablas, enums, índices, FKs,
  triggers de `updated_at`, y la vista `inscripciones_con_progreso`.
- **`20260601_002_rls_policies.sql`** — habilita RLS y crea políticas de
  SELECT para el patrón híbrido. SIN políticas de INSERT/UPDATE/DELETE: las
  escrituras pasan por Edge Functions con `service_role`.
- **`../../scripts/migrate-from-airtable.ts`** — script Deno idempotente
  que lee Airtable y escribe en Postgres. Soporta `--dry-run`.

## Orden de aplicación

### 1. Aplicar migrations

Desde el SQL Editor de Supabase, copia y pega cada `.sql` en orden:
primero `001`, luego `002`. (El `002` referencia las tablas del `001`.)

O con CLI si lo tienes vinculado al proyecto: `supabase db push`.

### 2. Dry run del script

```bash
AIRTABLE_API_KEY=patXXX...  \
SUPABASE_URL=https://ajvjyisplqsrjsessayo.supabase.co  \
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>  \
deno run --allow-net --allow-env scripts/migrate-from-airtable.ts --dry-run
```

Reporta qué haría sin escribir nada. Úsalo para validar que lee bien.

### 3. Migración real

Mismo comando sin `--dry-run`. Tiempo estimado: <30s con los volúmenes
actuales.

### 4. Verificación

En el SQL Editor:

```sql
select 'personas' as t, count(*) from personas
union all select 'cursos', count(*) from cursos
union all select 'modulos', count(*) from modulos
union all select 'lecciones', count(*) from lecciones
union all select 'inscripciones', count(*) from inscripciones
union all select 'progreso_lecciones', count(*) from progreso_lecciones
union all select 'posts', count(*) from posts
order by t;
```

Compara con Airtable. Diferencias esperadas:
- **personas:** ≤ `CRM + Portal` (se colapsan por email).
- **posts:** = total con estatus distinto de "eliminado huérfano".

## Decisiones clave

**`airtable_id` en cada tabla:** trazabilidad temporal + idempotencia del
script. Se borrará en un PR final cuando confiemos.

**Vista `inscripciones_con_progreso`:** reemplaza el rollup `Progreso %` de
Airtable. Se calcula bajo demanda en vez de mantenerse manualmente.

**RLS solo para SELECT:** decisión consciente del patrón híbrido. SELECTs
simples vía RLS, todo lo demás vía Edge Functions con service_role.

**Enums Postgres:** los `singleSelect` de Airtable se convierten en tipos
enum reales. Schema auto-documentado y validación automática.

## Rollback

Si algo se ve mal:

```sql
-- Vaciar tablas sin tirar el schema
truncate table
  evaluaciones_sesion, tests_autoconocimiento, tests_felicidad,
  respuestas_autoeval, respuestas_quiz, entregas_tarea,
  posts, progreso_lecciones, inscripciones, invitaciones,
  cohortes, lecciones, modulos, cursos, personas
restart identity cascade;
```

## Lo que NO está en este PR

- Reescribir Edge Functions para usar Postgres (PR 2-5)
- Frontend pidiendo datos vía RLS (PR 4-5)
- Eliminar código de Airtable (PR final)
- Borrar los campos `airtable_id` (migration final, ~1 mes después)
