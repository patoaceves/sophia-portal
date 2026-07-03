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

  "hwd-m2-actividad-1": {
    titulo: "Actividad",
    introEyebrow: "Actividad",
    introTitle: "Hábitos y autoconocimiento",
    introLead: [
      "Cuatro preguntas de opción múltiple sobre lo que viste en los videos. Se califican al terminar y puedes reintentarlas.",
    ],
    doneTitle: "¡Listo! Actividad completada",
    doneLead: "Gracias por participar. Revisa abajo tus respuestas.",
    preguntas: [
      {
        id: "estructura_habito",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 4",
        texto: "¿Cuál es la estructura fundamental de un hábito?",
        opciones: ["Motivación, esfuerzo y resultado.", "Señal, rutina y recompensa.", "Decisión, acción y consecuencia.", "Pensamiento, emoción y memoria."],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "eliminar_habitos",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 4",
        texto: "¿Por qué no se pueden \"eliminar\" los hábitos?",
        opciones: ["Porque la fuerza de voluntad es limitada para todos los seres humanos.", "Porque los hábitos son genéticos y nacemos con ellos.", "Porque las rutas neuronales son como autopistas permanentes en el cerebro.", "Porque el entorno siempre nos obliga a repetir las mismas acciones."],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "cambiar_habito",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 4",
        texto: "Si quieres cambiar un hábito perjudicial, ¿cuál es la estrategia que propone el autor?",
        opciones: ["Eliminar la señal por completo para que el cerebro no reaccione.", "Cambiar la rutina manteniendo la misma señal y la misma recompensa.", "Suprimir la recompensa para que el cerebro se olvide del hábito.", "Esperar a tener suficiente motivación intrínseca para dejarlo."],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "resultados_reales",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 4",
        texto: "¿En qué debería concentrarse una persona para obtener resultados reales?",
        opciones: ["En encontrar su destino predeterminado.", "En las metas a largo plazo y la motivación extrínseca.", "En sistemas de pequeñas mejoras diarias, no solo en metas.", "En aumentar su fuerza de voluntad mediante el pensamiento positivo."],
        correcta: 2,
        obligatoria: true,
      },
    ],
  },

  "hwd-m2-journaling": {
    titulo: "Journaling",
    introEyebrow: "Journaling",
    introTitle: "Tus Fortalezas VIA",
    introLead: [
      "Las fortalezas VIA son rasgos psicológicos positivos y universales: formas de pensar, sentir y actuar valoradas en prácticamente todas las culturas y épocas. Una fortaleza es un rasgo moral y entrenable.",
      "Antes de responder, descubre tus fortalezas contestando el cuestionario en viacharacter.org. Luego tómate unos minutos para reflexionar con honestidad.",
    ],
    preguntas: [
      {
        id: "fortalezas_insignia",
        tipo: "texto",
        eyebrow: "Reflexión",
        texto: "Mira tus 5 fortalezas principales (fortalezas insignia). ¿En qué momentos de tu vida reciente sentiste que estas fortalezas fluyeron de manera natural?",
        obligatoria: true,
      },
      {
        id: "herramienta_navegacion",
        tipo: "texto",
        eyebrow: "Reflexión",
        texto: "Describe una situación difícil que hayas superado. ¿Cuál de tus fortalezas fue tu principal \"herramienta de navegación\" para no perder el rumbo?",
        obligatoria: true,
      },
      {
        id: "fortaleza_pilar",
        tipo: "texto",
        eyebrow: "Reflexión",
        texto: "En el Modelo SOPHIA, la vida feliz es un \"platillo bien servido\" con 8 elementos esenciales. ¿Cómo podrías usar tu fortaleza #1 para mejorar uno de estos pilares hoy mismo? (Ej: usar la Gratitud para fortalecer tus Vínculos, o la Autorregulación para mejorar tu Bienestar Físico).",
        obligatoria: true,
      },
    ],
  },

  "hwd-m2-dinamica": {
    titulo: "Dinámica",
    introEyebrow: "Dinámica",
    introTitle: "Diseña un pacto",
    introLead: [
      "Vas a diseñar un pequeño experimento contigo mismo. Observa, formula una pregunta y recolecta datos para identificar tus siguientes pasos.",
    ],
    preguntas: [
      {
        id: "observa_situacion",
        tipo: "texto",
        eyebrow: "Paso 1",
        texto: "Observa tu situación actual: mira el mundo a tu alrededor, piensa en tus distintos roles hoy en día y en tu situación física, emocional, mental, espiritual, laboral y social.",
        obligatoria: true,
      },
      {
        id: "pregunta_investigacion",
        tipo: "texto",
        eyebrow: "Paso 2",
        texto: "Formula una pregunta de investigación. Por ejemplo: \"¿Qué pasaría si no como entre comidas?\" o \"¿Qué pasaría si convierto mi tiempo de pantalla en tiempo de lectura?\"",
        obligatoria: true,
      },
      {
        id: "experimento",
        tipo: "texto",
        eyebrow: "Paso 3",
        texto: "Diseña un pequeño experimento para recolectar datos que puedas analizar después. Por ejemplo: dejar el celular siempre en el mismo sitio y observar cuántas veces te acercas a él, qué sientes mientras está lejos y tu nivel de distracción al leer.",
        obligatoria: true,
      },
    ],
  },

  "hwd-m1-actividad-1": {
    titulo: "Actividad 1",
    introEyebrow: "Actividad",
    introTitle: "Pon a prueba lo que viste",
    introLead: [
      "Esta actividad tiene dos preguntas de opción múltiple y tres de reflexión personal.",
      "Las de opción múltiple se califican al terminar y puedes reintentarlas. Las de reflexión se guardan, son tuyas y confidenciales.",
    ],
    doneTitle: "¡Listo! Actividad completada",
    doneLead: "Gracias por reflexionar. Tus respuestas quedaron guardadas.",
    preguntas: [
      {
        id: "aristoteles_bien",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "Aristóteles establece que ______ es aquello a lo que todas las cosas tienden.",
        opciones: ["La armonía", "El éxito", "El progreso", "El bien"],
        correcta: 3,
        obligatoria: true,
      },
      {
        id: "errores_bien_aparente",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "¿Se puede decir que los errores que cometemos, o acciones moralmente cuestionables, de alguna forma buscaban algún tipo de bien, aunque haya resultado en un bien aparente?",
        opciones: ["Verdadero", "Falso"],
        correcta: 0,
        obligatoria: true,
      },
      {
        id: "elementos_vida_feliz",
        tipo: "texto",
        eyebrow: "Reflexión",
        texto: "¿Qué elementos en tu vida han logrado que vivas una vida feliz hasta ahora?",
        obligatoria: true,
      },
      {
        id: "elementos_mas_feliz",
        tipo: "texto",
        eyebrow: "Reflexión",
        texto: "¿Qué elementos ayudarían a que vivas una vida más feliz?",
        obligatoria: true,
      },
      {
        id: "felicidad_esperada",
        tipo: "texto",
        eyebrow: "Reflexión",
        texto: "Piensa en una situación en la que hayas hecho o conseguido algo que pensabas que te iba a hacer más feliz y que, en cambio, te hizo más infeliz, o la felicidad que esperabas fue mucho menor y muy corta. ¿Qué era lo que querías hacer o tener?",
        obligatoria: false,
      },
    ],
  },

  "hwd-m1-journaling": {
    titulo: "Journaling",
    introEyebrow: "Journaling",
    introTitle: "La cinta hedónica",
    introLead: [
      "Un espacio para escribir con calma. No hay respuestas correctas; esto es para ti.",
    ],
    preguntas: [
      {
        id: "cinta_hedonica",
        tipo: "texto",
        eyebrow: "Journaling",
        texto: "¿Has vivido el fenómeno de la cinta hedónica? Nombra algún logro, éxito o vivencia que lo refleje. Por ejemplo: cuando me gradué; cuando realicé el viaje de mis sueños; cuando abrí mi negocio.",
        obligatoria: true,
      },
    ],
  },
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
  // Coaching · Reflexión personal Sesión 5: Laboratorio de Integración I
  // 1 pregunta de texto libre (sin score)
  // ───────────────────────────────────────────────────────────────────
  "coaching-reflexion-s5": {
    titulo: "Reflexión personal",
    introEyebrow: "Sesión 5 · Laboratorio de Integración I",
    introTitle: "Reflexión personal: Laboratorio de Integración I",
    introLead: [
      "Objetivo de la sesión: práctica supervisada para consolidar los marcos de pensamiento y las habilidades de escucha iniciales.",
      "Tómate unos minutos para reflexionar con honestidad sobre la siguiente pregunta antes de la sesión en vivo. Tu respuesta se guarda en el portal y la podrás revisar más adelante.",
    ],
    doneTitle: "Reflexión guardada",
    doneLead: "Tu reflexión quedó registrada. Llévala contigo a la sesión 5.",
    preguntas: [
      {
        id: "reflexion_hilo_metodologia",
        tipo: "texto",
        eyebrow: "Pregunta reflexiva",
        texto: "Durante mis sesiones de práctica, ¿en qué momento siento que pierdo el hilo de la metodología y qué me dice eso de mi estado de presencia?",
        placeholder: "Escribe con honestidad. No hay respuesta correcta.",
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Journaling Sesión 5: Laboratorio de Integración I
  // 1 pregunta de texto libre (sin score)
  // ───────────────────────────────────────────────────────────────────
  "coaching-journaling-s5": {
    titulo: "Journaling de la semana",
    introEyebrow: "Semana 5 · Laboratorio de Integración I",
    introTitle: "Journaling: Laboratorio de Integración I",
    introLead: [
      "Objetivo: evaluar la aplicación inicial de la metodología en un entorno controlado.",
      "Desafío de la semana: solicita un feedback específico sobre un punto ciego y escribe un plan de acción para mejorarlo en el próximo laboratorio.",
    ],
    doneTitle: "Journaling guardado",
    doneLead: "Tu entrada quedó registrada. Volveremos a estos hallazgos en próximas sesiones.",
    preguntas: [
      {
        id: "journaling_patron_estilo",
        tipo: "texto",
        eyebrow: "Reflexión de la semana",
        texto: "Al observar mi desempeño en este primer laboratorio, ¿qué patrón recurrente detecto en mi estilo de coaching?",
        placeholder: "Anota tu reflexión. Trabajaremos sobre estos hallazgos en las próximas sesiones.",
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Quiz pre-sesión Sesión 4: El malestar de la mediana edad
  // Comprensión de los videos de trabajo previo. 5 preguntas de opción
  // múltiple con respuesta correcta marcada (sin umbral de aprobación).
  // ───────────────────────────────────────────────────────────────────
  "coaching-midlife-s4": {
    titulo: "Quiz: El malestar de la mediana edad",
    introEyebrow: "Pre-sesión · Sesión 4",
    introTitle: "Hechos y ficciones de la crisis de la mediana edad",
    introLead: [
      "Este quiz tiene 5 preguntas de opción múltiple basadas en los videos de trabajo previo sobre la crisis y el malestar de la mediana edad.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "midlife_porcentaje_crisis",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "Según la investigación mencionada de Margie Lachman, ¿qué porcentaje aproximado de hombres experimenta una crisis de mediana edad intensa?",
        opciones: [
          "Alrededor del 10 a 12%.",
          "Alrededor del 30 a 35%.",
          "Alrededor del 50 a 60%.",
          "Más del 80%.",
        ],
        correcta: 0,
        obligatoria: true,
      },
      {
        id: "midlife_critica_testosterona",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "¿Cuál es la crítica principal del Dr. Thomas Perls respecto al uso de testosterona para revertir el envejecimiento?",
        opciones: [
          "No hay evidencia de que aumente la energía.",
          "Está asociado con un mayor riesgo de eventos cardiovasculares.",
          "Es demasiado caro para la mayoría de los pacientes.",
          "Provoca pérdida de masa muscular.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "midlife_testimonio_life",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "En el testimonio del médico que toma testosterona (Dr. Jeffry Life), ¿qué afirmación hace sobre su propia experiencia tras años de tratamiento?",
        opciones: [
          "Dice que su salud empeoró notablemente.",
          "Afirma que ahora hace actividades físicas que no podía antes, como taekwondo.",
          "Menciona que dejó de trabajar por completo.",
          "Indica que perdió interés en la vida social.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "midlife_estrategia_pasion",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "En el relato personal sobre el malestar de la mediana edad, ¿qué estrategia encontró la oradora para encender una nueva pasión?",
        opciones: [
          "Renunciar a su trabajo inmediatamente.",
          "Tomar un curso de acuarela y cultivar la expresión creativa.",
          "Mudarse a otra ciudad para empezar de nuevo.",
          "Empezar a tomar suplementos hormonales sin supervisión.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "midlife_no_respuesta",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "Según la charla, ¿cuál de las siguientes NO es una de las tres respuestas comunes a la crisis o malestar de la mediana edad?",
        opciones: [
          "Resignación (surrender).",
          "Detonación (hacer cambios radicales destructivos).",
          "Exploración (buscar nuevas posibilidades).",
          "Inmovilismo absoluto por miedo.",
        ],
        correcta: 3,
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Quiz pre-sesión Sesión 5: Pensamiento estratégico
  // Comprensión del video de trabajo previo. 5 preguntas de opción múltiple
  // (incluye una de verdadero/falso) con respuesta correcta marcada.
  // ───────────────────────────────────────────────────────────────────
  "coaching-estrategico-s5": {
    titulo: "Quiz: Pensamiento estratégico",
    introEyebrow: "Pre-sesión · Sesión 5",
    introTitle: "Usa el pensamiento estratégico para crear la vida que quieres",
    introLead: [
      "Este quiz tiene 5 preguntas basadas en el video de trabajo previo sobre pensamiento estratégico.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "estrategico_tactico_vs_estrategico",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "¿Cuál es la diferencia clave entre pensamiento táctico y estratégico según el video?",
        opciones: [
          "El pensamiento táctico siempre es mejor para la planificación a largo plazo.",
          "El pensamiento táctico reacciona a problemas inmediatos; el estratégico busca el panorama general y previene problemas.",
          "El pensamiento estratégico depende solo del talento natural.",
          "No existe diferencia práctica entre ambos.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "estrategico_victorias_pasadas",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "En el análisis estratégico personal, ¿qué sugiere el video que hagas con tus victorias pasadas?",
        opciones: [
          "Solo listarlas sin más detalles.",
          "Ignorarlas y enfocarte en nuevas metas.",
          "Revisarlas para encontrar patrones que expliquen por qué tuviste éxito.",
          "Compartirlas en redes sociales para demostrar competencia.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "estrategico_diseno_entorno",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "Según el capítulo sobre diseño del entorno, los cambios en la vida práctica se recomiendan para facilitar buenas decisiones diarias.",
        opciones: [
          "Verdadero.",
          "Falso.",
        ],
        correcta: 0,
        obligatoria: true,
      },
      {
        id: "estrategico_riesgo_asimetrico",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "¿Cómo describe el video el concepto de riesgo asimétrico?",
        opciones: [
          "Riesgos en los que la pérdida supera siempre la ganancia.",
          "Riesgos que deben evitarse a toda costa.",
          "Oportunidades donde el potencial de ganancia es mucho mayor que la desventaja potencial.",
          "Una predicción exacta del resultado de una decisión.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "estrategico_meta_habilidades",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "Para aprender de forma estratégica, ¿qué recomienda el video como prioridad?",
        opciones: [
          "Aprender muchas habilidades al azar.",
          "Enfocarse en meta-habilidades que facilitan aprender otras cosas.",
          "Evitar habilidades fuera de tu campo.",
          "Memorizar datos sin integrar conocimientos.",
        ],
        correcta: 1,
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Quiz pre-sesión Sesión 6: Cómo lidiar con la depresión
  // Comprensión del video de trabajo previo. 5 preguntas de opción múltiple.
  // ───────────────────────────────────────────────────────────────────
  "coaching-depresion-s6": {
    titulo: "Quiz: Cómo lidiar con la depresión",
    introEyebrow: "Pre-sesión · Sesión 7",
    introTitle: "Cómo lidiar con la depresión",
    introLead: [
      "Este quiz tiene 5 preguntas basadas en el video de trabajo previo sobre la depresión, la intervención médica y la higiene mental.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "depresion_tratamiento_medico",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "Según el orador, ¿cuál es una razón importante para considerar un tratamiento médico (por ejemplo, antidepresivos) en una depresión severa?",
        opciones: [
          "Porque la depresión nunca mejora con intervenciones conductuales.",
          "La depresión puede ser fisiológicamente dañina y con alto riesgo de suicidio.",
          "Porque los antidepresivos garantizan la solución de problemas de vida complejos.",
          "Porque la terapia conductual es inútil en todos los casos.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "depresion_dominio_minimo",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "¿Qué significa, en el contexto del video, restringir el evento anómalo al dominio mínimo necesario (constrain the anomalous event to the minimal necessary domain)?",
        opciones: [
          "Exagerar el error para provocar un cambio radical en la identidad propia.",
          "Interpretar un fallo puntual como una evidencia de fracaso total de la vida o la carrera.",
          "Limitar la interpretación negativa de un suceso para evitar que desencadene una cascada de autocrítica.",
          "Evitar planear soluciones y esperar a que las cosas se resuelvan solas.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "depresion_sensacion_significado",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "El orador describe la sensación de significado como:",
        opciones: [
          "Una ilusión sin relevancia para el comportamiento humano.",
          "Un marcador psicofisiológico que orienta a la persona y sugiere que está actuando adecuadamente.",
          "Algo exclusivo de las personas extrovertidas.",
          "Un sustituto de la rutina y la disciplina.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "depresion_rutinas",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "¿Cuál de las siguientes ideas sobre las rutinas y la salud mental se menciona explícitamente en el video?",
        opciones: [
          "No tener rutina ni horarios no afecta el estado de ánimo.",
          "Mantener una rutina (hora de despertarse, comer) ayuda a regular el sistema nervioso y el ánimo.",
          "Comer menos por la mañana mejora la energía de forma consistente.",
          "Evitar relaciones íntimas favorece la estabilidad emocional.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "depresion_aprendizaje_errores",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "¿Qué punto hace el orador acerca del aprendizaje y de cometer errores al perseguir intereses nuevos?",
        opciones: [
          "Debes esperar hasta tener la idea perfecta antes de actuar.",
          "Hacerlo mal al principio es una parte necesaria del aprendizaje y es preferible a no intentarlo.",
          "Evitar ser torpe al empezar te convertirá en maestro más rápido.",
          "Los errores iniciales indican que no debes seguir con ese interés.",
        ],
        correcta: 1,
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Reflexión personal Sesión 6: El Observador Fenomenológico
  // ───────────────────────────────────────────────────────────────────
  "coaching-reflexion-s6": {
    titulo: "Reflexión personal",
    introEyebrow: "Sesión 7 · El Observador Fenomenológico",
    introTitle: "Reflexión personal: El Observador Fenomenológico",
    introLead: [
      "Objetivo de la sesión: comprender los fundamentos de la fenomenología y su aplicación práctica para observar la realidad del cliente sin prejuicios.",
      "Tómate unos minutos para reflexionar con honestidad sobre la siguiente pregunta antes de la sesión en vivo. Tu respuesta se guarda en el portal y la podrás revisar más adelante.",
    ],
    doneTitle: "Reflexión guardada",
    doneLead: "Tu reflexión quedó registrada. Llévala contigo a la sesión 6.",
    preguntas: [
      {
        id: "reflexion_suspender_juicios",
        tipo: "texto",
        eyebrow: "Pregunta reflexiva",
        texto: "Si lograra suspender todos mis juicios previos durante diez minutos de sesión, ¿qué verdades del cliente empezarían a emerger que antes me eran invisibles?",
        placeholder: "Escribe con honestidad. No hay respuesta correcta.",
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Journaling Sesión 6: El Observador Fenomenológico
  // ───────────────────────────────────────────────────────────────────
  "coaching-journaling-s6": {
    titulo: "Journaling de la semana",
    introEyebrow: "Semana 7 · El Observador Fenomenológico",
    introTitle: "Journaling: El Observador Fenomenológico",
    introLead: [
      "Objetivo: aplicar los principios fenomenológicos al coaching para una observación pura.",
      "Desafío de la semana: describe un objeto o una emoción de tu cliente durante 2 minutos usando solo lenguaje descriptivo, sin interpretaciones subjetivas.",
    ],
    doneTitle: "Journaling guardado",
    doneLead: "Tu entrada quedó registrada. Volveremos a estos hallazgos en próximas sesiones.",
    preguntas: [
      {
        id: "journaling_causas_vs_fenomeno",
        tipo: "texto",
        eyebrow: "Reflexión de la semana",
        texto: "¿Cómo cambia la sesión cuando dejo de buscar “causas” y empiezo a observar el “fenómeno” tal como se presenta?",
        placeholder: "Anota tu reflexión. Trabajaremos sobre estos hallazgos en las próximas sesiones.",
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Evaluación Sesión 6: Fenomenología y Coaching
  // Quiz CON SCORE — 5 preguntas con respuesta correcta marcada.
  // ───────────────────────────────────────────────────────────────────
  "coaching-evaluacion-s6": {
    titulo: "Evaluación · Sesión 7",
    introEyebrow: "Evaluación · Sesión 7",
    introTitle: "Fenomenología y Coaching",
    introLead: [
      "Esta evaluación tiene 5 preguntas de opción múltiple sobre la fenomenología aplicada al coaching: la epoché, la empatía no apropiativa, el rostro del otro y la pregunta fenomenológica.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Necesitas al menos 60% para aprobar y avanzar. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "fenom_epoche",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "¿Qué propone la “epoché” (inspirada en Husserl) como actitud fundamental del coach?",
        opciones: [
          "Analizar las causas psicológicas del pasado del coachee para dar un diagnóstico.",
          "Suspender juicios, teorías y expectativas previas para recibir la experiencia tal como se da.",
          "Dirigir al coachee hacia una solución rápida basada en la experiencia del coach.",
          "Comparar la historia del coachee con casos similares para encontrar un patrón.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "fenom_empatia_stein",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "Según Edith Stein, ¿cuál es la característica principal de la “empatía no apropiativa”?",
        opciones: [
          "Sentir exactamente lo mismo que el coachee para mimetizarse con él.",
          "Imaginar que uno es el coachee para darle consejos desde su lugar.",
          "Captar la vivencia del otro como algo “otro”, respetando su alteridad sin absorberla ni juzgarla.",
          "Ignorar las emociones del coachee para mantener la objetividad técnica.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "fenom_levinas_rostro",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "En la filosofía de Levinas aplicada al coaching, ¿qué implica “estar ante el rostro del otro”?",
        opciones: [
          "Observar las microexpresiones faciales para detectar mentiras.",
          "Reconocer que el otro es una categoría de mi propia conciencia.",
          "Aceptar una responsabilidad ética donde el coach acompaña sin imponer una agenda ni querer “arreglar” al coachee.",
          "Mantener contacto visual forzado para demostrar autoridad.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "fenom_pregunta_fenomenologica",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "¿Cuál es la principal diferencia entre una pregunta explicativa y una pregunta fenomenológica?",
        opciones: [
          "La explicativa busca el “cómo” y la fenomenológica busca el “por qué”.",
          "La explicativa busca causas y justificaciones; la fenomenológica busca la descripción rigurosa de la vivencia (forma, peso, sensación).",
          "No hay diferencia; ambas buscan que el coachee entienda su pasado.",
          "La pregunta fenomenológica siempre debe ser cerrada para evitar confusiones.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "fenom_dejar_emerger_sentido",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "¿Cómo debe actuar el coach para “dejar emerger el sentido” durante la sesión?",
        opciones: [
          "Proponiendo metáforas propias que le parezcan poéticas al coach.",
          "Reformulando lo que dice el coachee con interpretaciones técnicas (“esto que dices es ansiedad”).",
          "Favoreciendo el lenguaje del coachee y manteniendo silencios que den espacio a que el sentido tome forma por sí mismo.",
          "Concluyendo la sesión con una enseñanza moral sobre lo aprendido.",
        ],
        correcta: 2,
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Quiz pre-sesión Sesión 7: El efecto Super Mario y el fracaso
  // Comprensión del video de trabajo previo. 5 preguntas de opción múltiple.
  // ───────────────────────────────────────────────────────────────────
  "coaching-fracaso-s7": {
    titulo: "Quiz: El efecto Super Mario y el fracaso",
    introEyebrow: "Pre-sesión · Sesión 6",
    introTitle: "El fracaso como combustible",
    introLead: [
      "Este quiz tiene 5 preguntas basadas en el video de trabajo previo sobre el efecto Super Mario, el fracaso y el diseño de la vida.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "fracaso_metafora",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "Según el video, ¿qué metáfora usa el entrevistado para explicar cómo debemos ver el fracaso?",
        opciones: [
          "Un mapa del tesoro.",
          "Un videojuego (efecto Super Mario).",
          "Una carrera de obstáculos.",
          "Un rompecabezas.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "fracaso_conexion_emocional",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "¿Cuál es una razón que el entrevistado da para que sus videos conecten emocionalmente con la audiencia?",
        opciones: [
          "Prioriza datos técnicos y hojas de especificaciones.",
          "Evoca una respuesta visceral y emoción en los espectadores.",
          "Usa gráficos complejos que impresionan a los expertos.",
          "Evita el humor para mantener seriedad científica.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "fracaso_miedo_publico",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "¿Qué estrategia recomienda el entrevistado para superar el miedo a fallar en público?",
        opciones: [
          "Evitar exponerse hasta estar completamente preparado.",
          "Empezar con metas pequeñas y “fallar” intencionalmente para normalizarlo.",
          "Pedir siempre la aprobación de un mentor antes de actuar.",
          "No practicar y confiar en el talento natural.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "fracaso_esconder_verduras",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "¿Qué significa “esconder las verduras” en el enfoque del creador de contenidos?",
        opciones: [
          "Añadir información técnica oculta en la descripción del video.",
          "Disfrazar el aprendizaje en entretenimiento para atraer atención.",
          "Omitir los experimentos difíciles para simplificar el contenido.",
          "Enseñar solo a estudiantes avanzados para no confundir a principiantes.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "fracaso_vida_plena",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "¿Cuál de las siguientes ideas NO forma parte de la visión del entrevistado sobre una vida más plena?",
        opciones: [
          "Priorizar relaciones y vivir según valores personales.",
          "Buscar incrementos graduales y evitar quemarse por metas rápidas.",
          "Creer que la felicidad solo se alcanza con más dinero y posesiones.",
          "Practicar gratitud como herramienta para reajustar la perspectiva.",
        ],
        correcta: 2,
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Reflexión personal Sesión 7: El Lenguaje del Rapport y la Imaginación
  // ───────────────────────────────────────────────────────────────────
  "coaching-reflexion-s7": {
    titulo: "Reflexión personal",
    introEyebrow: "Sesión 6 · Las Preguntas del Acaso",
    introTitle: "Reflexión personal: El Lenguaje del Rapport y la Imaginación",
    introLead: [
      "Objetivo de la sesión: utilizar el lenguaje para construir rapport y crear preguntas de imaginación que promuevan la autoconciencia y el compromiso.",
      "Tómate unos minutos para reflexionar con honestidad sobre la siguiente pregunta antes de la sesión en vivo. Tu respuesta se guarda en el portal y la podrás revisar más adelante.",
    ],
    doneTitle: "Reflexión guardada",
    doneLead: "Tu reflexión quedó registrada. Llévala contigo a la sesión 7.",
    preguntas: [
      {
        id: "reflexion_metaforas_imagenes",
        tipo: "texto",
        eyebrow: "Pregunta reflexiva",
        texto: "¿Cómo impacta el uso deliberado de metáforas e imágenes en la capacidad del cliente para comprometerse con su propia visión?",
        placeholder: "Escribe con honestidad. No hay respuesta correcta.",
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Journaling Sesión 7: El Lenguaje del Rapport y la Imaginación
  // ───────────────────────────────────────────────────────────────────
  "coaching-journaling-s7": {
    titulo: "Journaling de la semana",
    introEyebrow: "Semana 6 · Las Preguntas del Acaso",
    introTitle: "Journaling: El Lenguaje del Rapport y la Imaginación",
    introLead: [
      "Objetivo: utilizar el lenguaje para construir rapport y crear preguntas que promuevan la autoconciencia.",
      "Desafío de la semana: crea una pregunta de imaginación que invite al coachee a visualizar su meta desde un futuro donde el problema ya no existe.",
    ],
    doneTitle: "Journaling guardado",
    doneLead: "Tu entrada quedó registrada. Volveremos a estos hallazgos en próximas sesiones.",
    preguntas: [
      {
        id: "journaling_preguntas_acaso",
        tipo: "texto",
        eyebrow: "Reflexión de la semana",
        texto: "¿Cómo pueden las “preguntas del acaso” y de imaginación abrir puertas que la lógica racional mantiene cerradas?",
        placeholder: "Anota tu reflexión. Trabajaremos sobre estos hallazgos en las próximas sesiones.",
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Evaluación Sesión 7: Las Preguntas del Acaso
  // Quiz CON SCORE — 5 preguntas con respuesta correcta marcada.
  // ───────────────────────────────────────────────────────────────────
  "coaching-evaluacion-s7": {
    titulo: "Evaluación · Sesión 6",
    introEyebrow: "Evaluación · Sesión 6",
    introTitle: "Las Preguntas del Acaso",
    introLead: [
      "Esta evaluación tiene 5 preguntas de opción múltiple sobre el lenguaje del rapport, las preguntas de imaginación y los desplazamientos en el tiempo vistos en la sesión 7.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Necesitas al menos 60% para aprobar y avanzar. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "acaso_suavizadores",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "¿Cuál es la función principal de los “suavizadores” (softeners) como “tengo curiosidad por...” al inicio de una pregunta?",
        opciones: [
          "Hacer que la sesión dure más tiempo.",
          "Reducir la tensión, eliminar la sensación de juicio y abrir espacio para la reflexión profunda.",
          "Demostrar que el coach tiene más conocimiento que el coachee.",
          "Evitar que el coachee responda con honestidad.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "acaso_nombrar_resultado",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "El marco de “nombrar el resultado” (naming the outcome) consiste en pedir permiso al coachee para:",
        opciones: [
          "Terminar la sesión antes de tiempo.",
          "Cambiar el precio de las sesiones de coaching.",
          "Dirigir la conversación hacia el objetivo acordado, asegurando que la pregunta esté al servicio del coachee.",
          "Darle un consejo directo sobre lo que debe hacer con su vida.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "acaso_visual_creativo",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "Según la metodología, ¿qué diferencia hay entre el pensamiento “no creativo” y el “sistema visual creativo”?",
        opciones: [
          "El no creativo es visual y el creativo es solo de lenguaje.",
          "El no creativo se organiza en bucles auditivos (diálogos internos limitantes), mientras que el sistema visual se activa con la imaginación y escenarios “como si”.",
          "No hay diferencia; el cerebro siempre piensa de la misma manera.",
          "El pensamiento creativo solo ocurre cuando el coachee está dormido.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "acaso_time_shift",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "¿A qué tipo de desplazamiento pertenece la pregunta: “Imagina que han pasado seis meses... ¿qué ha cambiado desde que lograste tu meta?”?",
        opciones: [
          "Desplazamiento de culpa.",
          "Desplazamiento en el tiempo (time shift).",
          "Pregunta de escala numérica.",
          "Retroalimentación reflejante.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "acaso_preguntas_puerta",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "¿Qué se busca lograr con las “preguntas botón o puerta” (como la pregunta milagro)?",
        opciones: [
          "Cerrar la sesión de forma abrupta.",
          "Romper la sensación de bloqueo imaginando que el problema desaparece de repente para identificar cambios.",
          "Evaluar el desempeño del coach durante el último mes.",
          "Obligar al coachee a firmar un nuevo contrato financiero.",
        ],
        correcta: 1,
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Quiz pre-sesión Sesión 8: La psicología detrás de las personas infelices
  // Comprensión del video de trabajo previo. 5 preguntas de opción múltiple.
  // ───────────────────────────────────────────────────────────────────
  "coaching-infelicidad-s8": {
    titulo: "Quiz: La psicología detrás de las personas infelices",
    introEyebrow: "Pre-sesión · Sesión 8",
    introTitle: "La psicología detrás de las personas infelices",
    introLead: [
      "Este quiz tiene 5 preguntas basadas en el video de trabajo previo sobre la infelicidad, el sesgo de negatividad y el estrés crónico.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "infelicidad_definicion",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "Según el orador, ¿cómo define principalmente la infelicidad?",
        opciones: [
          "Como la ausencia de bienes materiales.",
          "Como la incapacidad de estar a gusto en el momento presente.",
          "Como una enfermedad exclusivamente biológica.",
          "Como la falta de relaciones sociales profundas.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "infelicidad_causas",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "¿Cuál de las siguientes NO es una de las cinco causas principales de la infelicidad mencionadas en el video?",
        opciones: [
          "Buscar el bienestar fuera de uno mismo.",
          "Poner la atención en lo negativo.",
          "Tener una dieta equilibrada y ejercicio moderado.",
          "Envenenarse con estrés crónico.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "infelicidad_sesgo_negatividad",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "¿Qué explica el orador sobre el “sesgo de negatividad”?",
        opciones: [
          "Que solo existe en culturas orientales.",
          "Que el cerebro presta más atención a lo negativo por supervivencia.",
          "Que hace a las personas incapaces de sentir emociones positivas.",
          "Que se corrige automáticamente con el tiempo sin intervención.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "infelicidad_sindrome_hollywood",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "El “síndrome de Hollywood” al que se refiere el orador describe:",
        opciones: [
          "La tendencia a idealizar celebridades como ejemplo de felicidad.",
          "La creatividad necesaria para resolver problemas emocionales.",
          "La mente creando historias ficticias donde uno es siempre el protagonista.",
          "Un método terapéutico basado en guiones de cine.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "infelicidad_estres_cronico",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "¿Qué resultado provoca, según el video, el estrés crónico en el cuerpo y la mente?",
        opciones: [
          "Aumento de serotonina y mayor sensación de bienestar.",
          "Desregulación del sistema nervioso y aumento de cortisol.",
          "Mejora del sueño y mayor capacidad de descanso.",
          "Eliminación de la ansiedad de forma natural.",
        ],
        correcta: 1,
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Reflexión personal Sesión 8: Biología del Cambio
  // ───────────────────────────────────────────────────────────────────
  "coaching-reflexion-s8": {
    titulo: "Reflexión personal",
    introEyebrow: "Sesión 8 · Neurociencia del Coaching",
    introTitle: "Reflexión personal: Biología del Cambio",
    introLead: [
      "Objetivo de la sesión: aplicar los fundamentos neurocientíficos (reptiliano, límbico, corteza) para entender el desarrollo cerebral a través del coaching.",
      "Tómate unos minutos para reflexionar con honestidad sobre la siguiente pregunta antes de la sesión en vivo. Tu respuesta se guarda en el portal y la podrás revisar más adelante.",
    ],
    doneTitle: "Reflexión guardada",
    doneLead: "Tu reflexión quedó registrada. Llévala contigo a la sesión 8.",
    preguntas: [
      {
        id: "reflexion_calmar_limbico",
        tipo: "texto",
        eyebrow: "Pregunta reflexiva",
        texto: "¿Cómo puedo adaptar mis preguntas para calmar la respuesta del cerebro límbico de mi cliente y permitir que su corteza prefrontal acceda a soluciones creativas?",
        placeholder: "Escribe con honestidad. No hay respuesta correcta.",
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Journaling Sesión 8: Biología del Cambio
  // ───────────────────────────────────────────────────────────────────
  "coaching-journaling-s8": {
    titulo: "Journaling de la semana",
    introEyebrow: "Semana 8 · Neurociencia del Coaching",
    introTitle: "Journaling: Biología del Cambio",
    introLead: [
      "Objetivo: comprender los fundamentos neurocientíficos y la función del coaching en el desarrollo cerebral.",
      "Desafío de la semana: identifica un momento de “secuestro amigdalino” (estrés) en un cliente y reflexiona qué pregunta podría haber activado su corteza prefrontal.",
    ],
    doneTitle: "Journaling guardado",
    doneLead: "Tu entrada quedó registrada. Volveremos a estos hallazgos en próximas sesiones.",
    preguntas: [
      {
        id: "journaling_limbico_vs_corteza",
        tipo: "texto",
        eyebrow: "Reflexión de la semana",
        texto: "¿Estoy comunicándome con el cerebro límbico (emoción) o con la corteza (razón) de mi cliente en los momentos críticos?",
        placeholder: "Anota tu reflexión. Trabajaremos sobre estos hallazgos en las próximas sesiones.",
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Evaluación Sesión 8: Neurociencia en el Coaching
  // Quiz CON SCORE — 5 preguntas con respuesta correcta marcada.
  // ───────────────────────────────────────────────────────────────────
  "coaching-evaluacion-s8": {
    titulo: "Evaluación · Sesión 8",
    introEyebrow: "Evaluación · Sesión 8",
    introTitle: "Neurociencia en el Coaching",
    introLead: [
      "Esta evaluación tiene 5 preguntas de opción múltiple sobre la teoría de los tres cerebros, la neuroplasticidad y la regulación de la amígdala vistos en la sesión 8.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Necesitas al menos 60% para aprobar y avanzar. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "neuro_reptiliano",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "Según la teoría de los “tres cerebros”, ¿cuál es la función principal del sistema reticular (cerebro reptiliano) en el comportamiento humano?",
        opciones: [
          "La planificación de metas a largo plazo y el pensamiento lógico.",
          "La gestión de emociones complejas y el trabajo en equipo.",
          "La supervivencia inmediata y las reacciones automáticas de “lucha o huida”.",
          "La creación de metáforas y visualizaciones artísticas.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "neuro_limbico_tonal",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "El sistema límbico (cerebro mamífero) se caracteriza por ser “tonal” y “auditivo”. ¿Cómo se aplica esto en el coaching SOPHIA?",
        opciones: [
          "El coach debe hablar siempre lo más fuerte posible para imponer autoridad.",
          "El coachee solo puede aprender si escucha música durante la sesión.",
          "Los matices en el tono de voz del coach activan la confianza o la defensa emocional del coachee.",
          "El cerebro límbico no tiene relación con el lenguaje, solo con el hambre.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "neuro_neocorteza",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "¿Qué capacidad exclusiva de la neocorteza (cerebro cortical) permite que el coaching sea una herramienta de transformación hacia el futuro?",
        opciones: [
          "La capacidad de retirar la mano rápidamente del fuego.",
          "La capacidad de crear construcciones visuales, mapas mentales y escenarios “como si” (proyección prospectiva).",
          "La función de sentir miedo ante lo desconocido para evitar el cambio.",
          "El almacenamiento de grasa corporal para épocas de escasez.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "neuro_dopamina",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "¿Qué ocurre a nivel neurocientífico cuando un coach utiliza lenguaje positivo y visualización guiada?",
        opciones: [
          "Se bloquea la corteza prefrontal y el coachee entra en un estado de sueño.",
          "Se estimula la producción de dopamina y se fomenta la neuroplasticidad para crear nuevas rutas neuronales.",
          "El cerebro se agota y pierde la capacidad de tomar decisiones.",
          "Se activan únicamente los instintos de supervivencia del tronco encefálico.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "neuro_miedo",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "El “miedo” en el coaching es definido como la “imaginación del fracaso”. ¿Cuál es el rol del coach para gestionar esta emoción desde la neurociencia?",
        opciones: [
          "Ignorar el miedo y obligar al coachee a actuar sin pensar.",
          "Usar preguntas que activen la corteza prefrontal para regular la amígdala y “reescribir la escena” mediante visualización positiva.",
          "Darle la razón al coachee para que se sienta cómodo en su zona de confort.",
          "Analizar el trauma infantil que causó el miedo durante toda la sesión.",
        ],
        correcta: 1,
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Quiz pre-sesión Sesión 9: La ingeniería de la fortaleza mental
  // Comprensión del video de trabajo previo (Hormozi). 5 preguntas con score.
  // ───────────────────────────────────────────────────────────────────
  "coaching-fortaleza-s9": {
    titulo: "Quiz: La ingeniería de la fortaleza mental",
    introEyebrow: "Pre-sesión · Sesión 9",
    introTitle: "La ingeniería de la fortaleza mental",
    introLead: [
      "Este quiz tiene 5 preguntas basadas en el video de trabajo previo de Alex Hormozi sobre la dureza mental y sus cuatro variables: tolerancia, entereza, resiliencia y adaptabilidad.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "fortaleza_definicion",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "¿Cómo define el orador la “dureza mental”?",
        opciones: [
          "La capacidad de ocultar las emociones ante otros.",
          "La probabilidad de que un evento negativo cambie tu comportamiento en contra de tus metas.",
          "La habilidad de trabajar muchas horas seguidas.",
          "La ausencia total de sentimientos negativos.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "fortaleza_componentes",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "Según el modelo del video, ¿cuál de los siguientes NO es uno de los cuatro componentes de la dureza mental?",
        opciones: [
          "Tolerancia.",
          "Fortaleza (entereza).",
          "Creatividad.",
          "Adaptabilidad.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "fortaleza_resiliencia",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "¿Qué mide específicamente la “resiliencia” en el esquema presentado?",
        opciones: [
          "Cuánto empeoras permanentemente después de un evento negativo.",
          "El tiempo que tarda en volver a una nueva línea base después de un cambio de comportamiento.",
          "La intensidad inmediata de la reacción emocional.",
          "La cantidad de eventos negativos que puedes soportar sin cambiar de trabajo.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "fortaleza_baja_entereza",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "¿Cuál es un ejemplo de baja entereza (low fortitude) según el orador?",
        opciones: [
          "Respirar hondo y volver al trabajo en 5 minutos.",
          "Cambiar drásticamente tu comportamiento, como dejar el empleo o recurrir a sustancias, ante una adversidad menor.",
          "Mantener exactamente la misma conducta sin ninguna alteración.",
          "Usar el evento negativo para mejorar y subir tu nueva línea base.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "fortaleza_biologia",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "¿Qué relación establece el orador entre cuidado biológico (sueño, comida) y dureza mental?",
        opciones: [
          "No hay relación; la dureza mental es puramente genética.",
          "Un peor estado biológico reduce la tolerancia y la resiliencia.",
          "Dormir menos siempre aumenta la tolerancia.",
          "Comer poco mejora la adaptabilidad.",
        ],
        correcta: 1,
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Reflexión personal Sesión 9: Niveles de Atención y Escucha Profunda
  // ───────────────────────────────────────────────────────────────────
  "coaching-reflexion-s9": {
    titulo: "Reflexión personal",
    introEyebrow: "Sesión 9 · Niveles Existenciales",
    introTitle: "Reflexión personal: Niveles de Atención y Escucha Profunda",
    introLead: [
      "Objetivo de la sesión: organizar la información según niveles de atención para percibir significados ocultos y co-crear planes de acción alineados.",
      "Tómate unos minutos para reflexionar con honestidad sobre la siguiente pregunta antes de la sesión en vivo. Tu respuesta se guarda en el portal y la podrás revisar más adelante.",
    ],
    doneTitle: "Reflexión guardada",
    doneLead: "Tu reflexión quedó registrada. Llévala contigo a la sesión 9.",
    preguntas: [
      {
        id: "reflexion_nivel_significado",
        tipo: "texto",
        eyebrow: "Pregunta reflexiva",
        texto: "¿A qué nivel de significado suelo prestar más atención y qué dimensiones de la experiencia del cliente estoy ignorando por hábito?",
        placeholder: "Escribe con honestidad. No hay respuesta correcta.",
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Journaling Sesión 9: Niveles de Atención y Escucha Profunda
  // ───────────────────────────────────────────────────────────────────
  "coaching-journaling-s9": {
    titulo: "Journaling de la semana",
    introEyebrow: "Semana 9 · Niveles Existenciales",
    introTitle: "Journaling: Niveles de Atención y Escucha Profunda",
    introLead: [
      "Objetivo: desarrollar la escucha multinivel y evocar conciencia profunda.",
      "Desafío de la semana: durante una sesión, intenta “subir” un nivel de escucha, de los hechos (datos) a los valores o la identidad del cliente.",
    ],
    doneTitle: "Journaling guardado",
    doneLead: "Tu entrada quedó registrada. Volveremos a estos hallazgos en próximas sesiones.",
    preguntas: [
      {
        id: "journaling_nivel_escucha",
        tipo: "texto",
        eyebrow: "Reflexión de la semana",
        texto: "¿En qué nivel de atención (datos, emoción, identidad o esencia) suelo situar mi escucha de manera predominante?",
        placeholder: "Anota tu reflexión. Trabajaremos sobre estos hallazgos en las próximas sesiones.",
        obligatoria: true,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // Coaching · Evaluación Sesión 9: Niveles Existenciales
  // Quiz CON SCORE — 5 preguntas con respuesta correcta marcada.
  // ───────────────────────────────────────────────────────────────────
  "coaching-evaluacion-s9": {
    titulo: "Evaluación · Sesión 9",
    introEyebrow: "Evaluación · Sesión 9",
    introTitle: "Niveles Existenciales",
    introLead: [
      "Esta evaluación tiene 5 preguntas de opción múltiple sobre la jerarquía de los niveles existenciales, la confusión entre acción e identidad y la escucha multinivel vistas en la sesión 9.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Necesitas al menos 60% para aprobar y avanzar. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "niveles_jerarquia",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "Según el principio de jerarquía de los Niveles Existenciales, ¿qué sucede cuando se produce un cambio en un nivel superior (por ejemplo, Identidad o Valores)?",
        opciones: [
          "No tiene ningún efecto en los niveles de abajo.",
          "Organiza y transforma automáticamente los niveles inferiores (Capacidades, Acciones, Entorno).",
          "El coachee se confunde y deja de actuar.",
          "Solo cambia el entorno físico, pero no lo que la persona hace.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "niveles_confusion_identidad",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "El coach nota que un coachee dice: “Soy un fracasado porque llegué tarde a la reunión”. ¿Qué confusión de niveles está ocurriendo aquí?",
        opciones: [
          "Confusión entre Capacidad y Entorno.",
          "Confusión entre Acción (comportamiento) e Identidad (quién soy).",
          "Confusión entre Legado y Visión.",
          "No hay confusión, es una observación correcta de la realidad.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "niveles_bloqueo_capacidad",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "Si un coachee se siente bloqueado porque “no sabe cómo empezar un proyecto”, ¿en qué nivel existencial debería intervenir el coach con sus preguntas?",
        opciones: [
          "Nivel de Entorno (preguntar dónde está su oficina).",
          "Nivel de Identidad (preguntar quién necesita ser para lograrlo).",
          "Nivel de Capacidad (preguntar cómo podría desarrollar las habilidades necesarias).",
          "Nivel de Legado (preguntar qué dirán de él en 100 años).",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "niveles_observar_continuar",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "¿Cuál es el propósito de la tarea de coaching llamada “Observar (continuar)”?",
        opciones: [
          "Criticar los errores del pasado para no repetirlos.",
          "Desplazar el enfoque hacia lo que ya funciona (excepciones positivas) para que el coachee descubra tendencias constructivas.",
          "Obligar al coachee a escribir 10 páginas diarias sobre sus problemas.",
          "Que el coachee vigile a sus compañeros de trabajo.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "niveles_legado_maestria",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "En la metodología SOPHIA, ¿cuál es la pregunta clave para explorar el nivel de “Legado / Maestría”?",
        opciones: [
          "¿Qué vas a comer mañana?",
          "¿Por qué es importante esto para ti hoy?",
          "Si tu transformación dejara una huella permanente en el mundo dentro de 100 años, ¿cuál sería esa obra?",
          "¿Dónde y con quién vas a realizar esta acción?",
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
  },

  // ─── Sesión 10 · Niveles Existenciales 2 ───
  "coaching-mundo-interior-s10": {
    titulo: "Quiz: Deja de intentar trabajar más duro",
    introEyebrow: "Pre-sesión · Sesión 10",
    introTitle: "Tu mundo interior como motor del progreso",
    introLead: [
      "Este quiz tiene 5 preguntas basadas en el video de trabajo previo (\"Stop trying to work harder\") sobre cómo tu propio mundo interior, más que las circunstancias externas, determina el avance en tu carrera profesional.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "mundo_interior_factor",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "Según el video, ¿cuál es el factor que con más frecuencia impide el progreso en la carrera profesional?",
        opciones: [
          "Falta de conexiones y networking.",
          "La propia persona y cómo maneja su mundo interior.",
          "La ausencia de títulos universitarios prestigiosos.",
          "La economía y la automatización.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "mundo_interior_rasgo",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "El presentador comenta estudios sobre rasgos de personalidad. ¿Qué rasgo aparece frecuentemente asociado a la satisfacción laboral si se usa correctamente?",
        opciones: [
          "Neuroticismo.",
          "Apertura a ideas.",
          "Conciencia (conscientiousness).",
          "Hostilidad.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "mundo_interior_resiliencia",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "¿Qué estrategia recomienda el video para mejorar la resiliencia profesional cuando el mundo externo es más difícil?",
        opciones: [
          "Depender únicamente de la suerte y esperar oportunidades.",
          "Optimizar y trabajar en el mundo interno propio (auto-trabajo).",
          "Aumentar radicalmente las horas de trabajo sin límites.",
          "Evitar cualquier tipo de planificación a largo plazo.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "mundo_interior_neuroticismo",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "Sobre el neuroticismo, el video sugiere que lo más sano es:",
        opciones: [
          "Reprimir la ansiedad hasta que desaparezca.",
          "Usar la preocupación para identificar problemas y crear planes concretos.",
          "Ignorar las señales internas y seguir trabajando más duro.",
          "Cambiar de carrera inmediatamente para evitar el estrés.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "mundo_interior_practica",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "¿Qué práctica concreta propone el presentador para avanzar desde un trabajo sin crecimiento hacia un trabajo deseado?",
        opciones: [
          "Quejarse públicamente en redes sociales para atraer atención.",
          "Elegir un trabajo aleatorio y esperar una promoción.",
          "Planificar por pasos, invertir el trabajo soñado y crear una lista de tareas a 5–7 años.",
          "Evitar formación adicional y confiar en que el jefe notará el esfuerzo.",
        ],
        correcta: 2,
        obligatoria: true,
      },
    ],
  },

  "coaching-reflexion-s10": {
    titulo: "Reflexión personal",
    introEyebrow: "Sesión 10 · Niveles Existenciales 2",
    introTitle: "Reflexión personal: La Experiencia Integradora Existencial",
    introLead: [
      "Objetivo de la sesión: utilizar las hojas de trabajo de niveles existenciales para evocar conciencia, facilitar la acción y compartir apreciación profunda.",
      "Tómate unos minutos para reflexionar con honestidad sobre la siguiente pregunta antes de la sesión en vivo. Tu respuesta se guarda en el portal y la podrás revisar más adelante.",
    ],
    doneTitle: "Reflexión guardada",
    doneLead: "Tu reflexión quedó registrada. Llévala contigo a la sesión 10.",
    preguntas: [
      {
        id: "reflexion_apreciacion_niveles",
        tipo: "texto",
        eyebrow: "Pregunta reflexiva",
        texto: "Al compartir apreciación utilizando los niveles existenciales, ¿cómo se transforma la conexión y el reconocimiento de la identidad del coachee?",
        placeholder: "Escribe con honestidad. No hay respuesta correcta.",
        obligatoria: true,
      },
    ],
  },

  "coaching-journaling-s10": {
    titulo: "Journaling de la semana",
    introEyebrow: "Semana 10 · Niveles Existenciales 2",
    introTitle: "Journaling: La Experiencia Integradora Existencial",
    introLead: [
      "Objetivo: integrar la hoja de trabajo de Niveles Existenciales para co-crear planes de acción alineados.",
      "Desafío de la semana: utiliza la hoja de trabajo de Niveles Existenciales con un compañero y anota el impacto que tuvo en su nivel de compromiso.",
    ],
    doneTitle: "Journaling guardado",
    doneLead: "Tu entrada quedó registrada. Volveremos a estos hallazgos en próximas sesiones.",
    preguntas: [
      {
        id: "journaling_apreciacion_niveles",
        tipo: "texto",
        eyebrow: "Reflexión de la semana",
        texto: "¿Cómo transforma la sesión el hecho de compartir una apreciación basada en los Niveles Existenciales?",
        placeholder: "Anota tu reflexión. Trabajaremos sobre estos hallazgos en las próximas sesiones.",
        obligatoria: true,
      },
    ],
  },

  "coaching-evaluacion-s10": {
    titulo: "Evaluación · Sesión 10",
    introEyebrow: "Evaluación · Sesión 10",
    introTitle: "Los Niveles Existenciales como Proceso",
    introLead: [
      "Esta evaluación tiene 5 preguntas de opción múltiple sobre el proceso de coaching con Niveles Existenciales: el enfoque Top-Down, el trabajo de legado, la creación de confianza y la medición del avance vistos en la sesión 10.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Necesitas al menos 60% para aprobar y avanzar. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "eval_top_down",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "¿Por qué el coaching \"de arriba hacia abajo\" (Top-Down) se considera más transformador?",
        opciones: [
          "Porque es más rápido y requiere menos esfuerzo del coachee.",
          "Porque reorganiza la jerarquía interna; un cambio en la identidad o el legado transforma automáticamente las acciones y el entorno.",
          "Porque se enfoca únicamente en el entorno físico del coachee.",
          "Porque el coach da las órdenes desde una posición de autoridad.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "eval_legado",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "En la hoja de trabajo de los Niveles Existenciales, ¿cuál es el propósito de preguntar sobre el \"Legado (Maestría)\"?",
        opciones: [
          "Planificar la jubilación financiera del coachee.",
          "Conectar el cambio actual con una huella permanente y trascendente en el mundo (a 100 años vista).",
          "Identificar quiénes son los enemigos del coachee.",
          "Determinar cuánto dinero quiere ganar el coachee en el próximo mes.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "eval_confianza",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "Durante la fase de \"Crear Confianza y Seguridad\", ¿qué herramienta se sugiere para sintonizar con el coachee?",
        opciones: [
          "El uso de interrupciones constantes para demostrar atención.",
          "El uso de suavizadores (softeners) y la reformulación reflexiva.",
          "Ignorar el tono emocional del coachee para ser objetivo.",
          "Hablar únicamente de los problemas del coach.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "eval_nivel_identidad",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "¿A qué nivel existencial pertenece la pregunta: \"¿Qué cualidades quieres mostrar o qué tipo de persona serías al lograr esto?\"?",
        opciones: [
          "Acciones.",
          "Entorno.",
          "Identidad.",
          "Capacidades.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "eval_medicion",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "Al final de la sesión, en la etapa de \"Medición\", ¿qué herramienta se utiliza para confirmar el avance?",
        opciones: [
          "Un examen escrito de 20 preguntas.",
          "Una pregunta de escala (ej. \"¿Cómo sabrás que has avanzado en X?\").",
          "Una crítica constructiva sobre los errores del coachee.",
          "El cierre inmediato de la sesión sin preguntas.",
        ],
        correcta: 1,
        obligatoria: true,
      },
    ],
  },

  // ─── Sesión 11 · Laboratorio de Integración II (Lab 2) ───
  "coaching-trabajo-felicidad-s11": {
    titulo: "Quiz: ¿El trabajo te puede hacer feliz?",
    introEyebrow: "Pre-sesión · Sesión 11",
    introTitle: "¿El trabajo te puede hacer feliz?",
    introLead: [
      "Este quiz tiene 5 preguntas basadas en el video de trabajo previo (\"Can work make you happy?\") sobre el éxito ganado, el servicio a los demás y qué hace realmente que el trabajo produzca alegría.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "felicidad_idea_equivocada",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "Según el video, ¿cuál es la idea equivocada más común sobre el trabajo y la felicidad?",
        opciones: [
          "Que ganar reconocimiento o éxito puede garantizar la felicidad.",
          "Que el trabajo nunca puede traer felicidad.",
          "Que servir a los demás es irrelevante para la satisfacción laboral.",
          "Que lograr ingresos suficientes elimina toda insatisfacción.",
        ],
        correcta: 0,
        obligatoria: true,
      },
      {
        id: "felicidad_dos_cosas",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "¿Qué dos cosas principales dice el presentador que debes buscar en el trabajo para obtener verdadera felicidad?",
        opciones: [
          "Buen salario y título laboral prestigioso.",
          "Seguridad laboral y vacaciones largas.",
          "Éxito ganado y servicio a los demás.",
          "Flexibilidad horaria y reconocimiento público.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "felicidad_exito_ganado",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "¿Qué significa \"éxito ganado\" según el video?",
        opciones: [
          "Obtener poder sobre los demás en el trabajo.",
          "Sentir que creas valor y que ese valor es reconocido.",
          "Recibir aumentos salariales automáticos por antigüedad.",
          "Evitar responsabilidades para reducir el estrés.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "felicidad_experimento",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "En los experimentos mencionados, ¿qué actividad sencilla hizo que la gente empezara a gustar más de su trabajo?",
        opciones: [
          "Recibir un ascenso.",
          "Trabajar menos horas.",
          "Hacer café para compañeros y servir a otros.",
          "Cambiar de puesto dentro de la empresa.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "felicidad_otro_factor",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "Además del éxito ganado y el servicio, ¿qué otro factor afirma el presentador que contribuye a que el trabajo produzca alegría?",
        opciones: [
          "Hacer algo en lo que realmente seas bueno.",
          "Tener un título universitario prestigioso.",
          "Evitar la interacción con colegas.",
          "Priorizar únicamente la remuneración económica.",
        ],
        correcta: 0,
        obligatoria: true,
      },
    ],
  },

  "coaching-reflexion-s11": {
    titulo: "Reflexión personal",
    introEyebrow: "Sesión 11 · Laboratorio de Integración II",
    introTitle: "Reflexión personal: Laboratorio de Integración II",
    introLead: [
      "Objetivo de la sesión: refinar la escucha de niveles existenciales y la capacidad de evocar conciencia en un entorno controlado.",
      "Tómate unos minutos para reflexionar con honestidad sobre la siguiente pregunta antes de la sesión en vivo. Tu respuesta se guarda en el portal y la podrás revisar más adelante.",
    ],
    doneTitle: "Reflexión guardada",
    doneLead: "Tu reflexión quedó registrada. Llévala contigo a la sesión 11.",
    preguntas: [
      {
        id: "reflexion_crear_experiencia",
        tipo: "texto",
        eyebrow: "Pregunta reflexiva",
        texto: "¿Qué resistencia interna experimento al intentar \"crear una experiencia\" profunda en lugar de simplemente \"tener una conversación\"?",
        placeholder: "Escribe con honestidad. No hay respuesta correcta.",
        obligatoria: true,
      },
    ],
  },

  "coaching-journaling-s11": {
    titulo: "Journaling de la semana",
    introEyebrow: "Semana 11 · Laboratorio de Integración II",
    introTitle: "Journaling: Laboratorio de Integración II",
    introLead: [
      "Objetivo: consolidar la escucha y la evocación de conciencia a un nivel intermedio.",
      "Desafío de la semana: identifica una competencia de la ICF que hayas demostrado con éxito rotundo en esta sesión de laboratorio.",
    ],
    doneTitle: "Journaling guardado",
    doneLead: "Tu entrada quedó registrada. Volveremos a estos hallazgos en próximas sesiones.",
    preguntas: [
      {
        id: "journaling_evolucion_lab",
        tipo: "texto",
        eyebrow: "Reflexión de la semana",
        texto: "¿Cómo ha evolucionado mi capacidad de facilitar el insight desde el Laboratorio 1 hasta hoy?",
        placeholder: "Anota tu reflexión. Trabajaremos sobre estos hallazgos en las próximas sesiones.",
        obligatoria: true,
      },
    ],
  },

  // ─── Sesión 12 · Existencialismo ───
  "coaching-reflexion-s12": {
    titulo: "Reflexión personal",
    introEyebrow: "Sesión 12 · Existencialismo",
    introTitle: "Reflexión personal: La Escalera Existencial",
    introLead: [
      "Objetivo de la sesión: relacionar el existencialismo con el coaching a través de sus exponentes y aplicar la \"escalera existencial\" en la sesión.",
      "Tómate unos minutos para reflexionar con honestidad sobre la siguiente pregunta antes de la sesión en vivo. Tu respuesta se guarda en el portal y la podrás revisar más adelante.",
    ],
    doneTitle: "Reflexión guardada",
    doneLead: "Tu reflexión quedó registrada. Llévala contigo a la sesión 12.",
    preguntas: [
      {
        id: "reflexion_sostener_incertidumbre",
        tipo: "texto",
        eyebrow: "Pregunta reflexiva",
        texto: "Ante la libertad radical del cliente, ¿cuál es mi nivel de comodidad al sostener el vacío o la incertidumbre que surge en el proceso existencial?",
        placeholder: "Escribe con honestidad. No hay respuesta correcta.",
        obligatoria: true,
      },
    ],
  },

  "coaching-journaling-s12": {
    titulo: "Journaling de la semana",
    introEyebrow: "Semana 12 · Existencialismo",
    introTitle: "Journaling: La Escalera Existencial",
    introLead: [
      "Objetivo: relacionar el existencialismo con el coaching mediante la aplicación de la \"escalera existencial\".",
      "Desafío de la semana: analiza un dilema de un cliente bajo la premisa: \"¿Cómo está eligiendo el cliente ser libre en esta situación?\".",
    ],
    doneTitle: "Journaling guardado",
    doneLead: "Tu entrada quedó registrada. Volveremos a estos hallazgos en próximas sesiones.",
    preguntas: [
      {
        id: "journaling_libertad_responsabilidad",
        tipo: "texto",
        eyebrow: "Reflexión de la semana",
        texto: "¿De qué manera la responsabilidad y la libertad (ejes del existencialismo) están presentes en la meta de mi coachee?",
        placeholder: "Anota tu reflexión. Trabajaremos sobre estos hallazgos en las próximas sesiones.",
        obligatoria: true,
      },
    ],
  },

  "coaching-evaluacion-s12": {
    titulo: "Evaluación · Sesión 12",
    introEyebrow: "Evaluación · Sesión 12",
    introTitle: "Existencialismo y Coaching",
    introLead: [
      "Esta evaluación tiene 5 preguntas de opción múltiple sobre los exponentes del existencialismo (Kierkegaard, Sartre, Heidegger, Camus) y su aplicación al coaching a través de la Escalera Existencial vistos en la sesión 12.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Necesitas al menos 60% para aprobar y avanzar. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "eval_kierkegaard_angustia",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "Según Kierkegaard, ¿qué representa la \"Angustia\" en la vida del ser humano?",
        opciones: [
          "Una enfermedad mental que debe ser medicada de inmediato.",
          "El \"vértigo de la libertad\"; la parálisis ante la posibilidad infinita de elegir.",
          "Una falta de fe que indica que la persona es mala.",
          "Un sentimiento que solo experimentan las personas que no tienen éxito.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "eval_sartre_existencia",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "Jean-Paul Sartre afirma que \"la existencia precede a la esencia\". En el coaching, ¿qué significa esto para el coachee?",
        opciones: [
          "Que su destino ya está escrito y no puede cambiarlo.",
          "Que no nace con una \"naturaleza\" fija, sino que se define a sí mismo a través de sus acciones y elecciones libres.",
          "Que primero debe estudiar mucha filosofía antes de poder actuar.",
          "Que los demás son responsables de quién es él hoy.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "eval_heidegger_autenticidad",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "¿Cuál es la propuesta de Heidegger sobre la \"Autenticidad\" y el \"Dasein\"?",
        opciones: [
          "Seguir las modas y lo que \"la gente\" (das Man) dice para ser feliz.",
          "Vivir ignorando que vamos a morir para no sufrir.",
          "Salir del anonimato social y asumir la propia finitud (ser-para-la-muerte) para elegir una vida propia.",
          "Cambiar de personalidad cada día para ser más flexible.",
        ],
        correcta: 2,
        obligatoria: true,
      },
      {
        id: "eval_camus_rebelion",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "Albert Camus introduce el concepto de \"Rebelión\" frente al \"Absurdo\". ¿Cómo se aplica esto en una sesión de coaching?",
        opciones: [
          "Incitando al coachee a pelear con su jefe y su familia.",
          "Ayudando al coachee a crear sentido y dignidad a través de su acción, incluso cuando el mundo parece no tener respuestas claras.",
          "Convenciendo al coachee de que nada tiene sentido y que no vale la pena esforzarse.",
          "Buscando soluciones mágicas que eliminen todos los problemas del mundo.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "eval_escalera_primer_paso",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "En la \"Escalera Existencial\" del coaching, ¿cuál es el primer paso fundamental según la influencia de San Agustín y Heidegger?",
        opciones: [
          "Tomar una decisión drástica.",
          "La Presencia Radical: escuchar el interior y reconocer cómo se \"es\" en el mundo antes de intentar cambiar nada.",
          "Culpar a los demás por la situación actual.",
          "Diseñar un plan de acción financiero.",
        ],
        correcta: 1,
        obligatoria: true,
      },
    ],
  },

  // ─── Sesión 13 · Herramientas aplicadas al coaching ───
  "coaching-evaluacion-s13": {
    titulo: "Evaluación · Sesión 13",
    introEyebrow: "Evaluación · Sesión 13",
    introTitle: "Herramientas de Priorización",
    introLead: [
      "Esta evaluación tiene 5 preguntas de opción múltiple sobre las herramientas de priorización y visualización vistas en la sesión 13: priorizar vs. organizar la agenda, la Rueda de Priorización, el punto de apalancamiento y el uso comparativo de ruedas.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Necesitas al menos 60% para aprobar y avanzar. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "eval_priorizar_vs_agenda",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "Según el material, ¿cuál es la diferencia fundamental entre \"organizar la agenda\" y \"priorizar con efectividad\"?",
        opciones: [
          "No hay diferencia; ambas significan anotar todo lo que hay que hacer.",
          "La clave es agendar las verdaderas prioridades y sus completamientos, no solo organizar lo que ya está en la agenda.",
          "Organizar la agenda es para el trabajo y priorizar es para la familia.",
          "Priorizar consiste en hacer las tareas más fáciles primero para ahorrar energía.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "eval_poder_personal",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "¿Qué se busca identificar con la pregunta: \"¿Qué se necesita para poder decir 'no' a otras prioridades?\"?",
        opciones: [
          "La falta de educación del coachee.",
          "El nivel de compromiso con sus propios valores y su capacidad de establecer límites (Poder Personal).",
          "Quiénes son las personas que le caen mal al coachee.",
          "Cuántas horas libres tiene el coachee al día.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "eval_rueda_sombrear",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "En el ejercicio de la Rueda de Priorización, ¿cuál es el objetivo de sombrear las secciones del 1 al 10?",
        opciones: [
          "Hacer que el dibujo se vea más bonito y artístico.",
          "Crear una representación visual del nivel actual de satisfacción para que el coachee \"note\" dónde está el desequilibrio.",
          "Evaluar si el coachee sabe colorear correctamente.",
          "Comparar al coachee con otros clientes del coach.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "eval_apalancamiento",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "Al analizar la Rueda completa, el coach pregunta por el \"área que generaría un impacto positivo en las demás\". ¿Por qué es vital esta pregunta?",
        opciones: [
          "Para ahorrar tiempo y no tener que trabajar en todas las áreas a la vez.",
          "Para encontrar el punto de apalancamiento donde un pequeño cambio genera una transformación sistémica.",
          "Porque el coach decide qué área es la más importante.",
          "Porque es una regla matemática obligatoria.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "eval_dos_ruedas",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "Si un coachee tiene dudas entre dos opciones (ej. cambiar de trabajo o quedarse), ¿cómo se sugiere usar la Rueda?",
        opciones: [
          "Dibujando una sola rueda con ambas opciones mezcladas.",
          "Usando dos ruedas lado a lado, evaluando los mismos criterios en ambas para comparar visualmente la satisfacción potencial.",
          "Tirando una moneda al aire mientras se mira la rueda.",
          "Pidiendo al coach que elija la rueda que más le guste.",
        ],
        correcta: 1,
        obligatoria: true,
      },
    ],
  },

  "coaching-reflexion-s13": {
    titulo: "Reflexión personal",
    introEyebrow: "Sesión 13 · Herramientas aplicadas",
    introTitle: "Reflexión personal: Visualización y Priorización Estratégica",
    introLead: [
      "Tema de fase: aplicación técnica y gestión de polaridades. Objetivo de la sesión: utilizar diagramas visuales para la toma de decisiones, priorización efectiva y conducción de sesiones de descubrimiento.",
      "Tómate unos minutos para reflexionar con honestidad sobre la siguiente pregunta antes de la sesión en vivo. Tu respuesta se guarda en el portal y la podrás revisar más adelante.",
    ],
    doneTitle: "Reflexión guardada",
    doneLead: "Tu reflexión quedó registrada. Llévala contigo a la sesión 13.",
    preguntas: [
      {
        id: "reflexion_apoyo_visual",
        tipo: "texto",
        eyebrow: "Pregunta reflexiva",
        texto: "¿Cómo ayuda el apoyo visual a mi cliente a desenredar la complejidad de su pensamiento y qué revela esto sobre su forma de priorizar?",
        placeholder: "Escribe con honestidad. No hay respuesta correcta.",
        obligatoria: true,
      },
    ],
  },

  "coaching-journaling-s13": {
    titulo: "Journaling de la semana",
    introEyebrow: "Semana 13 · Herramientas aplicadas",
    introTitle: "Journaling: Visualización y Priorización Estratégica",
    introLead: [
      "Objetivo: aplicar técnicas de diagramación para priorización y sesiones de descubrimiento.",
      "Desafío de la semana: diseña un diagrama visual para un cliente que necesite priorizar tres áreas de vida o proyectos distintos.",
    ],
    doneTitle: "Journaling guardado",
    doneLead: "Tu entrada quedó registrada. Volveremos a estos hallazgos en próximas sesiones.",
    preguntas: [
      {
        id: "journaling_diagramacion",
        tipo: "texto",
        eyebrow: "Reflexión de la semana",
        texto: "¿Cómo facilita la diagramación visual el paso de la confusión mental a la toma de decisiones estratégica?",
        placeholder: "Anota tu reflexión. Trabajaremos sobre estos hallazgos en las próximas sesiones.",
        obligatoria: true,
      },
    ],
  },

  // ─── Sesión 14 · Dialéctica ───
  "coaching-evaluacion-s14": {
    titulo: "Evaluación · Sesión 14",
    introEyebrow: "Evaluación · Sesión 14",
    introTitle: "Dialéctica en el Coaching",
    introLead: [
      "Esta evaluación tiene 5 preguntas de opción múltiple sobre la mirada dialéctica y su aplicación al coaching: de Platón y Kant a Hegel, la dialéctica en DBT (Linehan) y el Mapa de Opuestos SOPHIA vistos en la sesión 14.",
      "Al terminar verás tu resultado y podrás revisar las respuestas correctas. Necesitas al menos 60% para aprobar y avanzar. Si lo deseas, puedes reintentar el quiz.",
    ],
    preguntas: [
      {
        id: "eval_platon_dialectica",
        tipo: "choice",
        eyebrow: "Pregunta 1 de 5",
        texto: "Según el modelo de Platón, ¿cuál es la función de la dialéctica en el proceso de aprendizaje?",
        opciones: [
          "Confirmar que nuestras opiniones iniciales siempre son correctas.",
          "Conducir el alma desde las sombras (apariencias) hacia la luz del conocimiento verdadero (Ideas).",
          "Ganar discusiones utilizando trucos retóricos.",
          "Ignorar la realidad para vivir en la imaginación.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "eval_kant_ilusion",
        tipo: "choice",
        eyebrow: "Pregunta 2 de 5",
        texto: "En la Dialéctica Trascendental de Kant, ¿cuándo se produce una \"ilusión de la razón\"?",
        opciones: [
          "Cuando el coachee miente descaradamente.",
          "Cuando la razón intenta conocer cosas que están más allá de la experiencia posible (como el alma o Dios como objetos físicos).",
          "Cuando el coach no utiliza un tono de voz adecuado.",
          "Cuando el coachee olvida sus metas de la semana anterior.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "eval_hegel_antitesis",
        tipo: "choice",
        eyebrow: "Pregunta 3 de 5",
        texto: "Para Hegel, la dialéctica es el movimiento de la realidad. ¿Qué representa la \"Antítesis\"?",
        opciones: [
          "El punto de partida o idea inicial.",
          "La negación o contradicción de la tesis inicial que permite el movimiento.",
          "La solución final y perfecta que no cambia más.",
          "Una pérdida de tiempo que debe evitarse.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "eval_dbt_nucleo",
        tipo: "choice",
        eyebrow: "Pregunta 4 de 5",
        texto: "¿Cuál es el núcleo de la dialéctica en la terapia DBT (Linehan) aplicada al coaching?",
        opciones: [
          "Obligar al coachee a cambiar aunque no quiera.",
          "La síntesis entre la Aceptación (validar lo que es) y el Cambio (trabajar en lo que puede ser).",
          "Elegir solo uno de los dos extremos: o acepto o cambio.",
          "Criticar al coachee por tener pensamientos contradictorios.",
        ],
        correcta: 1,
        obligatoria: true,
      },
      {
        id: "eval_sophia_sintesis",
        tipo: "choice",
        eyebrow: "Pregunta 5 de 5",
        texto: "En el \"Mapa de Opuestos\" del coaching SOPHIA, si la Tesis es \"Necesito seguridad\" y la Antítesis es \"Quiero independencia\", ¿qué sería la Síntesis?",
        opciones: [
          "Abandonar ambos deseos y no hacer nada.",
          "Elegir solo la seguridad para no correr riesgos.",
          "Una \"Autonomía responsable\" que integre la estabilidad con la libertad de acción.",
          "Pelear internamente hasta que una de las dos ideas gane.",
        ],
        correcta: 2,
        obligatoria: true,
      },
    ],
  },

  "coaching-reflexion-s14": {
    titulo: "Reflexión personal",
    introEyebrow: "Sesión 14 · Dialéctica",
    introTitle: "Reflexión personal: La Síntesis Dialéctica en SOPHIA",
    introLead: [
      "Objetivo de la sesión: aplicar la dialéctica (inspirada en DBT y SOPHIA) para navegar contradicciones y encontrar puntos de equilibrio en el proceso.",
      "Tómate unos minutos para reflexionar con honestidad sobre la siguiente pregunta antes de la sesión en vivo. Tu respuesta se guarda en el portal y la podrás revisar más adelante.",
    ],
    doneTitle: "Reflexión guardada",
    doneLead: "Tu reflexión quedó registrada. Llévala contigo a la sesión 14.",
    preguntas: [
      {
        id: "reflexion_verdades_opuestas",
        tipo: "texto",
        eyebrow: "Pregunta reflexiva",
        texto: "¿Qué \"verdades opuestas\" está sosteniendo mi cliente y cómo puedo ayudarle a encontrar una síntesis que le permita avanzar?",
        placeholder: "Escribe con honestidad. No hay respuesta correcta.",
        obligatoria: true,
      },
    ],
  },

  "coaching-journaling-s14": {
    titulo: "Journaling de la semana",
    introEyebrow: "Semana 14 · Dialéctica",
    introTitle: "Journaling: La Síntesis Dialéctica en SOPHIA",
    introLead: [
      "Objetivo: comprender la dialéctica en el coaching y su relación con DBT para el manejo de opuestos.",
      "Desafío de la semana: identifica una \"verdad\" del cliente y su \"opuesto\"; busca una síntesis que incluya ambas realidades sin anular ninguna.",
    ],
    doneTitle: "Journaling guardado",
    doneLead: "Tu entrada quedó registrada. Volveremos a estos hallazgos en próximas sesiones.",
    preguntas: [
      {
        id: "journaling_integrar_polaridades",
        tipo: "texto",
        eyebrow: "Reflexión de la semana",
        texto: "¿Cómo puedo ayudar al cliente a integrar sus polaridades (p. ej. \"quiero seguridad\" vs. \"quiero riesgo\") usando la dialéctica SOPHIA?",
        placeholder: "Anota tu reflexión. Trabajaremos sobre estos hallazgos en las próximas sesiones.",
        obligatoria: true,
      },
    ],
  }
};

export function getQuizDef(key) {
  return QUIZZES[(key || "").trim()] || null;
}
