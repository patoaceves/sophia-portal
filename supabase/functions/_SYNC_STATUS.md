# Estado de sincronización · Edge Functions (repo vs producción)

**Actualizado: 2026-06-01 — sincronización EN CURSO (11/27).**

## Contexto importante

Las Edge Functions **se despliegan a Supabase por Dashboard/MCP, no desde este
repo**. Lo que corre en producción vive en Supabase; estas carpetas son
**respaldo / referencia**.

Producción corre **27 funciones, todas 100% Postgres** (verificado). Este repo
se está poniendo al día copiando esas versiones. Vamos 11 de 27.

## Sincronizadas (versión Postgres real, = producción)

- `auth-bootstrap`
- `claim-by-email`
- `claim-invitation`
- `cleanup-orphan-uploads`
- `create-foro-post`
- `delete-entrega-archivo`
- `delete-foro-post`
- `get-entrega-tarea`   *(nueva: lee entregas_tarea)*
- `get-resultados-quiz`
- `submit-tarea`        *(v6: guard de Content-Length + topes de archivos)*
- `upload-asset`

## Pendientes (todavía con el código viejo de Airtable en el repo)

La versión que corre en prod (Postgres) es distinta y vive solo en Supabase.
No es riesgo operativo (no se despliega desde aquí), pero estas copias **no son
la verdad actual** hasta sincronizarlas:

- `delete-my-account`
- `export-my-data`
- `get-curso`
- `get-curso-roster`
- `get-foro-posts`
- `get-leccion`
- `get-mis-cursos`
- `get-resultados-autoeval`
- `get-resultados-test`
- `list-cursos-publico`
- `marcar-leccion`
- `proxy-inscripcion`
- `submit-autoeval`
- `submit-evaluacion`
- `submit-quiz`
- `submit-test-felicidad`

## Cómo obtener la fuente exacta de prod (mientras se completa)

1. Dashboard de Supabase → Edge Functions → cada función → ver código.
2. MCP: `get_edge_function` por slug.

## Funciones eliminadas en prod (carpetas borradas del repo)

- `submit-test-autoconocimiento` y `get-resultados-autoconocimiento`.
  El test de autoconocimiento se unificó en el sistema genérico de
  autoevaluaciones (`submit-autoeval` / `get-resultados-autoeval`), datos en
  `respuestas_autoeval`.

## Nota sobre `_shared`

Las funciones desplegadas son self-contained (helpers inlined). `_shared/`
quedó del diseño anterior; las versiones de prod no importan de ahí. Se puede
retirar al completar el sync.
