// SOPHIA Portal · Quiz (actividad en clase) — wizard nativo
//
// Wizard reflexivo para actividades en clase tipo `quiz` (ej. Gnóthi Seautón).
// A diferencia de las autoevaluaciones, NO puntúa: solo registra y guarda las
// respuestas del alumno en la tabla Airtable "Actividades en Clase".
//
// Flujo:
//   intro (-1) → preguntas (0..n) → submit → pantalla de resumen
// Si el alumno ya completó la actividad, al volver a entrar ve directo el
// resumen de sus respuestas (se consulta get-resultados-quiz al montar).
//
// Tipos de pregunta (ver quiz-defs.js):
//   - "choice" : opción única de una lista
//   - "texto"  : texto libre
//
// Uso:
//   import { mountQuiz } from "./quiz.js";
//   mountQuiz({ container, quizKey, leccionId, inscripcionId, nextHref, nextLabel, onComplete });

import { icon } from "./icons.js";
import { escapeHtml } from "./ui-shell.js";
import { api } from "./api.js";
import { getQuizDef } from "./quiz-defs.js";

/**
 * Monta el wizard de quiz dentro del container.
 * @param {object} opts
 * @param {HTMLElement} opts.container
 * @param {string} opts.quizKey      · clave del quiz (ej. "gnothi-seauton")
 * @param {string} opts.leccionId
 * @param {string} [opts.inscripcionId]
 * @param {string} [opts.nextHref]
 * @param {string} [opts.nextLabel]
 * @param {() => Promise<void>} [opts.onComplete] · para marcar la lección
 */
export async function mountQuiz({ container, quizKey, leccionId, inscripcionId, nextHref, nextLabel, onComplete }) {
  if (!container) return;

  const def = getQuizDef(quizKey);
  if (!def) {
    container.innerHTML = `
      <div class="quiz-error">
        <p>Esta actividad no está disponible. Contacta a soporte si el problema persiste.</p>
      </div>
    `;
    return;
  }

  const stateKey = `sophia_quiz_${leccionId}`;
  const cached = readState(stateKey);

  const state = {
    container,
    def,
    quizKey,
    leccionId,
    inscripcionId,
    onComplete,
    nextHref: nextHref || "/app/cursos",
    nextLabel: nextLabel || "Volver a mis cursos",
    preguntas: def.preguntas,
    // -1 = pantalla de intro. 0..n = preguntas.
    currentIndex: cached?.currentIndex ?? -1,
    respuestas: cached?.respuestas ?? {},
    submitted: false,
    submitting: false,
    completedAt: null,
    loading: true,
  };

  container.addEventListener("click", (e) => clickHandler(state, e));
  container.addEventListener("input", (e) => inputHandler(state, e));

  // Loader mientras consultamos si ya completó la actividad
  render(state);

  // ¿Ya completó esta actividad? Si sí, mostramos directo el resumen.
  try {
    const prev = await api.resultadosQuiz(leccionId);
    if (prev?.tieneResultados) {
      state.submitted = true;
      state.completedAt = prev.completedAt || null;
      if (prev.respuestas && typeof prev.respuestas === "object") {
        state.respuestas = prev.respuestas;
      }
    }
  } catch (err) {
    console.warn("resultadosQuiz check failed (continuing):", err);
  }
  state.loading = false;
  render(state);
}

// ─────────────────────────────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────────────────────────────

function render(state) {
  if (state.loading) {
    state.container.innerHTML = `
      <div class="quiz-loading">
        <div class="quiz-loading__spinner" aria-hidden="true"></div>
        <span>Cargando actividad…</span>
      </div>
    `;
    return;
  }

  if (state.submitted) {
    state.container.innerHTML = renderResumen(state);
    return;
  }

  const isIntro = state.currentIndex === -1;
  const total = state.preguntas.length;
  const idx = state.currentIndex;
  const pct = isIntro ? 0 : Math.round(((idx + 1) / total) * 100);

  const progressHtml = isIntro ? "" : `
    <div class="test-progress">
      <div class="test-progress__bar">
        <div class="test-progress__fill" style="width: ${pct}%;"></div>
      </div>
      <div class="test-progress__label">${idx + 1} de ${total}</div>
    </div>
  `;

  state.container.innerHTML = `
    ${progressHtml}
    <div class="test-wizard test-wizard--embedded">
      <div class="test-wizard__body">
        ${isIntro ? renderIntro(state) : renderPregunta(state, idx)}
      </div>
    </div>
  `;
}

