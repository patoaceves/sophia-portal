// SOPHIA Portal · Escala RYFF de Bienestar Psicologico (wizard de 18 reactivos).
//
// Wizard a nivel PERSONA (no por curso): 18 reactivos (3 por cada una de las 6
// dimensiones), Likert 1-6. Todo el contenido vive en ryff-defs.js. Al enviar,
// el backend (submit-ryff) calcula scores y bandas y redirige a la pagina de
// resultados.
//
// Standalone: /app/ryff?[slug=<curso>]  -> el slug solo sirve para el boton
// "salir/volver" (la evaluacion no se vincula a ningun curso).

import { requireAuth } from "./auth.js";
import { api } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";
import { icon } from "./icons.js";
import { preguntasPlanas, ESCALA_LABELS, SCALE, DIMS } from "./ryff-defs.js";

const ACCENT = "#C0112F"; // rojo SOPHIA (igual que el sitio publico de ryff)

// Valores de la escala 1..6
const SCALE_VALUES = Array.from({ length: SCALE.max - SCALE.min + 1 }, (_, i) => SCALE.min + i);

export function mountWizard(opts) {
  const preguntas = preguntasPlanas();
  const state = {
    preguntas,
    cursoSlug: opts.cursoSlug || null,
    container: opts.container,
    respuestas: {},
    currentIndex: -1,
    submitting: false,
  };

  state.container.addEventListener("click", (e) => clickHandler(state, e));
  state.container.style.setProperty("--wizard-accent", ACCENT);
  renderInto(state);
  return state;
}

function backHref(state) {
  return state.cursoSlug
    ? `/app/curso?slug=${encodeURIComponent(state.cursoSlug)}`
    : "/app/cursos";
}

function renderInto(state) {
  const total = state.preguntas.length;
  const isIntro = state.currentIndex === -1;
  const pct = isIntro ? 0 : Math.round(((state.currentIndex + 1) / total) * 100);
  const curColor = isIntro ? ACCENT : state.preguntas[state.currentIndex].accentColor;

  const bodyHtml = isIntro ? renderIntro(state) : renderPregunta(state, state.currentIndex);
  const bodyClass = isIntro ? "test-wizard__body ryff-card" : "test-wizard__body ryff-card ryff-card--split";

  const headerHtml = `
    <header class="test-wizard__header">
      <a href="${backHref(state)}" class="page-back">
        ${icon("chevronLeft")}
        <span>Salir de la evaluación</span>
      </a>
      ${!isIntro ? `<div class="test-wizard__counter">Pregunta ${state.currentIndex + 1} de ${total}</div>` : ""}
    </header>
  `;

  const progressBarHtml = isIntro ? "" : `
    <div class="test-progress">
      <div class="test-progress__bar">
        <div class="test-progress__fill" style="width: ${pct}%; background: ${curColor};"></div>
      </div>
    </div>
  `;

  state.container.innerHTML = isIntro
    ? `
      <div class="test-wizard ryff-wizard">
        ${headerHtml}
        <div class="${bodyClass}">${bodyHtml}</div>
      </div>
    `
    : `
      <div class="ryff-wizard-shell">
        <div class="test-wizard ryff-wizard ryff-wizard--split">
          ${headerHtml}
          ${progressBarHtml}
          <div class="${bodyClass}">${bodyHtml}</div>
        </div>
      </div>
    `;
}

// Avance por dimension: cuantas de las 3 preguntas de cada dimension van
// contestadas, cual es la activa y cual ya quedo completa (palomita en su color).
function dimProgress(state) {
  const cur = state.preguntas[state.currentIndex];
  const curDim = cur ? cur.dimKey : null;
  return DIMS.map((d) => {
    const qs = state.preguntas.filter((p) => p.dimKey === d.key);
    const answered = qs.filter((p) => state.respuestas[p.id] !== undefined).length;
    return { d, total: qs.length, answered, isActive: curDim === d.key, isDone: answered === qs.length };
  });
}

