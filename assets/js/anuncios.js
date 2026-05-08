// SOPHIA Portal · Anuncios
//
// Lista de mensajes del instructor / coordinación del programa al alumno.
// Por ahora muestra anuncios mockeados; el siguiente paso (cuando estés
// listo) es agregar una tabla "Anuncios" en Airtable con campos:
//   - Título, Cuerpo (HTML), Fecha publicación, Curso (FK), Audiencia
//     (todos / curso específico), Importante (bool), Adjuntos
// y un endpoint Supabase get-anuncios que filtre por las inscripciones
// del alumno.

import { requireAuth } from "./auth.js";
import { renderShell, escapeHtml } from "./ui-shell.js";
import { icon } from "./icons.js";

// Mock data · replace with Airtable fetch when the table is created.
const ANUNCIOS_MOCK = [
  {
    id: "anu-001",
    fecha: "2026-05-07",
    curso: "Happiness Workshop",
    titulo: "¡Bienvenida al Happiness Workshop!",
    cuerpo: "Nos da mucho gusto que formes parte de la primera generación. Antes del martes 12 te recomendamos completar la lectura del Capítulo 1 (Bienvenida + Claustro + Nota técnica) y tomar el Test de Felicidad. Cualquier duda, responde este anuncio o escríbeme directamente.",
    autor: "Natalia Arriaga",
    importante: true,
  },
  {
    id: "anu-002",
    fecha: "2026-05-05",
    curso: "Happiness Workshop",
    titulo: "Calendario y horario confirmado",
    cuerpo: "Las 9 sesiones se llevarán a cabo los martes de 7:30 P.M. a 9:30 P.M., del 12 de mayo al 7 de julio de 2026. Te recomendamos bloquear estos horarios en tu calendario desde ahora.",
    autor: "Coordinación SOPHIA",
    importante: false,
  },
];

(async () => {
  const persona = await requireAuth();
  if (!persona) return;

  renderShell({
    persona,
    title: "Anuncios",
    activePath: "/app/anuncios",
    contentHtml: renderAnuncios(ANUNCIOS_MOCK),
  });
})();

function renderAnuncios(anuncios) {
  return `
    <header class="page-header">
      <span class="page-eyebrow">Mensajes del programa</span>
      <h2 class="page-title">Anuncios</h2>
      <p class="page-subtitle">
        Comunicaciones de Natalia y del equipo SOPHIA sobre el desarrollo
        del Happiness Workshop. Los anuncios marcados como importantes
        aparecen primero.
      </p>
    </header>

    ${anuncios.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state__title">Sin anuncios por ahora</div>
        <p class="empty-state__desc">Cuando haya novedades del programa las verás aquí.</p>
      </div>
    ` : `
      <ol class="anuncios-list">
        ${[...anuncios].sort(sortAnuncios).map(renderAnuncio).join("")}
      </ol>

      <div class="anuncios-info">
        <p>
          <strong>¿Cómo funciona?</strong> Aquí ves los anuncios del programa
          que estás cursando. Pronto podrás responder al autor desde la misma
          plataforma; por ahora, contáctalos por correo si tienes dudas.
        </p>
      </div>
    `}
  `;
}

function sortAnuncios(a, b) {
  // Importantes arriba, después por fecha desc
  if (a.importante !== b.importante) return a.importante ? -1 : 1;
  return b.fecha.localeCompare(a.fecha);
}

function renderAnuncio(a) {
  const fecha = new Date(`${a.fecha}T12:00:00Z`).toLocaleDateString("es-MX", {
    day: "numeric", month: "long", year: "numeric",
  });

  return `
    <li class="anuncio ${a.importante ? "anuncio--importante" : ""}">
      <header class="anuncio__header">
        <div>
          <span class="anuncio__curso">${escapeHtml(a.curso)}</span>
          <h3 class="anuncio__title">${escapeHtml(a.titulo)}</h3>
        </div>
        <div class="anuncio__header-meta">
          ${a.importante ? `<span class="anuncio__badge">Importante</span>` : ""}
          <time class="anuncio__fecha">${escapeHtml(fecha)}</time>
        </div>
      </header>
      <div class="anuncio__cuerpo">
        <p>${escapeHtml(a.cuerpo)}</p>
      </div>
      <footer class="anuncio__footer">
        ${icon("instructor")}
        <span>${escapeHtml(a.autor)}</span>
      </footer>
    </li>
  `;
}
