// SOPHIA Portal · Lección (player de contenido).
//
// Cambios clave en esta iteración:
//   - El Test de Felicidad ya NO redirige a /app/test-felicidad. Se monta
//     embebido en la misma página manteniendo el checkpoint bar de la lección.
//   - El CTA de completar usa un solo botón con checkbox interno:
//     [☐] Marcar como completada  →  [✓] Avanzar
//     Click en el checkbox marca la lección. Click en el botón (cuando ya
//     está marcado) navega a la siguiente lección.
//   - Se sanitizan URLs de imágenes en el contenido HTML de Airtable
//     (auto-fix para rutas relativas malformadas, espacios, dominios viejos).

import { requireAuth } from "./auth.js";
import { api } from "./api.js";
import { renderShell, escapeHtml } from "./ui-shell.js";
import { icon, lessonIcon, lessonTipoLabel } from "./icons.js";
import { loaderHtml, startLoaderRotation } from "./loader.js";
import { mountWizard as mountTestWizard } from "./test-felicidad.js";
import { mountWizard as mountAutoconocimientoWizard } from "./test-autoconocimiento.js";
import { mountEvaluacion } from "./evaluacion-sesion.js";
import { mountQuiz } from "./quiz.js";

// ─────────────────────────────────────────────────────────────────────
// DOMPurify (cliente) — segunda capa de defensa.
// El servidor (get-leccion) ya pasa el HTML por nuestro sanitizer custom,
// pero re-aplicamos DOMPurify en cliente antes de cualquier innerHTML que
// reciba contenido de Airtable. Si el módulo falla al cargar, registramos
// warning pero no rompemos la página: el servidor ya hizo su trabajo.
// Tamaño: ~22KB gzipped.
// ─────────────────────────────────────────────────────────────────────
let _DOMPurify = null;
let _purifyPromise = null;
async function loadPurify() {
  if (_DOMPurify) return _DOMPurify;
  if (_purifyPromise) return _purifyPromise;
  _purifyPromise = import("https://esm.sh/dompurify@3.2.6")
    .then((mod) => {
      _DOMPurify = mod.default ?? mod;
      return _DOMPurify;
    })
    .catch((err) => {
      console.warn("DOMPurify load failed, relying on server sanitization:", err);
      _DOMPurify = null;
      return null;
    });
  return _purifyPromise;
}

function purify(html) {
  // Sync call: si DOMPurify ya está cargado, sanitiza; si no, devuelve tal cual
  // (el servidor ya lo sanitizó). Se llama loadPurify() temprano para que esté
  // listo cuando se renderee.
  if (_DOMPurify && typeof _DOMPurify.sanitize === "function") {
    return _DOMPurify.sanitize(html, {
      // Misma allowlist conceptual que server-side, pero DOMPurify usa su default
      // que es razonable. Forzamos rel en target=_blank y prohibimos onerror etc.
      ADD_ATTR: ["target"],
      FORBID_ATTR: ["style", "formaction", "srcdoc"],
      FORBID_TAGS: ["form", "input", "button", "select", "textarea", "iframe", "object", "embed"],
    });
  }
  return html;
}

// Disparar carga lo antes posible (en paralelo con el fetch de la lección)
loadPurify();

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  const params = new URLSearchParams(location.search);
  const leccionId = params.get("id");

  if (!leccionId) {
    renderShell({
      persona,
      title: "Lección",
      contentHtml: `
        <div class="empty-state">
          <div class="empty-state__title">Falta la lección</div>
          <p class="empty-state__desc">No se proporcionó un ID. <a href="/app/cursos">Volver a mis cursos</a>.</p>
        </div>
      `,
    });
    return;
  }

  renderShell({
    persona,
    title: "Cargando lección…",
    activePath: "/app/cursos",
    contentHtml: loaderHtml({ context: "leccion" }),
  });
  const stopLoader = startLoaderRotation();

  let leccionData;
  try {
    leccionData = await api.leccion(leccionId);
  } catch (e) {
    stopLoader();
    console.error("get-leccion failed:", e);
    document.querySelector(".app-main").innerHTML = `
      <div class="empty-state">
        <div class="empty-state__title">No pudimos cargar esta lección</div>
        <p class="empty-state__desc">${escapeHtml(e.message || "Intenta recargar.")}</p>
        <a href="/app/cursos" class="btn btn-secondary" style="margin-top:var(--s-4);">${icon("arrowLeft")}<span>Volver a mis cursos</span></a>
      </div>
    `;
    return;
  }

  // Necesitamos el contexto del curso para los checkpoints del capítulo
  let cursoContext = null;
  try {
    cursoContext = await fetchCursoContext(leccionData.cursoId);
  } catch (e) {
    console.warn("Could not fetch curso context for checkpoints:", e);
  }

  stopLoader();
  renderLeccion(persona, leccionData, cursoContext);
})();