function renderDimSidebar(state) {
  return dimProgress(state).map(({ d, total, answered, isActive, isDone }) => {
    const color = d.accentColor;
    const pct = total ? Math.round((answered / total) * 100) : 0;
    let iconHtml;
    if (isDone) {
      iconHtml = `<div class="ryff-dimnav__icon" style="background:${color};border-color:${color};"><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
    } else if (isActive) {
      iconHtml = `<div class="ryff-dimnav__icon" style="border-color:${color};background:${color}1A;"><span class="ryff-dimnav__dot" style="background:${color};"></span></div>`;
    } else {
      iconHtml = `<div class="ryff-dimnav__icon ryff-dimnav__icon--pending"></div>`;
    }
    const progStr = isDone ? "Completado" : (answered > 0 ? `${answered}/${total}` : "");
    const nameColor = (isActive || isDone) ? color : "var(--color-text)";
    const showBar = answered > 0 || isActive;
    return `<div class="ryff-dimnav__item">
      ${iconHtml}
      <div class="ryff-dimnav__info">
        <div class="ryff-dimnav__name" style="color:${nameColor};">${escapeHtml(d.nombreDisplay)}</div>
        ${progStr ? `<div class="ryff-dimnav__prog">${progStr}</div>` : ""}
        ${showBar ? `<div class="ryff-dimnav__bar"><div class="ryff-dimnav__bar-fill" style="width:${pct}%;background:${color};"></div></div>` : ""}
      </div>
    </div>`;
  }).join("");
}

function renderIntro(state) {
  return `
    <div class="test-intro">
      <span class="test-intro__eyebrow">Tu evaluación de bienestar</span>
      <h2 class="test-intro__title">Escala de Bienestar Psicológico</h2>
      <p class="test-intro__lead">
        18 afirmaciones para conocer cómo te encuentras hoy en las 6 dimensiones
        del bienestar psicológico de Carol Ryff: autoaceptación, relaciones
        positivas, autonomía, dominio del entorno, propósito en la vida y
        crecimiento personal. Tarda unos 4 minutos.
      </p>
      <p class="test-intro__note">
        Responde en una escala del 1 al 6, donde 1 es ${escapeHtml(ESCALA_LABELS.min)}
        y 6 es ${escapeHtml(ESCALA_LABELS.max)}. No hay respuestas correctas ni
        incorrectas; responde con honestidad pensando en cómo te sientes en general.
      </p>
      <button class="btn btn-accent btn-lg" data-test-action="start" type="button">
        <span>Comenzar evaluación</span>
        ${icon("arrowRight")}
      </button>
    </div>
  `;
}

function renderPregunta(state, idx) {
  const preguntas = state.preguntas;
  const p = preguntas[idx];
  const selected = state.respuestas[p.id];
  const isLast = idx === preguntas.length - 1;

  const dots = SCALE_VALUES.map((v) => {
    const active = selected === v;
    const aria = v === SCALE.min ? `${v} - ${ESCALA_LABELS.min}`
      : v === SCALE.max ? `${v} - ${ESCALA_LABELS.max}` : String(v);
    return `
      <button
        class="dot-option ${active ? "is-active" : ""}"
        data-test-action="answer"
        data-value="${v}"
        type="button"
        aria-label="${aria}"
      >
        <span class="dot-option__circle dot-option__circle--${v}"></span>
      </button>
    `;
  }).join("");

  return `
    <div class="ryff-quiz-layout">
      <aside class="ryff-quiz-sidebar">
        <p class="ryff-quiz-sidebar__title">Tu avance</p>
        ${renderDimSidebar(state)}
      </aside>
      <div class="ryff-quiz-main" style="--wizard-accent:${p.accentColor};">
        <article class="test-question">
          <div class="test-question__pilar">${escapeHtml(p.dimNombre)}</div>
          <h2 class="test-question__texto">${escapeHtml(p.texto)}</h2>

          <div class="dot-scale dot-scale--six">
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
              <button class="btn btn-accent" data-test-action="next" type="button" style="background:${p.accentColor};border-color:${p.accentColor};">
                <span>Ver mis resultados</span>
                ${icon("arrowRight")}
              </button>
            ` : `<span></span>`}
          </footer>
        </article>
      </div>
    </div>
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
    const p = state.preguntas[state.currentIndex];
    state.respuestas[p.id] = v;

    const allDots = btn.parentElement?.querySelectorAll(".dot-option");
    if (allDots) {
      allDots.forEach((d) => d.classList.remove("is-active"));
      btn.classList.add("is-active");
    }

    const isLast = state.currentIndex === state.preguntas.length - 1;
    if (isLast) {
      setTimeout(() => renderInto(state), 200);
    } else {
      setTimeout(() => {
        state.currentIndex += 1;
        renderInto(state);
      }, 260);
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
    const isLast = state.currentIndex === state.preguntas.length - 1;
    if (isLast) {
      await submit(state, btn);
    } else {
      state.currentIndex += 1;
      renderInto(state);
    }
    return;
  }
}

async function submit(state, submitBtn) {
  if (state.submitting) return;

  const missing = state.preguntas.find((p) => !state.respuestas[p.id]);
  if (missing) {
    const missingIdx = state.preguntas.indexOf(missing);
    state.currentIndex = missingIdx;
    renderInto(state);
    const card = state.container.querySelector(".test-question");
    if (card) {
      const note = document.createElement("div");
      note.className = "test-error-flash";
      note.textContent = `Faltan respuestas (esta es la pregunta ${missingIdx + 1}). Termínala para enviar la evaluación.`;
      card.prepend(note);
      setTimeout(() => note.remove(), 5000);
    }
    return;
  }

  state.submitting = true;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span>Calculando…</span>`;

  try {
    const result = await api.submitRyff(state.respuestas);
    const slugParam = state.cursoSlug ? `&slug=${encodeURIComponent(state.cursoSlug)}` : "";
    location.replace(`/app/ryff/resultados?id=${encodeURIComponent(result.respuestaId)}${slugParam}`);
  } catch (err) {
    console.error("[ryff] Submit failed:", err);
    state.submitting = false;
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>Reintentar</span> ${icon("arrowRight")}`;
    alert(`No se pudieron guardar tus respuestas: ${err.message}`);
  }
}

// ────────────────────────────────────────────────────────────────────
// Standalone bootstrap
// ────────────────────────────────────────────────────────────────────

const isStandalone =
  location.pathname.startsWith("/app/ryff")
  && !location.pathname.startsWith("/app/ryff/resultados");

if (isStandalone) bootstrapStandalone();

async function bootstrapStandalone() {
  const persona = await requireAuth();
  if (!persona) return;

  const params = new URLSearchParams(location.search);
  const cursoSlug = params.get("slug") || null;

  renderShell({
    persona,
    title: "Bienestar Psicológico",
    activePath: "/app/cursos",
    contentHtml: `<div id="ryffMount"></div>`,
  });

  mountWizard({
    container: document.getElementById("ryffMount"),
    cursoSlug,
  });
}
