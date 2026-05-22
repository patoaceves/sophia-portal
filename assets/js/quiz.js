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
      // El alumno ya completó previamente: revelar el botón "Avanzar" del
      // footer externo (renderizado por leccion.js) que viene oculto por
      // defecto. Esto le permite ver el resumen Y avanzar a la siguiente
      // lección sin tener que re-submittear.
      // Excepción: para quizzes scored solo lo mostramos si aprobó.
      const score = calcularScore(def, state.respuestas);
      const puedeAvanzar = !score || score.aprobado;
      if (puedeAvanzar) {
        document.getElementById("quizAdvanceBtn")?.removeAttribute("hidden");
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
      <span class="test-intro__eyebrow">${escapeHtml(def.introEyebrow || "Actividad")}</span>
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
  const nextLabel = isLast ? "Completar" : "Siguiente";

  return `
    <article class="test-question">
      <div class="test-question__pilar">${escapeHtml(p.eyebrow || "Reflexión")}</div>
      <h2 class="test-question__texto">${escapeHtml(p.texto)}</h2>
      ${!p.obligatoria ? `<p class="quiz-optional-note">Opcional – puedes dejarla en blanco si aún no tienes la respuesta.</p>` : ""}

      ${body}

      <footer class="test-question__nav">
        <button class="btn btn-ghost" data-quiz-action="prev" type="button" ${idx === 0 ? "disabled" : ""}>
          ${icon("arrowLeft")}
          <span>Anterior</span>
        </button>
        ${showNext ? `
          <button class="btn btn-accent" data-quiz-action="next" type="button" ${state.submitting ? "disabled" : ""} ${p.obligatoria && !isAnswered ? "disabled" : ""}>
            <span>${state.submitting ? "Completando…" : nextLabel}</span>
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

  // Variante 2-columnas para preguntas binarias (Sí/No típicamente):
  // si solo hay 2 opciones y ambas son cortas, las ponemos lado a lado.
  const isBinary = (p.opciones || []).length === 2
    && (p.opciones || []).every((o) => (o || "").length <= 6);
  return `<div class="quiz-choice-list ${isBinary ? "quiz-choice-list--binary" : ""}">${opts}</div>`;
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
 * Pantalla de cierre — dos variantes:
 *   - Sin scoring (def.preguntas no tiene `correcta`): muestra título +
 *     lead reflexivos, lista de respuestas que dio el alumno, y botón
 *     "Volver a contestar" para editar.
 *   - Con scoring (al menos una pregunta tiene `correcta`): score + revela
 *     correctas/incorrectas + botón para reintentar.
 */
function renderResumen(state) {
  if (hasScoring(state.def)) {
    return renderResumenConScore(state);
  }
  const titulo = state.def.doneTitle || "Actividad completada";
  const lead = state.def.doneLead || "Gracias por tomarte el tiempo de reflexionar sobre ti mismo.";

  // showAnswers (default true): si false, NO listamos las respuestas — solo
  // mostramos el mensaje de éxito. Útil para checklists de autodiagnóstico
  // donde repasar 35 sí/no sería ruidoso.
  const showAnswers = state.def.showAnswers !== false;

  const items = showAnswers
    ? state.def.preguntas.map((p) => {
        const respuesta = state.respuestas[p.id];
        const respuestaHtml = respuesta
          ? `<div class="quiz-resumen-item__user">${escapeHtml(respuesta)}</div>`
          : `<div class="quiz-resumen-item__user quiz-resumen-item__user--empty">Sin respuesta</div>`;
        return `
          <li class="quiz-resumen-item quiz-resumen-item--reflexivo">
            <div class="quiz-resumen-item__body">
              <div class="quiz-resumen-item__q">${escapeHtml(p.texto)}</div>
              ${respuestaHtml}
            </div>
          </li>
        `;
      }).join("")
    : "";

  return `
    <div class="quiz-resumen quiz-resumen--reflexivo">
      <div class="quiz-resumen__head">
        <div class="quiz-resumen__icon">${icon("check")}</div>
        <h2 class="quiz-resumen__title">${escapeHtml(titulo)}</h2>
        <p class="quiz-resumen__lead">${escapeHtml(lead)}</p>
      </div>
      ${showAnswers ? `<ol class="quiz-resumen-list">${items}</ol>` : ""}
      <div class="quiz-resumen__actions">
        <button class="btn btn-secondary" data-quiz-action="retry" type="button">
          ${icon("refresh")}
          <span>Volver a contestar</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Resumen con score: cuenta aciertos sobre preguntas con `correcta` definida,
 * lista todas las preguntas marcando ✓ o ✗, y ofrece botón para reintentar.
 *
 * Si NO aprobó (< 60%), el botón principal es "Volver a intentar" y se le
 * indica al alumno que debe pasar para avanzar.
 */
function renderResumenConScore(state) {
  const score = calcularScore(state.def, state.respuestas);
  const { scored, aciertos, total, pct, aprobado } = score;

  const items = scored.map((p) => {
    const respuestaUsuario = state.respuestas[p.id];
    const opcionCorrecta = p.opciones[p.correcta];
    const acerto = respuestaUsuario === opcionCorrecta;
    const userHtml = respuestaUsuario
      ? `<div class="quiz-resumen-item__user">Tu respuesta: <strong>${escapeHtml(respuestaUsuario)}</strong></div>`
      : `<div class="quiz-resumen-item__user quiz-resumen-item__user--empty">No respondida</div>`;
    const correctHtml = acerto
      ? ""
      : `<div class="quiz-resumen-item__correct">Respuesta correcta: <strong>${escapeHtml(opcionCorrecta)}</strong></div>`;
    return `
      <li class="quiz-resumen-item quiz-resumen-item--${acerto ? "ok" : "ko"}">
        <div class="quiz-resumen-item__marker" aria-hidden="true">
          ${acerto ? icon("check") : icon("close")}
        </div>
        <div class="quiz-resumen-item__body">
          <div class="quiz-resumen-item__q">${escapeHtml(p.texto)}</div>
          ${userHtml}
          ${correctHtml}
        </div>
      </li>
    `;
  }).join("");

  const tone = aprobado ? "ok" : "ko";
  const titulo = aprobado ? "¡Bien hecho!" : "No aprobaste, sigue practicando";
  const lead = aprobado
    ? "Tienes una base sólida sobre los temas de la sesión. Revisa abajo las respuestas correctas y, si quieres, reintenta el quiz."
    : `Obtuviste ${pct}%. Necesitas al menos 60% para aprobar y avanzar a la siguiente lección. Revisa las respuestas correctas abajo y vuelve a intentarlo.`;
  const btnLabel = aprobado ? "Reintentar quiz" : "Volver a intentar";
  const btnClass = aprobado ? "btn-secondary" : "btn-accent";

  return `
    <div class="quiz-resumen quiz-resumen--scored quiz-resumen--${tone}">
      <div class="quiz-resumen__head">
        <div class="quiz-resumen__score" aria-label="Resultado">
          <span class="quiz-resumen__score-num">${aciertos}</span>
          <span class="quiz-resumen__score-sep">/</span>
          <span class="quiz-resumen__score-total">${total}</span>
        </div>
        <h2 class="quiz-resumen__title">${titulo}</h2>
        <p class="quiz-resumen__lead">${lead}</p>
      </div>
      <ol class="quiz-resumen-list">${items}</ol>
      <div class="quiz-resumen__actions">
        <button class="btn ${btnClass}" data-quiz-action="retry" type="button">
          ${icon("refresh")}
          <span>${btnLabel}</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Calcula el score de un quiz scored.
 * Devuelve { scored, aciertos, total, pct, aprobado } o null si no aplica.
 * Umbral de aprobación: 60%.
 */
function calcularScore(def, respuestas) {
  if (!hasScoring(def)) return null;
  const scored = def.preguntas.filter((p) => typeof p.correcta === "number");
  let aciertos = 0;
  for (const p of scored) {
    const opcionCorrecta = p.opciones[p.correcta];
    if (respuestas[p.id] === opcionCorrecta) aciertos += 1;
  }
  const total = scored.length;
  const pct = total > 0 ? Math.round((aciertos / total) * 100) : 0;
  const aprobado = pct >= 60;
  return { scored, aciertos, total, pct, aprobado };
}

function hasScoring(def) {
  return (def?.preguntas || []).some((p) => typeof p.correcta === "number");
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

  if (action === "retry") {
    // Reintentar quiz scored: limpia respuestas y vuelve a la intro.
    // No borramos el record en Airtable — submit-quiz lo sobrescribe (idempotente).
    state.respuestas = {};
    state.currentIndex = -1;
    state.submitted = false;
    state.submitting = false;
    state.completedAt = null;
    clearState(state.leccionId);
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

    // Marcar la lección como completada SOLO si:
    //   - el quiz NO tiene scoring (reflexivo, siempre cuenta como completado), o
    //   - el quiz SÍ tiene scoring y el alumno aprobó (≥ 60%).
    // Si reprobó un quiz scored, NO se marca completada y NO aparece el
    // botón "Avanzar" en el footer de la lección. Debe reintentar.
    const score = calcularScore(state.def, state.respuestas);
    const completaLeccion = !score || score.aprobado;

    if (completaLeccion && typeof state.onComplete === "function") {
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
