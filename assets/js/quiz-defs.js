// SOPHIA Portal · Definiciones de quizzes (actividades en clase)
//
// Cada quiz es una actividad reflexiva tipo wizard. Las respuestas se guardan
// en la tabla Airtable "Actividades en Clase".
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
    introEyebrow: "Actividad en clase",
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
    doneLead: "Tu reflexión quedó registrada. Llévala contigo a la sesión 1 — vamos a profundizar en estas fronteras del coaching juntos.",
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
};

export function getQuizDef(key) {
  return QUIZZES[(key || "").trim()] || null;
}
