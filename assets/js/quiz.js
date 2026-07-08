// SOPHIA Portal · Quiz (actividad en clase) — wizard nativo
//
// Wizard reflexivo para actividades en clase tipo `quiz` (ej. Gnóthi Seautón).
// A diferencia de las autoevaluaciones, NO puntúa: solo registra y guarda las
// respuestas del alumno en Postgres (tabla respuestas_quiz) vía submit-quiz.
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
// Separador para respuestas de preguntas tipo "multi" (varias opciones).
const MULTI_SEP = " || ";

// Las claves correctas ya NO viven en quiz-defs.js: viven en la BD
// (tabla quiz_defs) y el backend las devuelve únicamente después de un
// submit (o al consultar resultados de un quiz ya completado). Este helper
// las inyecta en la def local para que el resumen y el score rendericen.
function applyClaves(def, claves) {
  if (!claves || typeof claves !== "object") return;
  for (const p of (def.preguntas || [])) {
    const c = claves[p.id];
    if (c === undefined) continue;
    if (Array.isArray(c)) {
      p.correctas = c
        .map((texto) => (p.opciones || []).indexOf(texto))
        .filter((i) => i >= 0);
    } else {
      const i = (p.opciones || []).indexOf(c);
      if (i >= 0) p.correcta = i;
    }
  }
}

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
      if (prev.claves) applyClaves(def, prev.claves);
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
  } else if (p.tipo === "multi") {
    body = renderMultiList(p, value);
  } else if (p.tipo === "escala") {
    body = renderEscala(p, value);
  } else if (p.tipo === "texto") {
    body = renderTextArea(p, value);
  }

  // Botón "Siguiente / Enviar": para choice/escala aparece al responder; para
  // texto siempre visible (porque puede ser opcional o requerir confirmar).
  const showNext = p.tipo === "texto" || p.tipo === "multi" || isAnswered || !p.obligatoria;
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

// Pregunta tipo "multi": selección múltiple con checkboxes. La respuesta se
// guarda como los textos de las opciones elegidas unidos por MULTI_SEP.
function renderMultiList(p, value) {
  const selected = new Set((value || "").split(MULTI_SEP).map((s) => s.trim()).filter(Boolean));
  const opts = (p.opciones || []).map((opt) => {
    const active = selected.has(opt);
    return `
      <button
        class="quiz-choice quiz-choice--multi ${active ? "is-active" : ""}"
        data-quiz-action="choose-multi"
        data-value="${escapeHtml(opt)}"
        type="button"
        aria-pressed="${active ? "true" : "false"}"
      >
        <span class="quiz-choice__radio quiz-choice__radio--square" aria-hidden="true"></span>
        <span class="quiz-choice__label">${escapeHtml(opt)}</span>
      </button>
    `;
  }).join("");
  return `
    <p class="quiz-optional-note">Selecciona todas las que apliquen.</p>
    <div class="quiz-choice-list">${opts}</div>
  `;
}

