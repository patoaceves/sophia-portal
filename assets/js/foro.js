// SOPHIA Portal · Foro de un curso
//
// Módulo que monta el feed del foro dentro de un container. Se llama
// desde curso.js cuando el usuario activa el tab "foro".
//
// Uso:
//   import { mountForo } from "./foro.js";
//   mountForo({ container, cursoId });
//
// Convenciones:
// - Texto plano. Convertimos URLs en links automáticamente.
// - Una imagen opcional por post (URL externa). v14 soporta uploads nativos.
// - Comentarios anidados solo 1 nivel.
// - Soft-delete: el autor o un admin pueden borrar.

import { api, ApiError } from "./api.js";
import { icon } from "./icons.js";
import { escapeHtml } from "./ui-shell.js";
import { renderComposerPill, wireComposerPill } from "./foro-composer-pill.js";
import { openForoLightbox } from "./foro-lightbox.js";

const MAX_LEN = 4000;

// ── Cache local de posts (id → post) ─────────────────────────────────
// Evita re-fetchear la página 1 del foro para resolver un post por id
// (ej. al abrir el lightbox de una imagen). Se alimenta del load inicial,
// de "Cargar más" y de los posts nuevos. Sin esto, un post cargado con
// "Cargar más" no se encontraba al abrir su imagen (el lightbox solo
// buscaba en la primera página).
const postsById = new Map();

function cachePosts(posts) {
  for (const p of posts || []) {
    if (p?.id) postsById.set(p.id, p);
  }
}

/**
 * Resuelve un post por id: primero del cache local; si no está, pagina
 * get-foro-posts hacia atrás (máx 5 páginas) hasta encontrarlo.
 */
async function resolvePost(cursoId, postId) {
  const hit = postsById.get(postId);
  if (hit) return hit;
  let before;
  for (let i = 0; i < 5; i++) {
    const data = await api.foroPosts(cursoId, before ? { before } : {});
    cachePosts(data?.posts ?? []);
    const found = postsById.get(postId);
    if (found) return found;
    if (!data?.hasMore || !data?.nextCursor) return null;
    before = data.nextCursor;
  }
  return null;
}

/**
 * Render avatar HTML — uses photo if `avatarUrl` exists, else initials.
 * @param {object} actor · expects { avatarUrl, iniciales }
 * @param {string} extraClass · optional extra class on the wrapper
 */
function renderAvatar(actor, extraClass = "") {
  const url = (actor?.avatarUrl || "").trim();
  const initials = actor?.iniciales || "?";
  if (url) {
    return `<div class="${extraClass} has-photo"><img src="${escapeHtml(url)}" alt="" referrerpolicy="no-referrer" loading="lazy"></div>`;
  }
  return `<div class="${extraClass}">${escapeHtml(initials)}</div>`;
}

/**
 * Render a post's attachment based on its type. v16 supports:
 *   - "imagen" → inline <img> in a clickable wrapper
 *   - "video"  → <video controls> player
 *   - "archivo" → card with file icon + name + download link
 * Returns empty string when there's no attachment.
 */
function renderAttachment(p) {
  const url = (p.adjuntoUrl || "").trim();
  const tipo = (p.adjuntoTipo || "").trim();
  if (!url || !tipo) return "";

  if (tipo === "imagen") {
    return `
      <button type="button" class="foro-post__image-link" data-action="open-lightbox" data-post-id="${escapeHtml(p.id)}" aria-label="Ver imagen en grande">
        <img src="${escapeHtml(url)}" alt="" loading="lazy" class="foro-post__image" onerror="this.parentElement.style.display='none'">
      </button>
    `;
  }

  if (tipo === "video") {
    return `
      <div class="foro-post__video-wrap">
        <video class="foro-post__video" controls preload="metadata" playsinline>
          <source src="${escapeHtml(url)}">
          Tu navegador no soporta el video.
        </video>
      </div>
    `;
  }

  // archivo
  const filename = (p.adjuntoNombre || "").trim() || "Archivo";
  return `
    <a href="${escapeHtml(url)}" target="_blank" rel="noopener" download class="foro-post__file-card">
      <div class="foro-post__file-icon">${icon("archivo")}</div>
      <div class="foro-post__file-body">
        <div class="foro-post__file-name">${escapeHtml(filename)}</div>
        <div class="foro-post__file-action">
          ${icon("download")}<span>Descargar</span>
        </div>
      </div>
    </a>
  `;
}