async function fetchCursoContext(cursoId) {
  const { cursos } = await api.misCursos();
  const c = cursos.find((x) => x.id === cursoId);
  if (!c) return null;
  const detalle = await api.curso(c.slug);
  return { ...detalle, slug: c.slug };
}

function renderLeccion(persona, payload, cursoContext) {
  const { leccion, capituloId, capitulo: capInfo, cursoId, inscripcionId, prevId, nextId } = payload;

  let capCompleto = null;
  let cursoSlug = "";
  let cursoTitulo = "";
  if (cursoContext) {
    capCompleto = cursoContext.capitulos.find((c) => c.id === capituloId);
    cursoSlug = cursoContext.slug;
    cursoTitulo = cursoContext.curso.titulo;
  }

  const capLecciones = capCompleto?.lecciones ?? [];
  const idxHere = capLecciones.findIndex((l) => l.id === leccion.id);
  const ponente = capInfo?.ponente || capCompleto?.ponente || "";

  const backHref = cursoSlug
    ? `/app/curso?slug=${encodeURIComponent(cursoSlug)}`
    : "/app/cursos";
  const backLabel = cursoTitulo ? `Volver a Mi Curso` : "Volver";

  const isTest = leccion.tipo === "test" || leccion.tipo === "autoeval";
  // "Evaluación de sesión": lección tipo enlace con etiqueta "Evaluación".
  // En vez del iframe del Google Form, montamos el wizard nativo.
  const isEvaluacion = leccion.tipo === "enlace" &&
    (leccion.etiqueta || "").trim().toLowerCase() === "evaluación";
  // "Actividad en clase": lección tipo quiz. Monta el wizard de quiz; la
  // clave del quiz (qué preguntas mostrar) viene en leccion.urlExterna.
  const isQuiz = leccion.tipo === "quiz";

  renderShell({
    persona,
    title: leccion.titulo,
    activePath: "/app/cursos",
    contentHtml: `
      ${renderCheckpointBar(capLecciones, idxHere)}

      <article class="leccion-page">
        <header class="leccion-page__header">
          <a href="${backHref}" class="page-back">
            ${icon("chevronLeft")}
            <span>${escapeHtml(backLabel)}</span>
          </a>
          ${capInfo || capCompleto ? `
            <div class="leccion-page__crumb">
              <span class="leccion-page__crumb-cap">Capítulo ${capInfo?.orden ?? capCompleto?.orden} · ${escapeHtml(capInfo?.titulo ?? capCompleto?.titulo ?? "")}</span>
              ${capLecciones.length > 0 ? `
                <span class="leccion-page__crumb-sep">·</span>
                <span class="leccion-page__crumb-leccion">Lección ${leccion.orden} de ${capLecciones.length}</span>
              ` : ""}
            </div>
          ` : ""}
          <div class="leccion-page__tipo">
            ${icon(lessonIcon(leccion.tipo))}
            <span>${escapeHtml(lessonTipoLabel(leccion.tipo))}</span>
          </div>
          <h2 class="page-title leccion-page__title">${escapeHtml(leccion.titulo)}</h2>
          ${ponente ? `
            <div class="leccion-page__ponente">
              ${icon("instructor")}
              <span><strong>Ponente:</strong> ${escapeHtml(ponente)}</span>
            </div>
          ` : ""}
        </header>

        <div class="leccion-page__body">
          ${isTest ? `<div id="testEmbed"></div>`
            : isEvaluacion ? `<div id="evalEmbed"></div>`
            : isQuiz ? `<div id="quizEmbed"></div>`
            : renderContent(leccion)}
        </div>

        ${(isTest || isEvaluacion || isQuiz) ? `
          <footer class="leccion-page__footer leccion-page__footer--test">
            <div>
              ${prevId
                ? `<a class="btn btn-ghost" href="/app/leccion?id=${encodeURIComponent(prevId)}">
                     ${icon("arrowLeft")}<span>Anterior</span>
                   </a>`
                : ""}
            </div>
            <div></div>
          </footer>
        ` : `
          <footer class="leccion-page__footer">
            <div>
              ${prevId
                ? `<a class="btn btn-ghost" href="/app/leccion?id=${encodeURIComponent(prevId)}">
                     ${icon("arrowLeft")}<span>Anterior</span>
                   </a>`
                : ""}
            </div>
            <div class="leccion-page__cta">
              ${renderCta(leccion, nextId, backHref)}
            </div>
          </footer>
        `}
      </article>
    `,
  });

  // Relocalizar checkpoint-bar DENTRO del .app-header para que header +
  // checkpoints se comporten como UNA sola unidad sticky (sin empalme).
  relocateCheckpointBarIntoHeader();

  // After render: post-process content (sanitize image URLs)
  if (isTest) {
    // Mount the right wizard depending on which autoeval is linked.
    // - "autoconocimiento" → VIA · 24 fortalezas, results en /app/test-autoconocimiento/resultados
    // - "felicidad" (o ausente, por compat) → Test de Felicidad
    const container = document.getElementById("testEmbed");
    const autoevalTipo = leccion.autoevalTipo || "felicidad";

    if (autoevalTipo === "autoconocimiento") {
      mountAutoconocimientoWizard({
        container,
        inscripcionId,
        leccionId: leccion.id,
        cursoSlug,
        embedded: true,
        onComplete: (result) => {
          // Pasamos `next` para que la página de resultados mande al usuario
          // a la siguiente lección (típicamente la "Evaluación de la sesión")
          // en vez de regresarlo al dashboard, donde no podría seguir el flow.
          const nextParam = nextId ? `&next=${encodeURIComponent(nextId)}` : "";
          location.href = `/app/test-autoconocimiento/resultados?id=${encodeURIComponent(result.respuestaId)}&slug=${encodeURIComponent(cursoSlug)}${nextParam}`;
        },
      });
    } else {
      mountTestWizard({
        container,
        inscripcionId,
        leccionId: leccion.id,
        cursoSlug,
        embedded: true,
        onComplete: (result) => {
          // After submitting, navigate to results within the same UX feel.
          // The lesson is already marked completed by the wizard.
          // Pasamos `next` para que resultados mande al siguiente paso (no al dashboard).
          const nextParam = nextId ? `&next=${encodeURIComponent(nextId)}` : "";
          location.href = `/app/test-felicidad/resultados?id=${encodeURIComponent(result.respuestaId)}&slug=${encodeURIComponent(cursoSlug)}${nextParam}`;
        },
      });
    }
  } else if (isEvaluacion) {
    // Mount evaluación nativa (reemplaza el iframe del Google Form)
    const container = document.getElementById("evalEmbed");
    const nextHref = nextId ? `/app/leccion?id=${encodeURIComponent(nextId)}` : backHref;
    const nextLabel = nextId ? "Continuar a la siguiente lección" : "Volver a Mi Curso";
    mountEvaluacion({
      container,
      leccionId: leccion.id,
      inscripcionId,
      nextHref,
      nextLabel,
      ponente: ponente, // pasamos el nombre del ponente para mostrarlo arriba del wizard
      // preguntas: leccion.evaluacionPreguntas (futuro: leerlo de Airtable)
      onComplete: async ({ respuestas }) => {
        // Persistir respuestas en la tabla "Evaluaciones Sesión".
        // Si falla el submit, NO marcamos completada — el usuario debe
        // intentar de nuevo. (El wizard ya conserva estado en sessionStorage.)
        try {
          await api.submitEvaluacion({
            leccionId: leccion.id,
            inscripcionId,
            respuestas,
          });
        } catch (err) {
          console.error("submitEvaluacion failed:", err);
          throw err; // propagar para que el wizard re-habilite el botón
        }
        // Marcar lección completada (best-effort)
        if (inscripcionId) {
          try {
            await api.marcarLeccion(leccion.id, inscripcionId);
          } catch (e) {
            console.warn("Could not mark evaluacion lesson complete:", e);
          }
        }
      },
    });
  } else if (isQuiz) {
    // Mount wizard de actividad en clase (quiz). La clave del quiz viene
    // en leccion.urlExterna (ej. "gnothi-seauton").
    const container = document.getElementById("quizEmbed");
    const quizKey = (leccion.urlExterna || "").trim();
    const nextHref = nextId ? `/app/leccion?id=${encodeURIComponent(nextId)}` : backHref;
    const nextLabel = nextId ? "Continuar a la siguiente lección" : "Volver a Mi Curso";
    mountQuiz({
      container,
      quizKey,
      leccionId: leccion.id,
      inscripcionId,
      nextHref,
      nextLabel,
      onComplete: async () => {
        // Marcar lección completada (best-effort). El submit del quiz
        // ya guardó las respuestas en su propio onComplete.
        if (inscripcionId) {
          try {
            await api.marcarLeccion(leccion.id, inscripcionId);
          } catch (e) {
            console.warn("Could not mark quiz lesson complete:", e);
          }
        }
      },
    });
  } else {
    sanitizeLessonContent();
    wireCtaButtons(leccion, inscripcionId, nextId, backHref);
    // Lecciones tipo pdf: PDF.js rellena los contenedores .leccion-pdf.
    // No-op si la lección no tiene ninguno.
    mountPdfViewers();
  }

  // Prefetch adyacentes en background para que la navegacion sea instantanea
  setTimeout(() => {
    if (nextId) api.leccion(nextId).catch(() => {});
    if (prevId) api.leccion(prevId).catch(() => {});
  }, 800);
}

