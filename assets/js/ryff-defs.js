// SOPHIA Portal · Definiciones de la Escala RYFF de Bienestar Psicologico.
//
// Escala corta de 18 reactivos (Ryff & Keyes, 1995): 6 dimensiones x 3
// reactivos, Likert 1-6 (1 = totalmente en desacuerdo, 6 = totalmente de
// acuerdo). Algunos reactivos estan redactados en negativo y se invierten
// (7 - respuesta) antes de sumar; van marcados con `reverse: true`.
//
// Por dimension: suma 3-18 -> % 0-100 -> 4 bandas (Fortaleza Actual / Zona de
// Crecimiento / Area de Atencion / Area Vulnerable). Tambien hay un indice
// global (suma 18-108).
//
// El backend (submit-ryff / get-resultados-ryff) solo guarda numeros y la
// ETIQUETA de banda (en ASCII). TODO el texto (reactivos, leads, pasos) vive
// aqui. Las etiquetas de banda que devuelve el backend son ASCII
// ("Area de Atencion", "Area Vulnerable"); este modulo las mapea a su
// version con acentos para mostrar y a su color/textos.
//
// Nota: la escala se ofrece libre para investigacion y practica. Los textos
// de banda son orientativos (no diagnosticos) y pueden revisarse con el area
// clinica de SOPHIA antes de considerarlos definitivos.

// Orden de DIMS = orden de ejes del radar (en sentido horario desde arriba).
export const DIMS = [
  {
    key: "autoaceptacion",
    nombre: "Autoaceptacion",
    nombreDisplay: "Autoaceptación",
    nombreCorto: "Autoaceptación",
    accentColor: "#C0112F",
    descripcion: "Actitud positiva hacia ti y hacia tu historia: reconocer tus cualidades y tus sombras, y estar en paz con lo vivido.",
    preguntas: [
      { id: "AA1", reverse: false, texto: "Cuando miro la historia de mi vida, me alegro de cómo han salido las cosas." },
      { id: "AA2", reverse: true,  texto: "En muchos aspectos me siento decepcionado/a de mis logros en la vida." },
      { id: "AA3", reverse: false, texto: "Me gustan la mayoría de los aspectos de mi personalidad." },
    ],
  },
  {
    key: "relaciones_positivas",
    nombre: "Relaciones positivas",
    nombreDisplay: "Relaciones positivas",
    nombreCorto: "Relaciones",
    accentColor: "#E0851B",
    descripcion: "Vínculos cálidos, de confianza y mutuos con los demás: empatía, cercanía y capacidad de dar y recibir.",
    preguntas: [
      { id: "RP1", reverse: false, texto: "La gente me describiría como una persona generosa, dispuesta a compartir su tiempo con los demás." },
      { id: "RP2", reverse: true,  texto: "Mantener relaciones cercanas me ha resultado difícil y frustrante." },
      { id: "RP3", reverse: true,  texto: "No he tenido muchas relaciones cálidas y de confianza con los demás." },
    ],
  },
  {
    key: "autonomia",
    nombre: "Autonomia",
    nombreDisplay: "Autonomía",
    nombreCorto: "Autonomía",
    accentColor: "#66A3F4",
    descripcion: "Autodeterminación e independencia: pensar por ti mismo/a y resistir la presión social para evaluarte con tus propios criterios.",
    preguntas: [
      { id: "AU1", reverse: false, texto: "Confío en mis propias opiniones, aunque sean diferentes a la forma de pensar de la mayoría." },
      { id: "AU2", reverse: true,  texto: "Suelo dejarme influir por las personas con opiniones firmes." },
      { id: "AU3", reverse: false, texto: "No me da miedo expresar mis opiniones, incluso cuando van en contra de las de la mayoría." },
    ],
  },
  {
    key: "dominio_entorno",
    nombre: "Dominio del entorno",
    nombreDisplay: "Dominio del entorno",
    nombreCorto: "Entorno",
    accentColor: "#2E8B6F",
    descripcion: "Sensación de competencia para manejar tu vida y tu entorno, y para aprovechar las oportunidades que se te presentan.",
    preguntas: [
      { id: "DE1", reverse: false, texto: "En general, siento que tengo el control de la situación en la que vivo." },
      { id: "DE2", reverse: true,  texto: "Las exigencias de la vida cotidiana a menudo me abruman." },
      { id: "DE3", reverse: false, texto: "Se me da bastante bien manejar las múltiples responsabilidades de mi día a día." },
    ],
  },
  {
    key: "proposito_vida",
    nombre: "Proposito en la vida",
    nombreDisplay: "Propósito en la vida",
    nombreCorto: "Propósito",
    accentColor: "#7A5BB0",
    descripcion: "Tener metas y un sentido de dirección: sentir que tu vida, presente y pasada, tiene significado.",
    preguntas: [
      { id: "PV1", reverse: false, texto: "Algunas personas van por la vida sin rumbo, pero yo no soy una de ellas." },
      { id: "PV2", reverse: true,  texto: "A veces siento que ya hice todo lo que había que hacer en la vida." },
      { id: "PV3", reverse: true,  texto: "Vivo la vida un día a la vez y no pienso mucho en el futuro." },
    ],
  },
  {
    key: "crecimiento_personal",
    nombre: "Crecimiento personal",
    nombreDisplay: "Crecimiento personal",
    nombreCorto: "Crecimiento",
    accentColor: "#8D9438",
    descripcion: "Sensación de desarrollo continuo: apertura a nuevas experiencias y mejora percibida de ti mismo/a con el tiempo.",
    preguntas: [
      { id: "CP1", reverse: false, texto: "Para mí, la vida ha sido un proceso continuo de aprendizaje, cambio y crecimiento." },
      { id: "CP2", reverse: true,  texto: "Hace tiempo que dejé de intentar hacer grandes mejoras o cambios en mi vida." },
      { id: "CP3", reverse: false, texto: "Creo que es importante tener nuevas experiencias que desafíen la forma en que pienso sobre mí mismo/a y sobre el mundo." },
    ],
  },
];

