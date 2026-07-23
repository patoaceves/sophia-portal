// SOPHIA Portal - instrumentos.js
//
// Componente de instrumentos de medicion (GAD-7 y WHO-5). Se monta en las
// lecciones tipo "enlace" con etiqueta "Instrumentos". Renderiza las escalas,
// valida que esten completas, envia las respuestas crudas a la edge function
// submit-medicion (que puntua en servidor) y pinta los resultados.

import { api } from "./api.js";
import { getInstrumentoDef } from "./instrumentos-defs.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function totalItems(def) {
  return def.escalas.reduce((n, e) => n + e.items.length, 0);
}

function renderResultados(container, def, resultados) {
  const bGad = def.bandas.gad7[resultados?.gad7?.banda] || {};
  const bWho = def.bandas.who5[resultados?.who5?.banda] || {};
  const gadTotal = resultados?.gad7?.total ?? 0;
  const whoIndice = resultados?.who5?.indice ?? 0;
  const seguimiento = !!resultados?.seguimiento;
  const ac = def.acompanamiento;

  container.innerHTML = `
    <div class="instr-res">
      <p class="instr-res__eyebrow">Tus resultados</p>

      <div class="instr-res__row" style="--band:${escapeHtml(bGad.color || "#666")}">
        <div class="instr-score"><b>${gadTotal}</b><small>de 21</small></div>
        <div class="instr-res__meta">
          <p class="instr-res__band">GAD-7: ansiedad ${escapeHtml((resultados?.gad7?.banda || "").toLowerCase())}</p>
          <p class="instr-res__desc">${escapeHtml(bGad.desc || "")}</p>
        </div>
      </div>
      <div class="instr-bar" style="--band:${escapeHtml(bGad.color || "#666")}"><i style="width:${Math.round((gadTotal / 21) * 100)}%"></i></div>

      <div class="instr-res__row instr-res__row--gap" style="--band:${escapeHtml(bWho.color || "#666")}">
        <div class="instr-score"><b>${whoIndice}</b><small>de 100</small></div>
        <div class="instr-res__meta">
          <p class="instr-res__band">WHO-5: ${escapeHtml((resultados?.who5?.banda || "").toLowerCase())}</p>
          <p class="instr-res__desc">${escapeHtml(bWho.desc || "")}</p>
        </div>
      </div>
      <div class="instr-bar" style="--band:${escapeHtml(bWho.color || "#666")}"><i style="width:${whoIndice}%"></i></div>

      ${seguimiento ? `
        <div class="instr-care">
          <h4>${escapeHtml(ac.titulo)}</h4>
          <p>${escapeHtml(ac.texto)}</p>
          <p>${escapeHtml(ac.crisis).replace("800 911 2000", `<a href="tel:${escapeHtml(ac.telefono)}">800 911 2000</a>`)}</p>
        </div>
      ` : ""}

      <p class="instr-nota">${escapeHtml(def.nota)}</p>
      <p class="instr-fuentes">${escapeHtml(def.fuentes)}</p>
    </div>
  `;
}

