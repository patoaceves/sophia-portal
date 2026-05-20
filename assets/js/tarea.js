// SOPHIA Portal · Tarea (entrega de archivo) — componente nativo
//
// Renderiza la UI para lecciones tipo `tarea`:
//   - Drag & drop / file picker
//   - Lista de archivos ya subidos con opción de borrar
//   - Textarea opcional para comentario
//   - Botón "Guardar comentario"
//
// Storage en Airtable: tabla "Actividades en Clase" con un record por
// (Lección × Inscripción), campos `Archivos` (multipleAttachments) y
// `Comentario`. La lección se marca como completada cuando hay al menos
// un archivo subido (lo evalúa get-leccion vía progreso).
//
// Uso:
//   import { mountTarea } from "./tarea.js";
//   mountTarea({ container, leccionId, inscripcionId, onComplete });

import { icon } from "./icons.js";
import { escapeHtml } from "./ui-shell.js";
import { api } from "./api.js";

const MAX_BYTES = 20 * 1024 * 1024;

export async function mountTarea({ container, leccionId, inscripcionId, onComplete }) {
  if (!container) return;

  const state = {
    container,
    leccionId,
    inscripcionId,
    onComplete,
    archivos: [],
    comentario: "",
    loading: true,
    uploading: false,
    uploadProgress: 0,
    uploadFilename: "",
    savingComment: false,
    deletingId: null,
    error: null,
  };

  render(state);

  // Cargar estado actual: ¿ya tiene archivos subidos?
  try {
    const prev = await api.resultadosQuiz(leccionId);
    if (prev?.tieneResultados) {
      state.archivos = Array.isArray(prev.archivos) ? prev.archivos : [];
      state.comentario = prev.comentario || "";
    }
  } catch (err) {
    console.warn("[tarea] no se pudo cargar entrega previa:", err);
  }
  state.loading = false;
  render(state);

  // Handlers globales
  container.addEventListener("click", (e) => clickHandler(state, e));
  container.addEventListener("change", (e) => changeHandler(state, e));
  container.addEventListener("input", (e) => inputHandler(state, e));
  container.addEventListener("dragover", (e) => dragOverHandler(state, e));
  container.addEventListener("dragleave", (e) => dragLeaveHandler(state, e));
  container.addEventListener("drop", (e) => dropHandler(state, e));
}

// ─────────────────────────────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────────────────────────────

function render(state) {
  if (state.loading) {
    state.container.innerHTML = `
      <div class="tarea-loading">
        <div class="tarea-loading__spinner" aria-hidden="true"></div>
        <span>Cargando tu entrega…</span>
      </div>
    `;
    return;
  }

  const hasFiles = state.archivos.length > 0;

  state.container.innerHTML = `
    <div class="tarea-component">
      ${hasFiles ? `
        <div class="tarea-status tarea-status--ok">
          ${icon("check")}
          <span>Tu tarea está entregada (${state.archivos.length} ${state.archivos.length === 1 ? "archivo" : "archivos"}). Puedes agregar más archivos o actualizar tu comentario.</span>
        </div>
      ` : ""}

      ${renderDropzone(state)}

      ${hasFiles ? renderArchivosList(state) : ""}

      ${renderComentario(state)}

      ${state.error ? `<div class="tarea-error">${escapeHtml(state.error)}</div>` : ""}
    </div>
  `;
}

function renderDropzone(state) {
  if (state.uploading) {
    const pct = Math.round(state.uploadProgress * 100);
    return `
      <div class="tarea-dropzone tarea-dropzone--uploading">
        <div class="tarea-dropzone__icon">${icon("upload")}</div>
        <div class="tarea-dropzone__text">
          <strong>Subiendo ${escapeHtml(state.uploadFilename)}…</strong>
          <div class="tarea-progress">
            <div class="tarea-progress__fill" style="width:${pct}%"></div>
          </div>
          <div class="tarea-progress__label">${pct}%</div>
        </div>
      </div>
    `;
  }
  return `
    <label class="tarea-dropzone" data-tarea-dropzone>
      <input type="file" hidden data-tarea-file-input>
      <div class="tarea-dropzone__icon">${icon("upload")}</div>
      <div class="tarea-dropzone__text">
        <strong>Arrastra un archivo aquí o haz clic para seleccionar</strong>
        <span class="tarea-dropzone__hint">Cualquier formato · máximo 20 MB por archivo · puedes subir varios</span>
      </div>
    </label>
  `;
}

function renderArchivosList(state) {
  const items = state.archivos.map((a) => {
    const deleting = state.deletingId === a.id;
    return `
      <li class="tarea-archivo ${deleting ? "tarea-archivo--deleting" : ""}">
        <div class="tarea-archivo__icon">${icon(iconForFile(a))}</div>
        <div class="tarea-archivo__body">
          <a href="${escapeHtml(a.url)}" target="_blank" rel="noopener" class="tarea-archivo__name">
            ${escapeHtml(a.filename)}
          </a>
          <div class="tarea-archivo__meta">
            ${formatSize(a.size)}
          </div>
        </div>
        <button
          type="button"
          class="tarea-archivo__delete"
          data-tarea-action="delete"
          data-attachment-id="${escapeHtml(a.id || "")}"
          aria-label="Eliminar ${escapeHtml(a.filename)}"
          ${deleting ? "disabled" : ""}
        >
          ${deleting ? `<span class="tarea-mini-spinner"></span>` : icon("close")}
        </button>
      </li>
    `;
  }).join("");

  return `
    <ul class="tarea-archivos-list">${items}</ul>
  `;
}

