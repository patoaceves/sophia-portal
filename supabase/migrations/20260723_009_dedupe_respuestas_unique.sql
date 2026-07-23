-- 009: elimina duplicados por carrera (check-then-insert) y agrega los
-- indices unicos que faltaban para que no vuelva a pasar.
-- Aplicada en prod el 2026-07-23 via MCP (7 filas duplicadas eliminadas:
-- 2 en respuestas_quiz, 4 en respuestas_autoeval, 1 en evaluaciones_sesion;
-- todas con delta de 0 segundos entre si, firma de doble-submit).
-- Se conserva la fila mas reciente de cada grupo (completado_en desc).
--
-- Nota: las edge functions submit-quiz / submit-evaluacion ya hacen
-- update-si-existe, asi que el retake normal sigue funcionando igual.
-- El indice solo mata la carrera: si dos requests entran al mismo tiempo,
-- el segundo insert falla y el primero ya quedo guardado.

with ranked as (
  select id, row_number() over (
    partition by inscripcion_id, leccion_id
    order by completado_en desc, created_at desc, id desc) rn
  from respuestas_quiz)
delete from respuestas_quiz where id in (select id from ranked where rn > 1);

with ranked as (
  select id, row_number() over (
    partition by inscripcion_id, leccion_id
    order by completado_en desc, created_at desc, id desc) rn
  from respuestas_autoeval where leccion_id is not null)
delete from respuestas_autoeval where id in (select id from ranked where rn > 1);

with ranked as (
  select id, row_number() over (
    partition by inscripcion_id, leccion_id
    order by completado_en desc, created_at desc, id desc) rn
  from evaluaciones_sesion where leccion_id is not null)
delete from evaluaciones_sesion where id in (select id from ranked where rn > 1);

create unique index if not exists respuestas_quiz_inscripcion_leccion_unique
  on respuestas_quiz (inscripcion_id, leccion_id);

create unique index if not exists respuestas_autoeval_inscripcion_leccion_unique
  on respuestas_autoeval (inscripcion_id, leccion_id) where leccion_id is not null;

create unique index if not exists evaluaciones_sesion_inscripcion_leccion_unique
  on evaluaciones_sesion (inscripcion_id, leccion_id) where leccion_id is not null;