/**
 * Monta el foro completo. Idempotente, si ya estaba montado lo reemplaza.
 * @param {object} opts
 * @param {HTMLElement} opts.container · donde montar el HTML
 * @param {string} opts.cursoId · record ID de Cursos
 */
export async function mountForo({ container, cursoId }) {
  if (!container) return;
  container.innerHTML = renderSkeleton();
  postsById.clear();

  let data;
  try {
    data = await api.foroPosts(cursoId);
  } catch (e) {
    container.innerHTML = renderError(e);
    return;
  }

  cachePosts(data?.posts ?? []);
  renderFeed(container, cursoId, data);
}

// ────────────────────────────────────────────────────────────────────
// Render
// ────────────────────────────────────────────────────────────────────

function renderFeed(container, cursoId, data) {
  const { posts, yo } = data;

  container.innerHTML = `
    <header class="tab-panel-header">
      <span class="tab-panel-header__eyebrow">Conversación del grupo</span>
      <h3 class="tab-panel-header__title">Foro</h3>
      <p class="tab-panel-header__sub">
        Comparte ideas, reflexiones y dudas con tus compañeros de grupo.
      </p>
    </header>

    <div data-foro-tab-compose>
      ${renderComposerPill(yo)}
    </div>

    <div class="foro-feed" id="foroFeed" data-curso-id="${escapeHtml(cursoId)}">
      ${posts.length === 0
        ? `<div class="foro-empty">
             <div class="foro-empty__icon">${icon("mensajes")}</div>
             <h4>Aún no hay publicaciones</h4>
             <p>Sé la primera persona en comenzar la conversación.</p>
           </div>`
        : posts.map((p) => renderPost(p, yo)).join("")}
    </div>
    ${data.hasMore ? `
      <div class="foro-load-more" data-foro-load-more style="display:flex; justify-content:center; margin-top:var(--s-4, 16px);">
        <button class="btn btn-secondary" data-action="foro-load-more" data-before="${escapeHtml(data.nextCursor || "")}" type="button">
          ${icon("refresh")}<span>Cargar publicaciones anteriores</span>
        </button>
      </div>` : ""}
  `;

  // Top composer (pill compartido con /resumen)
  const pillForm = container.querySelector("[data-foro-tab-compose] [data-foro-pill]");
  if (pillForm) {
    wireComposerPill(pillForm, {
      cursoId,
      onPublished: (post) => {
        // v2: inserción quirúrgica del post nuevo (create-foro-post lo
        // devuelve completo: autor, adjunto, fechaISO). Antes se
        // re-fetcheaba la página 1 y se reemplazaba TODO el feed, borrando
        // visualmente los posts cargados con "Cargar más".
        if (post?.id) {
          insertNewPost(container, post, yo, null);
        }
      },
    });
  }

  wireFeedActions(container, cursoId, yo);
}

