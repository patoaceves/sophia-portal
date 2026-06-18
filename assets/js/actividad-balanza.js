// SOPHIA Portal · Actividad "La Balanza Energética" — wizard nativo
//
// Actividad previa del módulo Vínculos Vitales. NO es un quiz puntuado ni una
// autoevaluación con bandas: es un ejercicio relacional de 4 pasos que mapea
// con quién recargas energía y con quién la drenas. Todo es client-side; no
// pega a ningún edge function. Al terminar el Paso 4 se llama onComplete()
// para marcar la lección como completada.
//
// Los resultados (nombres, roles y micro-misión) se guardan en localStorage
// por lección, así que al volver a entrar el alumno ve su mapa otra vez en
// lugar de empezar de cero.
//
// Flujo:
//   intro (0) → Paso 1 nombres (1) → Paso 2 análisis (2)
//             → Paso 3 mapa relacional (3) → Paso 4 micro-misión (4) → resultados
//
// Se monta desde leccion.js cuando una lección tipo `quiz` trae como clave
// (url_externa) "vinculos-balanza".
//
// Uso:
//   import { mountBalanza } from "./actividad-balanza.js";
//   mountBalanza({ container, leccionId, onComplete, yaCompletada });

import { icon } from "./icons.js";
import { escapeHtml } from "./ui-shell.js";
import { api } from "./api.js";

const ACTIVIDAD = "vinculos-balanza";

const ROLES = {
  verde: {
    nombre: "Sin Filtro",
    sub: "Soy Yo",
    desc: "Puedo decir lo que pienso, mostrarme vulnerable o equivocarme sin miedo a ser juzgado. Me siento libre.",
  },
  ambar: {
    nombre: "El Diplomático",
    sub: "Soy lo que esperan",
    desc: "Cuido mis palabras. Trato de complacer o cumplir un rol (el buen hijo, el empleado eficiente). No soy falso, pero tampoco soy totalmente espontáneo.",
  },
  rojo: {
    nombre: "El Soldado",
    sub: "Soy mi defensa",
    desc: "Estoy en guardia. Siento que debo protegerme, justificarme o tener cuidado para no detonar un conflicto. Me siento tenso.",
  },
};

const TERRITORIOS = {
  verde: {
    titulo: "Territorio de Refugio",
    mensaje: "Aquí es donde descansas y recargas. Estos vínculos son tu hogar emocional.",
  },
  ambar: {
    titulo: "Territorio de Teatro",
    mensaje: "Aquí funcionas, pero te adaptas. Cuidado: pasar mucho tiempo actuando para cumplir expectativas ajenas genera vacío interior.",
  },
  rojo: {
    titulo: "Territorio de Batalla",
    mensaje: "Aquí sobrevives. Estar en guardia constante activa tu sistema de alerta y bloquea la intimidad real.",
  },
};

const RETOS = {
  A: "Compartir una opinión real o un sentimiento honesto, aunque sea pequeño, rompiendo el guion de siempre.",
  B: "Dejar de justificarme o explicarme ante una crítica de esa persona.",
  C: 'Preguntar abiertamente: "¿Cómo sientes que estamos tú y yo últimamente?"',
};

const NUM_FILAS = 5;

// Punto de color (reemplaza emojis). Hereda los --bal-* de .balanza.
function dot(color) {
  return `<span class="bal-dot bal-dot--${color}" aria-hidden="true"></span>`;
}

