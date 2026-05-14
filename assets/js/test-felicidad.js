// SOPHIA Portal · Test de Felicidad (wizard de 16 preguntas).
//
// Modos de uso:
//   1. Standalone (`/app/test-felicidad?inscripcion=X[&leccion=Y]`):
//      el módulo se auto-monta al cargar la página, dentro del shell normal.
//   2. Embedded (`mountWizard(...)` desde leccion.js):
//      monta el wizard dentro de un contenedor existente, sin tocar el shell.
//      Mantiene el checkpoint bar de la lección visible.
//
// UX (todo igual en los dos modos):
//   - Una pregunta a la vez con dots tappables (1-5)
//   - Auto-avance al seleccionar (mini-delay para feedback visual)
//   - Botón anterior/siguiente para navegación manual
//   - Al responder la última, ENVÍA y redirige a resultados (no review screen)
//   - Si falta alguna respuesta al final, te lleva a la primera sin responder

import { requireAuth } from "./auth.js";
import { api } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";
import { icon } from "./icons.js";

const PREGUNTAS = [
  { id: "AC1", pilar: "Autoconocimiento", texto: "Conozco mis fortalezas y las uso de manera consciente en mi día a día." },
  { id: "AC2", pilar: "Autoconocimiento", texto: "Reconozco mis emociones cuando las siento y entiendo qué las dispara." },
  { id: "BE1", pilar: "Bienestar Emocional", texto: "Cuando me siento mal, tengo herramientas que me ayudan a regularme." },
  { id: "BE2", pilar: "Bienestar Emocional", texto: "Experimento emociones positivas (gratitud, alegría, calma) varias veces a la semana." },
  { id: "BF1", pilar: "Bienestar Físico", texto: "Mi cuerpo se siente con energía y vitalidad la mayor parte del tiempo." },
  { id: "BF2", pilar: "Bienestar Físico", texto: "Tengo hábitos sostenidos de movimiento, descanso y alimentación." },
  { id: "PC1", pilar: "Presencia Consciente", texto: "Soy capaz de estar plenamente en el momento sin distraerme." },
  { id: "PC2", pilar: "Presencia Consciente", texto: "Practico alguna forma de atención plena (meditación, respiración, silencio) regularmente." },
  { id: "VV1", pilar: "Vínculos Vitales", texto: "Tengo personas con quienes puedo ser auténtico/a y compartir lo importante." },
  { id: "VV2", pilar: "Vínculos Vitales", texto: "Cultivo intencionalmente mis relaciones más significativas." },
  { id: "TP1", pilar: "Trabajo con Propósito", texto: "Mi trabajo o actividad principal conecta con algo que me importa profundamente." },
  { id: "TP2", pilar: "Trabajo con Propósito", texto: "Siento que lo que hago aporta valor al mundo o a otras personas." },
  { id: "EE1", pilar: "Estética Existencial", texto: "Encuentro belleza, asombro o admiración en lo cotidiano." },
  { id: "EE2", pilar: "Estética Existencial", texto: "Cultivo la creatividad o la apreciación artística como parte de mi vida." },
  { id: "FF1", pilar: "Fe y Filosofía de Vida", texto: "Tengo un marco (espiritual, filosófico, ambos) que da sentido a mi existencia." },
  { id: "FF2", pilar: "Fe y Filosofía de Vida", texto: "Reflexiono sobre las preguntas grandes (sentido, muerte, trascendencia)." },
];

const ESCALA_LABELS = {
  min: "Nada de acuerdo",
  max: "Totalmente de acuerdo",
};

// ────────────────────────────────────────────────────────────────────
// Public API: mountWizard · used by leccion.js for embedded mode
// ────────────────────────────────────────────────────────────────────

/**
 * Monta el wizard del test dentro de un contenedor.
 * @param {object} opts
 * @param {HTMLElement} opts.container · donde montar el wizard
 * @param {string} opts.inscripcionId
 * @param {string} [opts.leccionId] · para marcar la lección como completada al enviar
 * @param {function(result):void} [opts.onComplete] · callback con el resultado del submit
 * @param {string} [opts.cursoSlug] · para el botón "salir"
 * @param {boolean} [opts.embedded=false] · si true, no muestra header propio (lección lo hace)
 */
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

  // Attach the click handler ONCE via event delegation on the container.
  // Re-wiring on every renderInto() would accumulate handlers and cause
  // the submit button to either fire multiple times or appear "stuck"
  // because previous handlers had already set state.submitting = true.
  state.container.addEventListener("click", (e) => clickHandler(state, e));

  renderInto(state);
  return state;
}

function renderInto(state) {
  const total = PREGUNTAS.length;
  const isIntro = state.currentIndex === -1;
  const pct = isIntro ? 0 : Math.round(((state.currentIndex + 1) / total) * 100);

  let bodyHtml;
  if (isIntro) {
    bodyHtml = renderIntro();
  } else {
    bodyHtml = renderPregunta(state.currentIndex, state.respuestas);
  }

  // Embedded mode: no progress bar (lección la maneja). Standalone: include it.
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

  // Always show the test's own progress bar (both embedded and standalone).
  // It indicates progress THROUGH THE TEST QUESTIONS, not the lesson.
  // In embedded mode it sits below the checkpoint bar; in standalone mode
  // it's the only progress indicator on the page.
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
  // Listener is wired ONCE in mountWizard via event delegation.
}

