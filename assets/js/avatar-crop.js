// SOPHIA Portal · Avatar cropper
//
// Modal nativo (sin librerías) que permite al usuario reposicionar y hacer
// zoom sobre una imagen antes de subirla como avatar. Devuelve un Blob
// JPEG cuadrado de 512×512 listo para subir vía upload-asset.
//
// Uso:
//   import { openAvatarCropper } from "./avatar-crop.js";
//   const blob = await openAvatarCropper(file);   // throws "cancelled" si user cierra
//   const croppedFile = new File([blob], file.name, { type: "image/jpeg" });
//   await api.uploadAsset({ file: croppedFile, kind: "avatar" });
//
// Interacción:
//   - Drag (mouse o touch) sobre la imagen para reposicionar
//   - Slider de zoom (1× a 5×)
//   - Wheel del mouse: zoom sobre el viewport
//   - Pinch con 2 dedos: zoom (touchscreens)
//   - "Cancelar" / "Confirmar"
//
// Output: 512×512 JPEG, calidad 0.92.

const VIEWPORT = 320;        // px del crop area visible en la UI
const OUTPUT = 512;          // px del lado del JPEG resultante
const MIN_ZOOM = 1;          // base = "cover" (la imagen llena el viewport)
const MAX_ZOOM = 5;          // 5× = zoom máximo

/**
 * Abre el modal, espera input del usuario, y devuelve un Blob recortado.
 * @param {File} file
 * @returns {Promise<Blob>} JPEG cuadrado 512×512
 *   Rechaza con Error("cancelled") si el usuario cierra sin confirmar.
 */
export function openAvatarCropper(file) {
  return new Promise((resolve, reject) => {
    if (!(file instanceof File)) {
      reject(new Error("Archivo inválido"));
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => mountUI(img, objectUrl, resolve, reject);
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No pudimos cargar la imagen"));
    };
    img.src = objectUrl;
  });
}