export function mountBalanza({ container, leccionId, inscripcionId, onComplete, yaCompletada }) {
  if (!container) return;

  const stateKey = `sophia_balanza_${leccionId || "vinculos"}`;
  const cached = readState(stateKey);

  const state = {
    container,
    stateKey,
    leccionId,
    inscripcionId,
    onComplete,
    yaCompletada: !!yaCompletada,
    step: cached?.step ?? 0,
    nombres: cached?.nombres ?? Array(NUM_FILAS).fill(""),
    roles: cached?.roles ?? {},        // idx → "verde" | "ambar" | "rojo"
    analisisIdx: cached?.analisisIdx ?? 0,
    misionTarget: cached?.misionTarget ?? null, // idx del vínculo elegido
    misionReto: cached?.misionReto ?? null,     // "A" | "B" | "C"
    finalizada: !!cached?.finalizada,
    saving: false,
  };

  container.addEventListener("click", (e) => clickHandler(state, e));
  container.addEventListener("input", (e) => inputHandler(state, e));

  // Revelar el botón "Avanzar" del footer (lo renderiza leccion.js oculto) si
  // la lección ya está completada en el servidor o localmente.
  if (state.finalizada || state.yaCompletada) {
    document.getElementById("quizAdvanceBtn")?.removeAttribute("hidden");
  }

  render(state);

  // Si no hay progreso local (otro dispositivo, caché limpiada), intentamos
  // hidratar desde la base: la fuente de verdad es respuestas_quiz. Solo
  // sobrescribimos cuando NO hay nada local en curso, para no pisar un redo.
  const hayProgresoLocal = !!cached && (cached.finalizada || (cached.step ?? 0) > 0 ||
    (Array.isArray(cached.nombres) && cached.nombres.some((n) => n && n.trim())));
  if (!hayProgresoLocal) {
    api.resultadosQuiz(leccionId)
      .then((prev) => {
        if (!prev?.tieneResultados || !prev.respuestas?.balanza) return;
        try {
          const saved = JSON.parse(prev.respuestas.balanza);
          hydrate(state, saved);
          state.finalizada = true;
          persist(state);
          document.getElementById("quizAdvanceBtn")?.removeAttribute("hidden");
          render(state);
        } catch (err) {
          console.warn("balanza hydrate parse failed:", err);
        }
      })
      .catch((err) => console.warn("balanza resultados fetch failed:", err));
  }
}

// Rellena el estado con un snapshot guardado (desde backend o local).
function hydrate(state, saved) {
  if (Array.isArray(saved.nombres)) {
    state.nombres = saved.nombres.concat(Array(NUM_FILAS).fill("")).slice(0, NUM_FILAS);
  }
  if (saved.roles && typeof saved.roles === "object") state.roles = saved.roles;
  state.misionTarget = (saved.misionTarget ?? null);
  state.misionReto = saved.misionReto || null;
}

// ─────────────────────────────────────────────────────────────────────
// Helpers de datos
// ─────────────────────────────────────────────────────────────────────

function indicesConNombre(state) {
  return state.nombres
    .map((n, i) => (n && n.trim() ? i : -1))
    .filter((i) => i >= 0);
}

function todosClasificados(state) {
  return indicesConNombre(state).every((i) => state.roles[i]);
}

function indicesPorTerritorio(state, color) {
  return indicesConNombre(state).filter((i) => state.roles[i] === color);
}

function indicesElegiblesMision(state) {
  return indicesConNombre(state).filter(
    (i) => state.roles[i] === "ambar" || state.roles[i] === "rojo",
  );
}

// ─────────────────────────────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────────────────────────────

function render(state) {
  const pasos = ["", "El reparto", "El análisis", "Tu mapa relacional", "La micro-misión"];
  const totalPasos = 4;
  const mostrarProgreso = !state.finalizada && state.step >= 1 && state.step <= totalPasos;
  const progressHtml = mostrarProgreso ? `
    <div class="test-progress">
      <div class="test-progress__bar">
        <div class="test-progress__fill" style="width:${Math.round((state.step / totalPasos) * 100)}%;"></div>
      </div>
      <div class="test-progress__label">Paso ${state.step} de ${totalPasos} · ${escapeHtml(pasos[state.step])}</div>
    </div>
  ` : "";

  let body = "";
  if (state.finalizada) body = renderResultados(state);
  else if (state.step === 0) body = renderIntro(state);
  else if (state.step === 1) body = renderPaso1(state);
  else if (state.step === 2) body = renderPaso2(state);
  else if (state.step === 3) body = renderPaso3(state);
  else if (state.step === 4) body = renderPaso4(state);

  state.container.innerHTML = `
    ${progressHtml}
    <div class="test-wizard test-wizard--embedded balanza">
      <div class="test-wizard__body">${body}</div>
    </div>
  `;
}