function renderComentario(state) {
  const initial = state.comentario || "";
  return `
    <div class="tarea-comentario">
      <label class="tarea-comentario__label" for="tarea-comentario-${state.leccionId}">
        Comentario (opcional)
      </label>
      <textarea
        id="tarea-comentario-${state.leccionId}"
        class="tarea-comentario__textarea"
        data-tarea-comentario
        rows="3"
        maxlength="4000"
        placeholder="Si quieres acompañar tu entrega con notas, déjalas aquí."
      >${escapeHtml(initial)}</textarea>
      <div class="tarea-comentario__actions">
        <button
          type="button"
          class="btn btn-secondary"
          data-tarea-action="save-comment"
          ${state.savingComment ? "disabled" : ""}
        >
          ${state.savingComment ? `<span class="tarea-mini-spinner"></span> Guardando…` : `${icon("check")} Guardar comentario`}
        </button>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────

function clickHandler(state, e) {
  const btn = e.target.closest("[data-tarea-action]");
  if (!btn) return;
  const action = btn.dataset.tareaAction;
  if (action === "delete") {
    const id = btn.dataset.attachmentId;
    if (id) deleteArchivo(state, id);
  } else if (action === "save-comment") {
    saveComentarioOnly(state);
  }
}

function changeHandler(state, e) {
  const input = e.target.closest("[data-tarea-file-input]");
  if (!input || !input.files || input.files.length === 0) return;
  const file = input.files[0];
  input.value = ""; // permitir re-seleccionar mismo archivo
  uploadArchivo(state, file);
}

function inputHandler(state, e) {
  const ta = e.target.closest("[data-tarea-comentario]");
  if (!ta) return;
  state.comentario = ta.value;
  // No re-render para no perder focus.
}

function dragOverHandler(state, e) {
  const dz = e.target.closest("[data-tarea-dropzone]");
  if (!dz) return;
  e.preventDefault();
  dz.classList.add("is-dragover");
}

function dragLeaveHandler(state, e) {
  const dz = e.target.closest("[data-tarea-dropzone]");
  if (!dz) return;
  if (e.target === dz) dz.classList.remove("is-dragover");
}

function dropHandler(state, e) {
  const dz = e.target.closest("[data-tarea-dropzone]");
  if (!dz) return;
  e.preventDefault();
  dz.classList.remove("is-dragover");
  const file = e.dataTransfer?.files?.[0];
  if (file) uploadArchivo(state, file);
}

// ─────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────

async function uploadArchivo(state, file) {
  if (state.uploading) return;

  // Validar tamaño antes de mandar
  if (file.size > MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    state.error = `El archivo pesa ${mb} MB. El máximo es 20 MB.`;
    render(state);
    return;
  }

  state.error = null;
  state.uploading = true;
  state.uploadProgress = 0;
  state.uploadFilename = file.name || "archivo";
  render(state);

  try {
    const res = await api.submitTarea({
      leccionId: state.leccionId,
      inscripcionId: state.inscripcionId,
      file,
      onProgress: (p) => {
        state.uploadProgress = p;
        // Update solo la barra para no re-render todo (mantiene fluidez)
        const fill = state.container.querySelector(".tarea-progress__fill");
        const label = state.container.querySelector(".tarea-progress__label");
        if (fill) fill.style.width = `${Math.round(p * 100)}%`;
        if (label) label.textContent = `${Math.round(p * 100)}%`;
      },
    });
    state.archivos = Array.isArray(res.archivos) ? res.archivos : state.archivos;
    state.uploading = false;
    render(state);

    if (typeof state.onComplete === "function") {
      try {
        await state.onComplete();
      } catch (err) {
        console.warn("tarea onComplete failed:", err);
      }
    }
  } catch (err) {
    console.error("tarea upload failed:", err);
    state.uploading = false;
    state.error = err?.message || "No pudimos subir el archivo. Intenta de nuevo.";
    render(state);
  }
}

async function deleteArchivo(state, attachmentId) {
  if (state.deletingId) return;
  state.deletingId = attachmentId;
  state.error = null;
  render(state);

  try {
    const res = await api.deleteEntregaArchivo({
      leccionId: state.leccionId,
      inscripcionId: state.inscripcionId,
      attachmentId,
    });
    state.archivos = Array.isArray(res.archivos) ? res.archivos : [];
    state.deletingId = null;
    render(state);
  } catch (err) {
    console.error("tarea delete failed:", err);
    state.deletingId = null;
    state.error = err?.message || "No pudimos eliminar el archivo.";
    render(state);
  }
}

async function saveComentarioOnly(state) {
  if (state.savingComment) return;
  state.savingComment = true;
  state.error = null;
  render(state);

  try {
    const res = await api.submitTarea({
      leccionId: state.leccionId,
      inscripcionId: state.inscripcionId,
      comentario: state.comentario,
    });
    state.archivos = Array.isArray(res.archivos) ? res.archivos : state.archivos;
    state.comentario = res.comentario ?? state.comentario;
    state.savingComment = false;
    render(state);
  } catch (err) {
    console.error("tarea save comment failed:", err);
    state.savingComment = false;
    state.error = err?.message || "No pudimos guardar el comentario.";
    render(state);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function iconForFile(a) {
  const mime = a.type || "";
  const name = (a.filename || "").toLowerCase();
  if (mime.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(name)) return "imagen";
  if (mime.startsWith("video/") || /\.(mp4|webm|mov|avi|mkv)$/.test(name)) return "video";
  return "archivo";
}