function backHref(state) {
  return state.cursoSlug
    ? `/app/curso?slug=${encodeURIComponent(state.cursoSlug)}`
    : "/app/cursos";
}

function renderIntro() {
  return `
    <div class="test-intro">
      <span class="test-intro__eyebrow">Tu evaluación inicial</span>
      <h2 class="test-intro__title">Test de Felicidad</h2>
      <p class="test-intro__lead">
        Una autoevaluación de 16 preguntas en 8 pilares que conforman una vida
        plena. Tarda unos 5 minutos. Al final recibes un análisis personalizado
        por pilar.
      </p>
      <div class="test-intro__pillars">
        ${[
          "Autoconocimiento", "Bienestar Emocional", "Bienestar Físico",
          "Presencia Consciente", "Vínculos Vitales", "Trabajo con Propósito",
          "Estética Existencial", "Fe y Filosofía de Vida",
        ].map((p) => `<span class="test-intro__pillar">${escapeHtml(p)}</span>`).join("")}
      </div>
      <p class="test-intro__note">
        No hay respuestas correctas. Sé honesto contigo: el valor del test
        depende totalmente de eso.
      </p>
      <button class="btn btn-accent btn-lg" data-test-action="start" type="button">
        <span>Empezar el test</span>
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
        aria-label="${v} - ${v === 1 ? "Nada de acuerdo" : v === 5 ? "Totalmente de acuerdo" : ""}"
      >
        <span class="dot-option__circle dot-option__circle--${v}"></span>
      </button>
    `;
  }).join("");

  const nextLabel = isLast ? "Enviar" : "Siguiente"; // legacy, kept for back-compat

  return `
    <article class="test-question">
      <div class="test-question__pilar">${escapeHtml(p.pilar)}</div>
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
    const p = PREGUNTAS[state.currentIndex];
    state.respuestas[p.id] = v;

    // Immediate visual feedback: mark this option active and unmark
    // siblings BEFORE the auto-advance fires. Otherwise the user clicks
    // and waits ~220ms with no visible change, which feels broken.
    const allDots = btn.parentElement?.querySelectorAll(".dot-option");
    if (allDots) {
      allDots.forEach((d) => d.classList.remove("is-active"));
      btn.classList.add("is-active");
    }

    // Auto-advance after short delay (feels snappier).
    // Última pregunta: NO auto-submit. Re-renderear para que aparezca el
    // botón "Enviar" — el usuario lo presiona cuando esté listo.
    const isLast = state.currentIndex === PREGUNTAS.length - 1;
    if (isLast) {
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

  // Validate all answered. If something missing, give CLEAR feedback
  // (jump to the missing question + flash the page-level error).
  const missing = PREGUNTAS.find((p) => !state.respuestas[p.id]);
  if (missing) {
    const missingIdx = PREGUNTAS.indexOf(missing);
    console.warn("[test] Missing answer for question", missingIdx + 1, missing.id);
    state.currentIndex = missingIdx;
    renderInto(state);
    // Flash a brief inline error so the user understands why the test
    // didn't submit (silent jump was confusing).
    const card = state.container.querySelector(".test-question");
    if (card) {
      const note = document.createElement("div");
      note.className = "test-error-flash";
      note.textContent = `Faltan respuestas (esta es la pregunta ${missingIdx + 1}). Termínala para enviar el test.`;
      card.prepend(note);
      setTimeout(() => note.remove(), 5000);
    }
    return;
  }

  console.log("[test] Submitting", Object.keys(state.respuestas).length, "answers");
  state.submitting = true;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span>Enviando…</span>`;

  try {
    const result = await api.submitTest(state.inscripcionId, state.respuestas);
    console.log("[test] Submit succeeded:", result);
    if (state.leccionId) {
      try { await api.marcarLeccion(state.leccionId, state.inscripcionId); } catch (e) {
        console.warn("[test] marcarLeccion failed (non-fatal):", e);
      }
    }
    if (state.onComplete) {
      state.onComplete(result);
    } else {
      // Standalone: redirect to results
      const slugParam = state.cursoSlug ? `&slug=${encodeURIComponent(state.cursoSlug)}` : "";
      location.replace(
        `/app/test-felicidad/resultados?id=${encodeURIComponent(result.respuestaId)}${slugParam}`,
      );
    }
  } catch (err) {
    console.error("[test] Submit failed:", err);
    state.submitting = false;
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>Reintentar</span> ${icon("arrowRight")}`;
    alert(`No se pudieron guardar tus respuestas: ${err.message}`);
  }
}

// ────────────────────────────────────────────────────────────────────
// Standalone bootstrap (only runs when this script is loaded as the page entry)
// Skipped when imported as a module from leccion.js
// ────────────────────────────────────────────────────────────────────

const isStandalone = location.pathname.startsWith("/app/test-felicidad")
  && !location.pathname.startsWith("/app/test-felicidad/resultados");

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
      title: "Test de Felicidad",
      activePath: "/app/cursos",
      contentHtml: `
        <div class="empty-state">
          <div class="empty-state__title">No estás inscrito en el curso del test</div>
          <p class="empty-state__desc">El Test de Felicidad es parte de un workshop. <a href="/app/cursos">Ver mis cursos</a>.</p>
        </div>
      `,
    });
    return;
  }

  // Mount shell with empty container, then mount wizard inside it
  renderShell({
    persona,
    title: "Test de Felicidad",
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