export const SCALE = { min: 1, max: 6 };

export const ESCALA_LABELS = {
  min: "Totalmente en desacuerdo",
  max: "Totalmente de acuerdo",
};

// Bandas universales (mismas que autoeval, ordenadas de mayor a menor). `key`
// coincide con lo que devuelve el backend (ASCII); `label` es para mostrar.
export const BANDAS = [
  { key: "Fortaleza Actual",    label: "Fortaleza Actual",    color: "#2E7D32", minPct: 70 },
  { key: "Zona de Crecimiento", label: "Zona de Crecimiento", color: "#1565C0", minPct: 45 },
  { key: "Area de Atencion",    label: "Área de Atención",    color: "#C88D2D", minPct: 22 },
  { key: "Area Vulnerable",     label: "Área Vulnerable",     color: "#B00020", minPct: 0  },
];

export const NOTE =
  "Esta escala es una herramienta de autoconocimiento, no un diagnóstico. Úsala como línea base y vuelve a medir tras unas semanas para ver tu evolución.";

export function bandaForPct(pct) {
  for (const b of BANDAS) {
    if (pct >= b.minPct) return b.key;
  }
  return BANDAS[BANDAS.length - 1].key;
}

export function bandaColor(key) {
  const b = BANDAS.find((x) => x.key === key);
  return b ? b.color : "#666";
}

export function bandaLabel(key) {
  const b = BANDAS.find((x) => x.key === key);
  return b ? b.label : key;
}

export function getDim(key) {
  return DIMS.find((d) => d.key === key) || null;
}

