// SOPHIA Portal — Smart loader con texto rotativo
//
// Uso:
//   import { loaderHtml, startLoaderRotation, stopLoaderRotation } from "./loader.js";
//   container.innerHTML = loaderHtml({ context: "portal" });
//   const stop = startLoaderRotation();  // mensajes cambian cada 2s
//   ...
//   stop();
//
// Contextos disponibles (cada uno con su propio set de mensajes):
//   - portal:     entrada al portal después de login
//   - curso:      cargando un curso
//   - leccion:    cargando una lección
//   - test:       cargando el test de felicidad
//   - resultados: cargando resultados del test
//   - generic:    fallback genérico

const MESSAGES = {
  portal: [
    "Iniciando tu sesión",
    "Cargando tu progreso",
    "Preparando tu camino",
    "Casi listo",
  ],
  curso: [
    "Cargando tu curso",
    "Sincronizando tu progreso",
    "Preparando los capítulos",
  ],
  leccion: [
    "Abriendo tu lección",
    "Cargando el contenido",
    "Casi listo",
  ],
  test: [
    "Preparando el test",
    "Cargando preguntas",
  ],
  resultados: [
    "Calculando tus resultados",
    "Construyendo tu rueda",
    "Analizando dimensiones",
  ],
  generic: [
    "Cargando",
    "Un momento",
  ],
};

/**
 * Devuelve el HTML del loader. Centrado verticalmente y horizontalmente
 * dentro del contenedor padre (asegúrate que el padre tenga altura definida
 * o el `--loader-min-h` le da una mínima razonable).
 *
 * @param {object} opts
 * @param {string} [opts.context="generic"]
 * @param {string} [opts.firstMessage] — override del primer mensaje
 * @param {boolean} [opts.fullPage=false] — si true, ocupa toda la pantalla
 */
export function loaderHtml({ context = "generic", firstMessage, fullPage = false } = {}) {
  const messages = MESSAGES[context] || MESSAGES.generic;
  const initial = firstMessage || messages[0];
  const minHeight = fullPage ? "calc(100vh - var(--header-h, 64px))" : "min(60vh, 480px)";
  return `
    <div class="page-loader" data-context="${context}" style="min-height:${minHeight};">
      <div class="page-loader__inner">
        <div class="spinner spinner--wheel" role="status" aria-live="polite">
          <span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span>
        </div>
        <div class="page-loader__text">
          <span class="page-loader__msg" id="page-loader-msg">${escapeHtml(initial)}</span><span class="page-loader__dots"><span>.</span><span>.</span><span>.</span></span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Inicia el ciclo de mensajes. Devuelve una función `stop` para limpiarlo.
 * Detecta automáticamente el contexto del data-attribute del loader.
 */
export function startLoaderRotation() {
  const node = document.querySelector(".page-loader");
  const msgEl = document.getElementById("page-loader-msg");
  if (!node || !msgEl) return () => {};

  const ctx = node.dataset.context || "generic";
  const messages = MESSAGES[ctx] || MESSAGES.generic;
  if (messages.length <= 1) return () => {};

  let idx = messages.indexOf(msgEl.textContent.trim());
  if (idx < 0) idx = 0;

  const interval = setInterval(() => {
    idx = (idx + 1) % messages.length;
    msgEl.style.opacity = "0";
    setTimeout(() => {
      msgEl.textContent = messages[idx];
      msgEl.style.opacity = "1";
    }, 220);
  }, 2200);

  return () => clearInterval(interval);
}

/**
 * Atajo: arrancar el loader cuando el contenedor ya tiene el HTML.
 * Devuelve la función para detenerlo.
 */
export function attachLoader(container, { context = "generic", fullPage = false } = {}) {
  if (typeof container === "string") container = document.querySelector(container);
  if (!container) return () => {};
  container.innerHTML = loaderHtml({ context, fullPage });
  return startLoaderRotation();
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