function renderIntro(state) {
  const def = state.def;
  // introLead puede ser string o array de párrafos
  const paras = Array.isArray(def.introLead)
    ? def.introLead
    : [def.introLead || ""];
  const leadHtml = paras
    .filter(Boolean)
    .map((p) => `<p class="test-intro__lead">${escapeHtml(p)}</p>`)
    .join("");
  return `
    <div class="test-intro">
      <span class="test-intro__eyebrow">${escapeHtml(def.introEyebrow || "Actividad en clase")}</span>
      <h2 class="test-intro__title">${escapeHtml(def.introTitle || def.titulo)}</h2>
      ${leadHtml}
      <button class="btn btn-accent btn-lg" data-quiz-action="start" type="button">
        <span>Comenzar actividad</span>
        ${icon("arrowRight")}
      </button>
    </div>
  `;
}

function renderPregunta(state, idx) {
  const p = state.preguntas[idx];
  const isLast = idx === state.preguntas.length - 1;
  const value = state.respuestas[p.id];
  const isAnswered = isAnswerValid(p, value);

  let body = "";
  if (p.tipo === "choice") {
    body = renderChoiceList(p, value);
  } else if (p.tipo === "texto") {
    body = renderTextArea(p, value);
  }

  // Botón "Siguiente / Enviar": para choice aparece al responder; para
  // texto siempre visible (porque puede ser opcional o requerir confirmar).
  const showNext = p.tipo === "texto" || isAnswered || !p.obligatoria;
  const nextLabel = isLast ? "Enviar" : "Siguiente";

  return `
    <article class="test-question">
      <div class="test-question__pilar">${escapeHtml(p.eyebrow || "Reflexión")}</div>
      <h2 class="test-question__texto">${escapeHtml(p.texto)}</h2>
      ${!p.obligatoria ? `<p class="quiz-optional-note">Opcional — puedes dejarla en blanco si aún no tienes la respuesta.</p>` : ""}

      ${body}

      <footer class="test-question__nav">
        <button class="btn btn-ghost" data-quiz-action="prev" type="button" ${idx === 0 ? "disabled" : ""}>
          ${icon("arrowLeft")}
          <span>Anterior</span>
        </button>
        ${showNext ? `
          <button class="btn btn-accent" data-quiz-action="next" type="button" ${state.submitting ? "disabled" : ""} ${p.obligatoria && !isAnswered ? "disabled" : ""}>
            <span>${state.submitting ? "Enviando…" : nextLabel}</span>
            ${isLast ? "" : icon("arrowRight")}
          </button>
        ` : `<span></span>`}
      </footer>
    </article>
  `;
}

function renderChoiceList(p, value) {
  const opts = (p.opciones || []).map((opt) => {
    const active = value === opt;
    return `
      <button
        class="quiz-choice ${active ? "is-active" : ""}"
        data-quiz-action="choose"
        data-value="${escapeHtml(opt)}"
        type="button"
      >
        <span class="quiz-choice__radio" aria-hidden="true"></span>
        <span class="quiz-choice__label">${escapeHtml(opt)}</span>
      </button>
    `;
  }).join("");

  return `<div class="quiz-choice-list">${opts}</div>`;
}

function renderTextArea(p, value) {
  return `
    <div class="eval-textarea-wrap">
      <textarea
        class="eval-textarea"
        data-quiz-text-input
        placeholder="${escapeHtml(p.placeholder || "")}"
        rows="5"
        maxlength="2000"
      >${escapeHtml(value || "")}</textarea>
      <div class="eval-textarea__count" data-quiz-textcount>${(value || "").length} / 2000</div>
    </div>
  `;
}

/**
 * Pantalla de resumen — se muestra tras enviar Y al volver a entrar a una
 * actividad ya completada. Lista cada pregunta con la respuesta del alumno.
 */
