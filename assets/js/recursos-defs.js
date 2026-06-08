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
  "fundamentos-de-coaching": [
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