// ────────────────────────────────────────────────────────────────────
// Checkpoint bar (sticky top of the lesson body)
// ────────────────────────────────────────────────────────────────────
function renderCheckpointBar(capLecciones, idxHere) {
  if (capLecciones.length === 0) {
    return `<div class="leccion-progress-bar"><div class="leccion-progress-bar__fill" style="width: 50%;"></div></div>`;
  }

  return `
    <div class="checkpoint-bar">
      <ol class="checkpoint-bar__list">
        ${capLecciones.map((l, i) => {
          const isHere = i === idxHere;
          const isDone = l.completada;
          const state = isHere && !isDone ? "current"
            : isDone ? "done"
            : i < idxHere ? "skipped"
            : "todo";
          return `
            <li class="checkpoint checkpoint--${state}">
              ${i > 0 ? `<span class="checkpoint__line ${state === "todo" ? "checkpoint__line--todo" : ""}"></span>` : ""}
              <a class="checkpoint__dot" href="/app/leccion?id=${encodeURIComponent(l.id)}"
                 title="${escapeHtml(l.titulo)}"
                 aria-current="${isHere ? "true" : "false"}">
                ${isDone ? icon("check") : ""}
                ${isHere && !isDone ? `<span class="checkpoint__pulse"></span>` : ""}
              </a>
              <span class="checkpoint__label">${escapeHtml(shortenTitle(l.titulo))}</span>
            </li>
          `;
        }).join("")}
      </ol>
    </div>
    <div class="checkpoint-bar-spacer" aria-hidden="true"></div>
  `;
}

