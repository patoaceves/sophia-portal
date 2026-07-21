// SOPHIA Portal - acuerdo-defs.js
//
// Definiciones de acuerdos de participacion con firma digital, por clave.
// La leccion (tipo "enlace", etiqueta "Acuerdo") apunta a la clave via
// url_externa. El componente acuerdo.js lee de aqui el PDF, las casillas de
// consentimiento y la version del documento.

export const ACUERDO_DEFS = {
  "anxiety-acuerdo-v1": {
    titulo: "Acuerdo de participación",
    version: "anxiety-acuerdo-v1",
    pdfUrl: "/assets/pdf/anxiety-workshop/acuerdo-participacion.pdf",
    intro: "Lee el documento completo. Al final confirma cada punto y escribe tu nombre como firma.",
    firmaLabel: "Escribe tu nombre completo como firma",
    casillas: [
      { id: "he_leido", texto: "He leído y comprendido este documento." },
      { id: "no_sustituye", texto: "Entiendo que el taller es psicoeducativo y grupal, y que no sustituye la psicoterapia individual ni el tratamiento psiquiátrico." },
      { id: "voluntaria", texto: "Entiendo que mi participación es voluntaria y que puedo retirarme en cualquier momento." },
      { id: "confidencialidad", texto: "Comprendo los alcances y los límites de la confidencialidad." },
      { id: "datos_salud", texto: "Autorizo el tratamiento de mis datos personales, incluidos los datos de salud, en los términos aquí descritos." },
      { id: "mediciones", texto: "Acepto participar en las mediciones (GAD-7 y WHO-5) con fines de acompañamiento y evaluación del programa." },
    ],
  },
};

export function getAcuerdoDef(clave) {
  return ACUERDO_DEFS[(clave || "").trim()] || null;
}