function renderResumen(state) {
  const fecha = state.completedAt
    ? new Date(state.completedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : "";

  const items = state.preguntas.map((p) => {
    const val = state.respuestas[p.id];
    const answered = isAnswerValid(p, val);
    return `
      <div class="quiz-resumen__item">
        <div class="quiz-resumen__q">${escapeHtml(p.texto)}</div>
        <div class="quiz-resumen__a ${answered ? "" : "quiz-resumen__a--empty"}">
          ${answered ? escapeHtml(String(val)) : "Sin responder"}
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="quiz-resumen">
      <div class="quiz-resumen__head">
        <div class="quiz-resumen__icon">${icon("check")}</div>
        <h2 class="quiz-resumen__title">Actividad completada</h2>
        <p class="quiz-resumen__lead">
          Gracias por tomarte el tiempo de reflexionar.
          ${fecha ? `Registramos tus respuestas el ${escapeHtml(fecha)}.` : "Registramos tus respuestas."}
          Este es tu resumen — puedes volver a consultarlo cuando quieras.
        </p>
      </div>
      <div class="quiz-resumen__list">${items}</div>
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
  const btn = e.target.closest("[data-quiz-action]");
  if (!btn) return;

  const action = btn.dataset.quizAction;
  const idx = state.currentIndex;
  const p = state.preguntas[idx];

  if (action === "start") {
    state.currentIndex = 0;
    persistState(state);
    render(state);
    return;
  }

  if (action === "choose") {
    state.respuestas[p.id] = btn.dataset.value;
    persistState(state);

    // Feedback inmediato
    const all = btn.parentElement?.querySelectorAll(".quiz-choice");
    if (all) {
      all.forEach((c) => c.classList.remove("is-active"));
      btn.classList.add("is-active");
    }

    const isLast = idx === state.preguntas.length - 1;
    if (isLast) {
      setTimeout(() => render(state), 220);
    } else {
      // Auto-advance
      setTimeout(() => {
        state.currentIndex += 1;
        persistState(state);
        render(state);
      }, 300);
    }
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
  const ta = e.target.closest("[data-quiz-text-input]");
  if (!ta) return;
  const p = state.preguntas[state.currentIndex];
  if (!p || p.tipo !== "texto") return;
  state.respuestas[p.id] = ta.value;
  // No re-render para no perder focus; actualizar contador + botón
  const counter = state.container.querySelector("[data-quiz-textcount]");
  if (counter) counter.textContent = `${ta.value.length} / 2000`;
  const nextBtn = state.container.querySelector('[data-quiz-action="next"]');
  if (nextBtn && p.obligatoria) {
    nextBtn.disabled = !isAnswerValid(p, ta.value);
  }
  persistStateDebounced(state);
}

async function submit(state) {
  if (state.submitting || state.submitted) return;
  state.submitting = true;
  render(state);

  try {
    const res = await api.submitQuiz({
      leccionId: state.leccionId,
      inscripcionId: state.inscripcionId,
      actividad: state.quizKey,
      respuestas: state.respuestas,
    });
    state.completedAt = res?.completedAt || new Date().toISOString();
    state.submitted = true;
    // Limpiamos el borrador local — ya está persistido en backend
    clearState(state.leccionId);

    // Marcar la lección como completada (best-effort)
    if (typeof state.onComplete === "function") {
      try {
        await state.onComplete();
      } catch (err) {
        console.warn("quiz onComplete failed:", err);
      }
    }
    render(state);
  } catch (err) {
    console.error("quiz submit failed:", err);
    state.submitting = false;
    render(state);
    alert("No pudimos guardar tu actividad. Intenta de nuevo en un momento.");
  }
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function isAnswerValid(pregunta, value) {
  if (pregunta.tipo === "choice") {
    return typeof value === "string" && (pregunta.opciones || []).includes(value);
  }
  if (pregunta.tipo === "texto") {
    return typeof value === "string" && value.trim().length > 0;
  }
  return false;
}

function persistState(state) {
  try {
    sessionStorage.setItem(
      `sophia_quiz_${state.leccionId}`,
      JSON.stringify({
        currentIndex: state.currentIndex,
        respuestas: state.respuestas,
      }),
    );
  } catch { /* quota or disabled */ }
}

let persistTimeout = null;
function persistStateDebounced(state) {
  if (persistTimeout) clearTimeout(persistTimeout);
  persistTimeout = setTimeout(() => persistState(state), 400);
}

function clearState(leccionId) {
  try {
    sessionStorage.removeItem(`sophia_quiz_${leccionId}`);
  } catch { /* noop */ }
}

function readState(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
