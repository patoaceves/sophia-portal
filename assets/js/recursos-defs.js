// SOPHIA Portal · recursos-defs.js
//
// Material complementario por curso (lecturas y documentos descargables).
// Se renderiza en la pestaña "Recursos" de cada curso (ver curso.js).
// Es contenido estatico del curso, no datos del usuario, por eso vive en un
// def file (mismo patron que quiz-defs.js / autoeval-defs.js) y no en la base.
//
// Los PDFs se sirven desde /assets/pdf/ (deploy estatico de Vercel).
// Cada recurso: { titulo, autor, descripcion, tipo, url, idioma, tamano }.

export const RECURSOS = {
  // ── Happiness Workshop Digital ────────────────────────────────────
  // Las notas tecnicas de los 9 modulos, juntas en un solo lugar. Son las
  // mismas que viven como leccion tipo pdf dentro de cada modulo; aqui se
  // ofrecen como biblioteca descargable para consultarlas fuera del temario.
  "happiness-workshop-digital": [
    {
      titulo: "Nota tecnica 1 · Hablemos de felicidad",
      autor: "SOPHIA Centro de Formacion en Humanidades",
      descripcion:
        "El modelo de felicidad de SOPHIA: los 8 elementos, fundamentales y elevados, y la felicidad como fin ultimo en Aristoteles.",
      tipo: "pdf",
      url: "/assets/pdf/hwd-m1-nota-tecnica.pdf",
      idioma: "Espanol",
      tamano: "2.5 MB",
    },
    {
      titulo: "Nota tecnica 2 · Autoconocimiento",
      autor: "SOPHIA Centro de Formacion en Humanidades",
      descripcion:
        "Reconocer fortalezas y debilidades con compasion, integridad y realismo. Descubrir lo que somos mas alla de lo que hacemos.",
      tipo: "pdf",
      url: "/assets/pdf/hwd-m2-nota-tecnica.pdf",
      idioma: "Espanol",
      tamano: "972 KB",
    },
    {
      titulo: "Nota tecnica 3 · Presencia consciente",
      autor: "SOPHIA Centro de Formacion en Humanidades",
      descripcion:
        "Los ques y comos del mindfulness (Kabat-Zinn) y la mente sabia como punto medio entre la mente racional y la emocional.",
      tipo: "pdf",
      url: "/assets/pdf/hwd-m3-nota-tecnica.pdf",
      idioma: "Espanol",
      tamano: "1.3 MB",
    },
    {
      titulo: "Nota tecnica 4 · Bienestar fisico",
      autor: "SOPHIA Centro de Formacion en Humanidades",
      descripcion:
        "El cuerpo como sosten de todos nuestros proyectos: sueno, alimentacion, movimiento, entorno y ritmo.",
      tipo: "pdf",
      url: "/assets/pdf/hwd-m4-nota-tecnica.pdf",
      idioma: "Espanol",
      tamano: "1.7 MB",
    },
    {
      titulo: "Nota tecnica 5 · Bienestar emocional",
      autor: "SOPHIA Centro de Formacion en Humanidades",
      descripcion:
        "Identificar, comprender, expresar y regular las emociones. Acoger tanto las placenteras como las dolorosas.",
      tipo: "pdf",
      url: "/assets/pdf/hwd-m5-nota-tecnica.pdf",
      idioma: "Espanol",
      tamano: "944 KB",
    },
    {
      titulo: "Nota tecnica 6 · Trabajo con proposito",
      autor: "SOPHIA Centro de Formacion en Humanidades",
      descripcion:
        "Vocacion, narrativa de vida y motivacion profunda. Como se conecta el quehacer diario con un sentido que lo trasciende.",
      tipo: "pdf",
      url: "/assets/pdf/hwd-m6-nota-tecnica.pdf",
      idioma: "Espanol",
      tamano: "696 KB",
    },
    {
      titulo: "Nota tecnica 7 · Vinculos vitales",
      autor: "SOPHIA Centro de Formacion en Humanidades",
      descripcion:
        "El reconocimiento del otro (Taylor), el dilema del erizo, los cuatro amores de C. S. Lewis y las habilidades DBT de comunicacion.",
      tipo: "pdf",
      url: "/assets/pdf/hwd-m7-nota-tecnica.pdf",
      idioma: "Espanol",
      tamano: "660 KB",
    },
    {
      titulo: "Nota tecnica 8 · Estetica existencial",
      autor: "SOPHIA Centro de Formacion en Humanidades",
      descripcion:
        "Construir la propia existencia como una obra de arte: creatividad vital motivada por lo bueno, lo bello y lo verdadero.",
      tipo: "pdf",
      url: "/assets/pdf/hwd-m8-nota-tecnica.pdf",
      idioma: "Espanol",
      tamano: "992 KB",
    },
    {
      titulo: "Nota tecnica 9 · Fe y filosofia de vida",
      autor: "SOPHIA Centro de Formacion en Humanidades",
      descripcion:
        "La brujula interna: creencias, valores y principios que orientan como interpretamos el mundo y tomamos decisiones.",
      tipo: "pdf",
      url: "/assets/pdf/hwd-m9-nota-tecnica.pdf",
      idioma: "Espanol",
      tamano: "1.2 MB",
    },
  ],

  "fundamentos-de-coaching": [
    {
      titulo: "Manual SOPHIA · Fundamentos de Coaching I",
      autor: "SOPHIA Centro de Formacion en Humanidades",
      descripcion:
        "Manual oficial del programa: marco humanista, modelo de sesion, herramientas y ejercicios de las 19 sesiones.",
      tipo: "pdf",
      url: "/assets/pdf/coaching-manual-sophia.pdf",
      idioma: "Espanol",
      tamano: "7.7 MB",
    },
    {
      titulo: "The Complete Handbook of Coaching",
      autor: "Eds. E. Cox, T. Bachkirova y D. Clutterbuck",
      descripcion:
        "Manual de referencia que recorre los principales enfoques, generos y contextos del coaching profesional. Base teorica del curso.",
      tipo: "pdf",
      url: "/assets/pdf/coaching-handbook-completo.pdf",
      idioma: "Ingles",
      tamano: "27 MB",
    },
    {
      titulo: "12 Reglas para Vivir: Un antidoto al caos",
      autor: "Jordan B. Peterson",
      descripcion:
        "Ensayo de psicologia practica sobre habitos, responsabilidad personal y la busqueda de sentido.",
      tipo: "pdf",
      url: "/assets/pdf/12-reglas-para-vivir-peterson.pdf",
      idioma: "Espanol",
      tamano: "1.4 MB",
    },
    {
      titulo: "Los origenes del modelo de cambio de tres pasos de Lewin",
      autor: "Bernard Burnes · Journal of Applied Behavioral Science (2019)",
      descripcion:
        "Articulo que rastrea el origen del modelo descongelar-mover-recongelar y su fundamento en la teoria de campo.",
      tipo: "pdf",
      url: "/assets/pdf/lewin-three-step-model.pdf",
      idioma: "Ingles",
      tamano: "560 KB",
    },
  ],
};

/** Devuelve los recursos de un curso por slug (array vacio si no hay). */
export function getRecursos(slug) {
  return RECURSOS[slug] ?? [];
}
