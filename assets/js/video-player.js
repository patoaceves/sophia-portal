// SOPHIA Portal · video-player.js
//
// Player nativo para videos self-hosted (bucket privado sophia-videos).
// - Pide signed URL + punto de resume a get-video-url.
// - Reanuda donde se quedó el alumno (video_pct -> currentTime).
// - Guarda avance con throttle (timeupdate / pause / pestaña oculta).
// - Marca completada al cruzar el umbral (lo decide el server).
// - Soporta subtítulos .vtt si existen.
//
// Uso (desde leccion.js, solo cuando urlVideo NO es http(s)):
//   import { mountVideoPlayer } from "./video-player.js";
//   await mountVideoPlayer(containerEl, { leccionId, inscripcionId });

import { api } from "./api.js";

const SAVE_EVERY_MS = 5000;   // no guardar más seguido que esto
const RESUME_MIN_PCT = 2;     // por debajo de esto, arranca desde 0
const RESUME_MAX_PCT = 95;    // por arriba, ya casi acabó: arranca desde 0

function fmtTime(secs) {
  if (!isFinite(secs) || secs < 0) secs = 0;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

export async function mountVideoPlayer(container, { leccionId, inscripcionId }) {
  container.innerHTML = `<div class="video-loading" style="aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;background:#000;border-radius:var(--r-lg);color:#fff;opacity:.7;">Cargando video…</div>`;

  let info;
  try {
    info = await api.getVideoUrl(leccionId);
  } catch (err) {
    container.innerHTML = `<div class="video-error" style="padding:24px;border-radius:var(--r-lg);background:var(--surface-2,#f5f5f5);">No se pudo cargar el video. ${escapeHtml(err?.message || "")}</div>`;
    return;
  }

  // inscripcionId puede venir del caller o de la respuesta de get-video-url
  const inscId = inscripcionId || info.inscripcionId;

  const wrap = document.createElement("div");
  wrap.className = "video-player";
  wrap.style.cssText = "position:relative;border-radius:var(--r-lg);overflow:hidden;background:#000;";

  const video = document.createElement("video");
  video.controls = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.style.cssText = "width:100%;display:block;background:#000;";
  video.src = info.signedUrl;

  if (info.subtitlesUrl) {
    const track = document.createElement("track");
    track.kind = "subtitles";
    track.srclang = "es";
    track.label = "Español";
    track.src = info.subtitlesUrl;
    video.appendChild(track);
  }

  wrap.appendChild(video);
  container.innerHTML = "";
  container.appendChild(wrap);

  // ── Resume ─────────────────────────────────────────────────────────
  const resumePct = Number(info.resumePct) || 0;
  let resumed = false;

  video.addEventListener("loadedmetadata", () => {
    if (resumed) return;
    if (resumePct > RESUME_MIN_PCT && resumePct < RESUME_MAX_PCT && isFinite(video.duration)) {
      const t = (resumePct / 100) * video.duration;
      video.currentTime = t;
      resumed = true;
      showResumeToast(wrap, video, t);
    }
  }, { once: false });

  // ── Guardado de avance (throttle) ──────────────────────────────────
  let lastSaveAt = 0;
  let lastPctSaved = -1;
  let saving = false;

  function currentPct() {
    if (!isFinite(video.duration) || video.duration <= 0) return 0;
    return Math.min(100, Math.round((video.currentTime / video.duration) * 100));
  }

  async function save(force = false) {
    if (!inscId) return; // sin inscripción no guardamos
    const pct = currentPct();
    if (pct <= 0) return;
    const now = Date.now();
    if (!force && (now - lastSaveAt < SAVE_EVERY_MS || pct === lastPctSaved)) return;
    if (saving) return;
    saving = true;
    lastSaveAt = now;
    lastPctSaved = pct;
    try {
      await api.guardarProgresoVideo(leccionId, inscId, pct);
    } catch (_e) {
      // best-effort: no rompemos la reproducción por un guardado fallido
    } finally {
      saving = false;
    }
  }

  video.addEventListener("timeupdate", () => save(false));
  video.addEventListener("pause", () => save(true));
  video.addEventListener("ended", () => save(true));
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(true); });
  window.addEventListener("pagehide", () => save(true));

  return { video, destroy() { try { video.pause(); } catch {} } };
}

function showResumeToast(wrap, video, t) {
  const toast = document.createElement("div");
  toast.style.cssText = "position:absolute;left:12px;bottom:64px;display:flex;gap:8px;align-items:center;background:rgba(0,0,0,.78);color:#fff;padding:8px 12px;border-radius:var(--r-md,10px);font-size:14px;z-index:3;backdrop-filter:blur(4px);";
  toast.innerHTML = `<span>Continuaste en ${fmtTime(t)}</span>`;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Empezar de nuevo";
  btn.style.cssText = "background:transparent;border:1px solid rgba(255,255,255,.4);color:#fff;padding:4px 10px;border-radius:999px;cursor:pointer;font-size:13px;";
  btn.addEventListener("click", () => {
    video.currentTime = 0;
    toast.remove();
    video.play().catch(() => {});
  });
  toast.appendChild(btn);
  wrap.appendChild(toast);

  setTimeout(() => { toast.style.transition = "opacity .4s"; toast.style.opacity = "0"; setTimeout(() => toast.remove(), 450); }, 6000);
}
