// SOPHIA Portal · Foro composer pill (compartido)
//
// Una sola barra horizontal SIEMPRE inline (no se expande):
//   [avatar] [textarea writable] [📷 imagen] [📎 archivo] [Publicar]
//
// El attachment subido (si existe) aparece COMO BLOQUE encima del pill.
// Se usa en /resumen (preview del foro) y en /foro tab (composer principal).
//
// Uso:
//   import { renderComposerPill, wireComposerPill } from "./foro-composer-pill.js";
//
//   container.innerHTML = renderComposerPill(persona);
//   wireComposerPill(container.querySelector("[data-foro-pill]"), {
//     cursoId,
//     onPublished: (post) => { /* refrescar lista o insertar optimista */ },
//   });
//
// El módulo NO importa api.js de manera circular — lo recibe como parámetro
// implícito vía global (ya está cargado).

import { api } from "./api.js";
import { icon } from "./icons.js";
import { escapeHtml } from "./ui-shell.js";

// ─────────────────────────────────────────────────────────────────────
// Tipos MIME aceptados (mismo conjunto que el upload-asset edge function)
// ─────────────────────────────────────────────────────────────────────
const ACCEPT_IMAGES = "image/jpeg,image/png,image/webp,image/gif";
const ACCEPT_ANY = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/webm", "video/quicktime",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv",
  "application/zip", "application/x-zip-compressed",
].join(",");

/**
 * Renderea el HTML del composer pill.
 * @param {object} persona · { nombre, apellidos, avatarUrl }
 * @param {object} [opts]
 * @param {string} [opts.placeholder="Comparte algo con el grupo"]
 * @returns {string} HTML
 */
export function renderComposerPill(persona, opts = {}) {
  const placeholder = opts.placeholder || "Comparte algo con el grupo";
  const yo = persona || {};
  const a = (yo.nombre || "").trim()[0] || "";
  const b = (yo.apellidos || "").trim()[0] || "";
  const initials = ((a + b).toUpperCase() || "S");
  const url = (yo.avatarUrl || "").trim();
  const avatarHtml = url
    ? `<div class="foro-pill__avatar has-photo"><img src="${escapeHtml(url)}" alt="" referrerpolicy="no-referrer" loading="lazy"></div>`
    : `<div class="foro-pill__avatar">${escapeHtml(initials)}</div>`;

  return `
    <form class="foro-pill" data-foro-pill autocomplete="off">
      <div class="foro-pill__attachment" data-attachment hidden>
        <div class="foro-pill__attachment-inner" data-attachment-inner></div>
        <button type="button" class="foro-pill__attachment-remove" data-action="remove-attachment" aria-label="Quitar adjunto">×</button>
      </div>

      <div class="foro-pill__row">
        ${avatarHtml}

        <textarea
          class="foro-pill__textarea"
          name="contenido"
          placeholder="${escapeHtml(placeholder)}"
          rows="1"
          maxlength="4000"
          data-textarea
        ></textarea>

        <div class="foro-pill__icons">
          <button type="button" class="foro-pill__icon-btn" data-action="pick-image" aria-label="Adjuntar imagen" title="Imagen">
            ${icon("imagen")}
          </button>
          <button type="button" class="foro-pill__icon-btn" data-action="pick-file" aria-label="Adjuntar archivo" title="Archivo">
            ${icon("clip")}
          </button>
        </div>

        <button type="submit" class="btn btn-accent btn-sm foro-pill__submit" data-submit disabled>
          <span data-cta>Publicar</span>
        </button>
      </div>

      <div class="foro-pill__error" data-error hidden></div>

      <input type="file" data-image-input accept="${ACCEPT_IMAGES}" hidden>
      <input type="file" data-file-input accept="${ACCEPT_ANY}" hidden>
    </form>
  `;
}

/**
 * Conecta event handlers al composer renderado.
 * @param {HTMLFormElement} form · el `<form data-foro-pill>` del DOM
 * @param {object} opts
 * @param {string} opts.cursoId · id del curso al que se publica
 * @param {(post: any) => (void|Promise<void>)} [opts.onPublished] · callback post-submit exitoso
 * @param {(err: Error) => void} [opts.onError]
 * @returns {() => void} · cleanup function
 */
