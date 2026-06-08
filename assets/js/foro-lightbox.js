// SOPHIA Portal · Foro lightbox modal
//
// Modal estilo Facebook que se abre al hacer click en una imagen del foro.
// Muestra la imagen grande a la izquierda y el post completo + comentarios
// + composer de respuesta a la derecha.
//
// Uso:
//   import { openForoLightbox } from "./foro-lightbox.js";
//   openForoLightbox({ post, cursoId, yo, onChange });
//
//   - post: el objeto del post (con autor, contenido, fechaISO, comentarios, adjuntoUrl, etc.)
//   - cursoId: id del curso (para el composer)
//   - yo: persona del usuario actual (para avatar en composer)
//   - onChange: callback que se invoca cuando se publica un comentario
//                (para que el caller refresque su feed)
//
// Cierre:
//   - Click en backdrop
//   - ESC
//   - Botón ×

import { icon } from "./icons.js";
import { escapeHtml } from "./ui-shell.js";
import { renderComposerPill, wireComposerPill } from "./foro-composer-pill.js";
import { api } from "./api.js";

let activeOverlay = null;

export function openForoLightbox({ post, cursoId, yo, onChange }) {
  // Solo se abre si el post tiene imagen (adjuntoTipo === "imagen")
  if (!post?.adjuntoUrl || post.adjuntoTipo !== "imagen") return;

  // Cerrar cualquier lightbox previo
  if (activeOverlay) closeLightbox();

  const overlay = document.createElement("div");
  overlay.className = "foro-lightbox";
  overlay.innerHTML = `
    <div class="foro-lightbox__inner" role="dialog" aria-label="Vista detallada del post">
      <button type="button" class="foro-lightbox__close" data-lightbox-action="close" aria-label="Cerrar">×</button>

      <div class="foro-lightbox__image-wrap">
        <img src="${escapeHtml(post.adjuntoUrl)}" alt="" class="foro-lightbox__image">
      </div>

      <aside class="foro-lightbox__sidebar">
        <header class="foro-lightbox__post-head">
          ${renderAvatar(post.autor, "foro-lightbox__avatar")}
          <div class="foro-lightbox__post-meta">
            <div class="foro-lightbox__post-author">${escapeHtml(displayName(post.autor))}</div>
            <time class="foro-lightbox__post-time">${escapeHtml(formatDate(post.fechaISO))}</time>
          </div>
        </header>

        ${post.contenido ? `
          <div class="foro-lightbox__post-content">${escapeHtmlMultiline(post.contenido)}</div>
        ` : ""}

        <div class="foro-lightbox__divider"></div>

        <div class="foro-lightbox__comments" data-comments-list>
          ${renderComments(post.comentarios)}
        </div>

        <div class="foro-lightbox__composer" data-composer-slot></div>
      </aside>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  activeOverlay = overlay;

  // Mount composer
  const composerSlot = overlay.querySelector("[data-composer-slot]");
  composerSlot.innerHTML = renderComposerPill(yo, { placeholder: "Escribe un comentario…" });
  const pillForm = composerSlot.querySelector("[data-foro-pill]");
  if (pillForm && cursoId) {
    wireComposerPill(pillForm, {
      cursoId,
      parentPostId: post.id,
      onPublished: async () => {
        // Re-fetchear y actualizar la lista de comentarios in-modal
        try {
          const data = await api.foroPosts(cursoId);
          const fresh = (data?.posts ?? []).find(p => p.id === post.id);
          if (fresh) {
            const commentsEl = overlay.querySelector("[data-comments-list]");
            if (commentsEl) {
              commentsEl.innerHTML = renderComments(fresh.comentarios);
              // Scroll al final para ver el comentario nuevo
              commentsEl.scrollTop = commentsEl.scrollHeight;
            }
            // Actualizar el post local (para futuras refrescos)
            post.comentarios = fresh.comentarios;
          }
          // Notificar al caller para que actualice el feed externo
          if (typeof onChange === "function") onChange();
        } catch (e) {
          console.warn("lightbox refresh failed:", e);
        }
      },
    });
  }

  // Event handlers
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeLightbox();
      return;
    }
    const btn = e.target.closest("[data-lightbox-action]");
    if (btn?.dataset.lightboxAction === "close") {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", onKeyDown);
}

function closeLightbox() {
  if (!activeOverlay) return;
  activeOverlay.remove();
  document.body.style.overflow = "";
  activeOverlay = null;
  document.removeEventListener("keydown", onKeyDown);
}

function onKeyDown(e) {
  if (e.key === "Escape") closeLightbox();
}

// ─── Helpers internos (copiados de foro.js para evitar import circular) ───

function renderAvatar(autor, className) {
  const url = (autor?.avatarUrl || "").trim();
  const inner = url
    ? `<img src="${escapeHtml(url)}" alt="" referrerpolicy="no-referrer" loading="lazy">`
    : escapeHtml(autor?.iniciales || "?");
  return `<div class="${className} ${url ? "has-photo" : ""}">${inner}</div>`;
}

function displayName(autor) {
  const n = (autor?.nombre || "").trim();
  const a = (autor?.apellidos || "").trim();
  return [n, a].filter(Boolean).join(" ") || "Anónimo";
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffH < 24) return `hace ${diffH} h`;
  if (diffD < 7) return `hace ${diffD} d`;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

function escapeHtmlMultiline(text) {
  // Escape + linkify URLs + preserve newlines + highlight @-mentions
  if (!text) return "";
  const escaped = escapeHtml(text);
  const linked = escaped.replace(
    /(https?:\/\/[^\s<>"']+)/g,
    (m) => `<a href="${m}" target="_blank" rel="noopener noreferrer">${m}</a>`,
  );
  const withMentions = linked.replace(
    /(^|\s)(@[A-Za-zÁÉÍÓÚÑáéíóúñ0-9_-]+)/g,
    (_, pre, mention) => `${pre}<span class="foro-mention">${mention}</span>`,
  );
  return withMentions.replace(/\n/g, "<br>");
}

function renderComments(comentarios) {
  const list = (comentarios || []).filter(c => !c.eliminado);
  if (list.length === 0) {
    return `<div class="foro-lightbox__no-comments">Sé el primero en comentar.</div>`;
  }
  return list.map(c => `
    <article class="foro-lightbox__comment">
      ${renderAvatar(c.autor, "foro-lightbox__comment-avatar")}
      <div class="foro-lightbox__comment-body">
        <div class="foro-lightbox__comment-bubble">
          <div class="foro-lightbox__comment-author">${escapeHtml(displayName(c.autor))}</div>
          <div class="foro-lightbox__comment-content">${escapeHtmlMultiline(c.contenido)}</div>
        </div>
        <time class="foro-lightbox__comment-time">${escapeHtml(formatDate(c.fechaISO))}</time>
      </div>
    </article>
  `).join("");
}
