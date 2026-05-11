// SOPHIA Portal · Loader inline con logo SOPHIA
//
// Antes había un box con spinner + texto rotativo ("Cargando tu curso..."
// etc.). Pato pidió usar el splash con logo SOPHIA en todos los loaders,
// así que esta versión devuelve el mismo visual del splash inicial:
// logo vertical rojo + spinner pequeño.
//
// Las funciones startLoaderRotation / attachLoader siguen exportadas para
// no romper imports existentes, pero startLoaderRotation ahora es noop
// porque el loader no tiene mensaje rotativo.

export function loaderHtml({ fullPage = false } = {}) {
  const inlineStyle = fullPage
    ? ` style="min-height: calc(100vh - var(--header-h, 64px));"`
    : "";
  return `
    <div class="inline-splash"${inlineStyle}>
      <div class="inline-splash__inner">
        <img src="/assets/img/brand/logo-vertical-rojo.png" alt="SOPHIA" class="inline-splash__logo">
        <div class="inline-splash__spinner" aria-hidden="true"></div>
      </div>
    </div>
  `;
}

export function startLoaderRotation() {
  // No-op: ya no hay texto rotativo, el logo es el único loader.
  return () => {};
}

export function attachLoader(container, opts = {}) {
  if (typeof container === "string") container = document.querySelector(container);
  if (!container) return () => {};
  container.innerHTML = loaderHtml(opts);
  return () => {};
}
