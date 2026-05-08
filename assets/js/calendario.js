// SOPHIA Portal · Calendario
//
// Vista de las próximas sesiones de los cursos en los que el alumno está
// inscrito. Por ahora hardcodeamos las sesiones del Happiness Workshop;
// más adelante se conectará a una tabla de Sesiones en Airtable.

import { requireAuth } from "./auth.js";
import { renderShell, escapeHtml } from "./ui-shell.js";
import { icon } from "./icons.js";

// Sesiones del Happiness Workshop (hardcoded por ahora; idealmente vendría
// de una tabla "Sesiones" en Airtable con FK al Curso).
const SESIONES_HW = [
  { num: 1, fecha: "2026-05-12", titulo: "Introducción: Hablemos de Felicidad",   ponente: "Mariana Riojas" },
  { num: 2, fecha: "2026-05-19", titulo: "Autoconocimiento",                       ponente: "Mary Carmen Tena" },
  { num: 3, fecha: "2026-05-26", titulo: "Bienestar Físico",                       ponente: "Nancy Moreno" },
  { num: 4, fecha: "2026-06-02", titulo: "Presencia Consciente",                   ponente: "Pedro Mariscal" },
  { num: 5, fecha: "2026-06-09", titulo: "Bienestar Emocional",                    ponente: "Nancy Moreno" },
  { num: 6, fecha: "2026-06-16", titulo: "Trabajo con Propósito",                  ponente: "José González" },
  { num: 7, fecha: "2026-06-23", titulo: "Estética Existencial",                   ponente: "Mariana Riojas" },
  { num: 8, fecha: "2026-06-30", titulo: "Vínculos Vitales",                       ponente: "Mary Carmen Tena" },
  { num: 9, fecha: "2026-07-07", titulo: "Fe y Filosofía de Vida",                 ponente: "Mateo Villarreal" },
];

const HORA_INICIO = "19:30";
const HORA_FIN    = "21:30";

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sesiones = SESIONES_HW.map((s) => {
    const fecha = new Date(`${s.fecha}T${HORA_INICIO}:00-06:00`); // Mexico time
    const fechaDia = new Date(fecha);
    fechaDia.setHours(0, 0, 0, 0);
    const isPast    = fechaDia < today;
    const isToday   = fechaDia.getTime() === today.getTime();
    return { ...s, fechaDate: fecha, isPast, isToday };
  });

  // Find the next upcoming session for the hero card
  const proxima = sesiones.find((s) => !s.isPast);

  renderShell({
    persona,
    title: "Calendario",
    activePath: "/app/calendario",
    contentHtml: `
      <header class="page-header">
        <span class="page-eyebrow">Tus sesiones programadas</span>
        <h2 class="page-title">Calendario</h2>
        <p class="page-subtitle">
          Las sesiones en vivo del Happiness Workshop. Los martes de
          ${HORA_INICIO} a ${HORA_FIN}, hora de la Ciudad de México.
        </p>
      </header>

      ${proxima ? renderProximaCard(proxima) : ""}

      <section class="cal-list">
        <header class="cal-list__header">
          <h3 class="cal-list__title">Todas las sesiones</h3>
          <span class="cal-list__count">9 sesiones · 9 semanas</span>
        </header>
        <ol class="cal-list__items">
          ${sesiones.map(renderSesionItem).join("")}
        </ol>
      </section>
    `,
  });
})();

function renderProximaCard(s) {
  const dayName = s.fechaDate.toLocaleDateString("es-MX", { weekday: "long" });
  const dayNum  = s.fechaDate.getDate();
  const month   = s.fechaDate.toLocaleDateString("es-MX", { month: "long" });

  const eyebrow = s.isToday ? "Hoy" : "Tu próxima sesión";

  return `
    <section class="proxima-sesion">
      <div class="proxima-sesion__date">
        <span class="proxima-sesion__day-name">${escapeHtml(dayName)}</span>
        <span class="proxima-sesion__day-num">${dayNum}</span>
        <span class="proxima-sesion__month">${escapeHtml(month)}</span>
      </div>
      <div class="proxima-sesion__body">
        <span class="proxima-sesion__eyebrow">${escapeHtml(eyebrow)} · Sesión ${s.num} de 9</span>
        <h3 class="proxima-sesion__title">${escapeHtml(s.titulo)}</h3>
        <p class="proxima-sesion__meta">
          <strong>${HORA_INICIO} – ${HORA_FIN}</strong> · Ponente: ${escapeHtml(s.ponente)}
        </p>
        <div class="proxima-sesion__actions">
          <a class="btn btn-accent btn-sm" href="${calendarUrl(s)}" target="_blank" rel="noopener">
            ${icon("calendario")}
            <span>Añadir al calendario</span>
          </a>
        </div>
      </div>
    </section>
  `;
}

function renderSesionItem(s) {
  const dayName = s.fechaDate.toLocaleDateString("es-MX", { weekday: "short" });
  const dayNum  = s.fechaDate.getDate();
  const month   = s.fechaDate.toLocaleDateString("es-MX", { month: "short" });

  let stateClass = "cal-item--upcoming";
  if (s.isPast)  stateClass = "cal-item--past";
  if (s.isToday) stateClass = "cal-item--today";

  return `
    <li class="cal-item ${stateClass}">
      <div class="cal-item__date">
        <span class="cal-item__day-name">${escapeHtml(dayName)}</span>
        <span class="cal-item__day-num">${dayNum}</span>
        <span class="cal-item__month">${escapeHtml(month)}</span>
      </div>
      <div class="cal-item__body">
        <div class="cal-item__num">Sesión ${s.num} de 9</div>
        <h4 class="cal-item__title">${escapeHtml(s.titulo)}</h4>
        <p class="cal-item__meta">${HORA_INICIO} – ${HORA_FIN} · ${escapeHtml(s.ponente)}</p>
      </div>
      <div class="cal-item__action">
        ${s.isPast
          ? `<span class="cal-item__badge cal-item__badge--past">Concluida</span>`
          : s.isToday
            ? `<span class="cal-item__badge cal-item__badge--today">Hoy</span>`
            : `<a class="cal-item__add" href="${calendarUrl(s)}" target="_blank" rel="noopener" title="Añadir al calendario">${icon("plus")}</a>`}
      </div>
    </li>
  `;
}

/**
 * Build a Google Calendar "add event" URL.
 */
function calendarUrl(s) {
  // Google expects YYYYMMDDTHHMMSS in UTC (or with /Z suffix).
  // Build the dates in CDMX time zone (UTC-6) and emit them in UTC.
  const startMx = new Date(`${s.fecha}T${HORA_INICIO}:00-06:00`);
  const endMx   = new Date(`${s.fecha}T${HORA_FIN}:00-06:00`);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const text  = encodeURIComponent(`Happiness Workshop · ${s.titulo}`);
  const dates = `${fmt(startMx)}/${fmt(endMx)}`;
  const details = encodeURIComponent(`Sesión ${s.num} de 9 · Ponente: ${s.ponente}\n\nHappiness Workshop by SOPHIA`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}`;
}
