// SOPHIA Portal — UI shell renderer (sidebar + header).
// Mounts into <body class="shell">…</body> on authenticated pages.

import { logout, isAdmin } from "./auth.js";

const ICONS = {
  cursos: `<svg class="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M2 6.5A2.5 2.5 0 0 1 4.5 4H10v15.5L8 18l-2 1.5V18l-2 2v-3.5A2.5 2.5 0 0 1 2 14V6.5zM10 4h7.5A2.5 2.5 0 0 1 20 6.5V20a2 2 0 0 1-2 2H10V4z" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  calendario: `<svg class="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="5" width="18" height="16" rx="2" stroke-width="1.5"/><path d="M3 9h18M8 3v4M16 3v4" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  progreso: `<svg class="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 17l6-6 4 4 8-8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 7h7v7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  testFelicidad: `<svg class="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" stroke-width="1.5"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M5.6 18.4L18.4 5.6" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  anuncios: `<svg class="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.7 21a2 2 0 0 1-3.4 0" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  recursos: `<svg class="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-width="1.5" stroke-linejoin="round"/><path d="M14 2v6h6M9 13h6M9 17h6" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  certificados: `<svg class="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="9" r="6" stroke-width="1.5"/><path d="M8.21 13.89L7 22l5-3 5 3-1.21-8.12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  perfil: `<svg class="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="7" r="4" stroke-width="1.5"/></svg>`,
  ayuda: `<svg class="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="1.5"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  admin: `<svg class="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke-width="1.5" stroke-linejoin="round"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  logout: `<svg class="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

const NAV_GROUPS = [
  {
    label: "Aprendizaje",
    links: [
      { href: "/app/cursos", icon: "cursos", label: "Mis cursos" },
      { href: "/app/calendario", icon: "calendario", label: "Calendario" },
      { href: "/app/progreso", icon: "progreso", label: "Mi progreso" },
    ],
  },
  {
    label: "Recursos",
    links: [
      { href: "/app/anuncios", icon: "anuncios", label: "Anuncios" },
      { href: "/app/recursos", icon: "recursos", label: "Biblioteca" },
      { href: "/app/certificados", icon: "certificados", label: "Certificados" },
    ],
  },
  {
    label: "Cuenta",
    links: [
      { href: "/app/perfil", icon: "perfil", label: "Mi perfil" },
      { href: "/app/ayuda", icon: "ayuda", label: "Soporte" },
    ],
  },
];

const ADMIN_GROUP = {
  label: "Administración",
  links: [
    { href: "/app/admin", icon: "admin", label: "Panel admin" },
  ],
};

/**
 * Renders the app shell into <body>. Call after requireAuth resolves.
 *
 * @param {object} opts
 * @param {object} opts.persona — { personaId, rol, nombre, apellidos }
 * @param {string} opts.title — header title
 * @param {string} [opts.activePath] — sidebar active link match (defaults to location.pathname)
 * @param {string} opts.contentHtml — main content HTML
 */
export function renderShell({ persona, title, activePath, contentHtml }) {
  const path = activePath ?? location.pathname;
  const groups = isAdmin(persona)
    ? [...NAV_GROUPS, ADMIN_GROUP]
    : NAV_GROUPS;

  const nameInitials = getInitials(persona);
  const fullName =
    [persona.nombre, persona.apellidos].filter(Boolean).join(" ") || "Alumno";

  document.body.className = "shell";
  document.body.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar__brand">
        <img src="https://static.wixstatic.com/media/6bf1ef_d0efb91350e04315be1fe1a9982e69c8~mv2.png" alt="SOPHIA" class="sidebar__logo">
      </div>
      <nav class="sidebar__nav">
        ${groups.map(g => renderGroup(g, path)).join("")}
      </nav>
      <div class="sidebar__footer">
        <button class="sidebar__user" id="userMenuBtn" type="button">
          <div class="sidebar__avatar">${escapeHtml(nameInitials)}</div>
          <div class="sidebar__user-info">
            <div class="sidebar__user-name">${escapeHtml(fullName)}</div>
            <div class="sidebar__user-role">${escapeHtml(persona.rol || "participante")}</div>
          </div>
        </button>
      </div>
    </aside>
    <header class="app-header">
      <h1 class="app-header__title">${escapeHtml(title)}</h1>
      <div class="app-header__actions">
        <button class="btn btn-ghost" id="logoutBtn" type="button">
          ${ICONS.logout}
          <span>Salir</span>
        </button>
      </div>
    </header>
    <main class="app-main">
      ${contentHtml}
    </main>
  `;

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    if (confirm("¿Cerrar sesión?")) logout();
  });
  document.getElementById("userMenuBtn")?.addEventListener("click", () => {
    location.href = "/app/perfil";
  });
}

function renderGroup(group, currentPath) {
  return `
    <div class="sidebar__group-label">${escapeHtml(group.label)}</div>
    ${group.links.map(l => renderLink(l, currentPath)).join("")}
  `;
}

function renderLink({ href, icon, label }, currentPath) {
  const active = currentPath === href || currentPath.startsWith(href + "/");
  return `
    <a class="sidebar__link ${active ? "is-active" : ""}" href="${href}">
      ${ICONS[icon] || ""}
      <span>${escapeHtml(label)}</span>
    </a>
  `;
}

function getInitials(persona) {
  const a = (persona.nombre || "").trim()[0] || "";
  const b = (persona.apellidos || "").trim()[0] || "";
  return (a + b).toUpperCase() || "S";
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

export { escapeHtml };
