// SOPHIA Portal · Definiciones de autoevaluaciones (Autoevaluaciones 2.0)
//
// Cada autoevaluación mide UN pilar del modelo de felicidad SOPHIA a través
// de los 8 niveles de integración: adecuadamente, disfrute, emociones
// positivas, compromiso, logro, satisfacción, sentido, trascendencia.
//
// Estructura (compartida por las 8): 8 preguntas (una por nivel), escala
// Likert 1–5, puntaje = suma 8–40 → % de integración 0–100 → 4 bandas
// (Fortaleza Actual / Zona de Crecimiento / Área de Atención / Área
// Vulnerable). El backend (`submit-autoeval`) valida y suma por los IDs de
// NIVELES y calcula la banda; TODO el contenido (preguntas, color, textos
// de banda) vive aquí — el backend no guarda texto, solo números.
//
// El orden de `preguntas` SIEMPRE corresponde a NIVELES (índice a índice).
//
// Preguntas: tomadas del PDF "Autoevaluaciones 2.0" (8 pilares × 8). Se
// normalizaron typos evidentes y la persona gramatical a primera persona.
//
// Textos de banda: los de `autoconocimiento` son los definitivos (Lic.
// Mariana Riojas, portados del legacy evalfelicidad.sophiamx.org). Los de
// los otros 7 pilares están marcados PROVISIONAL — revisar/aprobar con la
// Lic. Riojas antes de publicar esos módulos.

export const NIVELES = [
  "adecuadamente",
  "disfrute",
  "emociones_pos",
  "compromiso",
  "logro",
  "satisfaccion",
  "sentido",
  "trascendencia",
];

export const ESCALA_LABELS = {
  min: "Muy en desacuerdo",
  max: "Muy de acuerdo",
};

// Bandas universales (mismo modelo para los 8 pilares). Ordenadas de mayor
// a menor integración. `minTotal` es inclusivo sobre la suma de 8–40.
export const BANDAS = [
  { label: "Fortaleza Actual",    color: "#2E7D32", minTotal: 31 },
  { label: "Zona de Crecimiento", color: "#1565C0", minTotal: 21 },
  { label: "Área de Atención",    color: "#C88D2D", minTotal: 11 },
  { label: "Área Vulnerable",     color: "#B00020", minTotal: 0  },
];

export const NOTE =
  "Nota: Estos resultados no son diagnósticos. Úsalos como línea base y vuelve a medir tras 2–4 semanas.";

// Banda a partir de la suma total (8–40). Mismo criterio que el backend.
export function bandaForTotal(total) {
  for (const b of BANDAS) {
    if (total >= b.minTotal) return b.label;
  }
  return BANDAS[BANDAS.length - 1].label;
}

// % de integración 0–100 a partir de la suma total (8–40).
export function pctFromTotal(total) {
  return Math.max(0, Math.min(100, Math.round(((total - 8) / 32) * 100)));
}

export function bandaColor(label) {
  const b = BANDAS.find((x) => x.label === label);
  return b ? b.color : "#666";
}

// Helper: arma el arreglo [{id, texto}] emparejando NIVELES con los textos.
function preguntas(textos) {
  return NIVELES.map((id, i) => ({ id, texto: textos[i] }));
}