export function wireComposerPill(form, opts) {
  if (!form || form.dataset.wired === "true") return () => {};
  form.dataset.wired = "true";

  const { cursoId } = opts;
  if (!cursoId) {
    console.warn("wireComposerPill: cursoId requerido");
    return () => {};
  }

  const textarea = form.querySelector("[data-textarea]");
  const submitBtn = form.querySelector("[data-submit]");
  const ctaLabel = form.querySelector("[data-cta]");
  const errorEl = form.querySelector("[data-error]");
  const imageInput = form.querySelector("[data-image-input]");
  const fileInput = form.querySelector("[data-file-input]");
  const attachmentEl = form.querySelector("[data-attachment]");
  const attachmentInner = form.querySelector("[data-attachment-inner]");

  let attachment = null;
  let isUploading = false;
  let isSubmitting = false;

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }
  function clearError() {
    errorEl.textContent = "";
    errorEl.hidden = true;
  }

  function autoGrow() {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(180, textarea.scrollHeight) + "px";
  }

  function refreshSubmitState() {
    const hasText = textarea.value.trim().length > 0;
    submitBtn.disabled = (!hasText && !attachment) || isUploading || isSubmitting;
  }

  // ─── Textarea ────────────────────────────────────────────────────
  textarea.addEventListener("input", () => {
    clearError();
    autoGrow();
    refreshSubmitState();
  });
  textarea.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !submitBtn.disabled) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  // ─── File pickers ────────────────────────────────────────────────
  imageInput.addEventListener("change", () => {
    const f = imageInput.files?.[0];
    if (f) handleFileUpload(f);
    imageInput.value = "";
  });
  fileInput.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    if (f) handleFileUpload(f);
    fileInput.value = "";
  });

  async function handleFileUpload(file) {
    clearError();
    isUploading = true;
    refreshSubmitState();
    showAttachmentUploading(file);

    try {
      const asset = await api.uploadAsset({
        file,
        kind: "foro-attachment",
        cursoId,
        onProgress: (p) => updateAttachmentProgress(p),
      });
      attachment = asset;
      showAttachmentReady(asset);
    } catch (err) {
      console.error("foro-pill upload failed:", err);
      const msg = err?.payload?.code === "too_large"
        ? err.message
        : (err?.message || "No pudimos subir el archivo.");
      showError(msg);
      attachment = null;
      hideAttachment();
    } finally {
      isUploading = false;
      refreshSubmitState();
    }
  }

  function showAttachmentUploading(file) {
    attachmentEl.hidden = false;
    attachmentEl.classList.add("is-uploading");
    attachmentEl.classList.remove("is-ready");
    attachmentInner.innerHTML = `
      <div class="foro-pill__attachment-preview">
        ${attachmentIconForFile(file)}
      </div>
      <div class="foro-pill__attachment-meta">
        <div class="foro-pill__attachment-name">${escapeHtml(file.name)}</div>
        <div class="foro-pill__attachment-progress">
          <div class="foro-pill__attachment-progress-bar">
            <div class="foro-pill__attachment-progress-fill" data-progress style="width:0%"></div>
          </div>
          <span data-progress-label>Subiendo…</span>
        </div>
      </div>
    `;
  }

  function updateAttachmentProgress(p) {
    const fill = form.querySelector("[data-progress]");
    const label = form.querySelector("[data-progress-label]");
    if (fill) fill.style.width = `${Math.round(p * 100)}%`;
    if (label) label.textContent = p < 1 ? `Subiendo… ${Math.round(p * 100)}%` : "Procesando…";
  }

  function showAttachmentReady(asset) {
    attachmentEl.hidden = false;
    attachmentEl.classList.remove("is-uploading");
    attachmentEl.classList.add("is-ready");
    attachmentInner.innerHTML = `
      <div class="foro-pill__attachment-preview">
        ${attachmentReadyHtml(asset)}
      </div>
      <div class="foro-pill__attachment-meta">
        <div class="foro-pill__attachment-name">${escapeHtml(asset.originalName)}</div>
        <div class="foro-pill__attachment-size">${formatBytes(asset.size)} · ${escapeHtml(asset.attachmentType)}</div>
      </div>
    `;
  }

  function hideAttachment() {
    attachmentEl.hidden = true;
    attachmentEl.classList.remove("is-uploading", "is-ready");
    attachmentInner.innerHTML = "";
  }

  // ─── Click delegation (icons + remove attachment) ────────────────
  form.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "pick-image" && !isUploading) {
      imageInput.click();
    } else if (action === "pick-file" && !isUploading) {
      fileInput.click();
    } else if (action === "remove-attachment") {
      attachment = null;
      hideAttachment();
      refreshSubmitState();
    }
  });

  // ─── Submit ──────────────────────────────────────────────────────
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();
    if (isSubmitting) return;
    if (isUploading) {
      showError("Espera a que termine de subir el archivo.");
      return;
    }
    const contenido = textarea.value.trim();
    if (!contenido && !attachment) {
      showError("Escribe algo o adjunta un archivo.");
      return;
    }

    isSubmitting = true;
    refreshSubmitState();
    const originalLabel = ctaLabel.textContent;
    ctaLabel.textContent = "Publicando…";

    try {
      const result = await api.crearForoPost({
        cursoId,
        contenido,
        adjuntoUrl: attachment?.url,
        adjuntoTipo: attachment?.attachmentType,
        adjuntoNombre: attachment?.originalName,
      });
      // Reset
      textarea.value = "";
      autoGrow();
      attachment = null;
      hideAttachment();
      ctaLabel.textContent = originalLabel;
      isSubmitting = false;
      refreshSubmitState();
      // Callback
      if (typeof opts.onPublished === "function") {
        await opts.onPublished(result?.post || result);
      }
    } catch (err) {
      console.error("foro-pill submit failed:", err);
      const code = err?.payload?.code;
      const msg = code === "not_enrolled"
        ? "No estás inscrito a este curso."
        : code === "too_long"
        ? "Demasiado largo (max 4000 caracteres)."
        : code === "invalid_adjunto_url" || code === "invalid_adjunto_tipo"
        ? "El archivo adjunto no es válido."
        : (err?.message || "No pudimos publicar. Intenta de nuevo.");
      showError(msg);
      ctaLabel.textContent = originalLabel;
      isSubmitting = false;
      refreshSubmitState();
      if (typeof opts.onError === "function") opts.onError(err);
    }
  });

  // Cleanup: noop por ahora (todos los listeners son sobre nodos que se
  // remueven con el form, así que se garbage-collectean solos)
  return () => { form.dataset.wired = ""; };
}

// ─────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────

function attachmentIconForFile(file) {
  const mime = file.type || "";
  if (mime.startsWith("image/")) return icon("imagen");
  if (mime.startsWith("video/")) return icon("video");
  return icon("archivo");
}

function attachmentReadyHtml(asset) {
  if (asset.attachmentType === "imagen") {
    return `<img src="${escapeHtml(asset.url)}" alt="" loading="lazy">`;
  }
  if (asset.attachmentType === "video") {
    return icon("video");
  }
  return icon("archivo");
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
