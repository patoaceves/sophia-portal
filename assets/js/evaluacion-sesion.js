// SOPHIA Portal · Evaluación de sesión (wizard nativo)
//
// Reemplaza el iframe del Google Form. Mismo patrón que test-felicidad.js:
//   - Una pregunta por pantalla
//   - Barra de progreso
//   - Mezcla de rating 1-5 y texto libre
//   - Submit muestra estado "¡Gracias!" y marca la lección como completada
//
// Uso:
//   import { mountEvaluacion } from "./evaluacion-sesion.js";
//   mountEvaluacion({
//     container: document.getElementById("evalEmbed"),
//     leccionId: leccion.id,
//     inscripcionId,
//     onComplete: () => { /* mark lesson done */ },
//     preguntas: undefined,  // opcional, usa default si no se pasa
//   });
//
// Persistencia local (sessionStorage) para no perder respuestas al recargar
// dentro de la misma sesión. NO hay backend persistente todavía — TODO v18.

import { icon } from "./icons.js";
import { escapeHtml } from "./ui-shell.js";

// ─────────────────────────────────────────────────────────────────────
// Preguntas por defecto · 6 preguntas reales del Google Form de SOPHIA.
// Los `id` mapean directo a los campos de Airtable en "Evaluaciones Sesión".
// ─────────────────────────────────────────────────────────────────────
export const DEFAULT_PREGUNTAS_SESION = [
  {
    id: "profesor_preparado",
    tipo: "rating",
    eyebrow: "Sobre el profesor",
    texto: "¿Qué tan claro y preparado percibiste al profesor durante la sesión?",
    minLabel: "Confuso",
    maxLabel: "Muy claro y dominó el tema",
    obligatoria: true,
  },
  {
    id: "contenido_relevante",
    tipo: "rating",
    eyebrow: "Sobre el contenido",
    texto: "¿Qué tan relevante fue el contenido de esta sesión para tu vida personal o profesional?",
    minLabel: "Nada relevante",
    maxLabel: "Muy relevante",
    obligatoria: true,
  },
  {
    id: "fomento_participacion",
    tipo: "rating",
    eyebrow: "Sobre la dinámica",
    texto: "¿Cómo evaluarías la forma en que el profesor fomentó la participación y el diálogo?",
    minLabel: "Deficiente",
    maxLabel: "Excelente",
    obligatoria: true,
  },
  {
    id: "ideas_aplicables",
    tipo: "rating",
    eyebrow: "Sobre el aprendizaje",
    texto: "¿En qué medida te llevas ideas o herramientas aplicables a tu día a día?",
    minLabel: "Nada",
    maxLabel: "Mucho",
    obligatoria: true,
  },
  {
    id: "profesor_general",
    tipo: "rating",
    eyebrow: "Evaluación general",
    texto: "En general, ¿cómo evaluarías al profesor de esta sesión?",
    minLabel: "Deficiente",
    maxLabel: "Excelente",
    obligatoria: true,
  },
  {
    id: "comentarios",
    tipo: "texto",
    eyebrow: "Comentarios (opcional)",
    texto: "¿Qué fue lo que más te aportó esta sesión o qué podría mejorar el profesor?",
    placeholder: "Tu retroalimentación nos ayuda a evolucionar.",
    obligatoria: false,
  },
];

const RATING_VALUES = [1, 2, 3, 4, 5];

/**
 * Monta el wizard de evaluación dentro del container.
 * @param {object} opts
 * @param {HTMLElement} opts.container
 * @param {string} opts.leccionId
 * @param {string} [opts.inscripcionId]
 * @param {Array} [opts.preguntas] · si no se pasa, usa DEFAULT_PREGUNTAS_SESION
 * @param {() => Promise<void>} [opts.onComplete] · llamada al submit (para marcar lección)
 */
export function mountEvaluacion({ container, leccionId, inscripcionId, preguntas, nextHref, nextLabel, onComplete }) {
  if (!container) return;

  const questions = Array.isArray(preguntas) && preguntas.length > 0
    ? preguntas
    : DEFAULT_PREGUNTAS_SESION;

  const stateKey = `sophia_eval_sesion_${leccionId}`;
  const cached = readState(stateKey);

  const state = {
    container,
    leccionId,
    inscripcionId,
    onComplete,
    nextHref: nextHref || "/app/cursos",
    nextLabel: nextLabel || "Volver a mis cursos",
    preguntas: questions,
    currentIndex: cached?.currentIndex ?? 0,
    respuestas: cached?.respuestas ?? {},
    submitted: cached?.submitted ?? false,
    submitting: false,
  };

  // Listener delegado UNA vez por mount
  container.addEventListener("click", (e) => clickHandler(state, e));
  container.addEventListener("input", (e) => inputHandler(state, e));

  render(state);
}

// ─────────────────────────────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────────────────────────────

function render(state) {
  if (state.submitted) {
    state.container.innerHTML = renderThanks(state);
    return;
  }

  const total = state.preguntas.length;
  const idx = state.currentIndex;
  const pct = Math.round(((idx + 1) / total) * 100);

  state.container.innerHTML = `
    <div class="test-progress">
      <div class="test-progress__bar">
        <div class="test-progress__fill" style="width: ${pct}%;"></div>
      </div>
      <div class="test-progress__label">${idx + 1} de ${total}</div>
    </div>
    <div class="test-wizard test-wizard--embedded">
      <div class="test-wizard__body">
        ${renderPregunta(state, idx)}
      </div>
    </div>
  `;
}

