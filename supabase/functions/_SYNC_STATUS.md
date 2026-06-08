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

- `submit-tarea` v7: guard de Content-Length + topes de archivos (v6) y ahora
  sube el File directo a Storage sin copia extra en memoria por arrayBuffer.
- `get-curso` v12: usa el RPC `get_curso_payload(p_slug, p_persona_id)` que
  regresa curso + inscripción + módulos + lecciones + progreso en UNA llamada
  (antes 4 queries). El mapeo a camelCase sigue en la función; shape idéntico.
- `get-mis-cursos` v12: usa el RPC `get_mis_cursos_payload(p_persona_id)` con
  LATERAL counts (total de lecciones por curso y completadas por inscripción
  calculados en SQL; antes 3 queries y conteo en JS). Shape idéntico.
- Los 2 RPCs viven en la migración `rpc_get_curso_y_mis_cursos_payload`:
  SECURITY DEFINER, execute revocado a public/anon/authenticated y otorgado
  solo a service_role.
- Sin `Cache-Control: max-age` en get-curso/get-leccion A PROPÓSITO: ambas
  respuestas incluyen progreso del usuario y el cache HTTP del browser no se
  puede invalidar desde JS. Al marcar una lección, api.js limpia su caché de
  sessionStorage y refetchea; si el browser sirviera la respuesta HTTP vieja,
  la palomita desaparecería. El caché de sessionStorage (TTL 5 min con
  invalidación correcta) ya cubre recargas y navegación.
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
