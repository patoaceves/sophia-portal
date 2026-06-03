# Estado de sincronización · Edge Functions (repo vs producción)

**Actualizado: 2026-06-03 — SINCRONIZACIÓN COMPLETA (27/27, perf v2+v3 deployada).**

Migraciones aplicadas en prod: `20260603_003_rpc_lectura.sql` (rpc_get_curso,
rpc_get_mis_cursos), `20260603_004_indices_foro_visibles.sql` (índices del
foro) y `20260603_005_rpc_leccion_y_cursor_foro.sql` (rpc_get_leccion +
índice del cursor compuesto). Funciones redeployadas vía MCP: `get-curso`
(plataforma v13), `get-mis-cursos` (v13), `get-leccion` (v19),
`submit-tarea` (v8), `get-foro-posts` (v12).

## Resumen

Las 27 Edge Functions del repo ya reflejan exactamente la versión Postgres que
corre en producción (project `ajvjyisplqsrjsessayo`). Cero referencias a
Airtable. Todas pasan syntax check.

Recordatorio: las funciones se despliegan a Supabase por Dashboard/MCP, no desde
este repo. Estas carpetas son la fuente de verdad de respaldo / referencia.

## Las 27 funciones (todas Postgres)

auth-bootstrap, claim-by-email, claim-invitation, cleanup-orphan-uploads,
create-foro-post, delete-entrega-archivo, delete-foro-post, delete-my-account,
export-my-data, get-curso, get-curso-roster, get-entrega-tarea, get-foro-posts,
get-leccion, get-mis-cursos, get-resultados-autoeval, get-resultados-quiz,
get-resultados-test, list-cursos-publico, marcar-leccion, proxy-inscripcion,
submit-autoeval, submit-evaluacion, submit-quiz, submit-tarea,
submit-test-felicidad, upload-asset.

## Notas

- `get-curso` v2: las 5 queries + armado del árbol se colapsaron en una
  llamada a `public.rpc_get_curso` (requiere migración
  `20260603_003_rpc_lectura.sql`). Responde con
  `Cache-Control: private, max-age=60` y `Vary: Origin, Authorization`.
- `get-mis-cursos` v2: conteos por SQL vía `public.rpc_get_mis_cursos`
  (misma migración); ya no trae filas de lecciones/progreso para contar en
  JS. Mismo cache header. OJO: el total de lecciones ahora EXCLUYE
  archivadas (consistente con get-curso); el progresoPct del listado puede
  variar ligeramente vs antes.
- `get-leccion` v3: las 5 queries (lección, módulo, inscripción, hermanas,
  progreso) se colapsaron en una llamada a `public.rpc_get_leccion`
  (migración 005). La sanitización XSS del HTML se queda en el edge (el RPC
  regresa `contenidoHtmlRaw`). Prev/next ahora ordenan por (orden, id) —
  estable con órdenes duplicados. Conserva el cache header de v2.
- `get-foro-posts` v12: cursor compuesto `fecha|id` con orden
  (fecha desc, id desc) — el cursor v11 (solo fecha) podía saltarse o
  duplicar posts del mismo instante. Compat con cursores viejos (solo
  fecha). El cursor se valida con regex antes de interpolarse en el `.or()`
  de PostgREST. v11 introdujo la paginación real con `?limit`/`?before`.
- `submit-tarea` está en v7: sube el File (Blob) directo a Storage, sin
  `f.arrayBuffer()` (antes cada archivo vivía dos veces en memoria). v6
  agregó el guard de Content-Length + topes de archivos.
- `get-entrega-tarea` es nueva (lee entregas_tarea; arregla el bug de tareas
  que desaparecían al recargar).
- `upload-asset` v8: valida `cursoId` como UUID (ya no `rec` de Airtable),
  guard de Content-Length (413 si > 55 MB) antes de parsear el body, y sube el
  File directo a Storage (sin copia extra en memoria por arrayBuffer).
- `proxy-inscripcion` v3: paridad completa con la automation de Airtable
  "Alta participantes desde ventas" (ya retirable). Crea persona (respetando
  el `rol` del embed) + invitación en Postgres y manda el webhook a GHL con
  el mismo payload del script viejo (link de invitación, fecha/hora de
  primera sesión y datos del facilitador desde `cohortes`). GHL no bloquea
  el alta; fallas van en `warnings`. URL de GHL hardcodeada con override
  opcional vía secret `GHL_WEBHOOK_URL`. Re-importar a alguien re-manda su
  link (reusa la invitación activa).
- Funciones con `verify_jwt: false` en prod (autenticación propia, no JWT):
  `cleanup-orphan-uploads` (CLEANUP_SECRET), `list-cursos-publico` y
  `proxy-inscripcion` (IMPORT_PUBLIC_TOKEN). Tenerlo en cuenta al redeployar.

## Funciones eliminadas en prod (carpetas borradas del repo)

- `submit-test-autoconocimiento` y `get-resultados-autoconocimiento`.
  El test de autoconocimiento se unificó en el sistema genérico de
  autoevaluaciones (`submit-autoeval` / `get-resultados-autoeval`), datos en
  `respuestas_autoeval`.

## Nota sobre `_shared`

La carpeta `_shared/` fue **eliminada**: las funciones desplegadas son
self-contained (helpers inlined) y ninguna importaba de ahí. Quedaba muerta del
diseño anterior.