function renderFormulario(container, def, ctx) {
  const escalasHtml = def.escalas.map((esc) => `
    <section class="instr-escala" data-escala="${escapeHtml(esc.id)}">
      <div class="instr-escala__head">
        <h3 class="instr-escala__title">${escapeHtml(esc.titulo)}</h3>
        <span class="instr-escala__count" data-count="${escapeHtml(esc.id)}">0 de ${esc.items.length}</span>
      </div>
      <p class="instr-escala__intro">${escapeHtml(esc.instruccion)}</p>
      ${esc.items.map((texto, i) => `
        <div class="instr-q">
          <p class="instr-q__text"><span class="instr-q__num">${i + 1}</span><span>${escapeHtml(texto)}</span></p>
          <div class="instr-opts">
            ${esc.opciones.map((o) => `
              <label class="instr-opt">
                <input type="radio" name="${escapeHtml(esc.id)}_${i}" value="${o.valor}">
                <span>${escapeHtml(o.label)}</span>
              </label>
            `).join("")}
          </div>
        </div>
      `).join("")}
      ${esc.id === "gad7" && def.funcionalidad ? `
        <div class="instr-func">
          <p class="instr-func__label">${escapeHtml(def.funcionalidad.pregunta)}</p>
          <p class="instr-func__note">${escapeHtml(def.funcionalidad.nota)}</p>
          <div class="instr-opts">
            ${def.funcionalidad.opciones.map((o) => `
              <label class="instr-opt">
                <input type="radio" name="funcionalidad" value="${escapeHtml(o)}">
                <span>${escapeHtml(o)}</span>
              </label>
            `).join("")}
          </div>
        </div>
      ` : ""}
    </section>
  `).join("");

  container.innerHTML = `
    <div class="instr">
      <p class="instr__intro">${escapeHtml(def.intro)}</p>
      <form id="instrForm" class="instr__form">${escalasHtml}</form>
      <div class="instr__actions">
        <button type="button" id="instrEnviar" class="btn btn-accent" disabled>Ver mis resultados</button>
        <span id="instrHint" class="instr__hint"></span>
      </div>
      <p id="instrError" class="instr__error" hidden></p>
    </div>
  `;

  const form = container.querySelector("#instrForm");
  const btn = container.querySelector("#instrEnviar");
  const hint = container.querySelector("#instrHint");
  const errBox = container.querySelector("#instrError");
  const total = totalItems(def);

  function contestadas(esc) {
    let c = 0;
    for (let i = 0; i < esc.items.length; i++) {
      if (form.querySelector(`input[name="${esc.id}_${i}"]:checked`)) c++;
    }
    return c;
  }

  function update() {
    let hechas = 0;
    for (const esc of def.escalas) {
      const c = contestadas(esc);
      hechas += c;
      const el = container.querySelector(`[data-count="${esc.id}"]`);
      if (el) el.textContent = `${c} de ${esc.items.length}`;
    }
    const faltan = total - hechas;
    btn.disabled = faltan > 0;
    hint.textContent = faltan > 0
      ? (faltan === 1 ? "Te falta 1 pregunta." : `Te faltan ${faltan} preguntas.`)
      : "Listo, ya puedes ver tus resultados.";
  }

  form.addEventListener("change", (e) => {
    const inp = e.target;
    if (inp?.type !== "radio") return;
    form.querySelectorAll(`input[name="${inp.name}"]`).forEach((r) => {
      r.closest(".instr-opt")?.classList.toggle("is-sel", r.checked);
    });
    update();
  });
  update();

  btn.addEventListener("click", async () => {
    errBox.hidden = true;
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = "Enviando...";

    const respuestas = { funcionalidad: form.querySelector('input[name="funcionalidad"]:checked')?.value || null };
    for (const esc of def.escalas) {
      respuestas[esc.id] = esc.items.map((_, i) =>
        Number(form.querySelector(`input[name="${esc.id}_${i}"]:checked`).value));
    }

    try {
      const res = await api.submitMedicion({
        inscripcionId: ctx.inscripcionId,
        leccionId: ctx.leccionId,
        cursoId: ctx.cursoId,
        instrumentoClave: def.version,
        momento: ctx.momento || "inicial",
        respuestas,
      });
      renderResultados(container, def, res?.resultados);
      if (typeof ctx.onComplete === "function") await ctx.onComplete();
    } catch (e) {
      btn.disabled = false;
      btn.textContent = original;
      errBox.hidden = false;
      errBox.textContent = e?.message ? `No se pudo enviar: ${e.message}` : "No se pudo enviar. Intenta de nuevo.";
    }
  });
}

export async function mountInstrumentos(opts) {
  const { container, clave, inscripcionId, leccionId, cursoId, momento, onComplete } = opts;
  if (!container) return;

  const def = getInstrumentoDef(clave);
  if (!def) {
    container.innerHTML = `<p class="instr__vacio">Estos instrumentos no están configurados todavía.</p>`;
    return;
  }

  const ctx = { inscripcionId, leccionId, cursoId, momento, onComplete };

  try {
    const prev = await api.getMedicion(def.version, inscripcionId, momento || "inicial");
    if (prev && prev.completado) {
      renderResultados(container, def, prev.resultados);
      if (typeof onComplete === "function") await onComplete();
      return;
    }
  } catch (e) {
    console.warn("No se pudo verificar la medición previa:", e);
  }

  renderFormulario(container, def, ctx);
}
