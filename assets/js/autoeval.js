// SOPHIA Portal · Autoevaluación (wizard genérico de 8 preguntas).
//
// Un solo wizard para los 8 pilares del modelo SOPHIA. El pilar concreto se
// resuelve por `autoevalKey` (autoconocimiento, bienestar_emocional, …) y
// todo su contenido —preguntas, color, textos de banda— vive en
// `autoeval-defs.js`. Mismo formato para las 8: 8 preguntas (una por nivel
// de integración), Likert 1–5, suma 8–40 → % → 4 bandas.
//
// Modos de uso:
//   1. Embedded — mountWizard() desde leccion.js (caso principal).
//   2. Standalone — /app/autoevaluacion?autoeval=<key>[&inscripcion=X][&leccion=Y]
//      (sin `autoeval` cae a `autoconocimiento` por compatibilidad con la
//      ruta vieja /app/test-autoconocimiento).
//
// Reemplaza al antiguo test-autoconocimiento.js (que era específico de un
// solo pilar).

import { requireAuth } from "./auth.js";
import { api } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";
import { icon } from "./icons.js";
import { getAutoevalDef, ESCALA_LABELS } from "./autoeval-defs.js";

// Reusa las clases CSS (.test-wizard, .test-question, .dot-option, …) del
// test-felicidad. NO duplicar estilos en shell.css.

// ────────────────────────────────────────────────────────────────────
// Public API: mountWizard
// ────────────────────────────────────────────────────────────────────

/**
 * Monta el wizard de una autoevaluación dentro de un contenedor.
 * @param {object} opts
 * @param {HTMLElement} opts.container
 * @param {string} opts.autoevalKey · clave del pilar (ver autoeval-defs.js)
 * @param {string} opts.inscripcionId
 * @param {string} [opts.leccionId] · para marcar la lección como completada
 * @param {string} [opts.cursoSlug] · para el botón "salir"
 * @param {boolean} [opts.embedded=false]
 * @param {function(result):void} [opts.onComplete]
 */