function renderIntro(state) {
  const repaso = state.yaCompletada ? `
    <p class="balanza-aviso-repaso">Ya completaste esta actividad antes. Puedes repasarla cuando quieras o avanzar a la siguiente lección.</p>
  ` : "";
  return `
    <div class="test-intro balanza-intro">
      <span class="test-intro__eyebrow">Actividad previa</span>
      <h2 class="test-intro__title">La Balanza Energética</h2>
      <p class="test-intro__lead">Identifica rápidamente qué relaciones te nutren y cuáles te drenan en este momento de tu vida.</p>
      <p class="test-intro__lead">Vas a pensar en las personas con las que más tiempo o energía mental gastas hoy, reconocer quién eres cuando estás con ellas y descubrir tu mapa relacional. Es un ejercicio honesto y privado: nada de lo que escribas sale de tu dispositivo.</p>
      ${repaso}
      <button class="btn btn-accent btn-lg" data-bal-action="start" type="button">
        <span>Comenzar actividad</span>
        ${icon("arrowRight")}
      </button>
    </div>
  `;
}

function renderPaso1(state) {
  const filas = state.nombres.map((val, i) => `
    <div class="balanza-fila">
      <span class="balanza-fila__num">${i + 1}</span>
      <input
        class="balanza-input"
        type="text"
        inputmode="text"
        maxlength="40"
        placeholder="Nombre de la persona"
        data-bal-name="${i}"
        value="${escapeHtml(val)}"
        aria-label="Persona ${i + 1}"
      />
    </div>
  `).join("");

  const hayAlguno = indicesConNombre(state).length >= 1;

  return `
    <article class="test-question balanza-paso">
      <div class="test-question__pilar">Paso 1 · El reparto</div>
      <h2 class="test-question__texto">¿Con quién gastas más energía?</h2>
      <p class="balanza-ayuda">Piensa en las 5 personas con las que más tiempo o energía mental gastas actualmente (pareja, familiar, jefe, amigo). Escribe solo sus nombres. Puedes poner menos de cinco si quieres.</p>

      <div class="balanza-yo" aria-hidden="true">
        <span class="balanza-yo__circ">YO</span>
      </div>

      <div class="balanza-filas">${filas}</div>

      <footer class="test-question__nav balanza-nav">
        <span></span>
        <button class="btn btn-accent" data-bal-action="to-2" type="button" ${hayAlguno ? "" : "disabled"}>
          <span>Continuar</span>
          ${icon("arrowRight")}
        </button>
      </footer>
    </article>
  `;
}

function renderPaso2(state) {
  const indices = indicesConNombre(state);
  const i = indices[state.analisisIdx];
  const nombre = state.nombres[i] || "";
  const seleccion = state.roles[i] || null;
  const posicion = state.analisisIdx + 1;

  const opciones = ["verde", "ambar", "rojo"].map((color) => {
    const r = ROLES[color];
    const active = seleccion === color;
    return `
      <button
        class="balanza-mask balanza-mask--${color} ${active ? "is-active" : ""}"
        data-bal-action="mask"
        data-color="${color}"
        type="button"
      >
        <span class="balanza-mask__top">
          ${dot(color)}
          <span class="balanza-mask__nombre">${escapeHtml(r.nombre)} <em>(${escapeHtml(r.sub)})</em></span>
        </span>
        <span class="balanza-mask__desc">${escapeHtml(r.desc)}</span>
      </button>
    `;
  }).join("");

  const esUltimo = state.analisisIdx === indices.length - 1;

  return `
    <article class="test-question balanza-paso">
      <div class="test-question__pilar">Paso 2 · El análisis · ${posicion} de ${indices.length}</div>
      <h2 class="test-question__texto">Cuando estás a solas con <span class="balanza-nombre-hi">${escapeHtml(nombre)}</span>, ¿quién eres?</h2>
      <p class="balanza-ayuda">Sé brutalmente honesto. ¿Cuál de estas frases describe mejor tu estado?</p>

      <div class="balanza-masks">${opciones}</div>

      <footer class="test-question__nav balanza-nav">
        <button class="btn btn-ghost" data-bal-action="ana-prev" type="button">
          ${icon("arrowLeft")}<span>${state.analisisIdx === 0 ? "Editar nombres" : "Anterior"}</span>
        </button>
        <button class="btn btn-accent" data-bal-action="ana-next" type="button" ${seleccion ? "" : "disabled"}>
          <span>${esUltimo ? "Ver mi mapa" : "Siguiente"}</span>
          ${icon("arrowRight")}
        </button>
      </footer>
    </article>
  `;
}