function shortenTitle(t) {
  if (!t) return "";
  if (t.length <= 22) return t;
  return t.slice(0, 22).trimEnd() + "…";
}

// ────────────────────────────────────────────────────────────────────
// CTA button · single button with internal checkbox
//
// State 1 (not completed): a button labeled "Marcar como completada"
//   with a [☐] checkbox glyph on the left. Click triggers marcarLeccion.
// State 2 (completed):     the same button transforms into "Avanzar"
//   with a [✓] check glyph on the left. Click navigates to nextId.
//
// If completed && !nextId (last lesson): button says "Volver al temario".
// ────────────────────────────────────────────────────────────────────
function renderCta(leccion, nextId, backHref) {
  const completada = !!leccion.completada;
  const nextHref = nextId ? `/app/leccion?id=${encodeURIComponent(nextId)}` : backHref;
  const advanceLabel = nextId ? "Avanzar" : "Volver al temario";

  return `
    <button
      type="button"
      id="leccionCtaBtn"
      class="leccion-cta ${completada ? "is-checked" : ""}"
      data-completed="${completada}"
      data-next-href="${escapeHtml(nextHref)}"
      data-leccion-id="${escapeHtml(leccion.id)}"
      aria-pressed="${completada}"
    >
      <span class="leccion-cta__check" aria-hidden="true">
        <span class="leccion-cta__check-box">
          ${completada ? icon("check") : ""}
        </span>
      </span>
      <span class="leccion-cta__label">
        ${completada
          ? `<span class="leccion-cta__label-full">${escapeHtml(advanceLabel)}</span><span class="leccion-cta__label-short">${escapeHtml(advanceLabel)}</span>`
          : `<span class="leccion-cta__label-full">Marcar como completada</span><span class="leccion-cta__label-short">Completar</span>`}
      </span>
      ${completada ? `<span class="leccion-cta__arrow" aria-hidden="true">${icon("arrowRight")}</span>` : ""}
    </button>
  `;
}