function renderComposer(yo, { mode, parentPostId }) {
  const isComment = mode === "comment";
  const placeholder = isComment ? "Escribe una respuesta…" : "¿Qué quieres compartir con el grupo?";
  const cta = isComment ? "Responder" : "Publicar";
  const formId = isComment ? `composer-${parentPostId}` : "composer-root";

  return `
    <form class="foro-composer ${isComment ? "foro-composer--inline" : ""}" id="${escapeHtml(formId)}" data-parent="${escapeHtml(parentPostId || "")}">
      ${renderAvatar(yo, "foro-composer__avatar")}
      <div class="foro-composer__body">
        <textarea
          class="foro-composer__textarea"
          name="contenido"
          placeholder="${escapeHtml(placeholder)}"
          maxlength="${MAX_LEN}"
          rows="${isComment ? 2 : 3}"
          required
        ></textarea>

        <!-- Attachment preview (only on top-level composer, not in comments) -->
        ${isComment ? "" : `
          <div class="foro-composer__attachment" data-attachment hidden>
            <div class="foro-composer__attachment-inner" data-attachment-inner></div>
            <button type="button" class="foro-composer__attachment-remove" data-action="remove-attachment" aria-label="Quitar adjunto">×</button>
          </div>
          <input
            type="file"
            class="foro-composer__file-input"
            data-file-input
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/zip,application/x-zip-compressed"
            style="display:none;"
          >
        `}

        <div class="foro-composer__bar">
          <div class="foro-composer__tools">
            ${isComment ? "" : `
              <button type="button" class="foro-composer__tool" data-action="pick-file" title="Adjuntar imagen, video o archivo">
                ${icon("clip")}<span>Adjuntar</span>
              </button>
            `}
            <span class="foro-composer__count" data-count>0 / ${MAX_LEN}</span>
          </div>
          <div class="foro-composer__cta">
            ${isComment ? `<button type="button" class="btn btn-ghost btn-sm" data-action="cancel-comment">Cancelar</button>` : ""}
            <button type="submit" class="btn btn-accent btn-sm" data-submit>
              <span data-cta-label>${escapeHtml(cta)}</span>
            </button>
          </div>
        </div>
        <div class="foro-composer__error" data-error hidden></div>
      </div>
    </form>
  `;
}

function renderPost(p, yo) {
  // Tombstone: post eliminado pero conservado porque tiene comentarios vivos
  if (p.eliminado) {
    return `
      <article class="foro-post foro-post--tombstone" data-post-id="${escapeHtml(p.id)}">
        <div class="foro-post__avatar foro-post__avatar--tombstone" aria-hidden="true">·</div>
        <div class="foro-post__body">
          <div class="foro-post__tombstone">
            <span>Mensaje eliminado</span>
            <time class="foro-post__time" datetime="${escapeHtml(p.fechaISO)}">${escapeHtml(formatDate(p.fechaISO))}</time>
          </div>
          ${p.comentarios.length > 0 ? `
            <div class="foro-comments" data-comments-of="${escapeHtml(p.id)}">
              ${p.comentarios.map((c) => renderComment(c, yo)).join("")}
            </div>
          ` : ""}
        </div>
      </article>
    `;
  }

  const canDelete = p.esAutor || yo.esAdmin;
  return `
    <article class="foro-post" data-post-id="${escapeHtml(p.id)}">
      ${renderAvatar(p.autor, "foro-post__avatar")}
      <div class="foro-post__body">
        <header class="foro-post__head">
          <div>
            <div class="foro-post__author">${escapeHtml(displayName(p.autor))}${rolBadge(p.autor)}</div>
            <time class="foro-post__time" datetime="${escapeHtml(p.fechaISO)}">${escapeHtml(formatDate(p.fechaISO))}</time>
          </div>
          ${canDelete ? `
            <button type="button" class="foro-post__menu" data-action="delete" data-post-id="${escapeHtml(p.id)}" title="Borrar">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          ` : ""}
        </header>
        <div class="foro-post__content">${renderContent(p.contenido)}</div>
        ${renderAttachment(p)}
        <footer class="foro-post__footer">
          <button type="button" class="foro-post__action" data-action="reply" data-post-id="${escapeHtml(p.id)}">
            ${icon("mensajes")}<span>Responder</span>
            ${p.comentarios.length > 0 ? `<span class="foro-post__count">${p.comentarios.length}</span>` : ""}
          </button>
        </footer>

        ${(p.comentarios.length > 0 || true) ? `
          <div class="foro-comments" data-comments-of="${escapeHtml(p.id)}">
            ${p.comentarios.map((c) => renderComment(c, yo)).join("")}
            <div class="foro-comments__composer-slot" data-composer-slot="${escapeHtml(p.id)}"></div>
          </div>
        ` : ""}
      </div>
    </article>
  `;
}

