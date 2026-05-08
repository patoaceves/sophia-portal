// SOPHIA Portal — UI shell renderer (sidebar + header).
// Mounts into <body class="shell">…</body> on authenticated pages.

import { logout, isAdmin } from "./auth.js";
import { ICONS, icon } from "./icons.js";

// Helper: wrap an icon in the sidebar size
function sidebarIcon(name) {
  return `<span class="sidebar__icon">${icon(name)}</span>`;
}

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
        <img src="/assets/img/brand/logo-horizontal-rojo.png" alt="SOPHIA" class="sidebar__logo">
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
          ${sidebarIcon("logout")}
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

function renderLink({ href, icon: iconName, label }, currentPath) {
  const active = currentPath === href || currentPath.startsWith(href + "/");
  return `
    <a class="sidebar__link ${active ? "is-active" : ""}" href="${href}">
      ${sidebarIcon(iconName)}
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

export { escapeHtml, ICONS, icon };
