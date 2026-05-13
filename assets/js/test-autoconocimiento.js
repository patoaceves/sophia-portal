// SOPHIA Portal · Autoevaluación VIA Autoconocimiento (wizard de 24 preguntas).
//
// Modelo: las 24 fortalezas de carácter (Peterson & Seligman, 2004), agrupadas
// en 6 virtudes. Una pregunta por fortaleza, Likert 1–5 (Casi nunca → Casi siempre).
//
// Modos de uso (idéntico al test-felicidad):
//   1. Standalone (`/app/test-autoconocimiento?inscripcion=X[&leccion=Y]`):
//      el módulo se auto-monta al cargar la página, dentro del shell normal.
//   2. Embedded (`mountWizard(...)` desde leccion.js):
//      monta el wizard dentro de un contenedor existente, sin tocar el shell.
//      Mantiene el checkpoint bar de la lección visible.
//
// UX (igual en los dos modos):
//   - Una pregunta a la vez con dots tappables (1-5)
//   - Auto-avance al seleccionar (mini-delay para feedback visual)
//   - Botón anterior/siguiente para navegación manual
//   - Al responder la última, ENVÍA y redirige a resultados
//   - Si falta alguna respuesta al final, te lleva a la primera sin responder

import { requireAuth } from "./auth.js";
import { api } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";
import { icon } from "./icons.js";

// Reusamos los mismos clases CSS (.test-wizard, .test-question, .dot-option,
// etc.) que el test-felicidad. NO duplicar estilos en shell.css.

const PREGUNTAS = [
  // I. Sabiduría y Conocimiento
  { id: "S1", virtud: "sabiduria",      fortaleza: "Creatividad",                        texto: "Invento nuevas formas de hacer tareas aburridas solo para entretenerme, aunque nadie lo note." },
  { id: "S2", virtud: "sabiduria",      fortaleza: "Curiosidad",                         texto: "Hago preguntas tan inesperadas que la gente a mi alrededor se ríe o se queda pensando." },
  { id: "S3", virtud: "sabiduria",      fortaleza: "Apertura de mente",                  texto: "Cambio de opinión cuando alguien me da un argumento brillante, aunque contradiga lo que siempre he pensado." },
  { id: "S4", virtud: "sabiduria",      fortaleza: "Deseo de aprender",                  texto: "Me inscribo a cursos solo por el placer de descubrir algo nuevo, aunque nunca lo use para mi trabajo." },
  { id: "S5", virtud: "sabiduria",      fortaleza: "Perspectiva",                        texto: "Mis amigos me buscan cuando están en un dilema, porque saben que veo el problema desde otro ángulo." },

  // II. Coraje
  { id: "C1", virtud: "coraje",         fortaleza: "Valentía",                           texto: "Defiendo una idea poco popular en una conversación difícil, aunque quede como \"el raro\" del grupo." },
  { id: "C2", virtud: "coraje",         fortaleza: "Persistencia",                       texto: "Sigo intentando una receta, proyecto o ejercicio aunque falle varias veces, porque sé que puedo lograrlo." },
  { id: "C3", virtud: "coraje",         fortaleza: "Integridad",                         texto: "Admito mis errores aunque podría culpar discretamente a alguien más y salir bien librado." },
  { id: "C4", virtud: "coraje",         fortaleza: "Vitalidad",                          texto: "Hay días en los que mi energía entusiasma tanto a otros que contagio mis ganas de hacer cosas, incluso un lunes lluvioso." },

  // III. Humanidad
  { id: "H1", virtud: "humanidad",      fortaleza: "Amor",                               texto: "Me tomo tiempo para escuchar a mis seres queridos, aunque mi día esté a tope de pendientes." },
  { id: "H2", virtud: "humanidad",      fortaleza: "Amabilidad",                         texto: "Hago favores sin que me los pidan, como dejar un mensaje bonito o ayudar en una mudanza." },
  { id: "H3", virtud: "humanidad",      fortaleza: "Inteligencia social",                texto: "Detecto fácilmente cuándo alguien finge estar bien y le doy espacio o compañía según lo necesita." },

  // IV. Justicia
  { id: "J1", virtud: "justicia",       fortaleza: "Ciudadanía",                         texto: "Prefiero cooperar en equipo, incluso si trabajar solo sería más rápido." },
  { id: "J2", virtud: "justicia",       fortaleza: "Justicia",                           texto: "Me incomoda cuando veo que alguien recibe un trato injusto, aunque no tenga nada que ganar si intervengo." },
  { id: "J3", virtud: "justicia",       fortaleza: "Liderazgo",                          texto: "Me ha tocado mediar en una discusión o motivar a un grupo a no rendirse, aunque no me hubieran elegido líder." },

  // V. Moderación
  { id: "M1", virtud: "moderacion",     fortaleza: "Perdón y compasión",                 texto: "Soy capaz de dejar ir un rencor antiguo después de una buena conversación (o de una siesta)." },
  { id: "M2", virtud: "moderacion",     fortaleza: "Humildad",                           texto: "Puedo reírme de mis propios errores y dejar que otros brillen aunque me toque el papel discreto." },
  { id: "M3", virtud: "moderacion",     fortaleza: "Prudencia",                          texto: "Pienso dos veces antes de enviar un mensaje \"honesto\" que podría herir, incluso si lo siento justo." },
  { id: "M4", virtud: "moderacion",     fortaleza: "Autorregulación",                    texto: "Resisto la tentación de ver \"solo un capítulo más\" cuando sé que debo madrugar." },

  // VI. Trascendencia
  { id: "T1", virtud: "trascendencia",  fortaleza: "Apreciación de la belleza",          texto: "Me sorprendo admirando lo extraordinario en cosas simples, como la forma de una nube o el sabor de un buen café." },
  { id: "T2", virtud: "trascendencia",  fortaleza: "Gratitud",                           texto: "Agradezco en voz alta lo que otros hacen por mí, incluso detalles cotidianos como servirme agua o guardar un asiento." },
  { id: "T3", virtud: "trascendencia",  fortaleza: "Esperanza",                          texto: "Pienso que, pase lo que pase, siempre puedo encontrar una salida o un aprendizaje." },
  { id: "T4", virtud: "trascendencia",  fortaleza: "Sentido del humor",                  texto: "Soy capaz de hacer un chiste en momentos tensos, o reírme de mí mismo cuando algo sale mal." },
  { id: "T5", virtud: "trascendencia",  fortaleza: "Espiritualidad",                     texto: "Siento, aunque sea a veces, que hay algo más grande que yo mismo que da sentido a mi vida." },
];

