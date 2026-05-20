// SOPHIA Portal · Tarea (entrega de archivo) — componente nativo
//
// Modelo "staging": el alumno puede seleccionar N archivos locales y editar
// el comentario libremente. Nada se guarda en backend hasta que pulsa
// "Guardar entrega". En ese momento se sube todo en una sola request y se
// muestra el mensaje de éxito.
//
// Estado interno:
//   - savedFiles: archivos ya guardados en Airtable (vienen de get-resultados-quiz)
//   - pendingFiles: archivos seleccionados localmente, todavía no subidos
//   - savedComentario: lo que está en Airtable
//   - draftComentario: lo que el alumno está escribiendo (puede diferir)
//   - removedAttachmentIds: archivos previamente guardados que el alumno
//     marcó para eliminar (se procesan al guardar)
//
// Botón "Guardar entrega":
//   1) Por cada attachmentId en removedAttachmentIds → delete-entrega-archivo
//   2) submit-tarea con files=pendingFiles + comentario=draftComentario
//   3) Muestra mensaje de éxito
//
// Storage en Airtable: tabla "Actividades en Clase" con un record por
// (Lección × Inscripción), campos `Archivos` (multipleAttachments) y
// `Comentario`.
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
    // Archivos ya guardados (vienen del backend)
    savedFiles: [],
    // Archivos seleccionados localmente, todavía no subidos
    pendingFiles: [],
    // attachmentIds de archivos saved que el alumno marcó para borrar
    // (no se procesan hasta que pulse "Guardar entrega")
    removedAttachmentIds: new Set(),
    // Comentario en Airtable
    savedComentario: "",
    // Comentario que el alumno está escribiendo
    draftComentario: "",
    loading: true,
    saving: false,
    saveProgress: 0,
    showSuccessFlash: false,
    error: null,
  };

  render(state);

  // Cargar estado actual desde backend
  try {
    const prev = await api.resultadosQuiz(leccionId);
    if (prev?.tieneResultados) {
      state.savedFiles = Array.isArray(prev.archivos) ? prev.archivos : [];
      state.savedComentario = prev.comentario || "";
      state.draftComentario = state.savedComentario;
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
// Derived state
// ─────────────────────────────────────────────────────────────────────

function hasDirtyChanges(state) {
  if (state.pendingFiles.length > 0) return true;
  if (state.removedAttachmentIds.size > 0) return true;
  if (state.draftComentario !== state.savedComentario) return true;
  return false;
}

function visibleSavedFiles(state) {
  return state.savedFiles.filter((a) => !state.removedAttachmentIds.has(a.id));
}

function totalEntregadosTrasGuardar(state) {
  return visibleSavedFiles(state).length + state.pendingFiles.length;
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

  const savedVisible = visibleSavedFiles(state);
  const hasAnySaved = savedVisible.length > 0;
  const dirty = hasDirtyChanges(state);

  state.container.innerHTML = `
    <div class="tarea-component">
      ${state.showSuccessFlash ? `
        <div class="tarea-status tarea-status--ok" data-tarea-flash>
          ${icon("check")}
          <span>Entrega guardada con éxito.</span>
        </div>
      ` : hasAnySaved && !dirty ? `
        <div class="tarea-status tarea-status--ok">
          ${icon("check")}
          <span>Tu tarea está entregada (${savedVisible.length} ${savedVisible.length === 1 ? "archivo" : "archivos"}).</span>
        </div>
      ` : ""}

      ${renderDropzone(state)}

      ${(savedVisible.length > 0 || state.pendingFiles.length > 0) ? renderFilesList(state) : ""}

      ${renderComentario(state)}

      ${state.error ? `<div class="tarea-error">${escapeHtml(state.error)}</div>` : ""}

      ${renderSaveBar(state)}
    </div>
  `;
}

function renderDropzone(state) {
  if (state.saving) {
    const pct = Math.round(state.saveProgress * 100);
    return `
      <div class="tarea-dropzone tarea-dropzone--uploading">
        <div class="tarea-dropzone__icon">${icon("upload")}</div>
        <div class="tarea-dropzone__text">
          <strong>Guardando tu entrega…</strong>
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
      <input type="file" hidden multiple data-tarea-file-input>
      <div class="tarea-dropzone__icon">${icon("upload")}</div>
      <div class="tarea-dropzone__text">
        <strong>Arrastra archivos aquí o haz clic para seleccionar</strong>
        <span class="tarea-dropzone__hint">Cualquier formato · máximo 20 MB por archivo · puedes adjuntar varios</span>
      </div>
    </label>
  `;
}

function renderFilesList(state) {
  const savedVisible = visibleSavedFiles(state);

  const savedItems = savedVisible.map((a) => `
    <li class="tarea-archivo">
      <div class="tarea-archivo__icon">${icon(iconForFile(a))}</div>
      <div class="tarea-archivo__body">
        <a href="${escapeHtml(a.url)}" target="_blank" rel="noopener" class="tarea-archivo__name">
          ${escapeHtml(a.filename)}
        </a>
        <div class="tarea-archivo__meta">
          ${a.size ? formatSize(a.size) : "Entregado"}
        </div>
      </div>
      <button
        type="button"
        class="tarea-archivo__delete"
        data-tarea-action="remove-saved"
        data-attachment-id="${escapeHtml(a.id || "")}"
        aria-label="Quitar ${escapeHtml(a.filename)}"
        ${state.saving ? "disabled" : ""}
      >
        ${icon("close")}
      </button>
    </li>
  `).join("");

  const pendingItems = state.pendingFiles.map((p, idx) => `
    <li class="tarea-archivo tarea-archivo--pending">
      <div class="tarea-archivo__icon">${icon(iconForFile({ filename: p.file.name, type: p.file.type }))}</div>
      <div class="tarea-archivo__body">
        <span class="tarea-archivo__name">${escapeHtml(p.file.name)}</span>
        <div class="tarea-archivo__meta">
          <span class="tarea-archivo__badge">Pendiente de guardar</span>
          ${formatSize(p.file.size)}
        </div>
      </div>
      <button
        type="button"
        class="tarea-archivo__delete"
        data-tarea-action="remove-pending"
        data-pending-idx="${idx}"
        aria-label="Quitar ${escapeHtml(p.file.name)}"
        ${state.saving ? "disabled" : ""}
      >
        ${icon("close")}
      </button>
    </li>
  `).join("");

  return `<ul class="tarea-archivos-list">${savedItems}${pendingItems}</ul>`;
}

function renderComentario(state) {
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
        ${state.saving ? "disabled" : ""}
      >${escapeHtml(state.draftComentario || "")}</textarea>
    </div>
  `;
}

function renderSaveBar(state) {
  const dirty = hasDirtyChanges(state);
  const totalFinal = totalEntregadosTrasGuardar(state);
  // Permitimos guardar incluso cuando totalFinal=0 (caso: alumno borra todo
  // y solo deja un comentario). Solo deshabilitamos si no hay cambios.
  const canSave = dirty && !state.saving;

  let hint = "";
  if (state.saving) {
    hint = "Guardando…";
  } else if (state.pendingFiles.length > 0) {
    hint = `${state.pendingFiles.length} ${state.pendingFiles.length === 1 ? "archivo pendiente" : "archivos pendientes"} de guardar`;
  } else if (state.removedAttachmentIds.size > 0 && state.draftComentario !== state.savedComentario) {
    hint = "Cambios sin guardar";
  } else if (state.removedAttachmentIds.size > 0) {
    hint = `${state.removedAttachmentIds.size} ${state.removedAttachmentIds.size === 1 ? "archivo por quitar" : "archivos por quitar"}`;
  } else if (state.draftComentario !== state.savedComentario) {
    hint = "Comentario sin guardar";
  }

  return `
    <div class="tarea-savebar">
      <div class="tarea-savebar__hint">${escapeHtml(hint)}</div>
      <button
        type="button"
        class="btn btn-accent"
        data-tarea-action="save"
        ${canSave ? "" : "disabled"}
      >
        ${state.saving ? `<span class="tarea-mini-spinner"></span> Guardando…` : `${icon("check")} Guardar entrega`}
      </button>
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
  if (action === "remove-saved") {
    const id = btn.dataset.attachmentId;
    if (id) markSavedForRemoval(state, id);
  } else if (action === "remove-pending") {
    const idx = parseInt(btn.dataset.pendingIdx, 10);
    if (!Number.isNaN(idx)) removePendingAt(state, idx);
  } else if (action === "save") {
    commitEntrega(state);
  }
}

function changeHandler(state, e) {
  const input = e.target.closest("[data-tarea-file-input]");
  if (!input || !input.files || input.files.length === 0) return;
  const fileList = Array.from(input.files);
  input.value = ""; // permitir re-seleccionar mismo archivo
  addPendingFiles(state, fileList);
}

function inputHandler(state, e) {
  const ta = e.target.closest("[data-tarea-comentario]");
  if (!ta) return;
  state.draftComentario = ta.value;
  // Re-render solo la save bar (no toda la UI para no perder focus)
  const sb = state.container.querySelector(".tarea-savebar");
  if (sb) sb.outerHTML = renderSaveBar(state);
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
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    addPendingFiles(state, Array.from(files));
  }
}

// ─────────────────────────────────────────────────────────────────────
// State mutations
// ─────────────────────────────────────────────────────────────────────

function addPendingFiles(state, fileList) {
  state.error = null;
  state.showSuccessFlash = false;
  const errors = [];
  for (const f of fileList) {
    if (f.size > MAX_BYTES) {
      const mb = (f.size / 1024 / 1024).toFixed(1);
      errors.push(`"${f.name}" pesa ${mb} MB. El máximo es 20 MB.`);
      continue;
    }
    state.pendingFiles.push({ file: f, id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
  }
  if (errors.length > 0) {
    state.error = errors.join(" ");
  }
  render(state);
}

function removePendingAt(state, idx) {
  state.pendingFiles.splice(idx, 1);
  state.showSuccessFlash = false;
  render(state);
}

function markSavedForRemoval(state, attachmentId) {
  state.removedAttachmentIds.add(attachmentId);
  state.showSuccessFlash = false;
  render(state);
}

// ─────────────────────────────────────────────────────────────────────
// Commit
// ─────────────────────────────────────────────────────────────────────

async function commitEntrega(state) {
  if (state.saving) return;
  if (!hasDirtyChanges(state)) return;

  state.saving = true;
  state.saveProgress = 0;
  state.error = null;
  state.showSuccessFlash = false;
  render(state);

  try {
    // 1) Eliminar archivos marcados para borrar (uno por uno; el backend
    //    no soporta batch delete y son pocos en general).
    for (const attachmentId of state.removedAttachmentIds) {
      try {
        await api.deleteEntregaArchivo({
          leccionId: state.leccionId,
          inscripcionId: state.inscripcionId,
          attachmentId,
        });
      } catch (err) {
        // Si el archivo ya no existía (fue borrado en otra pestaña), seguimos.
        // Para errores reales abortamos.
        if (err?.status !== 404) {
          throw err;
        }
      }
    }

    // 2) Subir archivos nuevos + actualizar comentario en una sola request
    const files = state.pendingFiles.map((p) => p.file);
    const commentChanged = state.draftComentario !== state.savedComentario;

    // Si NO hay archivos nuevos pero hubo borrados y/o cambio de comentario,
    // de todas formas llamamos submit-tarea (con files=[] y comentario) para
    // actualizar el comentario. Si solo hubo borrados sin nada más, también
    // funciona porque submit-tarea sí acepta zero archivos cuando hay comentario.
    if (files.length > 0 || commentChanged || state.removedAttachmentIds.size === 0) {
      const res = await api.submitTarea({
        leccionId: state.leccionId,
        inscripcionId: state.inscripcionId,
        files,
        comentario: commentChanged ? state.draftComentario : undefined,
        onProgress: (p) => {
          state.saveProgress = p;
          const fill = state.container.querySelector(".tarea-progress__fill");
          const label = state.container.querySelector(".tarea-progress__label");
          if (fill) fill.style.width = `${Math.round(p * 100)}%`;
          if (label) label.textContent = `${Math.round(p * 100)}%`;
        },
      });
      state.savedFiles = Array.isArray(res.archivos) ? res.archivos : state.savedFiles;
      state.savedComentario = res.comentario ?? state.savedComentario;
    } else {
      // Solo borrados, sin upload ni cambio de comentario. Refrescamos
      // savedFiles desde el backend para reflejar el estado actual.
      const fresh = await api.resultadosQuiz(state.leccionId);
      if (fresh?.tieneResultados) {
        state.savedFiles = Array.isArray(fresh.archivos) ? fresh.archivos : [];
        state.savedComentario = fresh.comentario || "";
      } else {
        state.savedFiles = [];
        state.savedComentario = "";
      }
    }

    // 3) Reset state local
    state.pendingFiles = [];
    state.removedAttachmentIds = new Set();
    state.draftComentario = state.savedComentario;
    state.saving = false;
    state.saveProgress = 0;
    state.showSuccessFlash = true;
    render(state);

    // Quitar flash después de 4 segundos
    setTimeout(() => {
      if (state.showSuccessFlash) {
        state.showSuccessFlash = false;
        render(state);
      }
    }, 4000);

    // Marcar lección como completada si hay archivos
    if (state.savedFiles.length > 0 && typeof state.onComplete === "function") {
      try {
        await state.onComplete();
      } catch (err) {
        console.warn("tarea onComplete failed:", err);
      }
    }
  } catch (err) {
    console.error("commit tarea failed:", err);
    state.saving = false;
    state.saveProgress = 0;
    state.error = err?.message || "No pudimos guardar tu entrega. Intenta de nuevo.";
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
