// SOPHIA Portal · Los 8 pilares del modelo de felicidad
//
// Catálogo compartido entre la landing del curso (curso.js) y el generador
// del PDF de avance (avance-pdf.js). Vivía dentro de curso.js, pero al
// necesitarlo dos módulos se saca aquí para tener una sola fuente de verdad.

export const PILARES = [
  { key: "autoconocimiento",      file: "autoconocimiento",      dim: "mental",    name: "Autoconocimiento" },
  { key: "bienestar_fisico",      file: "bienestar-fisico",      dim: "fisico",    name: "Bienestar Físico" },
  { key: "presencia_consciente",  file: "presencia-consciente",  dim: "fisico",    name: "Presencia Consciente" },
  { key: "bienestar_emocional",   file: "bienestar-emocional",   dim: "afectivo",  name: "Bienestar Emocional" },
  { key: "trabajo_proposito",     file: "trabajo-proposito",     dim: "mental",    name: "Trabajo con Propósito" },
  { key: "estetica_existencial",  file: "estetica-existencial",  dim: "spiritual", name: "Estética Existencial" },
  { key: "vinculos_vitales",      file: "vinculos-vitales",      dim: "afectivo",  name: "Vínculos Vitales" },
  { key: "fe_filosofia",          file: "fe-filosofia",          dim: "spiritual", name: "Fe y Filosofía" },
];

// A qué módulo corresponde cada pilar, POR CURSO. El presencial y el digital
// no siguen el mismo orden: el digital intercambió Bienestar Físico con
// Presencia Consciente (mod 3/4) y Estética con Vínculos (mod 7/8). Antes esto
// se resolvía posicionalmente (`orden === idx + 2`), lo cual solo era correcto
// para el presencial.
export const PILAR_MODULO = {
  "happiness-workshop": {
    autoconocimiento: 2, bienestar_fisico: 3, presencia_consciente: 4,
    bienestar_emocional: 5, trabajo_proposito: 6, estetica_existencial: 7,
    vinculos_vitales: 8, fe_filosofia: 9,
  },
  "happiness-workshop-digital": {
    autoconocimiento: 2, presencia_consciente: 3, bienestar_fisico: 4,
    bienestar_emocional: 5, trabajo_proposito: 6, vinculos_vitales: 7,
    estetica_existencial: 8, fe_filosofia: 9,
  },
};

// Color de acento de cada dimensión (mismos hex que la rueda del test).
export const DIM_COLOR = {
  mental: "#66a3f4",
  fisico: "#8d9438",
  afectivo: "#d21744",
  spiritual: "#e3a52d",
};

// El Test de Felicidad y las 8 dimensiones aplican a ambos Happiness Workshop
// (presencial y digital), no a los demás cursos.
export function esHappinessWorkshop(slug) {
  return slug === "happiness-workshop" || slug === "happiness-workshop-digital";
}

// Número de módulo de un pilar en un curso dado. `idxFallback` mantiene el
// comportamiento viejo (posicional) si algún día se agrega un curso que use
// estos pilares y no esté en el mapa.
export function moduloDePilar(slug, key, idxFallback) {
  return PILAR_MODULO[slug]?.[key] ?? (idxFallback + 2);
}

// Los pilares que el alumno ya autoevaluó, en orden de módulo del curso.
export function pilaresTomados(slug, resultadosAutoeval) {
  return PILARES
    .filter((p) => resultadosAutoeval?.[p.key]?.tieneResultados)
    .sort((a, b) => moduloDePilar(slug, a.key, 0) - moduloDePilar(slug, b.key, 0));
}

// Los que le faltan, también en orden de módulo.
export function pilaresPendientes(slug, resultadosAutoeval) {
  return PILARES
    .filter((p) => !resultadosAutoeval?.[p.key]?.tieneResultados)
    .sort((a, b) => moduloDePilar(slug, a.key, 0) - moduloDePilar(slug, b.key, 0));
}