const VIRTUD_NOMBRES = {
  sabiduria:     "Sabiduría y Conocimiento",
  coraje:        "Coraje",
  humanidad:     "Humanidad",
  justicia:      "Justicia",
  moderacion:    "Moderación",
  trascendencia: "Trascendencia",
};

const ESCALA_LABELS = {
  min: "Casi nunca",
  max: "Casi siempre",
};

// ────────────────────────────────────────────────────────────────────
// Public API: mountWizard · usado por leccion.js para modo embedded
// ────────────────────────────────────────────────────────────────────

export function mountWizard(opts) {
  const state = {
    inscripcionId: opts.inscripcionId,
    leccionId: opts.leccionId || null,
    cursoSlug: opts.cursoSlug || null,
    embedded: !!opts.embedded,
    onComplete: opts.onComplete || null,
    container: opts.container,
    respuestas: {},
    currentIndex: -1,
    submitting: false,
  };

  state.container.addEventListener("click", (e) => clickHandler(state, e));
  renderInto(state);
  return state;
}

function renderInto(state) {
  const total = PREGUNTAS.length;
  const isIntro = state.currentIndex === -1;
  const pct = isIntro ? 0 : Math.round(((state.currentIndex + 1) / total) * 100);

  const bodyHtml = isIntro
    ? renderIntro()
    : renderPregunta(state.currentIndex, state.respuestas);

  const headerHtml = state.embedded ? "" : `
    <header class="test-wizard__header">
      <a href="${backHref(state)}" class="page-back">
        ${icon("chevronLeft")}
        <span>Salir del test</span>
      </a>
      ${!isIntro ? `<div class="test-wizard__counter">Pregunta ${state.currentIndex + 1} de ${total}</div>` : ""}
    </header>
  `;

  const wizardClass = `test-wizard ${state.embedded ? "test-wizard--embedded" : ""}`;

  const progressBarHtml = isIntro ? "" : `
    <div class="test-progress">
      <div class="test-progress__bar">
        <div class="test-progress__fill" style="width: ${pct}%;"></div>
      </div>
      <div class="test-progress__label">${state.currentIndex + 1} de ${total}</div>
    </div>
  `;

  state.container.innerHTML = `
    ${progressBarHtml}
    <div class="${wizardClass}">
      ${headerHtml}
      <div class="test-wizard__body">${bodyHtml}</div>
    </div>
  `;
}