function renderComment(c, yo) {
  const canDelete = c.esAutor || yo.esAdmin;
  return `
    <article class="foro-comment" data-post-id="${escapeHtml(c.id)}">
      ${renderAvatar(c.autor, "foro-comment__avatar")}
      <div class="foro-comment__body">
        <header class="foro-comment__head">
          <div>
            <span class="foro-comment__author">${escapeHtml(displayName(c.autor))}${rolBadge(c.autor)}</span>
            <time class="foro-comment__time" datetime="${escapeHtml(c.fechaISO)}">${escapeHtml(formatDate(c.fechaISO))}</time>
          </div>
          ${canDelete ? `
            <button type="button" class="foro-post__menu foro-post__menu--sm" data-action="delete" data-post-id="${escapeHtml(c.id)}" title="Borrar">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          ` : ""}
        </header>
        <div class="foro-comment__content">${renderContent(c.contenido)}</div>
      </div>
    </article>
  `;
}

function renderSkeleton() {
  return `
    <header class="tab-panel-header">
      <span class="tab-panel-header__eyebrow">Conversación del grupo</span>
      <h3 class="tab-panel-header__title">Foro</h3>
    </header>
    <div class="foro-skeleton">
      <div class="foro-skeleton__row loading-skeleton" style="height: 120px;"></div>
      <div class="foro-skeleton__row loading-skeleton" style="height: 80px; margin-top: 16px;"></div>
      <div class="foro-skeleton__row loading-skeleton" style="height: 80px; margin-top: 12px;"></div>
    </div>
  `;
}

function renderError(e) {
  const msg = e instanceof ApiError
    ? (e.payload?.code === "not_enrolled"
        ? "No estás inscrito a este curso."
        : (e.message || "No pudimos cargar el foro."))
    : (e?.message || "No pudimos cargar el foro.");
  return `
    <header class="tab-panel-header">
      <span class="tab-panel-header__eyebrow">Conversación del grupo</span>
      <h3 class="tab-panel-header__title">Foro</h3>
    </header>
    <div class="empty-state">
      <div class="empty-state__title">No pudimos cargar el foro</div>
      <p class="empty-state__desc">${escapeHtml(msg)}</p>
    </div>
  `;
}

// ────────────────────────────────────────────────────────────────────
// Wiring
// ────────────────────────────────────────────────────────────────────