function wireCtaButtons(leccion, inscripcionId, nextId, backHref) {
  const btn = document.getElementById("leccionCtaBtn");
  if (!btn) return;

  btn.addEventListener("click", async (e) => {
    const completedNow = btn.dataset.completed === "true";

    if (!completedNow) {
      // Click on the checkbox area OR the label both mark as completed.
      // After marking, the button transforms but doesn't auto-navigate ,
      // user explicitly clicks again to advance (or clicks the box again
      // to uncheck · but uncheck isn't supported by the API yet, so the
      // second click is what advances).
      const targetIsCheckbox = e.target.closest(".leccion-cta__check");
      // Either way: marcar.
      btn.disabled = true;
      const originalLabel = btn.querySelector(".leccion-cta__label").textContent;
      btn.querySelector(".leccion-cta__label").textContent = "Guardando…";

      try {
        await api.marcarLeccion(leccion.id, inscripcionId);

        // Transform into "Avanzar" state
        btn.dataset.completed = "true";
        btn.classList.add("is-checked");
        btn.setAttribute("aria-pressed", "true");
        btn.disabled = false;

        const labelEl = btn.querySelector(".leccion-cta__label");
        const boxEl = btn.querySelector(".leccion-cta__check-box");
        labelEl.textContent = nextId ? "Avanzar" : "Volver al temario";
        boxEl.innerHTML = icon("check");

        // El span del arrow NO existe en estado "no completado" (lo removí
        // en v19b para eliminar gap fantasma). Lo creamos aquí cuando la
        // lección pasa al estado completado.
        let arrowEl = btn.querySelector(".leccion-cta__arrow");
        if (!arrowEl) {
          arrowEl = document.createElement("span");
          arrowEl.className = "leccion-cta__arrow";
          arrowEl.setAttribute("aria-hidden", "true");
          btn.appendChild(arrowEl);
        }
        arrowEl.innerHTML = icon("arrowRight");

        // If the user clicked the checkbox, stay (let them admire the change).
        // If they clicked the wider button area when it was uncompleted,
        // also stay · they need to click again to advance. This matches the
        // "checkbox toggles, button advances" mental model.
        if (!targetIsCheckbox) {
          // Subtle hint: a small pulse animation
          btn.classList.add("just-marked");
          setTimeout(() => btn.classList.remove("just-marked"), 700);
        }
      } catch (err) {
        console.error("marcar-leccion error:", err);
        btn.disabled = false;
        btn.querySelector(".leccion-cta__label").textContent = originalLabel;
        alert(`No se pudo marcar: ${err.message}`);
      }
      return;
    }

    // Already completed: click → advance
    location.href = btn.dataset.nextHref;
  });
}

// ────────────────────────────────────────────────────────────────────
// Content rendering + image URL sanitization
// ────────────────────────────────────────────────────────────────────
function renderContent(l) {
  // Server-side ya sanitizó (html-sanitizer.ts en get-leccion). Aquí pasamos
  // DOMPurify como segunda capa de defensa antes de meter el HTML en una
  // template literal que termina en innerHTML.
  const html = purify(l.contenidoHTML || "");
  const tipo = (l.tipo || "texto").toLowerCase();
  switch (tipo) {
    case "video":
      return `
        ${l.urlVideo ? renderVideoEmbed(l.urlVideo) : ""}
        ${html ? `<div class="leccion-html">${html}</div>` : ""}
      `;
    case "pdf":
      return `
        ${html ? `<div class="leccion-html">${html}</div>` : ""}
        ${l.urlExterna ? renderPdfViewer(l.urlExterna) : `<p style="color:var(--color-text-muted);">El PDF aparecerá aquí cuando se publique.</p>`}
      `;
    case "documento":
      return `
        ${html ? `<div class="leccion-html">${html}</div>` : ""}
        ${l.archivoUrl ? `<a class="btn btn-secondary" href="${escapeHtml(l.archivoUrl)}" target="_blank" rel="noopener" style="margin-top:var(--s-4);">${icon("download")}<span>Abrir ${escapeHtml(l.archivoNombre || "documento")}</span></a>` : ""}
      `;
    case "enlace":
      return renderEnlaceContent(l, html);
    case "sesion_live":
    case "sesion-live":
    case "live":
      return `
        ${html ? `<div class="leccion-html">${html}</div>` : ""}
        ${l.urlExterna ? `<a class="btn btn-accent" href="${escapeHtml(l.urlExterna)}" target="_blank" rel="noopener" style="margin-top:var(--s-4);">${icon("lessonLive")}<span>Unirme a la sesión</span></a>` : `<p style="color:var(--color-text-muted);">El enlace a la sesión aparecerá aquí cuando se publique.</p>`}
      `;
    default:
      return html ? `<div class="leccion-html">${html}</div>` : `<p style="color:var(--color-text-muted);">Sin contenido.</p>`;
  }
}

function renderVideoEmbed(url) {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]+)/);
  if (yt) return `<div class="video-embed"><iframe src="https://www.youtube.com/embed/${yt[1]}" frameborder="0" allowfullscreen></iframe></div>`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `<div class="video-embed"><iframe src="https://player.vimeo.com/video/${vm[1]}" frameborder="0" allowfullscreen></iframe></div>`;
  return `<video src="${escapeHtml(url)}" controls style="width:100%;border-radius:var(--r-lg);"></video>`;
}

