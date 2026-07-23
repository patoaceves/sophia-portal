// SOPHIA Portal - instrumentos-defs.js
//
// Definiciones de los instrumentos de medicion, por clave. La leccion
// (tipo "enlace", etiqueta "Instrumentos") apunta a la clave via url_externa.
//
// Fuentes: GAD-7 (Spitzer, Kroenke, Williams y Löwe, 2006), de uso libre.
// WHO-5 Well-Being Index (Organizacion Mundial de la Salud, 1998), de uso
// libre citando la fuente.
//
// Las bandas y sus textos son los mismos que calcula el servidor
// (submit-medicion). Si cambian aqui, hay que cambiarlas alla.

export const INSTRUMENTO_DEFS = {
  "anxiety-instrumentos-v1": {
    titulo: "Instrumentos de medición",
    version: "anxiety-instrumentos-v1",
    intro: "Estas dos escalas nos dan un punto de partida para acompañarte durante el taller. Toma unos 3 minutos y no hay respuestas buenas ni malas.",
    escalas: [
      {
        id: "gad7",
        titulo: "GAD-7: Escala de ansiedad generalizada",
        instruccion: "Durante las últimas dos semanas, ¿con qué frecuencia te han molestado los siguientes problemas?",
        max: 3,
        opciones: [
          { label: "Ningún día", valor: 0 },
          { label: "Varios días", valor: 1 },
          { label: "Más de la mitad de los días", valor: 2 },
          { label: "Casi todos los días", valor: 3 },
        ],
        items: [
          "Sentirme nervioso/a, ansioso/a o con los nervios de punta.",
          "No poder dejar de preocuparme o no poder controlar la preocupación.",
          "Preocuparme demasiado por diferentes cosas.",
          "Dificultad para relajarme.",
          "Estar tan inquieto/a que me cuesta permanecer sentado/a.",
          "Molestarme o irritarme fácilmente.",
          "Sentir miedo, como si algo terrible pudiera pasar.",
        ],
      },
      {
        id: "who5",
        titulo: "WHO-5: Índice de bienestar de la OMS",
        instruccion: "Indica, para cada afirmación, cómo te has sentido durante las últimas dos semanas.",
        max: 5,
        opciones: [
          { label: "Todo el tiempo", valor: 5 },
          { label: "La mayor parte del tiempo", valor: 4 },
          { label: "Más de la mitad del tiempo", valor: 3 },
          { label: "Menos de la mitad del tiempo", valor: 2 },
          { label: "De vez en cuando", valor: 1 },
          { label: "Nunca", valor: 0 },
        ],
        items: [
          "Me he sentido alegre y de buen ánimo.",
          "Me he sentido tranquilo/a y relajado/a.",
          "Me he sentido activo/a y con energía.",
          "Me he despertado sintiéndome fresco/a y descansado/a.",
          "Mi vida cotidiana ha estado llena de cosas que me interesan.",
        ],
      },
    ],
    funcionalidad: {
      pregunta: "Si marcaste alguno de los problemas anteriores, ¿qué tanta dificultad te han dado para hacer tu trabajo, encargarte de las tareas del hogar o llevarte bien con otras personas?",
      nota: "Esta pregunta no se puntúa.",
      opciones: ["Ninguna", "Poca", "Mucha", "Extrema"],
    },
    bandas: {
      gad7: {
        "Mínima": { color: "#2E7D32", desc: "Tus respuestas sugieren muy pocos síntomas de ansiedad en las últimas dos semanas." },
        "Leve": { color: "#1565C0", desc: "Tus respuestas sugieren síntomas leves de ansiedad. Es un buen punto de partida para el taller." },
        "Moderada": { color: "#C88D2D", desc: "Tus respuestas sugieren síntomas moderados de ansiedad. Vale la pena comentarlo con el equipo del programa." },
        "Severa": { color: "#B00020", desc: "Tus respuestas sugieren síntomas de ansiedad de intensidad alta. Te recomendamos platicarlo con el equipo del programa." },
      },
      who5: {
        "Bienestar adecuado": { color: "#2E7D32", desc: "Tus respuestas reflejan un nivel de bienestar dentro de lo esperado." },
        "Bienestar bajo": { color: "#C88D2D", desc: "Tus respuestas reflejan un bienestar por debajo de lo esperado en las últimas dos semanas." },
        "Bienestar muy bajo": { color: "#B00020", desc: "Tus respuestas reflejan un bienestar bajo. Te sugerimos comentarlo con el equipo del programa." },
      },
    },
    acompanamiento: {
      titulo: "Queremos acompañarte",
      texto: "Tus respuestas indican que la estás pasando difícil en estas semanas. El taller puede ayudarte, y además te sugerimos platicarlo directamente con el equipo del programa para ver qué apoyo te queda mejor.",
      crisis: "Si en algún momento sientes que no puedes con esto o tienes pensamientos de hacerte daño, marca la Línea de la Vida al 800 911 2000, disponible las 24 horas.",
      telefono: "8009112000",
    },
    nota: "Estos resultados no son un diagnóstico. Son una medida de cómo te has sentido en las últimas dos semanas y nos sirven como línea base para acompañarte durante el taller. Volveremos a medir al final del programa.",
    fuentes: "GAD-7 (Spitzer, Kroenke, Williams y Löwe, 2006), de uso libre. WHO-5 Well-Being Index (Organización Mundial de la Salud, 1998), de uso libre citando la fuente.",
  },
};

export function getInstrumentoDef(clave) {
  return INSTRUMENTO_DEFS[(clave || "").trim()] || null;
}