export const AUTOEVALS = {
  // ── Pilar 1 · Autoconocimiento ─────────────────────────────────────
  // Textos de banda DEFINITIVOS (Lic. Mariana Riojas).
  autoconocimiento: {
    pilar: "Autoconocimiento",
    titulo: "Autoevaluación de Autoconocimiento",
    accentColor: "#66A3F4",
    preguntas: preguntas([
      "Conozco bien mis fortalezas personales y debilidades de manera objetiva.",
      "He experimentado alegría o satisfacción al descubrir aspectos nuevos de mí mismo.",
      "Acepto mis emociones negativas (enojo, ansiedad, tristeza) sin buscar huir de ellas.",
      "Me comprometo de manera persistente con mi propio crecimiento personal y autoconocimiento, incluso cuando es incómodo.",
      "Reconozco mis límites y situaciones donde soy débil, y tomo las medidas necesarias para prevenir que mis debilidades salgan de control.",
      "Acepto retroalimentación y separo las críticas constructivas de los ataques personales.",
      "He integrado mis fortalezas y debilidades para encontrar un propósito más profundo en mi vida.",
      "Vivo de modo coherente entre mis ideales más altos y mis acciones del día a día.",
    ]),
    bandas: {
      "Fortaleza Actual": {
        lead: "Sabes quién eres y posees una identidad clara que no depende de tu cargo, tus logros externos ni de la validación de los demás. Reconoces tus talentos con humildad auténtica y tus sombras con compasión que te permite crecer sin castigarte. Has integrado tu historia logrando que el conocimiento de ti mismo corresponda con la persona que realmente quieres llegar a ser.",
        steps: [
          "Aplica una fortaleza VIA en un contexto nuevo esta semana (15 min).",
          "Practica las 'tres cosas buenas': registra tu papel activo en lo positivo de cada día.",
        ],
      },
      "Zona de Crecimiento": {
        lead: "Tienes una idea general de quién eres, pero a menudo te defines demasiado por lo que haces o por los roles que otros esperan. Hay zonas de tu personalidad que evitas explorar por miedo o por inercia. Tu reto es profundizar en tu interior para encontrar la seguridad que a veces buscas fuera.",
        steps: [
          "Escribe tu Mejor Yo Posible dentro de 6–12 meses (15 min).",
          "Lleva un diario de fortalezas 2–3 veces por semana (10 min).",
        ],
      },
      "Área de Atención": {
        lead: "Vives bajo la influencia de 'guiones cognitivos' antiguos que dictan cómo 'deberías' actuar basándote en tu historia pasada o en el deseo de complacer a los demás. Este guión actúa como profecía autocumplida que te mantiene en patrones reactivos.",
        steps: [
          "10 min de autoobservación en silencio cada día, sin teléfono.",
          "Identifica una etiqueta que te has autoimpuesto y cuestiónala con evidencia real.",
        ],
      },
      "Área Vulnerable": {
        lead: "Vives con una brújula interna borrosa, sintiendo confusión profunda sobre lo que realmente quieres, actuando casi siempre por inercia o presión de las circunstancias. El ruido exterior se ha convertido en tu refugio para no escuchar las verdades que duelen dentro.",
        steps: [
          "5 min de escritura honesta al día: ¿qué siento? ¿qué quiero realmente?",
          "Busca acompañamiento de alguien de confianza para explorar tus heridas con integridad.",
        ],
      },
    },
  },

  // ── Pilar 2 · Bienestar Emocional ──────────────────────────────────
  // Textos de banda PROVISIONALES — revisar con Lic. Mariana Riojas.
  bienestar_emocional: {
    pilar: "Bienestar Emocional",
    titulo: "Autoevaluación de Bienestar Emocional",
    accentColor: "#D21744",
    preguntas: preguntas([
      "Reconozco mis emociones en el momento en el que surgen; me doy cuenta al instante de qué siento y por qué.",
      "Suelo reconocer y permitirme sentir emociones agradables como alegría, calma o gratitud en mi día a día.",
      "Ante una situación negativa, puedo mirarla de modo objetivo o positivo y calmarme.",
      "Respondo a mis emociones de manera equilibrada, sin reprimirlas ni dejar que me dominen.",
      "Soy muy bueno para mirar las situaciones desde la perspectiva de los demás, aunque no esté de acuerdo.",
      "Puedo decir con bastante precisión si alguien está molesto conmigo o esconde algo.",
      "Acepto y le doy un sentido profundo a mis experiencias emocionales, incluso las difíciles o dolorosas.",
      "Experimento con cierta regularidad emociones positivas por conectar con un propósito o sentido más grande que mi propia vida.",
    ]),
    bandas: {
      "Fortaleza Actual": {
        lead: "Tu vida emocional está bien integrada: reconoces lo que sientes en el momento, lo regulas con flexibilidad y le das un lugar incluso a las emociones difíciles. Las emociones te informan sin gobernarte, y con frecuencia conectas con estados positivos ligados a algo más grande que tú.",
        steps: [
          "Nombra en voz alta una emoción al día y agradece lo que vino a enseñarte.",
          "Sostén una conversación honesta a la semana sobre cómo te sientes de verdad.",
        ],
      },
      "Zona de Crecimiento": {
        lead: "Reconoces tus emociones la mayor parte del tiempo, pero a veces te ganan o las pospones. Tienes recursos para calmarte, aunque no siempre los usas a tiempo. Tu reto es pasar de entender lo que sientes a acompañarlo con intención.",
        steps: [
          "Haz un check-in emocional mañana y noche (2 min) nombrando qué sientes.",
          "Antes de reaccionar ante algo intenso, prueba la pausa de tres respiraciones.",
        ],
      },
      "Área de Atención": {
        lead: "Te cuesta diferenciar entre lo que sientes, piensas y haces, y eso te desgasta. Las emociones intensas suelen tomar el control o quedar reprimidas. No es debilidad: es falta de entrenamiento emocional, y se entrena con prácticas breves y constantes.",
        steps: [
          "Lleva un registro simple de emociones apoyándote en una rueda de emociones.",
          "Identifica tus tres disparadores más frecuentes y anota qué los precede.",
        ],
      },
      "Área Vulnerable": {
        lead: "Hoy tu mundo emocional se siente confuso o abrumador, y con frecuencia respondes desde la reacción más que desde la elección. Reconocer esto ya es un paso valiente. Empezar con algo pequeño y constante puede cambiar mucho.",
        steps: [
          "Dedica 5 min al día a escribir sin filtro qué sentiste y en qué momento.",
          "Apóyate en una persona de confianza o un profesional para acompañar el proceso.",
        ],
      },
    },
  },

  // ── Pilar 3 · Bienestar Físico ─────────────────────────────────────
  // Textos de banda PROVISIONALES — revisar con Lic. Mariana Riojas.
  bienestar_fisico: {
    pilar: "Bienestar Físico",
    titulo: "Autoevaluación de Bienestar Físico",
    accentColor: "#8D9438",
    preguntas: preguntas([
      "Cuido mi cuerpo de la manera que realmente necesita para sostener mi vida y mis proyectos.",
      "En general, me siento bien en mi cuerpo, más allá de su apariencia o rendimiento.",
      "Mi cuerpo contribuye a que me sienta feliz y experimente alegría.",
      "Procuro hábitos concretos que favorecen mi salud y vitalidad: alimentación, ejercicio, sueño y demás.",
      "Con cierta regularidad busco superar retos en una actividad física o de autocuidado.",
      "Siento que mi nivel de energía y salud corresponde con la vida que deseo vivir.",
      "Veo mi cuerpo como un vehículo para vivir con mayor propósito o acercarme a lo que realmente importa.",
      "Por medio de cuidar mi cuerpo aporto a otros y dejo una huella más allá de mí mismo.",
    ]),
    bandas: {
      "Fortaleza Actual": {
        lead: "Tu cuerpo está al servicio de tu vida: te mueves, descansas y te alimentas con sentido, y tu energía corresponde a la vida que quieres vivir. Cuidarte ya no es una obligación sino una forma de honrar quién eres y de poder darte a otros.",
        steps: [
          "Mantén tu hábito ancla y añade un reto pequeño y medible este mes.",
          "Comparte una práctica de autocuidado con alguien que la necesite.",
        ],
      },
      "Zona de Crecimiento": {
        lead: "Sabes lo que tu cuerpo necesita y a veces lo haces. La brecha entre intención y acción es lo que toca cerrar. Tienes buenos cimientos; falta consistencia para que la vitalidad sea estable y no de rachas.",
        steps: [
          "Elige UN hábito ancla (caminar, dormir, agua) y sostenlo 8 semanas.",
          "Agenda tus tiempos de movimiento y descanso como citas no negociables.",
        ],
      },
      "Área de Atención": {
        lead: "Tu cuerpo te está pidiendo atención y la has venido aplazando por urgencia o por inercia. La energía baja y la falta de hábitos te pesan más de lo que admites. No hace falta un plan ambicioso: basta con empezar simple.",
        steps: [
          "Suma 30 min de sueño y un vaso de agua al despertar.",
          "Camina 10 min al día durante dos semanas y observa qué cambia.",
        ],
      },
      "Área Vulnerable": {
        lead: "Hoy el cuidado de tu cuerpo está en pausa y eso afecta tu ánimo, tu energía y tu vida entera. Reconocerlo es el inicio. Lo simple, sostenido y sin exigencias heroicas es lo que transforma.",
        steps: [
          "Elige un solo cambio mínimo y hazlo a la misma hora cada día.",
          "Si hay señales de salud que te preocupan, busca una valoración profesional.",
        ],
      },
    },
  },

  // ── Pilar 4 · Presencia Consciente ─────────────────────────────────
  // Textos de banda PROVISIONALES — revisar con Lic. Mariana Riojas.
  presencia_consciente: {
    pilar: "Presencia Consciente",
    titulo: "Autoevaluación de Presencia Consciente",
    accentColor: "#8D9438",
    preguntas: preguntas([
      "Soy capaz de notar y distinguir entre mis pensamientos, mis emociones y mis sensaciones físicas con claridad.",
      "Vivo las experiencias positivas diarias (comer, escuchar música) como anclas que me traen al presente, no como distracciones para sedar mis sentimientos.",
      "Estoy abierto a reconocer y acoger emociones tanto positivas como negativas, sin aferrarme ni rechazarlas.",
      "Por lo general soy capaz de mantener la concentración cuando me hablan, incluso cuando no me interesa particularmente el tema.",
      "Soy capaz de disfrutar del silencio o de una experiencia monótona sin tener que distraerme con el celular o pensando en otras cosas.",
      "Siento satisfacción con mi capacidad de estar realmente presente en mi vida diaria.",
      "Vivo mi vida desde una consciencia presente, y no desde la urgencia o el piloto automático.",
      "Conectar con el momento presente me ha ayudado a conectar con Dios o a tener una experiencia trascendente.",
    ]),
    bandas: {
      "Fortaleza Actual": {
        lead: "Habitas el presente con cierta naturalidad: distingues pensamiento, emoción y sensación, y vives lo cotidiano como ancla y no como huida. Esa presencia es un activo enorme en un mundo distraído, y para ti es también una puerta a lo trascendente.",
        steps: [
          "Sostén 10 min diarios de práctica formal de atención plena.",
          "Reserva un momento de silencio sin pantallas cada día.",
        ],
      },
      "Zona de Crecimiento": {
        lead: "Tienes destellos de presencia, pero la mente se va seguido al futuro o al pasado. Disfrutas algunos momentos plenamente y otros se te escapan en automático. Tu reto es volver al ahora con más frecuencia e intención.",
        steps: [
          "Ancla la atención en la respiración antes de cada comida.",
          "Escucha a alguien sin preparar tu respuesta, solo presente.",
        ],
      },
      "Área de Atención": {
        lead: "El piloto automático domina buena parte de tus días y muchas experiencias pasan sin que las habites. No es un problema mientras seas consciente; el reto es cuando ni lo notas. La presencia se recupera con práctica breve.",
        steps: [
          "Practica 3 min de atención plena al día durante 21 días.",
          "Una vez al día detente y nombra 3 cosas que ves, oyes y sientes.",
        ],
      },
      "Área Vulnerable": {
        lead: "Hoy te cuesta estar realmente presente: la urgencia, la distracción o el ruido se han vuelto refugio. Vivir desde ahí desgasta y te aleja de tu propia vida. Empezar pequeño y sin exigencia es el camino.",
        steps: [
          "Elige una actividad diaria y hazla sin celular, solo atento a ella.",
          "Tómate 1 min al despertar para respirar antes de tomar el teléfono.",
        ],
      },
    },
  },

  // ── Pilar 5 · Trabajo con Propósito ────────────────────────────────
  // Textos de banda PROVISIONALES — revisar con Lic. Mariana Riojas.
  trabajo_proposito: {
    pilar: "Trabajo con Propósito",
    titulo: "Autoevaluación de Trabajo con Propósito",
    accentColor: "#66A3F4",
    preguntas: preguntas([
      "Por lo general me esfuerzo en que mi trabajo esté hecho de modo excelente.",
      "Experimento un disfrute más allá del logro material o del reconocimiento externo –plenitud, inspiración, gratitud o conexión profunda– con lo que hago y para quién lo hago.",
      "Me siento en armonía y con una perspectiva positiva hacia el futuro en relación con mi trabajo.",
      "Desarrollo mis ocupaciones del trabajo con entrega y dedicación.",
      "Tengo la posibilidad de experimentar éxito o crecimiento en mis ocupaciones.",
      "Me siento satisfecho con la posición y ocupación que tengo laboralmente.",
      "Mis trabajos y labores los hago para beneficiar a alguien más o por un sentido más allá de mí mismo.",
      "Siento que por medio de mi trabajo cumplo con mi misión de vida o que mi trabajo enriquece el sentido de mi vida.",
    ]),
    bandas: {
      "Fortaleza Actual": {
        lead: "Tu trabajo se siente como expresión de quién eres y no como peso. Lo haces con excelencia y entrega, conectado a un sentido que va más allá del logro o el reconocimiento. Sientes que aporta a otros y enriquece tu propia vida.",
        steps: [
          "Comparte tu conocimiento con alguien que apenas empieza.",
          "Integra descanso real y varía tus retos para sostener la inspiración.",
        ],
      },
      "Zona de Crecimiento": {
        lead: "Hay días en que tu trabajo conecta con algo más grande y otros en que es solo obligación. Tienes satisfacción y crecimiento, pero el sentido aparece de forma intermitente. Articularlo mejor puede cambiar tu experiencia diaria.",
        steps: [
          "Escribe en una frase qué impacto tiene tu trabajo en otras personas.",
          "Identifica una tarea que sí te da sentido y dale más espacio esta semana.",
        ],
      },
      "Área de Atención": {
        lead: "Tu trabajo se siente más como trámite que como camino. Cumples, pero la conexión con un propósito se ha ido apagando. No necesitas un cambio drástico para reencontrarla, sino un punto de entrada concreto.",
        steps: [
          "Suma un proyecto pequeño (voluntario o personal) donde tus habilidades sirvan a algo que te importa.",
          "Anota al final del día una cosa de tu trabajo que valió la pena.",
        ],
      },
      "Área Vulnerable": {
        lead: "Hoy tu trabajo se vive como desgaste o vacío de sentido, y eso pesa sobre el resto de tu vida. Reconocerlo es importante. El propósito se reconstruye desde lo pequeño, no desde una gran decisión inmediata.",
        steps: [
          "Identifica qué parte de lo que haces, por mínima que sea, te conecta con un valor tuyo.",
          "Conversa con alguien de confianza sobre qué te daría más sentido laboral.",
        ],
      },
    },
  },

  // ── Pilar 6 · Vínculos Vitales ─────────────────────────────────────
  // Textos de banda PROVISIONALES — revisar con Lic. Mariana Riojas.
  vinculos_vitales: {
    pilar: "Vínculos Vitales",
    titulo: "Autoevaluación de Vínculos Vitales",
    accentColor: "#D21744",
    preguntas: preguntas([
      "Busco activamente el bien y la felicidad de las personas que amo, más allá de mis propios intereses.",
      "Encuentro alegría genuina al darme a los demás y compartir tiempo, cuidado o apoyo.",
      "Me nutro emocionalmente de la cercanía, la empatía y la conexión auténtica con otros.",
      "Me esfuerzo de manera constante y libre por sostener y profundizar mis relaciones, incluso en momentos difíciles.",
      "He superado obstáculos o dificultades en mi camino de amar, aprendiendo a crecer al darme a mí mismo con generosidad.",
      "Siento plenitud y satisfacción cuando veo florecer a quienes amo gracias a mi apoyo o compañía.",
      "Vivo el amor como una razón fundamental de mi existencia y una fuente de sentido vital.",
      "Mi capacidad de amar trasciende mis propios límites, impacta positivamente a mi entorno y deja huella en la vida de otros.",
    ]),
    bandas: {
      "Fortaleza Actual": {
        lead: "Tus vínculos te nutren y tú los nutres. Buscas activamente el bien de quienes amas, sostienes tus relaciones incluso en lo difícil y encuentras en el amor una fuente honda de sentido. Tu manera de amar deja huella más allá de ti.",
        steps: [
          "Dedica tiempo de calidad sin pantallas a una relación clave esta semana.",
          "Expresa a alguien, en concreto, por qué su presencia importa en tu vida.",
        ],
      },
      "Zona de Crecimiento": {
        lead: "Tienes relaciones importantes y te das a los demás, pero hay vínculos que podrías profundizar. La intencionalidad es el ingrediente que a veces falta: estar de verdad, no solo coincidir.",
        steps: [
          "Elige una persona con quien quieras estar más cerca y agenda algo concreto.",
          "Pregunta y escucha de verdad cómo está alguien que te importa.",
        ],
      },
      "Área de Atención": {
        lead: "Tienes personas alrededor, pero la conexión auténtica se siente escasa o intermitente. Cuesta sostener las relaciones cuando hay roces o distancia. Reconectar empieza con gestos pequeños y constantes.",
        steps: [
          "Escribe hoy a alguien sin esperar respuesta inmediata, solo para abrir la puerta.",
          "Retoma un vínculo que valoras con una invitación sencilla.",
        ],
      },
      "Área Vulnerable": {
        lead: "Hoy la soledad o los vínculos rotos pesan más de lo que sueles admitir. Reconocerlo es un acto de honestidad y de valentía. Reconectar no exige una gran conversación: empieza con un primer paso pequeño.",
        steps: [
          "Manda un mensaje breve a una persona en quien confías.",
          "Busca un espacio (grupo, actividad, acompañamiento) donde construir vínculo con regularidad.",
        ],
      },
    },
  },

  // ── Pilar 7 · Estética Existencial ─────────────────────────────────
  // Textos de banda PROVISIONALES — revisar con Lic. Mariana Riojas.
  estetica_existencial: {
    pilar: "Estética Existencial",
    titulo: "Autoevaluación de Estética Existencial",
    accentColor: "#E3A52D",
    preguntas: preguntas([
      "En mi día a día me fijo de manera espontánea en la armonía o la belleza que me rodea, aunque sean cosas sencillas.",
      "Cultivo momentos de disfrute estético que alimentan mi espíritu y no solo mis sentidos.",
      "Procuro prácticas o entornos que contribuyan a sentir serenidad, gratitud o inspiración de forma natural.",
      "Me mantengo constante en proyectos o hábitos incluso cuando no hay un resultado inmediato.",
      "He superado desafíos para crear o sostener algo bello y significativo en mi entorno o en mí mismo.",
      "Mi modo de vivir está alineado con los valores que tengo y que deseo.",
      "Vivo mi vida de un modo alegre, en armonía con los demás, mi entorno y el mundo en general.",
      "Mi forma de vivir la belleza deja huella en otros y en el mundo que me rodea.",
    ]),
    bandas: {
      "Fortaleza Actual": {
        lead: "Vives con estética: notas la belleza en lo cotidiano, cultivas el disfrute que alimenta el espíritu y sostienes lo que creas aunque no haya resultado inmediato. Tu modo de vivir, alineado con tus valores, deja huella en otros.",
        steps: [
          "Crea o cuida algo bello esta semana sin más fin que el disfrute.",
          "Comparte tu mirada: invita a alguien a apreciar la belleza contigo.",
        ],
      },
      "Zona de Crecimiento": {
        lead: "Aprecias lo bello cuando aparece y tienes momentos de disfrute estético, pero podrías invitarlos más seguido y con más intención. La belleza alimenta capas que la productividad no toca.",
        steps: [
          "Reserva 10 min al día para algo bello: música atenta, lectura, naturaleza.",
          "Sostén un proyecto creativo pequeño aunque avance lento.",
        ],
      },
      "Área de Atención": {
        lead: "La belleza está bastante en pausa en tu vida, quizá por urgencia o por hábito. La aprecias poco y rara vez la cultivas. Recuperarla empieza con gestos mínimos y cotidianos.",
        steps: [
          "Coloca un objeto bello en tu espacio y obsérvalo a diario.",
          "Empieza el día con una canción o imagen que te conmueva.",
        ],
      },
      "Área Vulnerable": {
        lead: "Hoy lo bello casi no tiene lugar en tu vida y eso empobrece tu experiencia más de lo que parece. La belleza no es lujo, es nutrición existencial. Reconocer su ausencia es el primer paso para recuperarla.",
        steps: [
          "Una vez al día detente 1 min a mirar algo con atención y sin prisa.",
          "Dedica un rato a la semana a una actividad que te conecte con lo bello.",
        ],
      },
    },
  },

  // ── Pilar 8 · Fe y Filosofía de Vida ───────────────────────────────
  // Textos de banda PROVISIONALES — revisar con Lic. Mariana Riojas.
  fe_filosofia: {
    pilar: "Fe y Filosofía de Vida",
    titulo: "Autoevaluación de Fe y Filosofía de Vida",
    accentColor: "#E3A52D",
    preguntas: preguntas([
      "Tengo una confianza profunda o creencia firme en algo o alguien que guía mi vida.",
      "Vivir de acuerdo a mi fe (o filosofía de vida) me permite experimentar instancias o momentos disfrutables.",
      "Mi fe o filosofía de vida es motivo de emociones positivas como esperanza y gratitud.",
      "Mantengo una actitud constante y persistente respecto de mis creencias fundamentales de vida.",
      "Mi fe o filosofía de vida se va haciendo cada vez más profunda dentro de mí.",
      "Siento satisfacción entre lo que espero de mi fe y la manera en que impacta mi vida.",
      "Sé por qué me arraigo con fuerza a aquello en lo que creo.",
      "Mi fe se alinea con una actitud de apertura al otro y a un sentido de lo Absoluto.",
    ]),
    bandas: {
      "Fortaleza Actual": {
        lead: "Tienes un marco –espiritual, filosófico, o ambos– que da sentido a tu vida y te ancla cuando las circunstancias se mueven. Lo vives con constancia, se hace más hondo con el tiempo y te abre al otro y a un sentido de lo Absoluto.",
        steps: [
          "Sostén una práctica regular de lectura o reflexión contemplativa.",
          "Comparte tus convicciones en una conversación profunda y abierta.",
        ],
      },
      "Zona de Crecimiento": {
        lead: "Tienes convicciones que te orientan, pero no siempre del todo articuladas o constantes. Tu fe o filosofía de vida está viva, aunque a veces queda en segundo plano frente a la rutina.",
        steps: [
          "Escribe 20 min sobre qué crees realmente y por qué.",
          "Reserva un tiempo fijo a la semana para tu práctica o reflexión.",
        ],
      },
      "Área de Atención": {
        lead: "Las preguntas grandes –sentido, trascendencia, qué guía tu vida– suelen quedar aplazadas. Tienes intuiciones, pero falta arraigo y constancia. No es un defecto: es una invitación abierta.",
        steps: [
          "Dedica un momento semanal a una lectura o conversación sobre el sentido de vida.",
          "Identifica un valor que sí te orienta y vuélvelo explícito en tus decisiones.",
        ],
      },
      "Área Vulnerable": {
        lead: "Hoy sientes poco arraigo en algo que dé sentido último a tu vida, y eso puede dejar una sensación de intemperie. No necesitas tener todas las respuestas; basta empezar a hacerte mejores preguntas.",
        steps: [
          "Escribe qué te gustaría que diera sentido a tu vida, sin censurarte.",
          "Acércate a una tradición, lectura o persona que te ayude a explorar estas preguntas.",
        ],
      },
    },
  },
};

// Orden canónico de los pilares (para menús, navegación, etc.).
export const AUTOEVAL_KEYS = Object.keys(AUTOEVALS);

export function getAutoevalDef(key) {
  return AUTOEVALS[(key || "").trim()] || null;
}
