# Estado de sincronización · Edge Functions (repo vs producción)

**Actualizado: 2026-06-01 — SINCRONIZACIÓN COMPLETA (27/27).**

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

- `submit-tarea` está en v6 (guard de Content-Length + topes de archivos).
- `get-entrega-tarea` es nueva (lee entregas_tarea; arregla el bug de tareas
  que desaparecían al recargar).
- `upload-asset` v8: valida `cursoId` como UUID (ya no `rec` de Airtable),
  guard de Content-Length (413 si > 55 MB) antes de parsear el body, y sube el
  File directo a Storage (sin copia extra en memoria por arrayBuffer).
- `get-foro-posts` v11: paginación real. `?limit` (default 50, máx 100) y
  cursor `?before=<ISO>` sobre los posts top-level; devuelve `hasMore` y
  `nextCursor`. Trae los comentarios solo de la página. El frontend (foro.js)
  usa un botón "Cargar más" para traer páginas más viejas.
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
