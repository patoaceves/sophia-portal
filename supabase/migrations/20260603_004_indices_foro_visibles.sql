-- ════════════════════════════════════════════════════════════════════
-- SOPHIA Portal · 20260603_004_indices_foro_visibles.sql
-- Índices parciales que matchean EXACTAMENTE las queries de get-foro-posts,
-- que filtran estatus in ('activo','eliminado') (los eliminados se muestran
-- como tombstone). El índice viejo posts_curso_toplevel_fecha_idx solo
-- cubría estatus='activo', por lo que el planner no podía usarlo.
--
-- APLICADA EN PROD: 2026-06-03 (vía MCP). Verificado con EXPLAIN que el
-- planner usa posts_curso_toplevel_fecha_visible_idx (Index Scan ordenado,
-- sin nodo Sort) cuando enable_seqscan está off; con la tabla chica actual
-- el planner prefiere seq scan, lo cual es correcto y cambia solo al crecer.
-- ════════════════════════════════════════════════════════════════════

-- Top-level page: curso_id + fecha desc, post_padre_id is null
create index if not exists posts_curso_toplevel_fecha_visible_idx
on public.posts (curso_id, fecha desc)
where post_padre_id is null
  and estatus in ('activo', 'eliminado');

-- Comentarios de la página: curso_id + post_padre_id in (...)
create index if not exists posts_curso_padre_idx
on public.posts (curso_id, post_padre_id)
where post_padre_id is not null
  and estatus in ('activo', 'eliminado');

-- El índice viejo queda redundante (subset del nuevo) pero no estorba;
-- se puede retirar después de validar planes en prod:
--   drop index if exists posts_curso_toplevel_fecha_idx;