// Bloques de territorio, reutilizados por el Paso 3 y por la vista de resultados.
function renderMapa(state) {
  const bloque = (color) => {
    const t = TERRITORIOS[color];
    const idxs = indicesPorTerritorio(state, color);
    const personas = idxs.length
      ? `<ul class="balanza-terr__lista">${idxs.map((i) => `<li>${escapeHtml(state.nombres[i])}</li>`).join("")}</ul>`
      : `<p class="balanza-terr__vacio">Sin vínculos en este territorio.</p>`;
    return `
      <section class="balanza-terr balanza-terr--${color} ${idxs.length ? "" : "is-empty"}">
        <header class="balanza-terr__head">
          ${dot(color)}
          <h3 class="balanza-terr__titulo">${escapeHtml(t.titulo)}</h3>
        </header>
        ${personas}
        <p class="balanza-terr__msg">${escapeHtml(t.mensaje)}</p>
      </section>
    `;
  };
  return `
    <div class="balanza-mapa">
      ${bloque("verde")}
      ${bloque("ambar")}
      ${bloque("rojo")}
    </div>
  `;
}

function renderPaso3(state) {
  return `
    <article class="test-question balanza-paso">
      <div class="test-question__pilar">Paso 3 · Tu mapa relacional</div>
      <h2 class="test-question__texto">Así se reparte tu energía hoy</h2>
      <p class="balanza-ayuda">Tus vínculos quedan en tres territorios. No hay correctos ni incorrectos: es una foto honesta de este momento.</p>

      ${renderMapa(state)}

      <footer class="test-question__nav balanza-nav">
        <button class="btn btn-ghost" data-bal-action="to-2-back" type="button">
          ${icon("arrowLeft")}<span>Anterior</span>
        </button>
        <button class="btn btn-accent" data-bal-action="to-4" type="button">
          <span>Mi micro-misión</span>
          ${icon("arrowRight")}
        </button>
      </footer>
    </article>
  `;
}

function renderPaso4(state) {
  const elegibles = indicesElegiblesMision(state);

  // Caso raro: todos sus vínculos son de Refugio. No hay micro-misión de cambio.
  if (elegibles.length === 0) {
    return `
      <article class="test-question balanza-paso">
        <div class="test-question__pilar">Paso 4 · La micro-misión</div>
        <h2 class="test-question__texto">Todos tus vínculos están en Refugio</h2>
        <p class="balanza-ayuda">Marcaste a todas tus personas como Sin Filtro. Es un lugar privilegiado para estar. Tu micro-misión es cuidarlo: agradece a una de esas personas algo concreto esta semana.</p>
        <footer class="test-question__nav balanza-nav">
          <button class="btn btn-ghost" data-bal-action="to-3" type="button">
            ${icon("arrowLeft")}<span>Anterior</span>
          </button>
          <button class="btn btn-accent" data-bal-action="finish" type="button" ${state.saving ? "disabled" : ""}>
            <span>${state.saving ? "Guardando…" : "Completar actividad"}</span>
            ${icon("check")}
          </button>
        </footer>
      </article>
    `;
  }

  const tarjetas = elegibles.map((i) => {
    const color = state.roles[i];
    const r = ROLES[color];
    const active = state.misionTarget === i;
    return `
      <button class="balanza-target balanza-target--${color} ${active ? "is-active" : ""}" data-bal-action="target" data-idx="${i}" type="button">
        <span class="balanza-target__head">${dot(color)}<span class="balanza-target__nombre">${escapeHtml(state.nombres[i])}</span></span>
        <span class="balanza-target__rol">${escapeHtml(r.nombre)}</span>
      </button>
    `;
  }).join("");

  const retos = ["A", "B", "C"].map((k) => {
    const active = state.misionReto === k;
    return `
      <button class="balanza-reto ${active ? "is-active" : ""}" data-bal-action="reto" data-reto="${k}" type="button">
        <span class="balanza-reto__radio" aria-hidden="true"></span>
        <span class="balanza-reto__txt"><strong>Opción ${k}.</strong> ${escapeHtml(RETOS[k])}</span>
      </button>
    `;
  }).join("");

  const listo = state.misionTarget != null && state.misionReto;

  return `
    <article class="test-question balanza-paso">
      <div class="test-question__pilar">Paso 4 · La micro-misión</div>
      <h2 class="test-question__texto">Elige un vínculo y un reto pequeño</h2>
      <p class="balanza-ayuda">No se trata de cortar relaciones, sino de mejorar su calidad. Elige un vínculo que marcaste como Diplomático o Soldado y un reto para esta semana.</p>

      <h3 class="balanza-sub">1. Tu vínculo</h3>
      <div class="balanza-targets">${tarjetas}</div>

      <h3 class="balanza-sub">2. Tu reto de la semana</h3>
      <div class="balanza-retos">${retos}</div>

      <footer class="test-question__nav balanza-nav">
        <button class="btn btn-ghost" data-bal-action="to-3" type="button">
          ${icon("arrowLeft")}<span>Anterior</span>
        </button>
        <button class="btn btn-accent" data-bal-action="finish" type="button" ${listo && !state.saving ? "" : "disabled"}>
          <span>${state.saving ? "Guardando…" : "Completar actividad"}</span>
          ${icon("check")}
        </button>
      </footer>
    </article>
  `;
}

