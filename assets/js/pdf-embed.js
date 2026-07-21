// SOPHIA Portal - pdf-embed.js
//
// Renderiza un PDF a <canvas> con PDF.js (vendorizado en /assets/vendor/pdfjs),
// sin <iframe>. Así el documento se ve como parte de la página, sin la barra de
// miniaturas ni el toolbar del visor nativo del navegador, y consistente con
// las lecciones tipo pdf del portal. Mismo enfoque que leccion.js.

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

async function renderPdfInto(pdfjsLib, host, src) {
  const doc = await pdfjsLib.getDocument({
    url: src,
    standardFontDataUrl: `${PDFJS_BASE}/standard_fonts/`,
    disableFontFace: true,
  }).promise;

  host.classList.add("leccion-pdf--ready");

  async function draw() {
    const cs = getComputedStyle(host);
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
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
      canvas.style.width = cssWidth + "px";
      canvas.style.height = Math.round(canvas.height / dpr) + "px";
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

/**
 * Monta un PDF dentro de `host` (un contenedor con clase .leccion-pdf).
 * En caso de error deja un mensaje y el usuario puede usar el enlace de abajo.
 */
export async function mountPdfInto(host, src) {
  if (!host || !src) return;
  try {
    const lib = await loadPdfjs();
    await renderPdfInto(lib, host, src);
  } catch (e) {
    console.error("mountPdfInto:", e);
    host.classList.remove("leccion-pdf--ready");
    host.innerHTML = `
      <div class="leccion-pdf__error">
        <p>No pudimos mostrar el documento aquí. Ábrelo con el enlace de abajo.</p>
      </div>
    `;
  }
}