export function mountWizard(opts) {
  const def = getAutoevalDef(opts.autoevalKey);
  if (!def) {
    opts.container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__title">Autoevaluación no disponible</div>
        <p class="empty-state__desc">No se encontró la autoevaluación solicitada.</p>
      </div>`;
    return null;
  }

  const state = {
    autoevalKey: opts.autoevalKey,
    def,
    preguntas: def.preguntas,
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
  // Tiñe SOLO el wizard (progreso + bolitas + eyebrow) con el color del
  // pilar, vía la CSS var --wizard-accent. Los descendientes lo heredan.
  state.container.style.setProperty("--wizard-accent", def.accentColor);
  renderInto(state);
  return state;
}

function renderInto(state) {
  const total = state.preguntas.length;
  const isIntro = state.currentIndex === -1;
  const pct = isIntro ? 0 : Math.round(((state.currentIndex + 1) / total) * 100);

  const bodyHtml = isIntro
    ? renderIntro(state)
    : renderPregunta(state, state.currentIndex);

  const headerHtml = state.embedded ? "" : `
    <header class="test-wizard__header">
      <a href="${backHref(state)}" class="page-back">
        ${icon("chevronLeft")}
        <span>Salir de la autoevaluación</span>
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

function renderIntro(state) {
  const def = state.def;
  return `
    <div class="test-intro">
      <span class="test-intro__eyebrow">Tu autoevaluación</span>
      <h2 class="test-intro__title">${escapeHtml(def.pilar)}</h2>
      <p class="test-intro__lead">
        8 preguntas para medir qué tan integrado tienes ${escapeHtml(def.pilar)}
        en tu vida, según los 8 niveles de integración del modelo SOPHIA.
        Tarda unos 3 minutos.
      </p>
      <p class="test-intro__note">
        Responde en una escala del 1 al 5, donde 1 es ${escapeHtml(ESCALA_LABELS.min)}
        y 5 es ${escapeHtml(ESCALA_LABELS.max)}. Sé honesto: el valor de la
        autoevaluación depende totalmente de eso.
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
      <div class="test-question__pilar">${escapeHtml(state.def.pilar)} · Pregunta ${idx + 1} de ${preguntas.length}</div>
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
            <span>Enviar</span>
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
    const p = state.preguntas[state.currentIndex];
    state.respuestas[p.id] = v;

    const allDots = btn.parentElement?.querySelectorAll(".dot-option");
    if (allDots) {
      allDots.forEach((d) => d.classList.remove("is-active"));
      btn.classList.add("is-active");
    }

    const isLast = state.currentIndex === state.preguntas.length - 1;
    if (isLast) {
      // NO auto-submit: re-renderear para mostrar el botón "Enviar".
      setTimeout(() => renderInto(state), 200);
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
    const isLast = state.currentIndex === state.preguntas.length - 1;
    if (isLast) {
      await submitAutoeval(state, btn);
    } else {
      state.currentIndex += 1;
      renderInto(state);
    }
    return;
  }
}

async function submitAutoeval(state, submitBtn) {
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
    const result = await api.submitAutoeval(
      state.autoevalKey,
      state.inscripcionId,
      state.respuestas,
    );
    if (state.leccionId) {
      try { await api.marcarLeccion(state.leccionId, state.inscripcionId); } catch (e) {
        console.warn("[autoeval] marcarLeccion failed (non-fatal):", e);
      }
    }
    if (state.onComplete) {
      state.onComplete(result);
    } else {
      const slugParam = state.cursoSlug ? `&slug=${encodeURIComponent(state.cursoSlug)}` : "";
      location.replace(
        `/app/autoevaluacion/resultados?autoeval=${encodeURIComponent(state.autoevalKey)}` +
        `&id=${encodeURIComponent(result.respuestaId)}${slugParam}`,
      );
    }
  } catch (err) {
    console.error("[autoeval] Submit failed:", err);
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
  location.pathname.startsWith("/app/autoevaluacion")
  && !location.pathname.startsWith("/app/autoevaluacion/resultados");

if (isStandalone) {
  bootstrapStandalone();
}

async function bootstrapStandalone() {
  const persona = await requireAuth();
  if (!persona) return;

  const params = new URLSearchParams(location.search);
  // Sin ?autoeval=, cae a autoconocimiento (compat con la ruta vieja).
  const autoevalKey = params.get("autoeval") || "";
  const def = getAutoevalDef(autoevalKey);

  let inscripcionId = params.get("inscripcion");
  const leccionId = params.get("leccion");
  let cursoSlug = null;

  if (!def) {
    renderShell({
      persona,
      title: "Autoevaluación",
      activePath: "/app/cursos",
      contentHtml: `
        <div class="empty-state">
          <div class="empty-state__title">Autoevaluación no encontrada</div>
          <p class="empty-state__desc">La autoevaluación solicitada no existe. <a href="/app/cursos">Ver mis cursos</a>.</p>
        </div>`,
    });
    return;
  }

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
      title: `Autoevaluación · ${def.pilar}`,
      activePath: "/app/cursos",
      contentHtml: `
        <div class="empty-state">
          <div class="empty-state__title">No estás inscrito en el curso de esta autoevaluación</div>
          <p class="empty-state__desc">La autoevaluación de ${escapeHtml(def.pilar)} es parte de un workshop. <a href="/app/cursos">Ver mis cursos</a>.</p>
        </div>`,
    });
    return;
  }

  renderShell({
    persona,
    title: `Autoevaluación · ${def.pilar}`,
    activePath: "/app/cursos",
    contentHtml: `<div id="autoevalMount"></div>`,
  });

  mountWizard({
    container: document.getElementById("autoevalMount"),
    autoevalKey,
    inscripcionId,
    leccionId,
    cursoSlug,
    embedded: false,
  });
}
