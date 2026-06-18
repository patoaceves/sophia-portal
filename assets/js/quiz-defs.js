// SOPHIA Portal · Definiciones de quizzes (actividades en clase)
//
// Cada quiz es una actividad reflexiva tipo wizard. Las respuestas se guardan
// en Postgres (tabla respuestas_quiz) vía submit-quiz.
//
// La lección tipo `quiz` referencia un quiz por su clave (en Url_Externa).
// Para agregar una actividad nueva: añade una entrada a QUIZZES y crea la
// lección con tipo=quiz, Url_Externa = la clave.
//
// Tipos de pregunta soportados:
//   - "choice" : opción única de una lista (opciones: string[])
//               · Si la pregunta tiene `correcta: <índice>`, el quiz se
//                 evalúa con score: al final muestra cuántas se acertaron,
//                 cuáles fueron correctas/incorrectas, y permite reintentar.
//   - "texto"  : texto libre (textarea)
//
// Si NINGUNA pregunta tiene `correcta`, el quiz es reflexivo (sin score) y
// se comporta como antes (Gnóthi Seautón, Reflexión, Journaling).

export const QUIZZES = {
  // ───────────────────────────────────────────────────────────────────
  // Gnóthi Seautón · Actividad en clase del Cap 2 (Autoconocimiento)
  // ───────────────────────────────────────────────────────────────────
  "gnothi-seauton": {
    titulo: "Gnóthi Seautón",
    introEyebrow: "Actividad",
    introTitle: "Gnóthi Seautón · Conócete a ti mismo",
    introLead: [
      "Sócrates pensaba que la clave para vivir una buena vida radica en el " +
        "autoconocimiento: γνῶθι σεαυτόν (gnóthi seautón), \u201cconócete a ti " +
        "mismo\u201d. Este precepto estaba escrito en el Templo de Apolo en Delfos.",
      "Sócrates sostiene que el ser humano no debe cesar en la tarea de " +
        "conocerse a sí mismo: es así como se comienza a dibujar el camino " +
        "para tomar decisiones sensatas, integrar el pasado, apreciar el " +
        "presente y proyectar el futuro.",
      "Tómate unos minutos para responder con honestidad. Tus respuestas se " +
        "guardan y son confidenciales.",
    ],
    preguntas: [
      {
        id: "relacion_pasado",
        tipo: "choice",
        eyebrow: "Tu relación con el tiempo",
        texto: "Señala qué tipo de relación consideras que tienes con tu pasado, tu historia:",
        opciones: [
          "Aprendizaje",
          "Añoranza",
          "Rechazo",
          "Resentimiento",
          "Idealización",
          "Represión",
          "Estancamiento",
          "Agradecimiento",
          "Obsesión",
        ],
        obligatoria: true,
      },
      {
        id: "relacion_presente",
        tipo: "choice",
        eyebrow: "Tu relación con el tiempo",
        texto: "Señala qué tipo de relación consideras que tienes con el presente:",
        opciones: [
          "Ansiosa",
          "Ausente",
          "Apreciativa",
          "Disociada",
          "Fugaz",
          "Serena",
          "Compleja",
        ],
        obligatoria: true,
      },
      {
        id: "relacion_futuro",
        tipo: "choice",
        eyebrow: "Tu relación con el tiempo",
        texto: "Señala qué tipo de relación consideras que tienes con el futuro:",
        opciones: [
          "Esperanza",
          "Ansiedad",
          "Agobio",
          "Ilusión",
          "Angustia",
          "Desespero",
          "Paz",
        ],
        obligatoria: true,
      },
      {
        id: "fortaleza_familia",
        tipo: "texto",
        eyebrow: "Tus fortalezas, según tú",
        texto: "El autoconocimiento no es solo un trabajo introspectivo: los demás nos ayudan a conocernos mejor. ¿Cuál dirías que es tu más potente fortaleza en casa o para con tu familia?",
        placeholder: "Escribe con honestidad.",
        obligatoria: true,
      },
      {
        id: "fortaleza_trabajo",
        tipo: "texto",
        eyebrow: "Tus fortalezas, según tú",
        texto: "¿Cuál dirías que es tu más potente fortaleza en tu quehacer o trabajo profesional?",
        placeholder: "Escribe con honestidad.",
        obligatoria: true,
      },
      {
        id: "fortaleza_amistad",
        tipo: "texto",
        eyebrow: "Tus fortalezas, según tú",
        texto: "¿Cuál crees que es tu mejor cualidad como amig@?",
        placeholder: "Escribe con honestidad.",
        obligatoria: true,
      },
      {
        id: "otros_familia",
        tipo: "texto",
        eyebrow: "Tus fortalezas, según los demás",
        texto: "Pregunta a un miembro de tu familia o con quien habites: ¿cuál cree que es tu mayor fortaleza en el ámbito doméstico y de relación con la casa y la familia? Escribe aquí su respuesta.",
        placeholder: "Puedes escribirle un mensaje ahora mismo o llamar. Vuelve y registra su respuesta aquí.",
        obligatoria: false,
      },
      {
        id: "otros_trabajo",
        tipo: "texto",
        eyebrow: "Tus fortalezas, según los demás",
        texto: "Pregunta a un colega de trabajo o a alguien que se beneficie de tu quehacer: ¿cuál cree que es tu mayor fortaleza en tu trabajo? ¿Qué es lo que haces mejor? Escribe aquí su respuesta.",
        placeholder: "Registra aquí lo que te respondan.",
        obligatoria: false,
      },
      {
        id: "otros_amistad",
        tipo: "texto",
        eyebrow: "Tus fortalezas, según los demás",
        texto: "Pregunta a un amig@ cercan@: ¿cuál es tu mayor virtud como amig@? Escribe aquí su respuesta. ¿Coinciden las respuestas? ¿Los demás dicen algo de ti que no veías?",
        placeholder: "Registra aquí lo que te respondan.",
        obligatoria: false,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Happy Secret to Better Work (Shawn Achor)
  // Pre-session de la sesión 1 (sin score — reflexiva sobre TED Talk)
  // ───────────────────────────────────────────────────────────────────
  "coaching-happy-secret": {
    titulo: "Quiz: The happy secret to better work",
    introEyebrow: "Pre-session · Sesión 1",
    introTitle: "The happy secret to better work",
    introLead: [
      "Antes de responder este cuestionario, te invitamos a ver el TED Talk de Shawn Achor titulado \u201cThe happy secret to better work\u201d. Está disponible en YouTube.",
      "Las siguientes preguntas exploran los puntos centrales de la charla y te ayudarán a anclar los conceptos clave que usaremos en la sesión 1.",
    ],
    doneTitle: "¡Listo! Quiz completado",
    doneLead: "Anclaste los conceptos clave del TED Talk de Shawn Achor. Nos vemos en la sesión 1 para ponerlos en práctica.",
    preguntas: [
      {
        id: "recurso_narrativo",
        tipo: "choice",
        eyebrow: "Pregunta 1",
        texto: "¿Qué recurso narrativo usa el orador al inicio para introducir la idea de cambiar la percepción ante un accidente?",
        opciones: [
          "Un ejemplo científico sobre el cerebro",
          "Una historia personal sobre su hermana (el unicornio)",
          "Una estadística sobre felicidad",
          "Una cita famosa",
        ],
        obligatoria: true,
      },
      {
        id: "datos_atipicos",
        tipo: "choice",
        eyebrow: "Pregunta 2",
        texto: "Según el orador, ¿qué hacen con frecuencia las disciplinas científicas cuando encuentran datos \u201catípicos\u201d?",
        opciones: [
          "Los estudian con más detalle",
          "Los promocionan en los medios",
          "Los eliminan para ajustar al promedio",
          "Los usan para crear nuevas hipótesis",
        ],
        obligatoria: true,
      },
      {
        id: "critica_promedios",
        tipo: "choice",
        eyebrow: "Pregunta 3",
        texto: "¿Cuál es la crítica principal que hace el orador al \u201cculto científico a los promedios\u201d?",
        opciones: [
          "Que el promedio es siempre la medida más justa",
          "Que al centrarse en el promedio se ignoran los atípicos positivos",
          "Que los promedios incrementan la productividad",
          "Que los promedios se calculan incorrectamente",
        ],
        obligatoria: true,
      },
      {
        id: "porcentaje_felicidad",
        tipo: "choice",
        eyebrow: "Pregunta 4",
        texto: "¿Qué porcentaje de la felicidad a largo plazo, según el orador, puede predecirse por factores externos?",
        opciones: ["90%", "50%", "10%", "0%"],
        obligatoria: true,
      },
      {
        id: "cerebro_positivo",
        tipo: "choice",
        eyebrow: "Pregunta 5",
        texto: "Según la charla, ¿qué efecto tiene un cerebro positivo en el rendimiento laboral?",
        opciones: [
          "Ninguno; el rendimiento depende solo de la IQ",
          "Es 31% menos productivo",
          "Es 31% más productivo que si es negativo, neutro o presionado",
          "Solo mejora la creatividad, no la productividad",
        ],
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Evaluación Sesión 1: Introducción al Coaching
  // Quiz CON SCORE — 5 preguntas, todas con respuesta correcta marcada.
  // ───────────────────────────────────────────────────────────────────
  "coaching-evaluacion-s1": {
    titulo: "Evaluación · Sesión 1",
    introEyebrow: "Evaluación · Sesión 1",
    introTitle: "Introducción al Coaching",
    introLead: [
      "Esta evaluación tiene 5 preguntas de opción múltiple basadas en el contenido revisado en la nota técnica, la lectura del Capítulo 1 del Complete Handbook of Coaching, y lo discutido en la sesión en vivo.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "distincion_relacion",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "En la tabla de distinciones profesionales, ¿cuál es la característica principal que define la relación en el Coaching frente a la Mentoría o la Terapia?",
        opciones: [
          "Es una relación desigual donde el profesional da las soluciones.",
          "Es una relación entre iguales donde el coachee no tiene todas las respuestas.",
          "Es una relación basada únicamente en la experiencia previa del coach.",
          "Es una relación de dependencia hasta que el profesional da el alta.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "etimologia_coach",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "Etimológicamente, ¿cuál es el origen y el sentido inicial de la palabra \u201ccoach\u201d?",
        opciones: [
          "Proviene de un término griego que significa \u201cel que enseña\u201d.",
          "Se originó en Oxford para describir a un psicólogo deportivo.",
          "Proviene del pueblo de Kocs (Hungría) y refería a un carruaje que transportaba a alguien de un punto A a un punto B.",
          "Fue inventada por Thomas Leonard en 1992 para su primera escuela.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "rol_socratico",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "Según la filosofía socrática aplicada al coaching (Método SOPHIA), ¿cuál es el rol fundamental del coach?",
        opciones: [
          "Transferir su propio conocimiento al estudiante mediante lecciones magistrales.",
          "Corregir los traumas psicológicos del pasado del coachee.",
          "Actuar como una \u201cpartera\u201d que asiste al alma para que el coachee engendre su propio conocimiento.",
          "Decidir por el coachee cuál es el mejor camino a seguir en su carrera.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "escuela_ontologica",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "¿Cuál de las siguientes empresas de formación fue fundada en 1990 por Julio Olalla y Rafael Echeverría, basándose en la ontología del lenguaje?",
        opciones: [
          "New Ventures West (NVW).",
          "Newfield Network.",
          "Success Unlimited Network (SUN).",
          "Coach U (CU).",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "icf_crecimiento",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "En el Código de Ética de la ICF, el valor de \u201cCrecimiento continuo\u201d se refiere a:",
        opciones: [
          "Aumentar la cantidad de clientes cada mes de forma obligatoria.",
          "Buscar constantemente el aprendizaje, la autoconciencia y la superación personal.",
          "Cobrar tarifas más altas a medida que pasa el tiempo.",
          "Delegar las responsabilidades profesionales en otros colegas.",
        ],
        correcta: 1,
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Reflexión personal: Identidad y Ética Profesional
  // 1 pregunta de texto libre (sin score)
  // ───────────────────────────────────────────────────────────────────
  "coaching-reflexion-s1": {
    titulo: "Reflexión personal",
    introEyebrow: "Sesión 1 · Identidad y Ética Profesional",
    introTitle: "Reflexión personal: Identidad y Ética Profesional",
    introLead: [
      "Objetivo de la sesión: distinguir el coaching de otras disciplinas, comprender su historia y rol, y aplicar los Códigos de Ética de ICF y EMCC.",
      "Tómate unos minutos para reflexionar con honestidad sobre la siguiente pregunta antes de la sesión en vivo. Tu respuesta se guarda en el portal y la podrás revisar más adelante.",
    ],
    doneTitle: "Reflexión guardada",
    doneLead: "Tu reflexión quedó registrada. Llévala contigo a la sesión 1 – vamos a profundizar en estas fronteras del coaching juntos.",
    preguntas: [
      {
        id: "reflexion_fronteras",
        tipo: "texto",
        eyebrow: "Pregunta reflexiva",
        texto: "Al observar las fronteras entre coaching, terapia y consultoría, ¿qué aspectos de tu estilo personal tienden a cruzar esas líneas y cómo la ética protege la autonomía de tu cliente?",
        placeholder: "Escribe con honestidad. No hay respuesta correcta.",
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Journaling: Identidad y Ética Profesional
  // 1 pregunta de texto libre (sin score)
  // ───────────────────────────────────────────────────────────────────
  "coaching-journaling-s1": {
    titulo: "Journaling de la semana",
    introEyebrow: "Semana 1 · Identidad y Ética Profesional",
    introTitle: "Journaling: Identidad y Ética Profesional",
    introLead: [
      "Objetivo: diferenciar disciplinas de acompañamiento y fundamentar el rol del coach bajo estándares éticos.",
      "Desafío de la semana: identifica un momento en el que sentiste la tentación de \u201cdar un consejo\u201d (consultoría) y reflexiona sobre cómo una pregunta de coaching habría cambiado el resultado.",
    ],
    doneTitle: "Journaling guardado",
    doneLead: "Tu entrada quedó registrada. Volveremos a estos hallazgos en próximas sesiones para construir sobre ellos.",
    preguntas: [
      {
        id: "journaling_consejo",
        tipo: "texto",
        eyebrow: "Reflexión de la semana",
        texto: "¿En qué medida tu intervención actual respeta los límites del coaching frente a la consultoría o la terapia, y cómo honra esto el Código de Ética? Describe un momento concreto de la semana en el que esto se haya manifestado.",
        placeholder: "Anota tu reflexión. Trabajaremos sobre estos hallazgos en las próximas sesiones.",
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Quiz pre-sesión 2: El arte de preguntar las preguntas correctas
  // Quiz CON SCORE — 5 preguntas, basado en el video de trabajo previo.
  // ───────────────────────────────────────────────────────────────────
  "coaching-arte-preguntar-s2": {
    titulo: "Quiz: El arte de preguntar las preguntas correctas",
    introEyebrow: "Pre-sesión · Sesión 2",
    introTitle: "El arte de preguntar las preguntas correctas",
    introLead: [
      "Este quiz tiene 5 preguntas de opción múltiple basadas en el video de trabajo previo sobre el arte de preguntar.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "berger_valor_preguntas",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "¿Cuál es, según Warren Berger, la razón principal por la que las preguntas se vuelven más valiosas que las respuestas en entornos como Silicon Valley?",
        opciones: [
          "Porque las respuestas ya no son confiables.",
          "Porque las preguntas ayudan a organizar nuestro pensamiento sobre lo que no sabemos.",
          "Porque las empresas buscan reducir costos eliminando respuestas.",
          "Porque las respuestas están protegidas por derechos de autor.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "jahren_curiosidad",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "¿Cómo describe Hope Jahren el inicio de la investigación guiada por la curiosidad?",
        opciones: [
          "Como una búsqueda inmediata de aplicaciones comerciales.",
          "Como preguntas de niños sobre por qué ocurren fenómenos naturales.",
          "Como un proceso que evita cualquier colaboración con expertos.",
          "Como un método para acelerar la producción en masa.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "declive_preguntas",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "Según el video, ¿qué sucede con la tendencia a hacer preguntas desde la infancia hasta la secundaria?",
        opciones: [
          "Aumenta constante y significativamente.",
          "Se mantiene igual durante toda la escolaridad.",
          "Declina notablemente hasta casi desaparecer en la secundaria.",
          "Solo cambia en función del nivel socioeconómico.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "preguntas_absurdas",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "Tim Ferriss y los entrevistados hablan del valor de las \"preguntas absurdas\" o \"dumb questions\". ¿Cuál es un efecto clave de formular ese tipo de preguntas?",
        opciones: [
          "Reforzar los marcos mentales y las suposiciones actuales.",
          "Forzar pensamiento lateral y romper límites de confort.",
          "Aumentar la probabilidad de rechazo social sin beneficio intelectual.",
          "Evitar la reflexión profunda sobre problemas complejos.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "pregunta_obvia_periodismo",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "¿Qué ejemplo concreto se menciona sobre una \"pregunta obvia pero no formulada\" que llevó a una gran investigación o producto periodístico?",
        opciones: [
          "¿Cómo fabricar un coche volador en 24 horas?",
          "¿Por qué los bancos prestaron a personas con escasas posibilidades de pagar?",
          "¿Cuál es la fórmula secreta para mejorar la memoria?",
          "¿Cómo invertir todo el patrimonio en criptomonedas sin riesgo?",
        ],
        correcta: 1,
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Reflexión personal Sesión 2: Identidad y Ética Profesional
  // 1 pregunta de texto libre (sin score)
  // ───────────────────────────────────────────────────────────────────
  "coaching-reflexion-s2": {
    titulo: "Reflexión personal",
    introEyebrow: "Sesión 2 · El Pilar de la Confianza SOPHIA",
    introTitle: "Reflexión personal: Identidad y Ética Profesional",
    introLead: [
      "Objetivo de la sesión: integrar las competencias ICF con la metodología SOPHIA para cultivar un espacio de seguridad y llevar a cabo una sesión inicial.",
      "Tómate unos minutos para reflexionar con honestidad sobre la siguiente pregunta antes de la sesión en vivo. Tu respuesta se guarda en el portal y la podrás revisar más adelante.",
    ],
    doneTitle: "Reflexión guardada",
    doneLead: "Tu reflexión quedó registrada. Llévala contigo a la sesión 2.",
    preguntas: [
      {
        id: "reflexion_confianza",
        tipo: "texto",
        eyebrow: "Pregunta reflexiva",
        texto: "¿De qué manera mi capacidad para generar confianza determina la profundidad de la vulnerabilidad que el cliente se permite explorar en el modelo SOPHIA?",
        placeholder: "Escribe con honestidad. No hay respuesta correcta.",
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Journaling Sesión 2: El Corazón de la Metodología SOPHIA
  // 1 pregunta de texto libre (sin score)
  // ───────────────────────────────────────────────────────────────────
  "coaching-journaling-s2": {
    titulo: "Journaling de la semana",
    introEyebrow: "Semana 2 · El Corazón de la Metodología SOPHIA",
    introTitle: "Journaling: Identidad y Ética Profesional",
    introLead: [
      "Objetivo: comprender los pilares de la metodología SOPHIA y cultivar un entorno de seguridad psicológica.",
      "Desafío de la semana: realiza una práctica breve aplicando el primer pilar de SOPHIA y autoevalúa tu nivel de presencia.",
    ],
    doneTitle: "Journaling guardado",
    doneLead: "Tu entrada quedó registrada. Volveremos a estos hallazgos en próximas sesiones.",
    preguntas: [
      {
        id: "journaling_no_verbal",
        tipo: "texto",
        eyebrow: "Reflexión de la semana",
        texto: "¿Cómo se manifiesta la \"confianza y seguridad\" en mi lenguaje no verbal cuando inicio una sesión?",
        placeholder: "Anota tu reflexión. Trabajaremos sobre estos hallazgos en las próximas sesiones.",
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Evaluación Sesión 2: Introducción a la metodología SOPHIA
  // Quiz CON SCORE — 5 preguntas, todas con respuesta correcta marcada.
  // ───────────────────────────────────────────────────────────────────
  "coaching-evaluacion-s2": {
    titulo: "Evaluación · Sesión 2",
    introEyebrow: "Evaluación · Sesión 2",
    introTitle: "Introducción a la metodología SOPHIA",
    introLead: [
      "Esta evaluación tiene 5 preguntas de opción múltiple sobre la metodología SOPHIA y lo revisado en la sesión 2.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "pilar_existencial",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "Dentro de los pilares de la metodología SOPHIA, ¿qué autor y concepto sustentan el supuesto de la \"E: Existencial\"?",
        opciones: [
          "Kant – El estudio de la experiencia consciente.",
          "Heráclito – El cambio en el nivel del \"Ser\".",
          "Ortega y Gasset – La libertad, la elección y la responsabilidad personal.",
          "Sócrates – La evolución a través de la tensión y el diálogo.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "mentalidad_coach",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "Antes de iniciar una sesión, el coach debe entrar en una \"mentalidad de coach\". ¿Cuál de estas preguntas forma parte de esa preparación interna?",
        opciones: [
          "¿Qué consejos le voy a dar hoy al coachee?",
          "¿Qué ruido mental debo ignorar para escuchar plenamente?",
          "¿Cuánto tiempo falta para que termine la sesión?",
          "¿Qué solución es la más rápida para este problema?",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "contrato_acuerdo",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "Al generar el \"Contrato y acuerdo de la sesión\", ¿cuál es el objetivo principal de preguntas como \"¿Qué te gustaría lograr en estos minutos?\"?",
        opciones: [
          "Evaluar el pasado del coachee.",
          "Establecer el mejor uso del tiempo y el objetivo de la conversación actual.",
          "Decidir por el coachee qué competencia debe trabajar.",
          "Finalizar la relación profesional de inmediato.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "rueda_felicidad",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "En el modelo SOPHIA, la \"Rueda de la Felicidad\" se utiliza para que el coachee seleccione una competencia a mejorar. ¿Qué dimensiones incluye esta rueda?",
        opciones: [
          "Solo dimensión económica y profesional.",
          "Espiritual, Mental, Física y Afectiva.",
          "Terapia, Mentoría y Consultoría.",
          "Pasado, Presente y Futuro únicamente.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "etapa_mediacion",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "¿Qué sucede en la etapa de \"Mediación\" al finalizar la sesión de coaching?",
        opciones: [
          "El coach le dice al coachee qué nota le pone a su desempeño.",
          "Se ignora lo ocurrido en sesiones anteriores para no sesgar.",
          "Se compara la sesión actual con la pasada para identificar avances y el coachee elige cómo medir su progreso.",
          "El coach contacta a la familia del coachee para reportar avances.",
        ],
        correcta: 2,
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Quiz pre-sesión 3: Los 5 órdenes de conciencia de Robert Kegan
  // Quiz CON SCORE — 5 preguntas, basado en el video de trabajo previo.
  // ───────────────────────────────────────────────────────────────────
  "coaching-kegan-s3": {
    titulo: "Quiz: Los 5 órdenes de conciencia de Robert Kegan",
    introEyebrow: "Pre-sesión · Sesión 3",
    introTitle: "Los 5 órdenes de conciencia de Robert Kegan",
    introLead: [
      "Este quiz tiene 5 preguntas de opción múltiple basadas en el video de trabajo previo sobre los cinco órdenes de conciencia de Robert Kegan.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "kegan_primer_orden",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "¿Cómo describe Kegan el primer orden de la consciencia?",
        opciones: [
          "Como la etapa adulta donde se distinguen claramente sujeto y objeto.",
          "Como la etapa infantil en la que imaginación y realidad no están separadas.",
          "Como la etapa de modernismo y autoconciencia crítica.",
          "Como la etapa de transformaciones interinstitucionales.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "kegan_segundo_orden_edad",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "¿Qué rango de edad asocia el narrador al segundo orden de consciencia?",
        opciones: [
          "Entre 2 y 6 años.",
          "Entre 6 y 10 años.",
          "Entre 10 y 18 años.",
          "Entre 40 y 60 años.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "kegan_tercer_orden",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "¿Cuál de estas características pertenece al tercer orden de consciencia según la explicación del video?",
        opciones: [
          "Percepciones que no distinguen la fantasía de la realidad.",
          "Cognición concreta y categorías duraderas.",
          "Mutualidad, abstracción y habilidad interpersonal.",
          "Visión interconectada y fusión transformadora de identidades.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "kegan_metafora_cuarto",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "¿Qué metáfora geométrica usa el narrador para comparar el cuarto orden de consciencia?",
        opciones: [
          "Un punto.",
          "Una línea.",
          "Una caja o cubo (espacio tridimensional).",
          "Un plano hecho de líneas.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "kegan_importancia_cuarto",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "¿Por qué, según el video, es importante que los adultos desarrollen el cuarto orden de consciencia?",
        opciones: [
          "Para regresar a la infancia imaginativa.",
          "Para poder ver sistemas como objetos y comprender cómo encajan entre sí.",
          "Para negar la existencia de instituciones.",
          "Para promover la absoluta separación entre sujeto y objeto.",
        ],
        correcta: 1,
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Reflexión personal Sesión 3: La arquitectura de la escucha
  // 1 pregunta de texto libre (sin score)
  // ───────────────────────────────────────────────────────────────────
  "coaching-reflexion-s3": {
    titulo: "Reflexión personal",
    introEyebrow: "Sesión 3 · El Arte de la Escucha y el Acuerdo",
    introTitle: "Reflexión personal: La arquitectura de la escucha",
    introLead: [
      "Objetivo de la sesión: desarrollar las 4 habilidades de escucha SOPHIA, mantener la neutralidad y asegurar el cumplimiento de metas conversacionales y resultados acordados.",
      "Tómate unos minutos para reflexionar con honestidad sobre la siguiente pregunta antes de la sesión en vivo. Tu respuesta se guarda en el portal y la podrás revisar más adelante.",
    ],
    doneTitle: "Reflexión guardada",
    doneLead: "Tu reflexión quedó registrada. Llévala contigo a la sesión 3.",
    preguntas: [
      {
        id: "reflexion_escucha",
        tipo: "texto",
        eyebrow: "Pregunta reflexiva",
        texto: "Al elegir la información \u201cimportante\u201d de la sesión, ¿estoy escuchando lo que el cliente necesita resolver o lo que yo considero interesante?",
        placeholder: "Escribe con honestidad. No hay respuesta correcta.",
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Journaling Sesión 3: La arquitectura de la escucha
  // 1 pregunta de texto libre (sin score)
  // ───────────────────────────────────────────────────────────────────
  "coaching-journaling-s3": {
    titulo: "Journaling de la semana",
    introEyebrow: "Semana 3 · El Arte de la Escucha y el Acuerdo",
    introTitle: "Journaling: La arquitectura de la escucha",
    introLead: [
      "Objetivo: desarrollar habilidades de escucha profunda y establecer resultados conversacionales claros.",
      "Desafío de la semana: durante una conversación, identifica la \u201cinformación importante\u201d (la meta real) separándola del ruido narrativo del interlocutor.",
    ],
    doneTitle: "Journaling guardado",
    doneLead: "Tu entrada quedó registrada. Volveremos a estos hallazgos en próximas sesiones.",
    preguntas: [
      {
        id: "journaling_juicio",
        tipo: "texto",
        eyebrow: "Reflexión de la semana",
        texto: "De las 4 habilidades de escucha SOPHIA, ¿cuál es la que requiere mayor atención de mi parte para evitar el juicio?",
        placeholder: "Anota tu reflexión. Trabajaremos sobre estos hallazgos en las próximas sesiones.",
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Evaluación Sesión 3: Bases de la Metodología
  // Quiz CON SCORE — 5 preguntas, todas con respuesta correcta marcada.
  // ───────────────────────────────────────────────────────────────────
  "coaching-evaluacion-s3": {
    titulo: "Evaluación · Sesión 3",
    introEyebrow: "Evaluación · Sesión 3",
    introTitle: "Bases de la Metodología",
    introLead: [
      "Esta evaluación tiene 5 preguntas de opción múltiple sobre el arte de la escucha y el acuerdo, y lo revisado en la sesión 3.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Necesitas al menos 60% para aprobar y avanzar. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "escucha_nivel_1_2",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "¿Cuál es la diferencia fundamental entre la \u201cEscucha de Nivel 1\u201d y la \u201cEscucha de Nivel 2\u201d según la analogía del foco de luz (spotlight)?",
        opciones: [
          "En el Nivel 1 el foco está siempre en el coachee; en el Nivel 2 el foco se apaga.",
          "En el Nivel 1 el foco alterna entre el otro y mis propios juicios; en el Nivel 2 el foco permanece todo el tiempo sobre el hablante.",
          "El Nivel 1 es para percibir emociones profundas; el Nivel 2 es para escuchar solo el contenido verbal.",
          "No hay diferencia, ambas buscan dar consejos rápidos al coachee.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "pregunta_importante_valores",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "Según el material, ¿cuándo es especialmente útil la pregunta \u201c¿Por qué es esto importante para ti?\u201d?",
        opciones: [
          "En cualquier momento, ya que siempre ayuda a justificar las acciones.",
          "Únicamente al final de la sesión para dar un reporte.",
          "Durante la fase de contrato (acuerdo de sesión) para conectar con los valores del coachee.",
          "Nunca debe usarse porque siempre activa defensas y cierra la conversación.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "backtracking",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "El \u201cBacktracking\u201d es una herramienta de rapport que consiste en:",
        opciones: [
          "Corregir las palabras del coachee cuando se equivoca.",
          "Devolver al coachee el sentido esencial de lo comunicado utilizando sus propias palabras o expresiones clave.",
          "Contar una experiencia personal similar para que el coachee no se sienta solo.",
          "Guardar silencio absoluto durante toda la sesión sin intervenir.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "marco_resultado_ecologico",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "Dentro del \u201cMarco de Resultado\u201d, ¿qué significa que un objetivo debe ser \u201cArmónico o Ecológico\u201d?",
        opciones: [
          "Que debe estar relacionado con el cuidado del medio ambiente.",
          "Que debe ser un objetivo fácil de alcanzar sin esfuerzo.",
          "Que debe estar alineado con los valores y el entorno del coachee, sin generar conflictos en otras áreas de su vida.",
          "Que el coach debe estar de acuerdo con el objetivo para que sea válido.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "escucha_nivel_4_anhelos",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "En la \u201cEscucha de Nivel 4\u201d (Anhelos del corazón), ¿cuáles son algunos de los deseos profundos que el coach intenta percibir más allá de las palabras?",
        opciones: [
          "Dinero, fama, poder y posesiones materiales.",
          "Puntualidad, orden, técnica y gramática.",
          "Dignidad, justicia, paz, confianza y reconocimiento.",
          "El nombre de los familiares y amigos del coachee.",
        ],
        correcta: 2,
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Reflexión personal Sesión 4: La Arquitectura del Pensamiento Posibilista
  // 1 pregunta de texto libre (sin score)
  // ───────────────────────────────────────────────────────────────────
  "coaching-reflexion-s4": {
    titulo: "Reflexión personal",
    introEyebrow: "Sesión 4 · Marcos de Pensamiento",
    introTitle: "Reflexión personal: La Arquitectura del Pensamiento Posibilista",
    introLead: [
      "Objetivo de la sesión: gestionar marcos de pensamiento, aplicar las condiciones de establecimiento de metas y transformar preguntas cerradas en abiertas utilizando escalas.",
      "Tómate unos minutos para reflexionar con honestidad sobre la siguiente pregunta antes de la sesión en vivo. Tu respuesta se guarda en el portal y la podrás revisar más adelante.",
    ],
    doneTitle: "Reflexión guardada",
    doneLead: "Tu reflexión quedó registrada. Llévala contigo a la sesión 4.",
    preguntas: [
      {
        id: "reflexion_posibilismo",
        tipo: "texto",
        eyebrow: "Pregunta reflexiva",
        texto: "¿Cómo cambia mi presencia interna cuando paso de un pensamiento centrado en el problema a uno basado en la generación de múltiples posibilidades?",
        placeholder: "Escribe con honestidad. No hay respuesta correcta.",
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Journaling Sesión 4: La Arquitectura del Pensamiento Posibilista
  // 1 pregunta de texto libre (sin score)
  // ───────────────────────────────────────────────────────────────────
  "coaching-journaling-s4": {
    titulo: "Journaling de la semana",
    introEyebrow: "Semana 4 · Marcos de Pensamiento",
    introTitle: "Journaling: La Arquitectura del Pensamiento Posibilista",
    introLead: [
      "Objetivo: gestionar marcos de pensamiento y transformar preguntas cerradas en escalas de solución.",
      "Desafío de la semana: toma tres preguntas cerradas que hayas hecho recientemente y redáctalas como \u201cscaling questions\u201d (preguntas de escala) para buscar soluciones.",
    ],
    doneTitle: "Journaling guardado",
    doneLead: "Tu entrada quedó registrada. Volveremos a estos hallazgos en próximas sesiones.",
    preguntas: [
      {
        id: "journaling_estados_mentales",
        tipo: "texto",
        eyebrow: "Reflexión de la semana",
        texto: "¿Qué estados mentales propios están limitando mi capacidad de formular preguntas abiertas y generativas?",
        placeholder: "Anota tu reflexión. Trabajaremos sobre estos hallazgos en las próximas sesiones.",
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Evaluación Sesión 4: Marcos de Pensamiento
  // Quiz CON SCORE — 5 preguntas, todas con respuesta correcta marcada.
  // ───────────────────────────────────────────────────────────────────
  "coaching-evaluacion-s4": {
    titulo: "Evaluación · Sesión 4",
    introEyebrow: "Evaluación · Sesión 4",
    introTitle: "Marcos de Pensamiento",
    introLead: [
      "Esta evaluación tiene 5 preguntas de opción múltiple sobre los marcos de pensamiento, el establecimiento de metas y las preguntas de escala vistos en la sesión 4.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Necesitas al menos 60% para aprobar y avanzar. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "marcos_categoria_visitante",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "Si un coachee asiste a la sesión solo porque su jefe se lo ordenó, no reconoce tener un problema y no tiene intención de cambiar, ¿en qué categoría se encuentra?",
        opciones: [
          "Cliente.",
          "Quejoso o Reclamante.",
          "Visitante.",
          "Consultor.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "marcos_respuesta_quejoso",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "¿Cuál es la respuesta adecuada del coach ante un coachee con actitud de \u201cQuejoso\u201d (Complainant)?",
        opciones: [
          "Asignar tareas de acción directa e inmediata para forzar el cambio.",
          "No hacer nada y terminar la sesión rápidamente.",
          "Reconocer la necesidad de ampliar opciones y usar preguntas tipo \u201cas-if\u201d (como si...) para abrir posibilidades.",
          "Confrontarlo duramente por su falta de compromiso.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "marcos_resultado_smarrt",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "En el \u201cMarco de Resultado\u201d, ¿cuál es una condición necesaria para que una meta esté bien formulada?",
        opciones: [
          "Que el resultado dependa de que otras personas cambien su actitud.",
          "Que el resultado se formule en negativo (lo que se quiere evitar).",
          "Que el resultado sea S.M.A.R.R.T. y esté bajo el control de la persona.",
          "Que la meta sea tan grande que resulte inalcanzable para motivar más.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "marcos_scaling_questions",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "¿Qué herramienta se utiliza para medir la intensidad de la motivación o el progreso subjetivo del coachee en una escala del 1 al 10?",
        opciones: [
          "Backtracking.",
          "Preguntas de Escala (Scaling Questions).",
          "Rapport Biofísico.",
          "Contrato Financiero.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "marcos_apertura_preguntas",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "Al transformar una pregunta cerrada en una abierta, ¿cuál de las siguientes opciones representa una apertura real hacia múltiples posibilidades?",
        opciones: [
          "De \u201c¿Hay una forma?\u201d a \u201c¿Cuál es la única forma correcta?\u201d.",
          "De \u201c¿Quieres hacerlo?\u201d a \u201c¿Lo vas a hacer hoy?\u201d.",
          "De \u201c¿Por qué no podemos?\u201d a \u201c¿Cuáles podrían ser algunas de las mejores maneras de comenzar?\u201d.",
          "De \u201c¿Estás listo?\u201d a \u201c¿Sí o no?\u201d.",
        ],
        correcta: 2,
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Bienestar Físico · Checklist de Salud y Bienestar Corporal-Emocional
  // Actividad previa de la sesión de Bienestar Físico (HW)
  // Quiz reflexivo de 35 preguntas binarias en 7 categorías. No tiene
  // score — es un autodiagnóstico de hábitos que el alumno revisa luego
  // con la facilitadora.
  // ───────────────────────────────────────────────────────────────────
  "bienestar-fisico-checklist": {
    titulo: "Checklist de Salud y Bienestar",
    introEyebrow: "Actividad previa · Bienestar Físico",
    introTitle: "Checklist de Salud y Bienestar Corporal–Emocional",
    introLead: [
      "Esta autoevaluación te ayuda a tomar conciencia de tus hábitos actuales de bienestar físico en siete áreas: sueño, alimentación, movimiento, estética del entorno, ritmo y pausas, cuidado corporal y estado emocional.",
      "Responde con honestidad. No hay respuestas correctas o incorrectas — solo tu retrato actual. Llevaremos las respuestas a la sesión en vivo para reflexionar juntos.",
    ],
    doneTitle: "¡Listo! Checklist completado",
    doneLead: "Tu autodiagnóstico quedó registrado. Nos veremos en la sesión en vivo para profundizar en las áreas donde quieras crecer.",
    // No mostrar lista de 35 respuestas al final — son binarias y mucho ruido.
    // Solo el mensaje de éxito y la opción de volver a contestar.
    showAnswers: false,
    preguntas: [
      // — Sueño (5) —
      { id: "sueno_horas", tipo: "choice", eyebrow: "Sueño · 1 de 35", texto: "¿Duermo al menos 7 horas cada noche?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "sueno_desconexion", tipo: "choice", eyebrow: "Sueño · 2 de 35", texto: "¿Tengo rituales de desconexión digital antes de dormir?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "sueno_reparador", tipo: "choice", eyebrow: "Sueño · 3 de 35", texto: "¿Mi sueño es reparador: despierto con energía?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "sueno_horario", tipo: "choice", eyebrow: "Sueño · 4 de 35", texto: "¿Tengo un horario establecido para ir a dormir?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "sueno_cena", tipo: "choice", eyebrow: "Sueño · 5 de 35", texto: "¿Procuro cenar saludable y al menos una hora antes de dormir?", opciones: ["Sí", "No"], obligatoria: true },

      // — Alimentación (5) —
      { id: "alim_frescos", tipo: "choice", eyebrow: "Alimentación · 6 de 35", texto: "¿Como alimentos frescos y variados en al menos 2 comidas al día?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "alim_ultraproc", tipo: "choice", eyebrow: "Alimentación · 7 de 35", texto: "¿Evito productos ultraprocesados o con alto contenido de azúcares?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "alim_atencion", tipo: "choice", eyebrow: "Alimentación · 8 de 35", texto: "¿Como con atención, sin distracciones digitales?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "alim_hidratacion", tipo: "choice", eyebrow: "Alimentación · 9 de 35", texto: "¿Mantengo una buena hidratación durante el día (2L de agua)?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "alim_digestion", tipo: "choice", eyebrow: "Alimentación · 10 de 35", texto: "¿Mi digestión es regular y sin malestares frecuentes?", opciones: ["Sí", "No"], obligatoria: true },

      // — Movimiento (5) —
      { id: "mov_ejercicio", tipo: "choice", eyebrow: "Movimiento · 11 de 35", texto: "¿Realizo actividad física al menos 3 veces por semana?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "mov_dia", tipo: "choice", eyebrow: "Movimiento · 12 de 35", texto: "¿Integro el movimiento en mi día a día (caminar, subir escaleras, estirarme)?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "mov_disfruto", tipo: "choice", eyebrow: "Movimiento · 13 de 35", texto: "¿Disfruto alguna forma de movimiento (baile, deporte, yoga, caminata contemplativa)?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "mov_animo", tipo: "choice", eyebrow: "Movimiento · 14 de 35", texto: "¿Siento que el movimiento mejora mi estado de ánimo?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "mov_beneficios", tipo: "choice", eyebrow: "Movimiento · 15 de 35", texto: "¿Reconozco los beneficios emocionales del ejercicio físico?", opciones: ["Sí", "No"], obligatoria: true },

      // — Estética existencial y entorno (5) —
      { id: "est_armonia", tipo: "choice", eyebrow: "Estética y entorno · 16 de 35", texto: "¿Mis espacios (hogar, trabajo) me resultan armónicos y ordenados?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "est_naturaleza", tipo: "choice", eyebrow: "Estética y entorno · 17 de 35", texto: "¿Tengo contacto frecuente con la naturaleza (plantas, luz natural, caminatas)?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "est_detalles", tipo: "choice", eyebrow: "Estética y entorno · 18 de 35", texto: "¿Cuido los detalles estéticos de mi entorno (colores, aromas, limpieza, música)?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "est_entorno_emocional", tipo: "choice", eyebrow: "Estética y entorno · 19 de 35", texto: "¿Siento que mi entorno favorece mi bienestar emocional?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "est_contemplacion", tipo: "choice", eyebrow: "Estética y entorno · 20 de 35", texto: "¿Dedico momentos a la contemplación o a la belleza en lo cotidiano?", opciones: ["Sí", "No"], obligatoria: true },

      // — Ritmo y pausas (5) —
      { id: "ritmo_pausas", tipo: "choice", eyebrow: "Ritmo y pausas · 21 de 35", texto: "¿Hago pausas conscientes durante el día para respirar o estirarme?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "ritmo_cansancio", tipo: "choice", eyebrow: "Ritmo y pausas · 22 de 35", texto: "¿Reconozco señales de cansancio y respondo adecuadamente?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "ritmo_no_hacer", tipo: "choice", eyebrow: "Ritmo y pausas · 23 de 35", texto: "¿Integro momentos de \u201cno hacer\u201d en mi rutina diaria?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "ritmo_limites", tipo: "choice", eyebrow: "Ritmo y pausas · 24 de 35", texto: "¿Respeto mis límites físicos y mentales?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "ritmo_desconexion", tipo: "choice", eyebrow: "Ritmo y pausas · 25 de 35", texto: "¿Encuentro momentos de verdadera desconexión?", opciones: ["Sí", "No"], obligatoria: true },

      // — Cuidado corporal (5) —
      { id: "cuerpo_digno", tipo: "choice", eyebrow: "Cuidado corporal · 26 de 35", texto: "¿Me baño y visto de forma que me haga sentir digno(a) y cómodo(a)?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "cuerpo_aliado", tipo: "choice", eyebrow: "Cuidado corporal · 27 de 35", texto: "¿Reconozco mi cuerpo como aliado, no como obstáculo?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "cuerpo_medico", tipo: "choice", eyebrow: "Cuidado corporal · 28 de 35", texto: "¿Hago revisiones médicas básicas con regularidad?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "cuerpo_autocuidado", tipo: "choice", eyebrow: "Cuidado corporal · 29 de 35", texto: "¿Tengo rituales de autocuidado que refuerzan mi autoestima?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "cuerpo_compasion", tipo: "choice", eyebrow: "Cuidado corporal · 30 de 35", texto: "¿Aunque busque mejorarlo, acepto mi cuerpo con compasión?", opciones: ["Sí", "No"], obligatoria: true },

      // — Estado emocional (5) —
      { id: "emo_identifico", tipo: "choice", eyebrow: "Estado emocional · 31 de 35", texto: "¿Identifico mis emociones cotidianamente y sé nombrarlas?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "emo_regular", tipo: "choice", eyebrow: "Estado emocional · 32 de 35", texto: "¿Siento que puedo regular mis emociones sin reprimirlas ni explotar?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "emo_alguien", tipo: "choice", eyebrow: "Estado emocional · 33 de 35", texto: "¿Tengo al menos una persona con quien hablar emocionalmente de forma segura?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "emo_valores", tipo: "choice", eyebrow: "Estado emocional · 34 de 35", texto: "¿Me siento conectado(a) conmigo mismo(a) y con mis valores?", opciones: ["Sí", "No"], obligatoria: true },
      { id: "emo_satisfaccion", tipo: "choice", eyebrow: "Estado emocional · 35 de 35", texto: "¿Siento satisfacción con mi vida en general en la última semana?", opciones: ["Sí", "No"], obligatoria: true },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Bienestar Emocional · Test de diagnóstico breve
  // Actividad previa de la sesión 5 (HW). Reflexivo (sin score):
  // 4 enunciados en escala Likert de acuerdo (1-5) + 1 pregunta abierta.
  // Muestra el resumen de respuestas al final.
  // ───────────────────────────────────────────────────────────────────
  "bienestar-emocional-diagnostico": {
    titulo: "Test de diagnóstico breve",
    introEyebrow: "Actividad previa · Bienestar Emocional",
    introTitle: "Test de diagnóstico breve: Bienestar Emocional",
    introLead: [
      "Antes de la sesión en vivo, tómate un par de minutos para este breve autodiagnóstico. Para cada enunciado, marca qué tan de acuerdo estás en una escala del 1 al 5.",
      "No hay respuestas correctas ni incorrectas: es una foto de tu momento actual. Tus respuestas se guardan y son confidenciales; las retomaremos en la sesión.",
    ],
    doneTitle: "¡Listo! Diagnóstico completado",
    doneLead: "Gracias por tu honestidad. Esto es solo una foto de tu momento actual y será nuestro punto de partida en la sesión de Bienestar Emocional.",
    preguntas: [
      {
        id: "conciencia_emocional",
        tipo: "escala",
        eyebrow: "Conciencia y Manejo Emocional",
        texto: "Logro identificar qué emoción estoy sintiendo (tristeza, enojo, frustración) en el momento en que ocurre.",
        obligatoria: true,
      },
      {
        id: "autocuidado",
        tipo: "escala",
        eyebrow: "Autocuidado y Estilo de Vida",
        texto: "Consigo desconectarme de mis obligaciones diarias (trabajo, pendientes) para disfrutar tiempo para mí.",
        obligatoria: true,
      },
      {
        id: "relaciones_entorno",
        tipo: "escala",
        eyebrow: "Relaciones y Entorno",
        texto: "Siento que cuento con el apoyo emocional de amigos o familiares cuando lo necesito.",
        obligatoria: true,
      },
      {
        id: "proposito_mentalidad",
        tipo: "escala",
        eyebrow: "Propósito y Mentalidad",
        texto: "Encuentro satisfacción o sentido a las actividades que realizo durante el día.",
        obligatoria: true,
      },
      {
        id: "conclusion_abierta",
        tipo: "texto",
        eyebrow: "Conclusión",
        texto: "¿Qué te gustaría saber sobre el bienestar emocional?",
        placeholder: "Escribe lo que te gustaría explorar o resolver en la sesión. (Opcional)",
        obligatoria: false,
      },
    ],
    // Análisis por puntaje: 4 enunciados Likert (1-5) = total 4 a 20.
    // Se muestra al final, sin listar las respuestas.
    analisis: [
      {
        minTotal: 17,
        label: "Bienestar emocional sólido",
        color: "#2E7D32",
        texto: "Tu autopercepción de bienestar emocional es alta en los cuatro frentes: reconoces lo que sientes, te das tiempo para ti, te sientes acompañado y encuentras sentido en tu día. Llega a la sesión a profundizar y a sostener lo que ya funciona.",
      },
      {
        minTotal: 13,
        label: "Buen punto de partida",
        color: "#1565C0",
        texto: "Tienes una base emocional favorable, con algún frente por reforzar. Fíjate en cuál de las cuatro áreas (conciencia, autocuidado, vínculos, propósito) puntuó más bajo: ahí está tu mayor oportunidad para la sesión.",
      },
      {
        minTotal: 9,
        label: "Área de atención",
        color: "#C88D2D",
        texto: "Aparecen señales de desgaste en varios frentes de tu bienestar emocional. No es un diagnóstico, es una foto de hoy. Identifica el área más floja y llévala a la sesión para trabajarla con herramientas concretas.",
      },
      {
        minTotal: 4,
        label: "Área vulnerable",
        color: "#B00020",
        texto: "Tu bienestar emocional está pidiendo atención en casi todos los frentes. Date permiso de priorizarte. Llega a la sesión con apertura: veremos primeros pasos pequeños y sostenibles, y considera apoyarte en alguien de confianza.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Trabajo con Propósito · Actividad previa: Mi trabajo y mi propósito
  // Actividad previa de la sesión 6 (HW). Reflexiva (sin score de aprobar):
  // 6 enunciados en escala de frecuencia (1-5, Nunca a Siempre). Total 6-30.
  // Muestra el resumen por banda al final.
  // ───────────────────────────────────────────────────────────────────
  "trabajo-proposito-diagnostico": {
    titulo: "Mi trabajo y mi propósito",
    introEyebrow: "Actividad previa · Trabajo con Propósito",
    introTitle: "Mi trabajo y mi propósito",
    introLead: [
      "Antes de la sesión en vivo, tómate un par de minutos para este breve autodiagnóstico. Para cada enunciado, marca con qué frecuencia se cumple en tu día a día, en una escala del 1 (Nunca) al 5 (Siempre).",
      "No hay respuestas correctas ni incorrectas: es una foto de tu relación actual con tu trabajo. Tus respuestas se guardan y son confidenciales; las retomaremos en la sesión.",
    ],
    doneTitle: "¡Listo! Diagnóstico completado",
    doneLead: "Gracias por tu honestidad. Esto es solo una foto de tu momento actual y será nuestro punto de partida en la sesión de Trabajo con Propósito.",
    preguntas: [
      {
        id: "recompensa_personal",
        tipo: "escala",
        eyebrow: "Mi trabajo y mi propósito · 1 de 6",
        texto: "¿Experimentas una forma satisfactoria de recompensa personal a partir de tu quehacer?",
        escalaLabels: { min: "Nunca", max: "Siempre" },
        obligatoria: true,
      },
      {
        id: "impacto_claro",
        tipo: "escala",
        eyebrow: "Mi trabajo y mi propósito · 2 de 6",
        texto: "¿Puedes describir con claridad el tipo de impacto que tu trabajo produce en el mundo?",
        escalaLabels: { min: "Nunca", max: "Siempre" },
        obligatoria: true,
      },
      {
        id: "perfecciona_habilidades",
        tipo: "escala",
        eyebrow: "Mi trabajo y mi propósito · 3 de 6",
        texto: "¿Logras perfeccionar tus conocimientos y habilidades a través de tu trabajo?",
        escalaLabels: { min: "Nunca", max: "Siempre" },
        obligatoria: true,
      },
      {
        id: "beneficio_otros",
        tipo: "escala",
        eyebrow: "Mi trabajo y mi propósito · 4 de 6",
        texto: "¿Tu trabajo genera beneficios para otras personas?",
        escalaLabels: { min: "Nunca", max: "Siempre" },
        obligatoria: true,
      },
      {
        id: "inspirador",
        tipo: "escala",
        eyebrow: "Mi trabajo y mi propósito · 5 de 6",
        texto: "¿Tu manera de trabajar podría resultar, al menos mínimamente, inspiradora para un observador?",
        escalaLabels: { min: "Nunca", max: "Siempre" },
        obligatoria: true,
      },
      {
        id: "ayudas_a_crecer",
        tipo: "escala",
        eyebrow: "Mi trabajo y mi propósito · 6 de 6",
        texto: "¿Ayudas a otros a perfeccionarse y a desarrollar sus talentos y habilidades?",
        escalaLabels: { min: "Nunca", max: "Siempre" },
        obligatoria: true,
      },
    ],
    // Análisis por puntaje: 6 enunciados (1-5 c/u) = total 6 a 30.
    analisis: [
      {
        minTotal: 22,
        label: "Quehacer con propósito",
        color: "#2E7D32",
        texto: "Tu quehacer se vive como valioso, con impacto y crecimiento, tanto personal como hacia los demás. Llega a la sesión a profundizar en cómo sostener y expandir ese sentido en tu trabajo.",
      },
      {
        minTotal: 14,
        label: "En construcción de sentido",
        color: "#1565C0",
        texto: "Tu trabajo tiene momentos significativos, pero aún hay áreas por explorar para darle más sentido. Fíjate en qué enunciados puntuaron más bajo: ahí está tu mayor oportunidad para la sesión.",
      },
      {
        minTotal: 6,
        label: "Por reconectar con tu propósito",
        color: "#C88D2D",
        texto: "Tu trabajo todavía no se conecta de manera clara con tu identidad o propósito. No es un diagnóstico definitivo, es una foto de hoy. Reflexiona qué actividades te hacen sentir satisfacción, a quién beneficia lo que haces y cómo tu quehacer puede ser un espacio de aprendizaje. Lo trabajaremos en la sesión.",
      },
    ],
  }
};

export function getQuizDef(key) {
  return QUIZZES[(key || "").trim()] || null;
}