// Vista de resultados: se muestra al terminar y al volver a entrar.
function renderResultados(state) {
  const i = state.misionTarget;
  const tieneMision = i != null && state.misionReto && state.nombres[i];
  const detalle = tieneMision ? `
    <div class="balanza-final__mision">
      <span class="balanza-final__mision-label">Tu reto de la semana con ${escapeHtml(state.nombres[i])}:</span>
      <p class="balanza-final__mision-txt">${escapeHtml(RETOS[state.misionReto])}</p>
    </div>
  ` : "";

  return `
    <div class="quiz-resumen quiz-resumen--reflexivo balanza-final">
      <div class="quiz-resumen__head">
        <div class="quiz-resumen__icon">${icon("check")}</div>
        <h2 class="quiz-resumen__title">Tu Balanza Energética</h2>
        <p class="quiz-resumen__lead">Este es tu mapa relacional de hoy y el reto que elegiste. Llévalo a la práctica antes de la sesión.</p>
      </div>

      ${renderMapa(state)}
      ${detalle}

      <div class="balanza-final__nota">
        <p>En la sesión cubriremos <strong>DEAR MAN</strong>, <strong>VIDA</strong> y <strong>AVES</strong>: estrategias para ser efectivos en estos tres roles.</p>
      </div>
      <div class="quiz-resumen__actions">
        <button class="btn btn-secondary" data-bal-action="retry" type="button">
          ${icon("refresh")}<span>Volver a hacerla</span>
        </button>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────

function clickHandler(state, e) {
  const btn = e.target.closest("[data-bal-action]");
  if (!btn) return;
  const action = btn.dataset.balAction;

  switch (action) {
    case "start":
      // Si ya estaba finalizada, "Comenzar" rehace la actividad desde cero.
      if (state.finalizada) { resetState(state); render(state); break; }
      state.step = 1;
      persist(state); render(state); break;

    case "to-2": {
      // Limpiar roles de filas que quedaron sin nombre.
      const validos = new Set(indicesConNombre(state));
      Object.keys(state.roles).forEach((k) => {
        if (!validos.has(Number(k))) delete state.roles[k];
      });
      if (state.misionTarget != null && !validos.has(state.misionTarget)) {
        state.misionTarget = null;
      }
      state.analisisIdx = 0;
      state.step = 2;
      persist(state); render(state); break;
    }

    case "mask":
      state.roles[indicesConNombre(state)[state.analisisIdx]] = btn.dataset.color;
      persist(state); render(state); break;

    case "ana-prev":
      // Desde la primera persona, "Anterior" regresa al Paso 1 (editar nombres).
      if (state.analisisIdx === 0) {
        state.step = 1; persist(state); render(state);
      } else {
        state.analisisIdx -= 1; persist(state); render(state);
      }
      break;

    case "ana-next": {
      const indices = indicesConNombre(state);
      if (state.analisisIdx < indices.length - 1) {
        state.analisisIdx += 1; persist(state); render(state);
      } else if (todosClasificados(state)) {
        state.step = 3; persist(state); render(state);
      }
      break;
    }

    case "to-2-back":
      state.step = 2;
      state.analisisIdx = Math.max(0, indicesConNombre(state).length - 1);
      persist(state); render(state); break;

    case "to-3":
      state.step = 3; persist(state); render(state); break;

    case "to-4": {
      // Si el vínculo elegido ya no es elegible (cambió de color o se borró),
      // limpiar la selección.
      const elegibles = new Set(indicesElegiblesMision(state));
      if (state.misionTarget != null && !elegibles.has(state.misionTarget)) {
        state.misionTarget = null;
      }
      state.step = 4; persist(state); render(state); break;
    }

    case "target":
      state.misionTarget = Number(btn.dataset.idx);
      persist(state); render(state); break;

    case "reto":
      state.misionReto = btn.dataset.reto;
      persist(state); render(state); break;

    case "finish":
      finish(state); break;

    case "retry":
      resetState(state); render(state); break;
  }
}

function inputHandler(state, e) {
  const input = e.target.closest("[data-bal-name]");
  if (!input) return;
  const idx = Number(input.dataset.balName);
  state.nombres[idx] = input.value;
  // No re-render (perderíamos foco). Solo habilitar/deshabilitar Continuar.
  const cont = state.container.querySelector('[data-bal-action="to-2"]');
  if (cont) cont.disabled = indicesConNombre(state).length < 1;
  persistDebounced(state);
}

async function finish(state) {
  if (state.saving || state.finalizada) return;
  state.saving = true;
  render(state);

  // Guardar en la base (respuestas_quiz) vía submit-quiz. Serializamos el
  // estado completo como string porque submit-quiz exige valores string.
  try {
    await api.submitQuiz({
      leccionId: state.leccionId,
      inscripcionId: state.inscripcionId,
      actividad: ACTIVIDAD,
      respuestas: {
        balanza: JSON.stringify({
          nombres: state.nombres,
          roles: state.roles,
          misionTarget: state.misionTarget,
          misionReto: state.misionReto,
        }),
      },
    });
  } catch (err) {
    // No bloqueamos: el resultado queda en localStorage y la lección igual se
    // marca como completada. Se reintentará guardar si vuelve a finalizar.
    console.warn("balanza submitQuiz failed (se guardó local):", err);
  }

  // Marcar la lección como completada (best-effort).
  try {
    if (typeof state.onComplete === "function") await state.onComplete();
  } catch (err) {
    console.warn("balanza onComplete failed:", err);
  }

  state.saving = false;
  state.finalizada = true;
  persist(state); // guardamos resultados (NO se limpia) para recordarlos al volver
  render(state);
}

// ─────────────────────────────────────────────────────────────────────
// Persistencia local (localStorage · sobrevive entre sesiones)
// ─────────────────────────────────────────────────────────────────────

function snapshot(state) {
  return {
    step: state.step,
    nombres: state.nombres,
    roles: state.roles,
    analisisIdx: state.analisisIdx,
    misionTarget: state.misionTarget,
    misionReto: state.misionReto,
    finalizada: state.finalizada,
  };
}

function persist(state) {
  try { localStorage.setItem(state.stateKey, JSON.stringify(snapshot(state))); }
  catch { /* quota / disabled */ }
}

let persistTimeout = null;
function persistDebounced(state) {
  if (persistTimeout) clearTimeout(persistTimeout);
  persistTimeout = setTimeout(() => persist(state), 400);
}

function clearState(key) {
  try { localStorage.removeItem(key); } catch { /* noop */ }
}

function readState(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function resetState(state) {
  state.step = 1;
  state.nombres = Array(NUM_FILAS).fill("");
  state.roles = {};
  state.analisisIdx = 0;
  state.misionTarget = null;
  state.misionReto = null;
  state.finalizada = false;
  state.saving = false;
  clearState(state.stateKey);
}
