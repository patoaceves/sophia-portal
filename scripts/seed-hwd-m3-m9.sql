-- ============================================================================
-- SOPHIA Portal · SEED de contenido — Happiness Workshop Digital (M3–M9)
-- ============================================================================
-- ESTO NO ES UNA MIGRACIÓN DE ESQUEMA. Es un registro de trazabilidad del
-- contenido (módulos + lecciones de video) que se insertó en producción
-- (project ajvjyisplqsrjsessayo) para el curso happiness-workshop-digital.
--
-- curso_id: a17c34f0-1c2a-48a8-8f64-5ff48c1a8b5f
-- Aplicado en prod: 2026-07-08
--
-- Notas:
--   * Los archivos de video viven en Storage (bucket sophia-videos), no en git.
--   * Lecciones creadas en estatus 'borrador' (igual que M1/M2).
--   * Títulos de lección PROVISIONALES (patrón "N.X <Tema>"): pendientes de
--     reemplazar por los títulos reales de cada lección.
--   * No incluye los extras por módulo (nota técnica PDF, quiz, autoeval) que
--     sí traen M1/M2; se agregarán cuando exista ese contenido.
--   * Idempotente: puede correrse varias veces sin duplicar.
-- ============================================================================
begin;

-- 1) Módulos 3–9
insert into modulos (curso_id, titulo, orden, descripcion)
select 'a17c34f0-1c2a-48a8-8f64-5ff48c1a8b5f'::uuid, x.titulo, x.orden, ''
from (values
  ('3: Bienestar Físico', 3),
  ('4: Presencia Consciente', 4),
  ('5: Bienestar Emocional', 5),
  ('6: Trabajo con Propósito', 6),
  ('7: Estética Existencial', 7),
  ('8: Vínculos Vitales', 8),
  ('9: Fe y Filosofía de Vida', 9)
) as x(titulo, orden)
where not exists (
  select 1 from modulos m
  where m.curso_id='a17c34f0-1c2a-48a8-8f64-5ff48c1a8b5f' and m.orden=x.orden
);

-- 2) Lecciones de video
insert into lecciones (modulo_id, titulo, tipo, orden, url_video, subtitulo, estatus)
select m.id, v.titulo, 'video'::leccion_tipo, v.orden, v.url_video, 'Lección', 'borrador'::leccion_estatus
from modulos m
join (values
  -- M3 Bienestar Físico
  (3,'3.1 Bienestar Físico',10,'happiness-workshop-digital/m3/hwd_m3_l3-1_bienestar-fisico.mp4'),
  (3,'3.2 Bienestar Físico',20,'happiness-workshop-digital/m3/hwd_m3_l3-2_bienestar-fisico.mp4'),
  (3,'3.3 Bienestar Físico',30,'happiness-workshop-digital/m3/hwd_m3_l3-3_bienestar-fisico.mp4'),
  (3,'3.4 Bienestar Físico',40,'happiness-workshop-digital/m3/hwd_m3_l3-4_bienestar-fisico.mp4'),
  -- M4 Presencia Consciente
  (4,'4.1 Presencia Consciente',10,'happiness-workshop-digital/m4/hwd_m4_l4-1_presencia-consciente.mp4'),
  (4,'4.2 Presencia Consciente',20,'happiness-workshop-digital/m4/hwd_m4_l4-2_presencia-consciente.mp4'),
  (4,'4.3 Presencia Consciente',30,'happiness-workshop-digital/m4/hwd_m4_l4-3_presencia-consciente.mp4'),
  (4,'4.4 Presencia Consciente',40,'happiness-workshop-digital/m4/hwd_m4_l4-4_presencia-consciente.mp4'),
  -- M5 Bienestar Emocional
  (5,'5.1 Bienestar Emocional',10,'happiness-workshop-digital/m5/hwd_m5_l5-1_bienestar-emocional.mp4'),
  (5,'5.2 Bienestar Emocional',20,'happiness-workshop-digital/m5/hwd_m5_l5-2_bienestar-emocional.mp4'),
  (5,'5.3 Bienestar Emocional',30,'happiness-workshop-digital/m5/hwd_m5_l5-3_bienestar-emocional.mp4'),
  -- M6 Trabajo con Propósito
  (6,'6.1 Trabajo con Propósito',10,'happiness-workshop-digital/m6/hwd_m6_l6-1_trabajo-con-proposito.mp4'),
  (6,'6.2 Trabajo con Propósito',20,'happiness-workshop-digital/m6/hwd_m6_l6-2_trabajo-con-proposito.mp4'),
  (6,'6.3 Trabajo con Propósito',30,'happiness-workshop-digital/m6/hwd_m6_l6-3_trabajo-con-proposito.mp4'),
  (6,'6.4 Trabajo con Propósito',40,'happiness-workshop-digital/m6/hwd_m6_l6-4_trabajo-con-proposito.mp4'),
  -- M7 Estética Existencial
  (7,'7.1 Estética Existencial',10,'happiness-workshop-digital/m7/hwd_m7_l7-1_estetica-existencial.mp4'),
  (7,'7.2 Estética Existencial',20,'happiness-workshop-digital/m7/hwd_m7_l7-2_estetica-existencial.mp4'),
  (7,'7.3 Estética Existencial',30,'happiness-workshop-digital/m7/hwd_m7_l7-3_estetica-existencial.mp4'),
  (7,'7.4 Estética Existencial',40,'happiness-workshop-digital/m7/hwd_m7_l7-4_estetica-existencial.mp4'),
  -- M8 Vínculos Vitales
  (8,'8.1 Vínculos Vitales',10,'happiness-workshop-digital/m8/hwd_m8_l8-1_vinculos-vitales.mp4'),
  (8,'8.2 Vínculos Vitales',20,'happiness-workshop-digital/m8/hwd_m8_l8-2_vinculos-vitales.mp4'),
  (8,'8.3 Vínculos Vitales',30,'happiness-workshop-digital/m8/hwd_m8_l8-3_vinculos-vitales.mp4'),
  (8,'8.4 Vínculos Vitales',40,'happiness-workshop-digital/m8/hwd_m8_l8-4_vinculos-vitales.mp4'),
  -- M9 Fe y Filosofía de Vida
  (9,'9.1 Fe y Filosofía de Vida',10,'happiness-workshop-digital/m9/hwd_m9_l9-1_fe-filosofia-vida.mp4'),
  (9,'9.2 Fe y Filosofía de Vida',20,'happiness-workshop-digital/m9/hwd_m9_l9-2_fe-filosofia-vida.mp4'),
  (9,'9.3 Fe y Filosofía de Vida',30,'happiness-workshop-digital/m9/hwd_m9_l9-3_fe-filosofia-vida.mp4'),
  (9,'9.4 Fe y Filosofía de Vida',40,'happiness-workshop-digital/m9/hwd_m9_l9-4_fe-filosofia-vida.mp4')
) as v(mod, titulo, orden, url_video) on v.mod = m.orden
where m.curso_id='a17c34f0-1c2a-48a8-8f64-5ff48c1a8b5f'
  and m.orden between 3 and 9
  and not exists (
    select 1 from lecciones l where l.modulo_id=m.id and l.url_video=v.url_video
  );

commit;
