// SOPHIA Portal — Test de Felicidad (wizard, 1 pregunta por pantalla)

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

// Escala 1-5 mostrada como bolitas. Etiquetas en los extremos solamente.
const ESCALA_LABELS = {
  min: "Nada de acuerdo",
  max: "Totalmente de acuerdo",
};

const STATE = {
  inscripcionId: null,
  leccionId: null,
  cursoSlug: null,
  respuestas: {},
  currentIndex: -1,
  submitting: false,
};

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  const params = new URLSearchParams(location.search);
  STATE.inscripcionId = params.get("inscripcion");
  STATE.leccionId = params.get("leccion");

  // Si no viene la inscripción en URL, resolver desde misCursos
  if (!STATE.inscripcionId) {
    try {
      const { cursos } = await api.misCursos();
      const c = cursos[0];
      if (c) {
        STATE.inscripcionId = c.inscripcionId;
        STATE.cursoSlug = c.slug;
      }
    } catch (e) {
      console.error("Could not resolve inscripcion:", e);
    }
  } else {
    // Encontrar el slug del curso para el botón "regresar"
    try {
      const { cursos } = await api.misCursos();
      const c = cursos.find((x) => x.inscripcionId === STATE.inscripcionId);
      if (c) STATE.cursoSlug = c.slug;
    } catch {}
  }

  if (!STATE.inscripcionId) {
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

  renderWizard(persona);
})();

function backHref() {
  return STATE.cursoSlug
    ? `/app/curso?slug=${encodeURIComponent(STATE.cursoSlug)}`
    : "/app/cursos";
}

function renderWizard(persona) {
  const total = PREGUNTAS.length;
  const isIntro = STATE.currentIndex === -1;
  const isReview = STATE.currentIndex >= total;

  const pct = isIntro
    ? 0
    : isReview
      ? 100
      : Math.round((STATE.currentIndex / total) * 100);

  let bodyHtml;
  if (isIntro) {
    bodyHtml = renderIntro();
  } else if (isReview) {
    bodyHtml = renderReview();
  } else {
    bodyHtml = renderPregunta(STATE.currentIndex);
  }

  renderShell({
    persona,
    title: "Test de Felicidad",
    activePath: "/app/cursos",
    contentHtml: `
      <div class="leccion-progress-bar">
        <div class="leccion-progress-bar__fill" style="width: ${pct}%;"></div>
      </div>

      <div class="test-wizard">
        <header class="test-wizard__header">
          <a href="${backHref()}" class="page-back">
            ${icon("chevronLeft")}
            <span>Salir del test</span>
          </a>
          ${!isIntro && !isReview
            ? `<div class="test-wizard__counter">Pregunta ${STATE.currentIndex + 1} de ${total}</div>`
            : ""}
        </header>

        <div class="test-wizard__body">
          ${bodyHtml}
        </div>
      </div>
    `,
  });

  wireWizard();
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
          "Autoconocimiento",
          "Bienestar Emocional",
          "Bienestar Físico",
          "Presencia Consciente",
          "Vínculos Vitales",
          "Trabajo con Propósito",
          "Estética Existencial",
          "Fe y Filosofía de Vida",
        ].map((p) => `<span class="test-intro__pillar">${escapeHtml(p)}</span>`).join("")}
      </div>
      <p class="test-intro__note">
        No hay respuestas correctas. Sé honesto contigo: el valor del test
        depende totalmente de eso.
      </p>
      <button class="btn btn-accent btn-lg" id="startBtn" type="button">
        <span>Empezar el test</span>
        ${icon("arrowRight")}
      </button>
    </div>
  `;
}

function renderPregunta(idx) {
  const p = PREGUNTAS[idx];
  const selected = STATE.respuestas[p.id];

  // 5 bolitas, tamaños van creciendo de min a max para refuerzo visual
  const dots = [1, 2, 3, 4, 5].map((v) => {
    const active = selected === v;
    return `
      <button
        class="dot-option ${active ? "is-active" : ""}"
        data-value="${v}"
        type="button"
        aria-label="${v} - ${v === 1 ? "Nada de acuerdo" : v === 5 ? "Totalmente de acuerdo" : ""}"
      >
        <span class="dot-option__circle dot-option__circle--${v}"></span>
      </button>
    `;
  }).join("");

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
        <button class="btn btn-ghost" id="prevBtn" type="button" ${idx === 0 ? "disabled" : ""}>
          ${icon("arrowLeft")}
          <span>Anterior</span>
        </button>
        <button class="btn btn-accent" id="nextBtn" type="button" ${selected ? "" : "disabled"}>
          <span>${idx === PREGUNTAS.length - 1 ? "Revisar respuestas" : "Siguiente"}</span>
          ${icon("arrowRight")}
        </button>
      </footer>
    </article>
  `;
}

