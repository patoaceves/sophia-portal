// SOPHIA Portal · Autoevaluación Autoconocimiento (wizard de 8 preguntas).
//
// Modelo: los 8 niveles de integración del modelo SOPHIA (adecuadamente,
// disfrute, emociones positivas, compromiso, logro, satisfacción, sentido,
// trascendencia) aplicados al pilar Autoconocimiento. Una pregunta por
// nivel, Likert 1–5 (Muy en desacuerdo → Muy de acuerdo).
//
// Resultado: % de integración (de 0 a 100, basado en suma 8-40) +
// banda (Fortaleza Actual / Zona Crecimiento / Área Atención / Área Vulnerable).
//
// Modos de uso (idéntico al test-felicidad):
//   1. Standalone (`/app/test-autoconocimiento?inscripcion=X[&leccion=Y]`)
//   2. Embedded (mountWizard() desde leccion.js)

import { requireAuth } from "./auth.js";
import { api } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";
import { icon } from "./icons.js";

// Reusamos los mismos clases CSS (.test-wizard, .test-question, .dot-option, etc.)
// del test-felicidad. NO duplicar estilos en shell.css.

const PREGUNTAS = [
  { id: "adecuadamente", texto: "¿Reconozco y utilizo mis fortalezas en el momento y lugar adecuados para lo que la situación requiere?" },
  { id: "disfrute",      texto: "¿He experimentado alegría o satisfacción al descubrir aspectos nuevos de mí mismo, más allá de logros externos?" },
  { id: "emociones_pos", texto: "¿De qué manera el conocerme mejor influye en mi capacidad para generar y mantener estados emocionales armoniosos?" },
  { id: "compromiso",    texto: "¿Me comprometo de manera persistente con mi propio crecimiento personal y autoconocimiento, incluso cuando es incómodo?" },
  { id: "logro",         texto: "¿He superado una limitación personal o he potenciado una fortaleza gracias a mi autoconocimiento?" },
  { id: "satisfaccion",  texto: "¿Siento que el conocimiento que tengo de mí mismo corresponde con la persona que quiero llegar a ser?" },
  { id: "sentido",       texto: "¿De qué forma conocer mis fortalezas y debilidades me ayuda a encontrar un propósito más profundo en mi vida?" },
  { id: "trascendencia", texto: "¿Cómo puede mi autoconocimiento contribuir al bienestar de otros o inspirar a quienes me rodean?" },
];

const ESCALA_LABELS = {
  min: "Muy en desacuerdo",
  max: "Muy de acuerdo",
};

// ────────────────────────────────────────────────────────────────────
// Public API: mountWizard
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
  return `
    <div class="test-intro">
      <span class="test-intro__eyebrow">Tu autoevaluación · Capítulo 2</span>
      <h2 class="test-intro__title">Autoconocimiento</h2>
      <p class="test-intro__lead">
        8 preguntas para medir qué tan integrado tienes el autoconocimiento
        en tu vida, según los 8 niveles del modelo SOPHIA. Tarda unos 3 minutos.
      </p>
      <p class="test-intro__note">
        Responde en una escala del 1 al 5, donde 1 es Muy en desacuerdo y
        5 es Muy de acuerdo. Sé honesto: el valor de la autoevaluación
        depende totalmente de eso.
      </p>
      <button class="btn btn-accent btn-lg" data-test-action="start" type="button">
        <span>Comenzar evaluación</span>
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
        aria-label="${v} - ${v === 1 ? ESCALA_LABELS.min : v === 5 ? ESCALA_LABELS.max : ""}"
      >
        <span class="dot-option__circle dot-option__circle--${v}"></span>
      </button>
    `;
  }).join("");

  return `
    <article class="test-question">
      <div class="test-question__pilar">Autoconocimiento · Pregunta ${idx + 1} de ${PREGUNTAS.length}</div>
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

  state.submitting = true;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span>Enviando…</span>`;

  try {
    const result = await api.submitAutoconocimiento(state.inscripcionId, state.respuestas);
    if (state.leccionId) {
      try { await api.marcarLeccion(state.leccionId, state.inscripcionId); } catch (e) {
        console.warn("[autoconocimiento] marcarLeccion failed (non-fatal):", e);
      }
    }
    if (state.onComplete) {
      state.onComplete(result);
    } else {
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
// Standalone bootstrap
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
      title: "Autoevaluación Autoconocimiento",
      activePath: "/app/cursos",
      contentHtml: `
        <div class="empty-state">
          <div class="empty-state__title">No estás inscrito en el curso de esta autoevaluación</div>
          <p class="empty-state__desc">La autoevaluación de Autoconocimiento es parte de un workshop. <a href="/app/cursos">Ver mis cursos</a>.</p>
        </div>
      `,
    });
    return;
  }

  renderShell({
    persona,
    title: "Autoevaluación · Autoconocimiento",
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

export const AUTOCONOCIMIENTO_PREGUNTAS = PREGUNTAS;
