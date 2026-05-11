// SOPHIA Portal · Loader fullscreen con logo SOPHIA
//
// Antes había un box con spinner + texto rotativo. Pato pidió usar SIEMPRE
// el splash fullscreen (mismo visual del bootstrap inicial) — cubre toda
// la pantalla con gradiente crema + logo SOPHIA vertical + spinner rojo.
//
// Aunque este markup se inyecta dentro de `<main>` por sus consumers
// (curso.js, leccion.js, etc.), la clase .app-splash usa `position: fixed;
// inset: 0; z-index: 9999`, así que escapa de su contenedor y cubre toda
// la viewport. Al re-renderear el contenedor con el contenido real, el
// nodo del splash se elimina del DOM y la overlay desaparece automáticamente.

export function loaderHtml() {
  return `
    <div class="app-splash" aria-hidden="true">
      <div class="app-splash__inner">
        <img src="/assets/img/brand/logo-vertical-rojo.png" alt="SOPHIA" class="app-splash__logo">
        <div class="app-splash__spinner" aria-hidden="true"></div>
      </div>
    </div>
  `;
}

export function startLoaderRotation() {
  // No-op: ya no hay texto rotativo, el logo es el único loader.
  return () => {};
}

export function attachLoader(container) {
  if (typeof container === "string") container = document.querySelector(container);
  if (!container) return () => {};
  container.innerHTML = loaderHtml();
  return () => {};
}