function renderPregunta(state, idx) {
  const p = state.preguntas[idx];
  const isLast = idx === state.preguntas.length - 1;
  const value = state.respuestas[p.id];
  const isAnswered = isAnswerValid(p, value);

  let body = "";
  if (p.tipo === "rating") {
    body = renderRatingScale(p, value);
  } else if (p.tipo === "texto") {
    body = renderTextArea(p, value);
  }

  const nextLabel = isLast ? "Enviar evaluación" : "Siguiente";
  const canAdvance = p.obligatoria ? isAnswered : true;

  return `
    <article class="test-question">
      <div class="test-question__pilar">${escapeHtml(p.eyebrow || "Tu opinión")}</div>
      <h2 class="test-question__texto">${escapeHtml(p.texto)}</h2>

      ${body}

      <footer class="test-question__nav">
        <button class="btn btn-ghost" data-eval-action="prev" type="button" ${idx === 0 ? "disabled" : ""}>
          ${icon("arrowLeft")}
          <span>Anterior</span>
        </button>
        <button class="btn btn-accent" data-eval-action="next" type="button" ${canAdvance && !state.submitting ? "" : "disabled"}>
          <span>${state.submitting ? "Enviando…" : nextLabel}</span>
          ${isLast ? "" : icon("arrowRight")}
        </button>
      </footer>
    </article>
  `;
}

function renderRatingScale(p, value) {
  const dots = RATING_VALUES.map((v) => {
    const active = value === v;
    return `
      <button
        class="dot-option ${active ? "is-active" : ""}"
        data-eval-action="rate"
        data-value="${v}"
        type="button"
        aria-label="${v}"
      >
        <span class="dot-option__circle dot-option__circle--${v}"></span>
      </button>
    `;
  }).join("");

  return `
    <div class="dot-scale">
      <span class="dot-scale__label dot-scale__label--min">${escapeHtml(p.minLabel || "Nada")}</span>
      <div class="dot-scale__dots">${dots}</div>
      <span class="dot-scale__label dot-scale__label--max">${escapeHtml(p.maxLabel || "Mucho")}</span>
    </div>
  `;
}

function renderTextArea(p, value) {
  return `
    <div class="eval-textarea-wrap">
      <textarea
        class="eval-textarea"
        data-eval-text-input
        placeholder="${escapeHtml(p.placeholder || "")}"
        rows="5"
        maxlength="2000"
      >${escapeHtml(value || "")}</textarea>
      <div class="eval-textarea__count" data-eval-textcount>${(value || "").length} / 2000</div>
    </div>
  `;
}

function renderThanks(state) {
  return `
    <div class="eval-thanks">
      <div class="eval-thanks__icon">${icon("check")}</div>
      <h2 class="eval-thanks__title">¡Gracias por tu retroalimentación!</h2>
      <p class="eval-thanks__lead">
        Tu opinión nos ayuda a mejorar cada sesión. Recibimos tus respuestas y
        las revisaremos con el equipo de SOPHIA.
      </p>
      <a class="btn btn-accent" href="${escapeHtml(state.nextHref)}">
        <span>${escapeHtml(state.nextLabel)}</span>
        ${icon("arrowRight")}
      </a>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────

function clickHandler(state, e) {
  const btn = e.target.closest("[data-eval-action]");
  if (!btn) return;

  const action = btn.dataset.evalAction;
  const idx = state.currentIndex;
  const p = state.preguntas[idx];

  if (action === "rate") {
    const value = parseInt(btn.dataset.value, 10);
    state.respuestas[p.id] = value;
    persistState(state);
    render(state);
    return;
  }

  if (action === "prev") {
    if (idx > 0) {
      state.currentIndex -= 1;
      persistState(state);
      render(state);
    }
    return;
  }

  if (action === "next") {
    const isLast = idx === state.preguntas.length - 1;
    if (isLast) {
      submit(state);
      return;
    }
    state.currentIndex += 1;
    persistState(state);
    render(state);
  }
}

function inputHandler(state, e) {
  const ta = e.target.closest("[data-eval-text-input]");
  if (!ta) return;
  const p = state.preguntas[state.currentIndex];
  if (!p || p.tipo !== "texto") return;
  state.respuestas[p.id] = ta.value;
  // No re-render para no perder focus; solo actualizar contador y botón
  const counter = state.container.querySelector("[data-eval-textcount]");
  if (counter) counter.textContent = `${ta.value.length} / 2000`;
  // Re-evaluar disabled del botón Next
  const nextBtn = state.container.querySelector('[data-eval-action="next"]');
  if (nextBtn) {
    const canAdvance = p.obligatoria ? isAnswerValid(p, ta.value) : true;
    nextBtn.disabled = !canAdvance;
  }
  persistStateDebounced(state);
}

async function submit(state) {
  if (state.submitting || state.submitted) return;
  state.submitting = true;
  render(state);

  try {
    if (typeof state.onComplete === "function") {
      await state.onComplete({ respuestas: state.respuestas });
    }
    state.submitted = true;
    persistState(state);
    render(state);
  } catch (err) {
    console.error("evaluacion submit failed:", err);
    state.submitting = false;
    render(state);
    alert("No pudimos enviar tu evaluación. Intenta de nuevo en un momento.");
  }
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function isAnswerValid(pregunta, value) {
  if (pregunta.tipo === "rating") {
    return RATING_VALUES.includes(value);
  }
  if (pregunta.tipo === "texto") {
    return typeof value === "string" && value.trim().length > 0;
  }
  return false;
}

function persistState(state) {
  try {
    sessionStorage.setItem(
      `sophia_eval_sesion_${state.leccionId}`,
      JSON.stringify({
        currentIndex: state.currentIndex,
        respuestas: state.respuestas,
        submitted: state.submitted,
      }),
    );
  } catch { /* quota or disabled */ }
}

let persistTimeout = null;
function persistStateDebounced(state) {
  if (persistTimeout) clearTimeout(persistTimeout);
  persistTimeout = setTimeout(() => persistState(state), 400);
}

function readState(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