// Pregunta tipo escala Likert 1–5 con las "bolitas" (mismas clases CSS que la
// autoevaluación: .dot-scale / .dot-option / .dot-option__circle--N). Guarda
// el valor numérico 1–5. parseInt tolera respuestas previas tipo "2 · ...".
function renderEscala(p, value) {
  const labels = p.escalaLabels || { min: "Totalmente en desacuerdo", max: "Totalmente de acuerdo" };
  const sel = parseInt(value, 10);
  const dots = [1, 2, 3, 4, 5].map((v) => {
    const active = sel === v;
    return `
      <button
        class="dot-option ${active ? "is-active" : ""}"
        data-quiz-action="escala"
        data-value="${v}"
        type="button"
        aria-label="${v} - ${v === 1 ? escapeHtml(labels.min) : v === 5 ? escapeHtml(labels.max) : ""}"
      >
        <span class="dot-option__circle dot-option__circle--${v}"></span>
      </button>
    `;
  }).join("");
  return `
    <div class="dot-scale">
      <span class="dot-scale__label dot-scale__label--min">${escapeHtml(labels.min)}</span>
      <div class="dot-scale__dots">${dots}</div>
      <span class="dot-scale__label dot-scale__label--max">${escapeHtml(labels.max)}</span>
    </div>
  `;
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
  if (hasAnalisis(state.def)) {
    return renderResumenAnalisis(state);
  }
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
    const opcionCorrecta = correctaLabel(p);
    const acerto = esCorrecta(p, respuestaUsuario);
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
  const titulo = aprobado ? "¡Bien hecho!" : "¡Casi! Repasa y vuelve a intentar";
  const lead = aprobado
    ? "Tienes una base sólida sobre los temas de la sesión. Revisa abajo las respuestas correctas y, si quieres, reintenta el quiz."
    : `Llevas ${pct}%. Revisa abajo las respuestas correctas y, cuando quieras, inténtalo de nuevo. Vas muy bien.`;
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
function esCorrecta(p, respuesta) {
  if (Array.isArray(p.correctas)) {
    const esperado = new Set(p.correctas.map((i) => p.opciones[i]));
    const dado = new Set((respuesta || "").split(MULTI_SEP).map((s) => s.trim()).filter(Boolean));
    return esperado.size === dado.size && [...esperado].every((s) => dado.has(s));
  }
  return respuesta === p.opciones[p.correcta];
}

function correctaLabel(p) {
  if (Array.isArray(p.correctas)) return p.correctas.map((i) => p.opciones[i]).join(", ");
  return p.opciones[p.correcta];
}

function calcularScore(def, respuestas) {
  if (!hasScoring(def)) return null;
  const scored = def.preguntas.filter((p) => typeof p.correcta === "number" || Array.isArray(p.correctas));
  let aciertos = 0;
  for (const p of scored) {
    if (esCorrecta(p, respuestas[p.id])) aciertos += 1;
  }
  const total = scored.length;
  const pct = total > 0 ? Math.round((aciertos / total) * 100) : 0;
  const aprobado = pct >= 60;
  return { scored, aciertos, total, pct, aprobado };
}

function hasScoring(def) {
  return (def?.preguntas || []).some((p) => typeof p.correcta === "number" || Array.isArray(p.correctas));
}

// ─────────────────────────────────────────────────────────────────────
// Análisis por puntaje (escala Likert) para la actividad previa
// ─────────────────────────────────────────────────────────────────────

function hasAnalisis(def) {
  return Array.isArray(def?.analisis) && def.analisis.length > 0;
}

// Suma el puntaje de las preguntas tipo escala (1–5 c/u). parseInt tolera
// tanto valores numéricos como respuestas previas tipo "2 · En desacuerdo".
function computeEscalaTotal(def, respuestas) {
  const escalaQs = (def.preguntas || []).filter((p) => p.tipo === "escala");
  let total = 0;
  let answered = 0;
  for (const p of escalaQs) {
    const n = parseInt(respuestas[p.id], 10);
    if (Number.isInteger(n) && n >= 1 && n <= 5) {
      total += n;
      answered += 1;
    }
  }
  return { total, max: escalaQs.length * 5, count: escalaQs.length, answered };
}

// Banda de análisis a partir del total. `def.analisis` es un arreglo de
// { minTotal, label, texto, color? }; se elige la primera (de mayor a menor
// minTotal) cuyo umbral se alcanza.
function bandaForAnalisis(def, total) {
  const bands = [...(def.analisis || [])].sort((a, b) => b.minTotal - a.minTotal);
  for (const b of bands) {
    if (total >= b.minTotal) return b;
  }
  return bands[bands.length - 1] || null;
}

// Pantalla final de la actividad previa: NO lista las respuestas (no es un
// quiz). Muestra el puntaje y un análisis breve según la banda.
function renderResumenAnalisis(state) {
  const def = state.def;
  const titulo = def.doneTitle || "Diagnóstico completado";
  const lead = def.doneLead || "Gracias por tu honestidad.";
  const { total, max } = computeEscalaTotal(def, state.respuestas);
  const banda = bandaForAnalisis(def, total);
  const color = banda?.color || "var(--color-accent, #2E7D32)";

  return `
    <div class="quiz-resumen quiz-resumen--reflexivo">
      <div class="quiz-resumen__head">
        <div class="quiz-resumen__icon">${icon("check")}</div>
        <h2 class="quiz-resumen__title">${escapeHtml(titulo)}</h2>
        <p class="quiz-resumen__lead">${escapeHtml(lead)}</p>
      </div>
      <div style="margin-top:var(--s-4, 16px); padding:var(--s-5, 20px); border-radius:12px; background:var(--color-surface-2, #faf7f2); border-left:4px solid ${color};">
        <div style="display:flex; align-items:baseline; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
          <span style="font-size:2.25rem; font-weight:700; color:${color}; line-height:1;">${total}</span>
          <span style="color:var(--color-text-muted, #8a8478); font-size:0.95rem;">de ${max}</span>
          ${banda ? `<span style="margin-left:auto; font-weight:600; color:${color};">${escapeHtml(banda.label)}</span>` : ""}
        </div>
        ${banda ? `<p style="margin:0; color:var(--color-text, #2b2b2b); line-height:1.55;">${escapeHtml(banda.texto)}</p>` : ""}
      </div>
      <div class="quiz-resumen__actions">
        <button class="btn btn-secondary" data-quiz-action="retry" type="button">
          ${icon("refresh")}
          <span>Volver a contestar</span>
        </button>
      </div>
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

  if (action === "retry") {
    // Reintentar quiz scored: limpia respuestas y vuelve a la intro.
    // No borramos el registro en la base de datos; submit-quiz lo sobrescribe (idempotente).
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

  if (action === "choose-multi") {
    const opt = btn.dataset.value;
    const current = new Set((state.respuestas[p.id] || "").split(MULTI_SEP).map((s) => s.trim()).filter(Boolean));
    if (current.has(opt)) current.delete(opt); else current.add(opt);
    // Preservar el orden de p.opciones al serializar
    state.respuestas[p.id] = (p.opciones || []).filter((o) => current.has(o)).join(MULTI_SEP);
    persistState(state);
    btn.classList.toggle("is-active");
    btn.setAttribute("aria-pressed", btn.classList.contains("is-active") ? "true" : "false");
    const nextBtn = state.container.querySelector('[data-quiz-action="next"]');
    if (nextBtn && p.obligatoria) nextBtn.disabled = !isAnswerValid(p, state.respuestas[p.id]);
    return;
  }

  if (action === "escala") {
    const v = parseInt(btn.getAttribute("data-value"), 10);
    // Guardamos como string: submit-quiz valida que cada respuesta sea string,
    // y todo el cálculo de puntaje usa parseInt, así que "4" funciona igual.
    state.respuestas[p.id] = String(v);
    persistState(state);

    // Feedback inmediato
    const allDots = btn.parentElement?.querySelectorAll(".dot-option");
    if (allDots) {
      allDots.forEach((d) => d.classList.remove("is-active"));
      btn.classList.add("is-active");
    }

    const isLast = idx === state.preguntas.length - 1;
    if (isLast) {
      setTimeout(() => render(state), 220);
    } else {
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
    // v2: el backend califica contra las claves en la BD (tabla quiz_defs)
    // y devuelve { evaluacion, claves }. Ya no se manda score del cliente.
    const res = await api.submitQuiz({
      leccionId: state.leccionId,
      inscripcionId: state.inscripcionId,
      actividad: state.quizKey,
      respuestas: state.respuestas,
    });
    if (res?.claves) applyClaves(state.def, res.claves);
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
  if (pregunta.tipo === "multi") {
    const sel = (value || "").split(MULTI_SEP).map((s) => s.trim()).filter(Boolean);
    return sel.length > 0 && sel.every((s) => (pregunta.opciones || []).includes(s));
  }
  if (pregunta.tipo === "escala") {
    const n = parseInt(value, 10);
    return Number.isInteger(n) && n >= 1 && n <= 5;
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
