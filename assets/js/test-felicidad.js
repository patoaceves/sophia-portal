// SOPHIA Portal — Test de Felicidad (formulario 16 preguntas, 8 pilares)

import { requireAuth } from "./auth.js";
import { api } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";

const PREGUNTAS = [
  // Autoconocimiento
  { id: "AC1", pilar: "Autoconocimiento", texto: "Conozco mis fortalezas y las uso de manera consciente en mi día a día." },
  { id: "AC2", pilar: "Autoconocimiento", texto: "Reconozco mis emociones cuando las siento y entiendo qué las dispara." },
  // Bienestar Emocional
  { id: "BE1", pilar: "Bienestar Emocional", texto: "Cuando me siento mal, tengo herramientas que me ayudan a regularme." },
  { id: "BE2", pilar: "Bienestar Emocional", texto: "Experimento emociones positivas (gratitud, alegría, calma) varias veces a la semana." },
  // Bienestar Físico
  { id: "BF1", pilar: "Bienestar Físico", texto: "Mi cuerpo se siente con energía y vitalidad la mayor parte del tiempo." },
  { id: "BF2", pilar: "Bienestar Físico", texto: "Tengo hábitos sostenidos de movimiento, descanso y alimentación." },
  // Presencia Consciente
  { id: "PC1", pilar: "Presencia Consciente", texto: "Soy capaz de estar plenamente en el momento sin distraerme." },
  { id: "PC2", pilar: "Presencia Consciente", texto: "Practico alguna forma de atención plena (meditación, respiración, silencio) regularmente." },
  // Vínculos Vitales
  { id: "VV1", pilar: "Vínculos Vitales", texto: "Tengo personas con quienes puedo ser auténtico/a y compartir lo importante." },
  { id: "VV2", pilar: "Vínculos Vitales", texto: "Cultivo intencionalmente mis relaciones más significativas." },
  // Trabajo con Propósito
  { id: "TP1", pilar: "Trabajo con Propósito", texto: "Mi trabajo o actividad principal conecta con algo que me importa profundamente." },
  { id: "TP2", pilar: "Trabajo con Propósito", texto: "Siento que lo que hago aporta valor al mundo o a otras personas." },
  // Estética Existencial
  { id: "EE1", pilar: "Estética Existencial", texto: "Encuentro belleza, asombro o admiración en lo cotidiano." },
  { id: "EE2", pilar: "Estética Existencial", texto: "Cultivo la creatividad o la apreciación artística como parte de mi vida." },
  // Fe y Filosofía de Vida
  { id: "FF1", pilar: "Fe y Filosofía de Vida", texto: "Tengo un marco (espiritual, filosófico, ambos) que da sentido a mi existencia." },
  { id: "FF2", pilar: "Fe y Filosofía de Vida", texto: "Reflexiono sobre las preguntas grandes (sentido, muerte, trascendencia)." },
];

const ESCALA = [
  { v: 1, label: "Nunca / Para nada" },
  { v: 2, label: "Casi nunca" },
  { v: 3, label: "A veces" },
  { v: 4, label: "Casi siempre" },
  { v: 5, label: "Siempre / Totalmente" },
];

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  const params = new URLSearchParams(location.search);
  let inscripcionId = params.get("inscripcion");
  const leccionId = params.get("leccion");

  // Si no viene en URL, resolver desde misCursos (busca el curso que tenga el test)
  if (!inscripcionId) {
    try {
      const { cursos } = await api.misCursos();
      // Por convención, el curso piloto que incluye el test es Happiness Workshop.
      // Tomamos la primera inscripción si no hay una específica.
      if (cursos && cursos.length > 0) {
        inscripcionId = cursos[0].inscripcionId;
      }
    } catch (e) {
      console.error("Could not resolve inscripcion:", e);
    }
  }

  if (!inscripcionId) {
    renderShell({
      persona,
      title: "Test de Felicidad",
      contentHtml: `
        <div class="empty-state">
          <div class="empty-state__title">No estás inscrito en el curso del test</div>
          <p class="empty-state__desc">El Test de Felicidad es parte del Happiness Workshop. <a href="/app/cursos">Ver mis cursos</a>.</p>
        </div>
      `,
    });
    return;
  }

  const respuestas = {};

  renderShell({
    persona,
    title: "Test de Felicidad",
    activePath: "/app/test-felicidad",
    contentHtml: `
      <header class="page-header">
        <span class="page-eyebrow">Autoevaluación · 8 pilares</span>
        <h2 class="page-title">¿Cómo está tu vida hoy?</h2>
        <p class="page-subtitle">
          Responde con honestidad — no hay respuestas correctas. Tarda unos 5 minutos.
          Al final verás un análisis personalizado por pilar.
        </p>
      </header>

      <form id="testForm" class="test-form">
        ${PREGUNTAS.map(renderPregunta).join("")}

        <div class="test-form__footer">
          <p id="formStatus" class="test-form__status"></p>
          <button class="btn btn-accent" type="submit" id="submitBtn">Ver mis resultados →</button>
        </div>
      </form>
    `,
  });

  const form = document.getElementById("testForm");
  const status = document.getElementById("formStatus");
  const submitBtn = document.getElementById("submitBtn");

  form.addEventListener("change", (e) => {
    const t = e.target;
    if (t.type === "radio" && t.name) {
      respuestas[t.name] = parseInt(t.value, 10);
      updateProgress();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const missing = PREGUNTAS.filter(p => !respuestas[p.id]);
    if (missing.length > 0) {
      status.textContent = `Te faltan ${missing.length} pregunta${missing.length === 1 ? "" : "s"}.`;
      status.className = "test-form__status is-error";
      // scroll a la primera faltante
      document.querySelector(`[data-pregunta="${missing[0].id}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando…";
    status.textContent = "";
    status.className = "test-form__status";

    try {
      const result = await api.submitTest(inscripcionId, respuestas);
      // Si venimos desde una lección, marcarla como completada
      if (leccionId) {
        try { await api.marcarLeccion(leccionId, inscripcionId); } catch {}
      }
      // Redirigir a resultados
      location.replace(`/app/test-felicidad/resultados?id=${encodeURIComponent(result.respuestaId)}`);
    } catch (err) {
      console.error("submit-test failed:", err);
      submitBtn.disabled = false;
      submitBtn.textContent = "Ver mis resultados →";
      status.textContent = `No se pudieron guardar tus respuestas: ${err.message}`;
      status.className = "test-form__status is-error";
    }
  });

  function updateProgress() {
    const done = Object.keys(respuestas).length;
    const total = PREGUNTAS.length;
    status.textContent = `${done} de ${total} respondidas`;
    status.className = "test-form__status";
  }
})();

function renderPregunta(p, idx) {
  return `
    <div class="test-q" data-pregunta="${p.id}">
      <div class="test-q__num">${idx + 1} / ${PREGUNTAS.length}</div>
      <div class="test-q__pilar">${escapeHtml(p.pilar)}</div>
      <div class="test-q__texto">${escapeHtml(p.texto)}</div>
      <div class="test-q__opciones">
        ${ESCALA.map(o => `
          <label class="test-q__opcion">
            <input type="radio" name="${p.id}" value="${o.v}">
            <span class="test-q__bullet"></span>
            <span class="test-q__label">${o.v} · ${escapeHtml(o.label)}</span>
          </label>
        `).join("")}
      </div>
    </div>
  `;
}
