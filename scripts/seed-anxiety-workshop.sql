-- ============================================================================
-- SOPHIA Portal - Seed: Anxiety Workshop
-- ============================================================================
-- Crea el curso (draft / privado), sus 9 modulos (0 = "Antes de empezar", 1..8
-- las sesiones) y las lecciones del modulo 0 (acuerdo de participacion con
-- firma digital + documento de bienvenida).
--
-- Las lecciones de nota tecnica / actividades / evaluacion de cada sesion se
-- agregan despues (llegan en zips). Todo nace en borrador / draft: nada se hace
-- publico hasta que se cambie estatus/visibilidad a mano.
--
-- Idempotente: se puede correr varias veces sin duplicar.
-- ============================================================================

do $$
declare
  v_curso uuid;
  v_mod0  uuid;
begin
  -- ── Curso ────────────────────────────────────────────────────────────────
  insert into public.cursos (
    slug, titulo, descripcion_corta, descripcion_larga,
    instructor, color_primario, modalidad, tema,
    visibilidad, estatus, destacado, fecha_inicio, fecha_fin
  ) values (
    'anxiety-workshop',
    'Anxiety Workshop',
    'Programa psicoeducativo de 8 sesiones para comprender la ansiedad y transformar tu relación con ella.',
    'Taller híbrido de 8 sesiones semanales (jueves de 7:30 a 9:30 PM), con sesiones presenciales y en línea. Combina explicación del modelo, trabajo con el cuerpo y la mente, exposición y construcción de una vida con sentido.',
    'Daniela Leyva',
    '#c0112f',
    'híbrido',
    'light',
    'privado',
    'draft',
    false,
    '2026-07-23',
    '2026-09-10'
  )
  on conflict (slug) do update set updated_at = now()
  returning id into v_curso;

  if v_curso is null then
    select id into v_curso from public.cursos where slug = 'anxiety-workshop';
  end if;

  -- ── Modulos (0..8) ───────────────────────────────────────────────────────
  -- (titulo, descripcion, ponente, orden)
  insert into public.modulos (curso_id, titulo, descripcion, ponente, orden)
  select v_curso, m.titulo, m.descripcion, m.ponente, m.orden
  from (values
    ('Antes de empezar',
     'Documento de bienvenida y acuerdo de participación. Complétalo antes de la primera sesión.',
     null, 0),
    ('¿Qué me está pasando? Explicación del modelo',
     'Sesión presencial, jueves 23/Jul/2026, 7:30 a 9:30 PM.',
     'Daniela Leyva', 1),
    ('Expectativas e Incertidumbre',
     'Sesión en línea, jueves 30/Jul/2026, 7:30 a 9:30 PM.',
     'Daniel Contreras', 2),
    ('El Cuerpo como Ancla',
     'Sesión presencial, jueves 06/Aug/2026, 7:30 a 9:30 PM.',
     'Nancy Moreno', 3),
    ('Lo que pienso vs. lo que es. La mente como aliada',
     'Sesión en línea, jueves 13/Aug/2026, 7:30 a 9:30 PM.',
     'Santiago Viveros', 4),
    ('¿Cómo la exposición, el cambio, el mastery y hacer mejoras poco a poco puede ayudarme?',
     'Sesión presencial, jueves 20/Aug/2026, 7:30 a 9:30 PM.',
     'Daniela Leyva', 5),
    ('¿Aceptación o acción? Vita activa y vita contemplativa',
     'Sesión en línea, jueves 27/Aug/2026, 7:30 a 9:30 PM.',
     'Daniel Contreras', 6),
    ('Red de apoyo. Fuente de energía y soporte para maniobrar.',
     'Sesión presencial, jueves 03/Sep/2026, 7:30 a 9:30 PM.',
     'Nancy Moreno', 7),
    ('La vida que quiero vivir.',
     'Sesión en línea, jueves 10/Sep/2026, 7:30 a 9:30 PM.',
     'Santiago Viveros', 8)
  ) as m(titulo, descripcion, ponente, orden)
  where not exists (
    select 1 from public.modulos x
    where x.curso_id = v_curso and x.orden = m.orden
  );

  -- ── Lecciones del modulo 0 ───────────────────────────────────────────────
  select id into v_mod0 from public.modulos where curso_id = v_curso and orden = 0;

  -- L1: Acuerdo de participación (firma digital)
  insert into public.lecciones (modulo_id, titulo, tipo, etiqueta, orden, url_externa, subtitulo, estatus)
  select v_mod0, 'Acuerdo de participación', 'enlace', 'Acuerdo', 1,
         'anxiety-acuerdo-v1', 'Fírmalo para continuar.', 'borrador'
  where not exists (
    select 1 from public.lecciones l where l.modulo_id = v_mod0 and l.orden = 1
  );

  -- L2: Documento de bienvenida (PDF)
  insert into public.lecciones (modulo_id, titulo, tipo, orden, url_externa, subtitulo, estatus)
  select v_mod0, 'Documento de bienvenida', 'pdf', 2,
         '/assets/pdf/anxiety-workshop/documento-bienvenida.pdf',
         'Léelo con calma antes de la primera sesión.', 'borrador'
  where not exists (
    select 1 from public.lecciones l where l.modulo_id = v_mod0 and l.orden = 2
  );

  raise notice 'Anxiety Workshop seed OK. curso_id=%', v_curso;
end $$;