function backHref(state) {
  return state.cursoSlug
    ? `/app/curso?slug=${encodeURIComponent(state.cursoSlug)}`
    : "/app/cursos";
}

function renderIntro() {
  // Listamos las 6 virtudes como "pills" — análogo a los pilares en el
  // test de felicidad.
  const virtudes = Object.values(VIRTUD_NOMBRES);
  return `
    <div class="test-intro">
      <span class="test-intro__eyebrow">Tu autoevaluación · Capítulo 2</span>
      <h2 class="test-intro__title">Tus fortalezas de carácter VIA</h2>
      <p class="test-intro__lead">
        Una autoevaluación de 24 preguntas basada en la clasificación de
        Peterson y Seligman (2004). Tarda unos 7 minutos. Al final descubres
        tus 5 fortalezas firma y el ranking completo de las 24.
      </p>
      <div class="test-intro__pillars">
        ${virtudes.map((v) => `<span class="test-intro__pillar">${escapeHtml(v)}</span>`).join("")}
      </div>
      <p class="test-intro__note">
        No hay fortalezas "buenas" ni "malas". Sé honesto contigo: el valor de
        la autoevaluación depende totalmente de eso.
      </p>
      <button class="btn btn-accent btn-lg" data-test-action="start" type="button">
        <span>Empezar la autoevaluación</span>
        ${icon("arrowRight")}
      </button>
    </div>
  `;
}

function renderPregunta(idx, respuestas) {
  const p = PREGUNTAS[idx];
  const selected = respuestas[p.id];
  const isLast = idx === PREGUNTAS.length - 1;

  const dots = [1, 2, 3, 4, 5].map((v) => {
    const active = selected === v;
    return `
      <button
        class="dot-option ${active ? "is-active" : ""}"
        data-test-action="answer"
        data-value="${v}"
        type="button"
        aria-label="${v} - ${v === 1 ? "Casi nunca" : v === 5 ? "Casi siempre" : ""}"
      >
        <span class="dot-option__circle dot-option__circle--${v}"></span>
      </button>
    `;
  }).join("");

  // Mostramos virtud + fortaleza concreta como dos niveles de contexto.
  const eyebrow = `${VIRTUD_NOMBRES[p.virtud]} · ${p.fortaleza}`;

  return `
    <article class="test-question">
      <div class="test-question__pilar">${escapeHtml(eyebrow)}</div>
      <h2 class="test-question__texto">${escapeHtml(p.texto)}</h2>

      <div class="dot-scale">
        <span class="dot-scale__label dot-scale__label--min">${escapeHtml(ESCALA_LABELS.min)}</span>
        <div class="dot-scale__dots">${dots}</div>
        <span class="dot-scale__label dot-scale__label--max">${escapeHtml(ESCALA_LABELS.max)}</span>
      </div>

      <footer class="test-question__nav">
        <button class="btn btn-ghost" data-test-action="prev" type="button" ${idx === 0 ? "disabled" : ""}>
          ${icon("arrowLeft")}
          <span>Anterior</span>
        </button>
        ${isLast && selected ? `
          <button class="btn btn-accent" data-test-action="next" type="button">
            <span>Ver resultados</span>
            ${icon("arrowRight")}
          </button>
        ` : `<span></span>`}
      </footer>
    </article>
  `;
}

async function clickHandler(state, e) {
  const btn = e.target.closest("[data-test-action]");
  if (!btn) return;
  const action = btn.dataset.testAction;

  if (action === "start") {
    state.currentIndex = 0;
    renderInto(state);
    return;
  }

  if (action === "answer") {
    const v = parseInt(btn.getAttribute("data-value"), 10);
    const p = PREGUNTAS[state.currentIndex];
    state.respuestas[p.id] = v;

    // Feedback visual inmediato
    const allDots = btn.parentElement?.querySelectorAll(".dot-option");
    if (allDots) {
      allDots.forEach((d) => d.classList.remove("is-active"));
      btn.classList.add("is-active");
    }

    const isLast = state.currentIndex === PREGUNTAS.length - 1;
    if (isLast) {
      setTimeout(async () => {
        try {
          await submitTest(state, btn);
        } catch (err) {
          console.error("auto-submit failed:", err);
          renderInto(state);
        }
      }, 320);
    } else {
      setTimeout(() => {
        state.currentIndex += 1;
        renderInto(state);
      }, 280);
    }
    return;
  }

  if (action === "prev") {
    if (state.currentIndex > 0) {
      state.currentIndex -= 1;
      renderInto(state);
    }
    return;
  }

  if (action === "next") {
    const isLast = state.currentIndex === PREGUNTAS.length - 1;
    if (isLast) {
      await submitTest(state, btn);
    } else {
      state.currentIndex += 1;
      renderInto(state);
    }
    return;
  }
}