// Lista plana de los 18 reactivos en orden de dimension (para el wizard).
export function preguntasPlanas() {
  const out = [];
  for (const d of DIMS) {
    for (const p of d.preguntas) {
      out.push({ ...p, dimKey: d.key, dimNombre: d.nombreDisplay, accentColor: d.accentColor });
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────
// Textos de banda por dimension. Indexados por dimKey -> bandaKey ->
// { lead, steps[] }. Orientativos, en primera persona, no diagnosticos.
// ────────────────────────────────────────────────────────────────────

export const BAND_TEXT = {
  autoaceptacion: {
    "Fortaleza Actual": {
      lead: "Tienes una relación amable contigo mismo/a. Reconoces tus cualidades sin presumir y tus límites sin castigarte, y estás en paz con la historia que has vivido. Esa base te sostiene cuando las cosas se ponen difíciles.",
      steps: [
        "Anota cada noche, durante una semana, una cosa que hiciste bien o que te gustó de ti.",
        "Cuando te sorprendas siendo duro/a contigo, pregúntate: ¿le hablaría así a alguien que quiero?",
      ],
    },
    "Zona de Crecimiento": {
      lead: "En general te aceptas, pero hay aspectos de ti o de tu pasado con los que todavía cargas cierta exigencia o arrepentimiento. Aceptarte no es resignarte: es dejar de pelear con lo que ya es para poder construir desde ahí.",
      steps: [
        "Escribe una decisión del pasado que aún pese y reformúlala en qué aprendiste de ella.",
        "Haz una lista de 5 fortalezas tuyas y léela cuando te ataque la autocrítica.",
      ],
    },
    "Area de Atencion": {
      lead: "Hoy te cuesta verte con buenos ojos: la balanza se inclina hacia lo que no te gusta de ti o hacia lo que crees que te falta. Eso desgasta y no es la verdad completa sobre quién eres. La aceptación se entrena.",
      steps: [
        "Practica 'tres cosas buenas': cada noche registra tres momentos del día y tu papel en ellos.",
        "Identifica una etiqueta dura que te pones ('soy un desastre') y búscale dos contraejemplos reales.",
      ],
    },
    "Area Vulnerable": {
      lead: "Por ahora la relación contigo es áspera y eso pesa en todo lo demás. No es un defecto de carácter, suele venir de heridas o de mensajes viejos que se volvieron tu voz interior. Vale la pena no recorrer esto en soledad.",
      steps: [
        "Empieza con 5 minutos al día de escritura honesta: ¿qué siento hoy hacia mí?, sin juzgar.",
        "Considera platicarlo con alguien de confianza o con un profesional; pedir apoyo aquí es fortaleza.",
      ],
    },
  },

  relaciones_positivas: {
    "Fortaleza Actual": {
      lead: "Cultivas vínculos cálidos y de confianza, y sabes dar y recibir. Las relaciones cercanas son uno de los predictores más sólidos de una vida plena, y tú las tienes presentes. Cuídalas con intención.",
      steps: [
        "Agenda esta semana un rato sin pantallas con alguien que te importa.",
        "Dile a una persona algo concreto que valoras de ella; nombrar lo bueno fortalece el lazo.",
      ],
    },
    "Zona de Crecimiento": {
      lead: "Tienes relaciones importantes, pero hay espacio para profundizar o para abrirte más. La cercanía no se da sola: pide tiempo, presencia y cierta vulnerabilidad. La calidad pesa más que la cantidad.",
      steps: [
        "Elige una relación que quieras acercar este mes y propón algo concreto para verse.",
        "Practica escuchar sin preparar tu respuesta mientras el otro habla.",
      ],
    },
    "Area de Atencion": {
      lead: "Hoy las relaciones cercanas se sienten difíciles, distantes o costosas de sostener. Quizá te cuesta confiar o abrirte. Reconectar no empieza con una gran conversación, sino con un primer gesto pequeño.",
      steps: [
        "Manda hoy un mensaje breve a alguien con quien quieras retomar contacto, sin esperar nada a cambio.",
        "Identifica qué te frena al acercarte (miedo, orgullo, tiempo) y nómbralo por escrito.",
      ],
    },
    "Area Vulnerable": {
      lead: "La soledad o los vínculos lastimados pesan más de lo que sueles admitir. El aislamiento se refuerza solo, y por eso cuesta tanto romperlo. No tienes que hacerlo de golpe ni en solitario.",
      steps: [
        "Da un paso mínimo de contacto esta semana: un saludo, un café corto, un mensaje.",
        "Si la soledad se siente persistente, busca acompañamiento profesional para trabajarla con calma.",
      ],
    },
  },

  autonomia: {
    "Fortaleza Actual": {
      lead: "Piensas por ti mismo/a y te sostienes en tus opiniones aunque vayan a contracorriente. Te evalúas con tus propios criterios más que con la mirada ajena. Esa independencia interna es un ancla valiosa.",
      steps: [
        "Antes de una decisión importante, escribe qué quieres tú antes de preguntar a otros.",
        "Cuida que autonomía no se vuelva rigidez: pide una opinión distinta y escúchala de verdad.",
      ],
    },
    "Zona de Crecimiento": {
      lead: "Sueles tener criterio propio, pero en ciertos contextos te dejas arrastrar por lo que esperan los demás o por las voces más fuertes. Afianzar tu autonomía es aprender a quedarte contigo cuando hay presión.",
      steps: [
        "Esta semana sostén una opinión tuya en una conversación donde normalmente cederías.",
        "Antes de decir que sí por automático, date 24 horas para revisar si de verdad lo quieres.",
      ],
    },
    "Area de Atencion": {
      lead: "Hoy te cuesta sostener lo que piensas frente a la presión: las opiniones ajenas o el deseo de no incomodar terminan decidiendo por ti. Tu voz importa, y recuperarla se practica en cosas pequeñas.",
      steps: [
        "Identifica una decisión reciente que tomaste por complacer y reflexiona qué hubieras elegido tú.",
        "Practica decir 'déjame pensarlo' en vez de aceptar de inmediato.",
      ],
    },
    "Area Vulnerable": {
      lead: "Por ahora vives mucho en función de lo que otros esperan, y se te dificulta saber qué quieres realmente. Esto suele venir de patrones aprendidos, no de falta de valor. Reconstruir tu brújula interna es posible y vale la pena.",
      steps: [
        "Dedica 5 minutos al día a escribir, sin filtro, qué quieres tú en una situación concreta.",
        "Empieza por elegir cosas pequeñas a tu modo (qué comer, cómo organizar tu día) para entrenar el músculo.",
      ],
    },
  },

  dominio_entorno: {
    "Fortaleza Actual": {
      lead: "Sientes que llevas las riendas de tu vida y manejas bien tus responsabilidades. Sabes ordenar tu entorno para que trabaje a tu favor y aprovechar oportunidades. Esa competencia te da estabilidad.",
      steps: [
        "Revisa qué sistema o hábito te está funcionando y refínalo en vez de cambiarlo todo.",
        "Bloquea tiempo para lo importante-no-urgente antes de que la agenda se llene sola.",
      ],
    },
    "Zona de Crecimiento": {
      lead: "Manejas tu vida razonablemente bien, aunque hay temporadas en que las exigencias te rebasan o sientes que reaccionas más de lo que decides. Cerrar la brecha entre intención y acción es lo que toca afinar.",
      steps: [
        "Elige UNA responsabilidad que te abruma y divídela en pasos chicos para la semana.",
        "Al inicio del día define las 3 cosas que de verdad importan y protégelas.",
      ],
    },
    "Area de Atencion": {
      lead: "Hoy las demandas de la vida cotidiana te superan con frecuencia y cuesta sentir que controlas tu entorno. La sensación de ir apagando incendios es agotadora, pero el orden se reconstruye desde lo pequeño y sostenido.",
      steps: [
        "Saca de tu cabeza todos los pendientes a una lista; lo que está escrito deja de abrumar igual.",
        "Elige un solo ámbito (un cajón, una hora del día) y ponlo en orden como punto de partida.",
      ],
    },
    "Area Vulnerable": {
      lead: "Por ahora sientes que la vida te pasa por encima y que tienes poco margen de control. Cuando todo abruma, la salida no es hacer más, sino simplificar y recuperar un punto de apoyo a la vez.",
      steps: [
        "Reduce: elige la única cosa que de verdad importa hoy y suelta el resto sin culpa.",
        "Si la carga se siente inmanejable de forma sostenida, apóyate en alguien para repartirla.",
      ],
    },
  },

  proposito_vida: {
    "Fortaleza Actual": {
      lead: "Tienes claro hacia dónde vas y sientes que tu vida tiene sentido y dirección. Ese propósito te da energía y te ayuda a sostener el rumbo cuando las circunstancias se mueven. Síguelo alimentando.",
      steps: [
        "Revisa si tus metas siguen siendo tuyas o ya las traes por inercia; ajústalas si hace falta.",
        "Conecta una tarea cotidiana con el porqué más grande que le da sentido.",
      ],
    },
    "Zona de Crecimiento": {
      lead: "Tienes algunas metas y cierto sentido de dirección, pero a ratos sientes que avanzas sin un rumbo claro. El propósito no siempre llega como una revelación: muchas veces se construye dando pasos y observando qué te mueve.",
      steps: [
        "Escribe en una frase qué te gustaría que fuera distinto en tu vida dentro de un año.",
        "Identifica una actividad que te haga perder la noción del tiempo y dale más espacio.",
      ],
    },
    "Area de Atencion": {
      lead: "Hoy cuesta encontrarle dirección a las cosas: los días pasan y la sensación de para qué se difumina. No es falta de valor, suele ser señal de que toca reconectar con lo que te importa. Las preguntas correctas abren camino.",
      steps: [
        "Dedica 15 minutos a escribir: ¿qué cosas me importaban antes y dejé de lado?",
        "Prueba un proyecto pequeño (voluntario o personal) donde lo que haces sirva a algo que valoras.",
      ],
    },
    "Area Vulnerable": {
      lead: "Por ahora sientes que la vida transcurre sin un sentido claro, y eso puede pesar bastante. Reconstruir el propósito es un proceso, no un interruptor. Empezar a hacerte mejores preguntas ya es avanzar.",
      steps: [
        "No te exijas un gran propósito: empieza por una micro-meta semanal que te dé algo de dirección.",
        "Si la falta de sentido viene con desánimo persistente, busca apoyo profesional para acompañarte.",
      ],
    },
  },

  crecimiento_personal: {
    "Fortaleza Actual": {
      lead: "Vives la vida como un proceso de aprendizaje y te mantienes abierto/a a nuevas experiencias. Sientes que sigues creciendo y desarrollando tu potencial. Esa mentalidad de expansión es un motor poderoso.",
      steps: [
        "Elige una habilidad o tema nuevo y dale un primer paso esta semana.",
        "Comparte lo que has aprendido con alguien; enseñar consolida tu propio crecimiento.",
      ],
    },
    "Zona de Crecimiento": {
      lead: "Sigues aprendiendo y cambiando, aunque a veces te acomodas en lo conocido y dejas pasar oportunidades de expandirte. La curiosidad se cultiva: basta con buscar a propósito experiencias que te saquen un poco de la zona cómoda.",
      steps: [
        "Haz esta semana una cosa que normalmente evitarías por ser nueva o incómoda.",
        "Cuestiona una rutina que traes en automático: ¿hay una forma distinta de hacerla?",
      ],
    },
    "Area de Atencion": {
      lead: "Hoy sientes cierto estancamiento: la idea de cambiar o probar cosas nuevas se ve lejana o sin caso. Esa sensación es común y reversible. El crecimiento vuelve con experiencias pequeñas que renueven tu curiosidad.",
      steps: [
        "Elige una experiencia nueva y mínima (un lugar, un libro, una conversación) y pruébala.",
        "Recuerda un momento en que sí creciste y qué lo hizo posible; replica una pieza de eso.",
      ],
    },
    "Area Vulnerable": {
      lead: "Por ahora sientes que dejaste de avanzar y que las cosas no cambian. El estancamiento prolongado pesa y a veces se mezcla con desánimo. La buena noticia: el cambio se reactiva con pasos muy pequeños y sostenidos.",
      steps: [
        "Define un paso diminuto de algo que quieras retomar y hazlo hoy, por pequeño que sea.",
        "Si la sensación de no avanzar viene con apatía sostenida, considera buscar acompañamiento.",
      ],
    },
  },
};

export function bandTextFor(dimKey, bandaKey) {
  const dim = BAND_TEXT[dimKey];
  if (!dim) return { lead: "", steps: [] };
  return dim[bandaKey] || { lead: "", steps: [] };
}