/**
 * Visor de PDF · contenedor que PDF.js rellena tras el render.
 * El PDF se renderiza a <canvas> (sin <iframe>), por lo que NO depende
 * de X-Frame-Options ni de la CSP frame-ancestors.
 */
function renderPdfViewer(url) {
  const safe = escapeHtml(url);
  return `
    <div class="leccion-pdf" data-pdf-src="${safe}">
      <div class="leccion-pdf__loading">
        <div class="leccion-pdf__spinner" aria-hidden="true"></div>
        <span>Cargando documento…</span>
      </div>
    </div>
    <p class="leccion-pdf__alt">
      ¿Prefieres descargarlo?
      <a href="${safe}" target="_blank" rel="noopener">
        ${icon("external")}<span>Abrir el PDF en otra pestaña</span>
      </a>
    </p>
  `;
}

// ────────────────────────────────────────────────────────────────────
// Render de PDF con PDF.js (vendorizado en /assets/vendor/pdfjs/).
// PDF.js, su worker y las fuentes estándar son del mismo origen, así que
// los cubre script-src 'self'. El PDF se descarga vía fetch (connect-src
// 'self') y se dibuja en <canvas>. Sin <iframe> → sin problemas de framing.
// ────────────────────────────────────────────────────────────────────
const PDFJS_BASE = "/assets/vendor/pdfjs";
let _pdfjsLibPromise = null;