function renderReview() {
  const allAnswered = PREGUNTAS.every((p) => STATE.respuestas[p.id]);
  return `
    <div class="test-review">
      <h2 class="test-review__title">Revisa tus respuestas</h2>
      <p class="test-review__lead">
        Puedes editar cualquiera antes de enviar. Todas tus respuestas se
        guardarán de forma segura.
      </p>

      <ul class="test-review__list">
        ${PREGUNTAS.map((p, i) => {
          const v = STATE.respuestas[p.id];
          return `
            <li class="test-review__item ${v ? "" : "is-missing"}">
              <button class="test-review__edit" data-idx="${i}" type="button">
                <span class="test-review__num">${i + 1}</span>
                <div class="test-review__content">
                  <div class="test-review__pilar">${escapeHtml(p.pilar)}</div>
                  <div class="test-review__texto">${escapeHtml(p.texto)}</div>
                </div>
                <div class="test-review__answer">
                  ${v
                    ? `<span class="test-review__value">${v}/5</span>`
                    : `<span class="test-review__missing">Sin responder</span>`}
                </div>
                ${icon("chevronRight")}
              </button>
            </li>
          `;
        }).join("")}
      </ul>

      <footer class="test-review__footer">
        <button class="btn btn-ghost" id="backToQuestionsBtn" type="button">
          ${icon("arrowLeft")}
          <span>Volver a las preguntas</span>
        </button>
        <button
          class="btn btn-accent btn-lg"
          id="submitBtn"
          type="button"
          ${allAnswered ? "" : "disabled"}
        >
          <span>${allAnswered ? "Enviar y ver mis resultados" : "Faltan respuestas"}</span>
          ${icon("arrowRight")}
        </button>
      </footer>
    </div>
  `;
}

function wireWizard() {
  // Intro
  const startBtn = document.getElementById("startBtn");
  startBtn?.addEventListener("click", () => {
    STATE.currentIndex = 0;
    rerenderWithoutShell();
  });

  // Pregunta: bolitas
  document.querySelectorAll(".dot-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = parseInt(btn.getAttribute("data-value"), 10);
      const p = PREGUNTAS[STATE.currentIndex];
      STATE.respuestas[p.id] = v;
      // Avanzar automáticamente con un mini-delay para que el usuario vea
      // el feedback visual de la selección.
      setTimeout(() => {
        if (STATE.currentIndex < PREGUNTAS.length - 1) {
          STATE.currentIndex += 1;
        } else {
          STATE.currentIndex = PREGUNTAS.length;
        }
        rerenderWithoutShell();
      }, 220);
    });
  });

  // Pregunta: navegación
  document.getElementById("prevBtn")?.addEventListener("click", () => {
    if (STATE.currentIndex > 0) {
      STATE.currentIndex -= 1;
      rerenderWithoutShell();
    }
  });
  document.getElementById("nextBtn")?.addEventListener("click", () => {
    if (STATE.currentIndex < PREGUNTAS.length - 1) {
      STATE.currentIndex += 1;
    } else {
      STATE.currentIndex = PREGUNTAS.length;
    }
    rerenderWithoutShell();
  });

  // Revisión: editar pregunta específica
  document.querySelectorAll(".test-review__edit").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-idx"), 10);
      STATE.currentIndex = idx;
      rerenderWithoutShell();
    });
  });

  // Revisión: volver a preguntas
  document.getElementById("backToQuestionsBtn")?.addEventListener("click", () => {
    STATE.currentIndex = PREGUNTAS.length - 1;
    rerenderWithoutShell();
  });

  // Revisión: submit
  const submitBtn = document.getElementById("submitBtn");
  submitBtn?.addEventListener("click", async () => {
    if (STATE.submitting) return;
    STATE.submitting = true;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Enviando…</span>`;

    try {
      const result = await api.submitTest(STATE.inscripcionId, STATE.respuestas);
      if (STATE.leccionId) {
        try { await api.marcarLeccion(STATE.leccionId, STATE.inscripcionId); } catch {}
      }
      location.replace(
        `/app/test-felicidad/resultados?id=${encodeURIComponent(result.respuestaId)}`,
      );
    } catch (err) {
      console.error("submit-test failed:", err);
      STATE.submitting = false;
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Reintentar</span> ${icon("arrowRight")}`;
      alert(`No se pudieron guardar tus respuestas: ${err.message}`);
    }
  });
}

/**
 * Re-renderiza solo el contenido del wizard sin tocar la sidebar/header
 * (que son estáticos). Mucho más rápido que renderShell completo.
 */
function rerenderWithoutShell() {
  // Re-renderizamos el bloque interno y la barra de progreso.
  const total = PREGUNTAS.length;
  const isIntro = STATE.currentIndex === -1;
  const isReview = STATE.currentIndex >= total;
  const pct = isIntro ? 0 : isReview ? 100 : Math.round((STATE.currentIndex / total) * 100);

  const main = document.querySelector(".app-main");
  if (!main) {
    // Fallback: re-render completo
    requireAuth().then((p) => p && renderWizard(p));
    return;
  }

  let bodyHtml;
  if (isIntro) bodyHtml = renderIntro();
  else if (isReview) bodyHtml = renderReview();
  else bodyHtml = renderPregunta(STATE.currentIndex);

  main.innerHTML = `
    <div class="leccion-progress-bar">
      <div class="leccion-progress-bar__fill" style="width: ${pct}%;"></div>
    </div>
    <div class="test-wizard">
      <header class="test-wizard__header">
        <a href="${backHref()}" class="page-back">
          ${icon("chevronLeft")}
          <span>Salir del test</span>
        </a>
        ${!isIntro && !isReview
          ? `<div class="test-wizard__counter">Pregunta ${STATE.currentIndex + 1} de ${total}</div>`
          : ""}
      </header>
      <div class="test-wizard__body">
        ${bodyHtml}
      </div>
    </div>
  `;

  wireWizard();
}