function mountUI(img, objectUrl, resolve, reject) {
  // ─── DOM ──────────────────────────────────────────────────────────
  const overlay = document.createElement("div");
  overlay.className = "avatar-cropper";
  overlay.innerHTML = `
    <div class="avatar-cropper__modal" role="dialog" aria-label="Ajustar foto">
      <header class="avatar-cropper__header">
        <h3 class="avatar-cropper__title">Ajusta tu foto</h3>
        <button class="avatar-cropper__close" data-action="cancel" aria-label="Cancelar" type="button">×</button>
      </header>

      <div class="avatar-cropper__viewport" data-viewport>
        <img class="avatar-cropper__image" data-img alt="" draggable="false">
        <div class="avatar-cropper__mask" aria-hidden="true"></div>
      </div>

      <div class="avatar-cropper__zoom-row">
        <span class="avatar-cropper__zoom-icon" aria-hidden="true">−</span>
        <input
          type="range"
          class="avatar-cropper__zoom"
          data-zoom
          min="${MIN_ZOOM}" max="${MAX_ZOOM}" step="0.01" value="${MIN_ZOOM}"
          aria-label="Zoom"
        >
        <span class="avatar-cropper__zoom-icon" aria-hidden="true">+</span>
      </div>

      <p class="avatar-cropper__hint">Arrastra para reposicionar · usa el slider o la rueda del mouse para hacer zoom</p>

      <footer class="avatar-cropper__actions">
        <button class="btn btn-ghost" data-action="cancel" type="button">Cancelar</button>
        <button class="btn btn-accent" data-action="confirm" type="button">
          <span>Aplicar foto</span>
        </button>
      </footer>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden"; // bloquear scroll de fondo

  const imgEl = overlay.querySelector("[data-img]");
  const viewport = overlay.querySelector("[data-viewport]");
  const zoomSlider = overlay.querySelector("[data-zoom]");

  imgEl.src = img.src;

  // ─── Estado ───────────────────────────────────────────────────────
  // baseScale = factor mínimo donde la imagen aún cubre el viewport.
  // El zoom del slider 1..5 multiplica este baseScale.
  const baseScale = Math.max(VIEWPORT / img.naturalWidth, VIEWPORT / img.naturalHeight);
  let zoomFactor = 1;
  let scale = baseScale * zoomFactor;
  let offsetX = 0;
  let offsetY = 0;

  function applyTransform() {
    imgEl.style.transform = `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  }

  function clampOffsets() {
    const halfDisplayedW = (img.naturalWidth * scale) / 2;
    const halfDisplayedH = (img.naturalHeight * scale) / 2;
    const maxOffsetX = Math.max(0, halfDisplayedW - VIEWPORT / 2);
    const maxOffsetY = Math.max(0, halfDisplayedH - VIEWPORT / 2);
    offsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX));
    offsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY));
  }

  // ─── Pan (un solo puntero) ───────────────────────────────────────
  const activePointers = new Map(); // pointerId -> {x, y}
  let dragStartOffsetX = 0;
  let dragStartOffsetY = 0;
  let dragAnchor = null; // {x, y} cuando hay un solo puntero

  // Pinch (dos punteros)
  let pinchStartDist = 0;
  let pinchStartZoom = 1;

  function getDistance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.hypot(dx, dy);
  }

  viewport.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    viewport.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 1) {
      dragAnchor = { x: e.clientX, y: e.clientY };
      dragStartOffsetX = offsetX;
      dragStartOffsetY = offsetY;
    } else if (activePointers.size === 2) {
      const [p1, p2] = Array.from(activePointers.values());
      pinchStartDist = getDistance(p1, p2);
      pinchStartZoom = zoomFactor;
      dragAnchor = null; // disable pan mientras pinch
    }
  });

  viewport.addEventListener("pointermove", (e) => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 1 && dragAnchor) {
      offsetX = dragStartOffsetX + (e.clientX - dragAnchor.x);
      offsetY = dragStartOffsetY + (e.clientY - dragAnchor.y);
      clampOffsets();
      applyTransform();
    } else if (activePointers.size === 2) {
      const [p1, p2] = Array.from(activePointers.values());
      const dist = getDistance(p1, p2);
      if (pinchStartDist > 0) {
        const newZoom = pinchStartZoom * (dist / pinchStartDist);
        setZoom(newZoom);
      }
    }
  });

  function endPointer(e) {
    activePointers.delete(e.pointerId);
    if (activePointers.size === 0) dragAnchor = null;
    if (activePointers.size === 1) {
      // Reanudar pan con el puntero restante
      const [pid] = Array.from(activePointers.keys());
      const p = activePointers.get(pid);
      if (p) {
        dragAnchor = { x: p.x, y: p.y };
        dragStartOffsetX = offsetX;
        dragStartOffsetY = offsetY;
      }
    }
  }
  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);
  viewport.addEventListener("pointerleave", endPointer);

  // ─── Zoom slider ──────────────────────────────────────────────────
  function setZoom(newZoom) {
    zoomFactor = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    scale = baseScale * zoomFactor;
    zoomSlider.value = zoomFactor;
    clampOffsets();
    applyTransform();
  }

  zoomSlider.addEventListener("input", () => {
    setZoom(parseFloat(zoomSlider.value));
  });

  // ─── Wheel zoom ───────────────────────────────────────────────────
  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    setZoom(zoomFactor * factor);
  }, { passive: false });

  // ─── Acciones ─────────────────────────────────────────────────────
  function cleanup() {
    URL.revokeObjectURL(objectUrl);
    document.body.style.overflow = "";
    overlay.remove();
  }

  overlay.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) {
      // Click en backdrop = cancelar
      if (e.target === overlay) {
        cleanup();
        reject(new Error("cancelled"));
      }
      return;
    }
    if (btn.dataset.action === "cancel") {
      cleanup();
      reject(new Error("cancelled"));
    } else if (btn.dataset.action === "confirm") {
      try {
        const confirmBtn = btn;
        confirmBtn.disabled = true;
        confirmBtn.querySelector("span").textContent = "Procesando…";
        renderCrop(img, scale, offsetX, offsetY)
          .then((blob) => {
            cleanup();
            resolve(blob);
          })
          .catch((err) => {
            console.error("renderCrop failed:", err);
            confirmBtn.disabled = false;
            confirmBtn.querySelector("span").textContent = "Aplicar foto";
            cleanup();
            reject(err);
          });
      } catch (err) {
        cleanup();
        reject(err);
      }
    }
  });

  // ESC para cancelar
  function onKeyDown(e) {
    if (e.key === "Escape") {
      document.removeEventListener("keydown", onKeyDown);
      cleanup();
      reject(new Error("cancelled"));
    }
  }
  document.addEventListener("keydown", onKeyDown);

  // ─── Render inicial ───────────────────────────────────────────────
  applyTransform();
}

/**
 * Convierte el estado actual del crop (scale, offsets) a un canvas de
 * OUTPUT×OUTPUT y devuelve el blob JPEG.
 */
function renderCrop(img, scale, offsetX, offsetY) {
  return new Promise((resolve, reject) => {
    // En coordenadas de imagen, ¿qué rectángulo queda dentro del viewport?
    //
    // El viewport mide VIEWPORT×VIEWPORT, con su centro en el origen visual.
    // La imagen está pintada con su CENTRO en (offsetX, offsetY) del centro
    // del viewport, escalada por `scale`.
    //
    // En coords de viewport (origen = centro del viewport):
    //   imagen_centro_x = offsetX
    //   imagen_centro_y = offsetY
    //   imagen visible: (offsetX - W*scale/2, offsetY - H*scale/2) ↘ idem positivo
    //
    // Para mapear viewport→imagen:
    //   src_x = (vp_x - offsetX) / scale + naturalWidth/2
    //
    // El viewport va de (-V/2, -V/2) a (+V/2, +V/2) en coordenadas centradas.
    const cropX = (-VIEWPORT / 2 - offsetX) / scale + img.naturalWidth / 2;
    const cropY = (-VIEWPORT / 2 - offsetY) / scale + img.naturalHeight / 2;
    const cropW = VIEWPORT / scale;
    const cropH = VIEWPORT / scale;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Canvas no disponible"));
      return;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // Fondo blanco por si la imagen tiene transparencia (JPEG no soporta alpha)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, OUTPUT, OUTPUT);

    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("canvas.toBlob falló"));
      },
      "image/jpeg",
      0.92,
    );
  });
}