function loadPdfjs() {
  if (!_pdfjsLibPromise) {
    _pdfjsLibPromise = import(`${PDFJS_BASE}/pdf.min.mjs`).then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.mjs`;
      return lib;
    });
  }
  return _pdfjsLibPromise;
}

async function mountPdfViewers() {
  const hosts = document.querySelectorAll(".leccion-pdf[data-pdf-src]");
  if (hosts.length === 0) return;

  let pdfjsLib;
  try {
    pdfjsLib = await loadPdfjs();
  } catch (err) {
    console.error("No se pudo cargar PDF.js:", err);
    hosts.forEach(showPdfError);
    return;
  }

  for (const host of hosts) {
    try {
      await renderPdfInto(pdfjsLib, host, host.getAttribute("data-pdf-src"));
    } catch (err) {
      console.error("Error al renderizar el PDF:", err);
      showPdfError(host);
    }
  }
}

async function renderPdfInto(pdfjsLib, host, src) {
  const doc = await pdfjsLib.getDocument({
    url: src,
    standardFontDataUrl: `${PDFJS_BASE}/standard_fonts/`,
  }).promise;

  host.classList.add("leccion-pdf--ready");

  // Dibuja todas las páginas a la resolución EXACTA del dispositivo.
  // El bitmap del canvas = anchoCSS × devicePixelRatio, y se fija el ancho
  // CSS explícito → mapeo 1:1 con los píxeles físicos → nada borroso.
  async function draw() {
    const cs = getComputedStyle(host);
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    // clientWidth ya excluye el scrollbar (overflow-y: scroll lo fija);
    // restamos el padding horizontal para obtener el ancho real del canvas.
    const cssWidth = Math.max((host.clientWidth || 700) - padX, 240);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);

    host.innerHTML = "";
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (cssWidth * dpr) / base.width });

      const canvas = document.createElement("canvas");
      canvas.className = "leccion-pdf__page";
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      // Tamaño CSS explícito → el navegador no reescala el bitmap.
      canvas.style.width = cssWidth + "px";
      canvas.style.height = "auto";
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `Página ${n} de ${doc.numPages}`);

      await page.render({
        canvasContext: canvas.getContext("2d", { alpha: false }),
        viewport,
      }).promise;

      host.appendChild(canvas);
    }
  }

  await draw();

  // Re-dibuja si cambia el ancho disponible (resize de ventana), con
  // debounce. El guard evita re-renders por cambios mínimos.
  let lastWidth = host.clientWidth;
  let timer = null;
  const ro = new ResizeObserver(() => {
    if (Math.abs(host.clientWidth - lastWidth) < 24) return;
    lastWidth = host.clientWidth;
    clearTimeout(timer);
    timer = setTimeout(() => { draw().catch((e) => console.error("re-render PDF:", e)); }, 250);
  });
  ro.observe(host);
}

function showPdfError(host) {
  host.classList.remove("leccion-pdf--ready");
  host.innerHTML = `
    <div class="leccion-pdf__error">
      <p>No pudimos mostrar el documento aquí. Usa el enlace de abajo para abrirlo.</p>
    </div>
  `;
}

/**
 * "enlace" lessons: si el URL es un Google Form o un Typeform, los embebemos
 * inline (iframe) para que el usuario llene la forma sin salir del portal.
 * Para cualquier otro URL, mostramos el botón de "abrir en otra pestaña".
 */
function renderEnlaceContent(l, html) {
  const intro = html ? `<div class="leccion-html">${html}</div>` : "";
  if (!l.urlExterna) return intro;

  const embedUrl = getEmbeddableUrl(l.urlExterna);
  if (embedUrl) {
    return `
      ${intro}
      <div class="leccion-embed">
        <iframe
          src="${escapeHtml(embedUrl)}"
          loading="lazy"
          allow="fullscreen"
          referrerpolicy="strict-origin-when-cross-origin"
        ></iframe>
      </div>
      <p class="leccion-embed__alt">
        ¿Problemas con el formulario?
        <a href="${escapeHtml(l.urlExterna)}" target="_blank" rel="noopener">
          ${icon("external")}<span>Abrirlo en otra pestaña</span>
        </a>
      </p>
    `;
  }

  return `
    ${intro}
    <a class="btn btn-accent" href="${escapeHtml(l.urlExterna)}" target="_blank" rel="noopener" style="margin-top:var(--s-4);">
      ${icon("external")}<span>Abrir enlace</span>
    </a>
  `;
}

/**
 * Devuelve un URL embebible si la URL recibida es de un servicio que
 * soportamos como iframe. Devuelve null si no se puede embeber.
 */
function getEmbeddableUrl(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return null; }

  // Google Forms: docs.google.com/forms/d/e/<id>/viewform o /edit
  if (u.hostname === "docs.google.com" && /\/forms\//.test(u.pathname)) {
    // Forzar /viewform y agregar embedded=true
    const path = u.pathname.replace(/\/edit\/?$/, "/viewform");
    const finalPath = /\/viewform/.test(path) ? path : path.replace(/\/?$/, "/viewform");
    return `${u.origin}${finalPath}?embedded=true`;
  }

  // Typeform: <slug>.typeform.com/to/<id> o form.typeform.com/to/<id>
  if (/(^|\.)typeform\.com$/.test(u.hostname) && u.pathname.startsWith("/to/")) {
    return rawUrl;
  }

  return null;
}

/**
 * Post-process .leccion-html content after insertion in DOM.
 * Fixes common Airtable HTML issues:
 *  - Image URLs without leading slash (assets/foo.png → /assets/foo.png)
 *  - Image URLs with spaces (URI-encode them)
 *  - Old/relocated paths (e.g. when files moved between folders)
 *  - Adds onerror fallback so a broken image becomes a graceful caption
 */
function sanitizeLessonContent() {
  const root = document.querySelector(".leccion-html");
  if (!root) return;

  // Known asset relocations: when an old path no longer exists, map it
  // to its current location. Add entries here as legacy URLs surface.
  // Each entry: pattern (RegExp) → replacement string ($n captures supported).
  const PATH_REWRITES = [
    // Claustro images: were referenced from /assets/img/happiness-workshop/
    // but actually live in /assets/img/brand/
    [/^\/?assets\/img\/happiness-workshop\/(claustro[^"\s]*)$/i, "/assets/img/brand/$1"],
    // Brand-specific assets sometimes referenced bare ("claustro-1.jpg")
    [/^(claustro[^"\s]*)$/i, "/assets/img/brand/$1"],
    [/^(mariana-riojas[^"\s]*)$/i, "/assets/img/brand/$1"],
    [/^(aristoteles[^"\s]*)$/i, "/assets/img/brand/$1"],
    // Workshop images sometimes referenced bare
    [/^(intro-hw[^"\s]*)$/i, "/assets/img/happiness-workshop/$1"],
    [/^(modelo-felicidad-[^"\s]*)$/i, "/assets/img/happiness-workshop/$1"],
    [/^(portada[^"\s]*)$/i, "/assets/img/happiness-workshop/$1"],
    // Capítulo 2 · Autoconocimiento — Martin Seligman portrait + VIA table
    [/^(martin-seligman[^"\s]*)$/i, "/assets/img/happiness-workshop/autoconocimiento/$1"],
    [/^(fortalezas-de-caracter[^"\s]*)$/i, "/assets/img/happiness-workshop/autoconocimiento/$1"],
  ];

  const imgs = root.querySelectorAll("img");
  imgs.forEach((img) => {
    let src = img.getAttribute("src") || "";
    if (!src) return;

    if (!/^(data:|https?:)/i.test(src)) {
      // Apply known rewrites first (catches both bare and absolute paths
      // pointing at moved files).
      for (const [pattern, replacement] of PATH_REWRITES) {
        if (pattern.test(src)) {
          src = src.replace(pattern, replacement);
          break;
        }
      }
      // Missing leading slash: "assets/foo.png" → "/assets/foo.png"
      if (/^assets\//.test(src)) {
        src = "/" + src;
      }
      // Encode spaces in path segments (preserves slashes and existing encoding)
      if (/\s/.test(src)) {
        src = src.split("/").map((seg) => {
          // Don't double-encode already-encoded segments; just fix raw spaces
          return seg.includes("%") ? seg : seg.replace(/\s+/g, "%20");
        }).join("/");
      }
    }

    img.setAttribute("src", src);
    img.setAttribute("loading", "lazy");
    img.setAttribute("decoding", "async");

    // Graceful fallback if the image fails to load
    img.addEventListener("error", () => {
      const alt = img.getAttribute("alt") || "Imagen no disponible";
      const fallback = document.createElement("figcaption");
      fallback.className = "leccion-html__broken-img";
      fallback.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" style="vertical-align:-4px;margin-right:8px;opacity:0.6;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg><span>${escapeHtml(alt)}</span>`;
      img.replaceWith(fallback);
    }, { once: true });
  });

  // Fix anchor links: open external in new tab
  root.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    if (/^https?:/i.test(href) && !href.includes(location.host)) {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    }
  });
}