function wireComposer(root, { cursoId, parentPostId, yo }) {
  const formId = parentPostId ? `composer-${parentPostId}` : "composer-root";
  const form = root.querySelector(`#${cssEscape(formId)}`);
  if (!form) return;

  const textarea = form.querySelector(".foro-composer__textarea");
  const counter = form.querySelector("[data-count]");
  const submitBtn = form.querySelector("[data-submit]");
  const ctaLabel = form.querySelector("[data-cta-label]");
  const errorEl = form.querySelector("[data-error]");
  const fileInput = form.querySelector("[data-file-input]");
  const attachmentEl = form.querySelector("[data-attachment]");
  const attachmentInner = form.querySelector("[data-attachment-inner]");
  const pickFileBtn = form.querySelector('[data-action="pick-file"]');
  const removeAttachmentBtn = form.querySelector('[data-action="remove-attachment"]');
  const cancelCommentBtn = form.querySelector('[data-action="cancel-comment"]');

  // Attachment state (only meaningful for top-level composer)
  let attachment = null; // { url, attachmentType, originalName, mimeType, size }
  let isUploading = false;

  function updateCount() {
    if (!counter) return;
    counter.textContent = `${textarea.value.length} / ${MAX_LEN}`;
  }
  textarea.addEventListener("input", updateCount);
  updateCount();

  if (pickFileBtn && fileInput) {
    pickFileBtn.addEventListener("click", () => {
      if (isUploading) return;
      fileInput.click();
    });
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      fileInput.value = "";
      await handleFileUpload(file);
    });
  }

  async function handleFileUpload(file) {
    clearError();
    isUploading = true;
    setComposerBusy(true);
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
      console.error("upload failed:", err);
      const msg = err?.payload?.code === "too_large"
        ? err.message
        : (err?.message || "No pudimos subir el archivo.");
      showError(msg);
      attachment = null;
      hideAttachment();
    } finally {
      isUploading = false;
      setComposerBusy(false);
    }
  }

  function showAttachmentUploading(file) {
    if (!attachmentEl || !attachmentInner) return;
    attachmentEl.hidden = false;
    attachmentEl.classList.add("is-uploading");
    attachmentInner.innerHTML = `
      <div class="foro-composer__attachment-preview">
        ${attachmentIconForFile(file)}
      </div>
      <div class="foro-composer__attachment-meta">
        <div class="foro-composer__attachment-name">${escapeHtml(file.name)}</div>
        <div class="foro-composer__attachment-progress">
          <div class="foro-composer__attachment-progress-bar"><div class="foro-composer__attachment-progress-fill" data-progress style="width:0%"></div></div>
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
    if (!attachmentEl || !attachmentInner) return;
    attachmentEl.classList.remove("is-uploading");
    attachmentEl.classList.add("is-ready");
    attachmentInner.innerHTML = `
      <div class="foro-composer__attachment-preview">
        ${attachmentPreviewHtml(asset)}
      </div>
      <div class="foro-composer__attachment-meta">
        <div class="foro-composer__attachment-name">${escapeHtml(asset.originalName)}</div>
        <div class="foro-composer__attachment-size">${formatBytes(asset.size)} · ${escapeHtml(asset.attachmentType)}</div>
      </div>
    `;
  }

  function hideAttachment() {
    if (!attachmentEl || !attachmentInner) return;
    attachmentEl.hidden = true;
    attachmentEl.classList.remove("is-uploading", "is-ready");
    attachmentInner.innerHTML = "";
  }

  function setComposerBusy(busy) {
    submitBtn.disabled = busy;
    if (pickFileBtn) pickFileBtn.disabled = busy;
  }

  if (removeAttachmentBtn) {
    removeAttachmentBtn.addEventListener("click", () => {
      attachment = null;
      hideAttachment();
    });
  }
  if (cancelCommentBtn) {
    cancelCommentBtn.addEventListener("click", () => form.remove());
  }

  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }
  function clearError() {
    if (!errorEl) return;
    errorEl.textContent = "";
    errorEl.hidden = true;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();
    if (isUploading) {
      showError("Espera a que termine de subir el archivo.");
      return;
    }
    const contenido = (textarea.value || "").trim();

    if (!contenido && !attachment) {
      showError("Escribe algo o adjunta un archivo.");
      return;
    }
    if (contenido.length > MAX_LEN) {
      showError(`Demasiado largo (max ${MAX_LEN} caracteres).`);
      return;
    }

    submitBtn.disabled = true;
    const originalLabel = ctaLabel.textContent;
    ctaLabel.textContent = "Publicando…";

    try {
      const { post } = await api.crearForoPost({
        cursoId,
        contenido,
        adjuntoUrl: attachment?.url,
        adjuntoTipo: attachment?.attachmentType,
        adjuntoNombre: attachment?.originalName,
        parentPostId: parentPostId || undefined,
      });
      // Insertar en el DOM sin recargar
      insertNewPost(root, post, yo, parentPostId);
      // Reset form
      textarea.value = "";
      attachment = null;
      hideAttachment();
      updateCount();
      // Si era reply, cerrar el composer inline
      if (parentPostId) form.remove();
    } catch (err) {
      console.error("crearForoPost failed:", err);
      const code = err?.payload?.code;
      const msg = code === "not_enrolled"
        ? "No estás inscrito a este curso."
        : code === "too_long"
        ? `Demasiado largo (max ${MAX_LEN} caracteres).`
        : code === "invalid_adjunto_url" || code === "invalid_adjunto_tipo"
        ? "El archivo adjunto no es válido."
        : (err?.message || "No pudimos publicar tu post. Intenta de nuevo.");
      showError(msg);
    } finally {
      submitBtn.disabled = false;
      ctaLabel.textContent = originalLabel;
    }
  });
}

function attachmentIconForFile(file) {
  const mime = file.type || "";
  if (mime.startsWith("image/")) return icon("imagen");
  if (mime.startsWith("video/")) return icon("video");
  return icon("archivo");
}

function attachmentPreviewHtml(asset) {
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

function insertNewPost(root, post, yo, parentPostId) {
  // Mantener el cache local en sync: post top-level nuevo se cachea;
  // comentario nuevo se agrega al array del padre cacheado (para que el
  // lightbox lo muestre si se abre después).
  if (parentPostId) {
    const padre = postsById.get(parentPostId);
    if (padre) {
      // Dedupe por id: el lightbox ya pudo haber agregado este comentario
      // al mismo objeto cacheado antes de invocar onChange.
      const ya = (padre.comentarios || []).some((c) => c.id === post.id);
      if (!ya) {
        padre.comentarios = [...(padre.comentarios || []), { ...post, esAutor: true }];
      }
    }
  } else if (post?.id) {
    postsById.set(post.id, { ...post, esAutor: true, comentarios: post.comentarios || [] });
  }

  if (parentPostId) {
    // Insertar al final de la lista de comentarios del padre
    const slot = root.querySelector(`[data-comments-of="${cssAttr(parentPostId)}"]`);
    if (!slot) return;
    const html = renderComment({ ...post, esAutor: true }, yo);
    const composerSlot = slot.querySelector(`[data-composer-slot="${cssAttr(parentPostId)}"]`);
    if (composerSlot) {
      composerSlot.insertAdjacentHTML("beforebegin", html);
    } else {
      slot.insertAdjacentHTML("beforeend", html);
    }
    // Actualizar el contador del botón "Responder"
    const replyBtn = root.querySelector(`.foro-post[data-post-id="${cssAttr(parentPostId)}"] [data-action="reply"]`);
    if (replyBtn) {
      let countEl = replyBtn.querySelector(".foro-post__count");
      if (!countEl) {
        countEl = document.createElement("span");
        countEl.className = "foro-post__count";
        countEl.textContent = "1";
        replyBtn.appendChild(countEl);
      } else {
        countEl.textContent = String(parseInt(countEl.textContent || "0", 10) + 1);
      }
    }
  } else {
    // Insertar al inicio del feed (newest-first)
    const feed = root.querySelector("#foroFeed");
    if (!feed) return;
    // Borrar empty state si existe
    feed.querySelector(".foro-empty")?.remove();
    const html = renderPost({ ...post, esAutor: true, comentarios: [] }, yo);
    feed.insertAdjacentHTML("afterbegin", html);
  }
}

function wireFeedActions(root, cursoId, yo) {
  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === "foro-load-more") {
      const before = btn.dataset.before;
      if (!before) return;
      btn.disabled = true;
      const labelEl = btn.querySelector("span");
      const prevLabel = labelEl ? labelEl.textContent : "";
      if (labelEl) labelEl.textContent = "Cargando…";
      try {
        const data = await api.foroPosts(cursoId, { before });
        cachePosts(data?.posts ?? []);
        const older = (data?.posts ?? []).filter((p) => !p.eliminado);
        const feed = root.querySelector("#foroFeed");
        if (feed && older.length) {
          feed.insertAdjacentHTML("beforeend", older.map((p) => renderPost(p, yo)).join(""));
        }
        if (data?.hasMore && data?.nextCursor) {
          btn.dataset.before = data.nextCursor;
          btn.disabled = false;
          if (labelEl) labelEl.textContent = prevLabel;
        } else {
          const wrap = btn.closest("[data-foro-load-more]");
          if (wrap) wrap.remove(); else btn.remove();
        }
      } catch (err) {
        console.error("foro load-more failed:", err);
        btn.disabled = false;
        if (labelEl) labelEl.textContent = prevLabel;
      }
      return;
    }

    if (action === "open-lightbox") {
      const postId = btn.dataset.postId;
      if (!postId) return;
      // v2: resolver del cache local (o paginando hacia atrás) en vez de
      // re-fetchear solo la página 1 — los posts de "Cargar más" no se
      // encontraban y el lightbox fallaba en silencio.
      try {
        const post = await resolvePost(cursoId, postId);
        if (post) {
          openForoLightbox({
            post,
            cursoId,
            yo,
            onChange: (nuevoComentario) => {
              // Inserción quirúrgica del comentario nuevo en el feed.
              // Antes se re-fetcheaba la página 1 y se re-renderizaba TODO
              // el feed, lo que borraba los posts traídos con "Cargar más".
              if (nuevoComentario?.id) {
                insertNewPost(root, nuevoComentario, yo, post.id);
              }
            },
          });
        }
      } catch (err) {
        console.error("lightbox open failed:", err);
      }
      return;
    }

    if (action === "delete") {
      const postId = btn.dataset.postId;
      if (!postId) return;
      if (!confirm("¿Borrar esta publicación? No se puede deshacer.")) return;
      btn.disabled = true;
      try {
        await api.borrarForoPost(postId);

        // Sync del cache local: tombstone si es top-level, remoción si es
        // comentario (el mountForo del caso con comentarios lo limpia solo).
        const cached = postsById.get(postId);
        if (cached) {
          cached.eliminado = true;
        } else {
          for (const p of postsById.values()) {
            if (Array.isArray(p.comentarios)) {
              const c = p.comentarios.find((x) => x.id === postId);
              if (c) { c.eliminado = true; break; }
            }
          }
        }

        const article = root.querySelector(`article[data-post-id="${cssAttr(postId)}"]`);
        const isTopLevel = article?.classList.contains("foro-post") && !article.closest(".foro-comments");
        const hasComments = article?.querySelector(".foro-comments .foro-comment");

        if (isTopLevel && hasComments) {
          // Top-level con comentarios vivos → tras el soft-delete, el backend
          // lo devolverá como tombstone. Re-fetch para que el cliente coincida.
          mountForo({ container: root, cursoId });
          return;
        }

        // Comentario, o top-level sin comentarios → quitar del DOM directo
        if (article) article.remove();

        // Si era un comentario, decrementar el counter del padre
        const parentArticle = btn.closest(".foro-comments")?.parentElement?.closest(".foro-post");
        if (parentArticle) {
          const replyBtn = parentArticle.querySelector('[data-action="reply"]');
          const countEl = replyBtn?.querySelector(".foro-post__count");
          if (countEl) {
            const newCount = Math.max(0, parseInt(countEl.textContent || "0", 10) - 1);
            if (newCount === 0) countEl.remove();
            else countEl.textContent = String(newCount);
          }
        }
        // Si el feed quedó vacío, mostrar empty state
        const feed = root.querySelector("#foroFeed");
        if (feed && feed.querySelectorAll(".foro-post").length === 0) {
          feed.innerHTML = `
            <div class="foro-empty">
              <div class="foro-empty__icon">${icon("mensajes")}</div>
              <h4>Aún no hay publicaciones</h4>
              <p>Sé la primera persona en comenzar la conversación.</p>
            </div>`;
        }
      } catch (err) {
        console.error("borrarForoPost failed:", err);
        alert(`No pudimos borrar: ${err.message}`);
        btn.disabled = false;
      }
      return;
    }

    if (action === "reply") {
      const postId = btn.dataset.postId;
      const slot = root.querySelector(`[data-composer-slot="${cssAttr(postId)}"]`);
      if (!slot) return;
      // Toggle: si ya hay un composer abierto, cerrarlo
      if (slot.querySelector("form")) {
        slot.innerHTML = "";
        return;
      }
      // Reply usa el mismo pill que los posts top-level (pill pequeño blanco
      // con attachments y mentions), no el composer expandido grandote.
      slot.innerHTML = renderComposerPill(yo, { placeholder: "Escribe una respuesta…" });
      const pillForm = slot.querySelector("[data-foro-pill]");
      if (pillForm) {
        wireComposerPill(pillForm, {
          cursoId,
          parentPostId: postId,
          onPublished: async () => {
            // Re-fetchear feed completo (incluirá el nuevo comentario nested)
            try {
              const data = await api.foroPosts(cursoId);
              const fresh = (data?.posts ?? []).filter(p => !p.eliminado);
              const feed = root.querySelector("#foroFeed");
              if (feed) {
                feed.innerHTML = fresh.length === 0
                  ? `<div class="foro-empty">
                       <div class="foro-empty__icon">${icon("mensajes")}</div>
                       <h4>Aún no hay publicaciones</h4>
                       <p>Sé la primera persona en comenzar la conversación.</p>
                     </div>`
                  : fresh.map((p) => renderPost(p, yo)).join("");
              }
            } catch (e) {
              console.warn("foro feed reload failed:", e);
            }
          },
        });
        // Focus en el textarea
        slot.querySelector(".foro-pill__textarea")?.focus();
      }
      return;
    }
  });
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Renderea un badge de rol al lado del nombre. Solo muestra para roles
 * distintos a "participante" (default), para no saturar visualmente.
 */
function rolBadge(autor) {
  const rol = (autor?.rol || "").trim().toLowerCase();
  if (!rol || rol === "participante") return "";
  const labels = {
    profesor: "Profesor",
    admin: "Admin",
    facilitador: "Facilitador",
    coordinador: "Coordinador",
  };
  const label = labels[rol] || rol.charAt(0).toUpperCase() + rol.slice(1);
  return ` <span class="foro-rol-badge foro-rol-badge--${escapeHtml(rol)}">${escapeHtml(label)}</span>`;
}

function displayName(autor) {
  const n = (autor.nombre || "").trim();
  const a = (autor.apellidos || "").trim();
  return [n, a].filter(Boolean).join(" ") || "Anónimo";
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `hace ${diffD} d`;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Render seguro de contenido: escapa HTML, convierte \n en <br>,
 * y autoenlaza URLs http(s).
 */
function renderContent(text) {
  if (!text) return "";
  const escaped = escapeHtml(text);
  // Auto-link URLs (después del escape, así que `<` ya es `&lt;`)
  const linked = escaped.replace(
    /(https?:\/\/[^\s<>"']+)/g,
    (m) => `<a href="${m}" target="_blank" rel="noopener noreferrer">${m}</a>`,
  );
  // @-mentions: matches @todos, @grupo, @nombre_apellido, @nombre.
  // Acepta letras (incl. acentos), números, guion bajo, guion. NO espacios.
  const withMentions = linked.replace(
    /(^|\s)(@[A-Za-zÁÉÍÓÚÑáéíóúñ0-9_-]+)/g,
    (_, pre, mention) => `${pre}<span class="foro-mention">${mention}</span>`,
  );
  return withMentions.replace(/\n/g, "<br>");
}

function cssEscape(s) {
  // Mínimo necesario para querySelector: escapar caracteres especiales en IDs
  return String(s).replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}

function cssAttr(s) {
  // Escapar comillas para usar dentro de [attr="..."]
  return String(s).replace(/"/g, '\\"');
}