async function submitTest(state, submitBtn) {
  if (state.submitting) return;

  const missing = PREGUNTAS.find((p) => !state.respuestas[p.id]);
  if (missing) {
    const missingIdx = PREGUNTAS.indexOf(missing);
    console.warn("[autoconocimiento] Missing answer for question", missingIdx + 1, missing.id);
    state.currentIndex = missingIdx;
    renderInto(state);
    const card = state.container.querySelector(".test-question");
    if (card) {
      const note = document.createElement("div");
      note.className = "test-error-flash";
      note.textContent = `Faltan respuestas (esta es la pregunta ${missingIdx + 1}). Termínala para enviar la autoevaluación.`;
      card.prepend(note);
      setTimeout(() => note.remove(), 5000);
    }
    return;
  }

  console.log("[autoconocimiento] Submitting", Object.keys(state.respuestas).length, "answers");
  state.submitting = true;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span>Enviando…</span>`;

  try {
    const result = await api.submitAutoconocimiento(state.inscripcionId, state.respuestas);
    console.log("[autoconocimiento] Submit succeeded:", result);
    if (state.leccionId) {
      try { await api.marcarLeccion(state.leccionId, state.inscripcionId); } catch (e) {
        console.warn("[autoconocimiento] marcarLeccion failed (non-fatal):", e);
      }
    }
    if (state.onComplete) {
      state.onComplete(result);
    } else {
      // Standalone: redirect to results
      const slugParam = state.cursoSlug ? `&slug=${encodeURIComponent(state.cursoSlug)}` : "";
      location.replace(
        `/app/test-autoconocimiento/resultados?id=${encodeURIComponent(result.respuestaId)}${slugParam}`,
      );
    }
  } catch (err) {
    console.error("[autoconocimiento] Submit failed:", err);
    state.submitting = false;
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>Reintentar</span> ${icon("arrowRight")}`;
    alert(`No se pudieron guardar tus respuestas: ${err.message}`);
  }
}

// ────────────────────────────────────────────────────────────────────
// Standalone bootstrap (sólo cuando este script es el entry de la página)
// ────────────────────────────────────────────────────────────────────

const isStandalone = location.pathname.startsWith("/app/test-autoconocimiento")
  && !location.pathname.startsWith("/app/test-autoconocimiento/resultados");

if (isStandalone) {
  bootstrapStandalone();
}

async function bootstrapStandalone() {
  const persona = await requireAuth();
  if (!persona) return;

  const params = new URLSearchParams(location.search);
  let inscripcionId = params.get("inscripcion");
  const leccionId = params.get("leccion");
  let cursoSlug = null;

  if (!inscripcionId) {
    try {
      const { cursos } = await api.misCursos();
      const c = cursos[0];
      if (c) {
        inscripcionId = c.inscripcionId;
        cursoSlug = c.slug;
      }
    } catch (e) {
      console.error("Could not resolve inscripcion:", e);
    }
  } else {
    try {
      const { cursos } = await api.misCursos();
      const c = cursos.find((x) => x.inscripcionId === inscripcionId);
      if (c) cursoSlug = c.slug;
    } catch {}
  }

  if (!inscripcionId) {
    renderShell({
      persona,
      title: "Autoevaluación VIA",
      activePath: "/app/cursos",
      contentHtml: `
        <div class="empty-state">
          <div class="empty-state__title">No estás inscrito en el curso de esta autoevaluación</div>
          <p class="empty-state__desc">La autoevaluación VIA es parte de un workshop. <a href="/app/cursos">Ver mis cursos</a>.</p>
        </div>
      `,
    });
    return;
  }

  renderShell({
    persona,
    title: "Autoevaluación VIA · Fortalezas",
    activePath: "/app/cursos",
    contentHtml: `<div id="testWizardMount"></div>`,
  });

  const container = document.getElementById("testWizardMount");
  mountWizard({
    container,
    inscripcionId,
    leccionId,
    cursoSlug,
    embedded: false,
  });
}

// Export para que get-resultados-autoconocimiento + dashboard puedan leer el catálogo
export const VIA_PREGUNTAS = PREGUNTAS;
export const VIA_VIRTUDES = VIRTUD_NOMBRES;