/**
 * Mueve la .checkpoint-bar DESDE .app-main HACIA dentro de .app-header
 * para que header + checkpoints sean UNA sola unidad sticky (no dos
 * elementos translúcidos separados que se "empalmen" al hacer scroll).
 *
 * También envuelve el contenido original del header en .app-header__row
 * para preservar el layout horizontal (hamburguesa · título · acciones)
 * y añade la clase modificadora .app-header--with-checkpoints, que el
 * CSS usa para cambiar el header a stack vertical y `position: fixed`.
 *
 * Después de relocar, mide la altura real del header y la guarda en
 * `--lesson-header-h` (var CSS) — `.app-main` la usa para padding-top
 * y evitar que el contenido quede escondido bajo el header fixed.
 *
 * Si no hay checkpoint-bar (caso raro), no-op.
 */
function relocateCheckpointBarIntoHeader() {
  const header = document.querySelector(".app-header");
  const checkpoint = document.querySelector(".app-main > .checkpoint-bar");
  if (!header || !checkpoint) return;

  // Si ya estaba relocalizado (re-render?), no duplicar
  if (header.classList.contains("app-header--with-checkpoints")) {
    // Re-attach del nuevo checkpoint si el header ya tiene la clase pero
    // el checkpoint del nuevo render quedó en main: reemplazarlo
    const existing = header.querySelector(":scope > .checkpoint-bar");
    if (existing) existing.remove();
    header.appendChild(checkpoint);
    document.querySelector(".checkpoint-bar-spacer")?.remove();
    measureAndSetLessonHeaderHeight(header);
    return;
  }

  // 1. Wrap header's current children in .app-header__row
  const row = document.createElement("div");
  row.className = "app-header__row";
  while (header.firstChild) {
    row.appendChild(header.firstChild);
  }
  header.appendChild(row);

  // 2. Move checkpoint-bar into header (after the row)
  header.appendChild(checkpoint);

  // 3. Remove the now-unneeded spacer (checkpoint is part of header,
  //    main content already flows below the header naturally)
  document.querySelector(".checkpoint-bar-spacer")?.remove();

  // 4. Mark header for CSS variant
  header.classList.add("app-header--with-checkpoints");

  // 5. Medir altura real del header (con checkpoints) y setear var CSS
  //    para que .app-main reserve espacio (el header es position:fixed)
  measureAndSetLessonHeaderHeight(header);

  // 6. Re-medir en resize (cambio de viewport puede cambiar altura)
  if (!window.__sophiaLessonHeaderResize) {
    window.__sophiaLessonHeaderResize = true;
    window.addEventListener("resize", () => {
      const h = document.querySelector(".app-header--with-checkpoints");
      if (h) measureAndSetLessonHeaderHeight(h);
    });
  }
}

function measureAndSetLessonHeaderHeight(header) {
  // requestAnimationFrame: deja que el browser aplique los nuevos estilos
  // (especialmente position:fixed y flex-direction:column) antes de medir.
  requestAnimationFrame(() => {
    const h = Math.round(header.getBoundingClientRect().height);
    if (h > 0) {
      document.documentElement.style.setProperty("--lesson-header-h", `${h}px`);
    }
  });
}
