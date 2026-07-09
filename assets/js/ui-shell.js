// SOPHIA Portal · UI shell renderer (sidebar + header).
// Mounts into <body class="shell">…</body> on authenticated pages.

import { logout, isAdmin } from "./auth.js";
import { ICONS, icon } from "./icons.js";
import { api } from "./api.js";

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
    ],
  },
  {
    label: "Recursos",
    links: [
      { href: "/app/anuncios", icon: "anuncios", label: "Anuncios" },
      { href: "/app/recursos", icon: "biblioteca", label: "Biblioteca" },
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
 * If a static shell skeleton already exists (mounted by shell-skeleton.js
 * before bootstrap), this function only updates the dynamic parts:
 *   - sidebar user (avatar + name + role)
 *   - active sidebar link
 *   - header title
 *   - main content
 * The sidebar layout never disappears between page navigations, so
 * the user perceives a smooth transition rather than a flash.
 *
 * @param {object} opts
 * @param {object} opts.persona, { personaId, rol, nombre, apellidos }
 * @param {string} opts.title · header title
 * @param {string} [opts.activePath] · sidebar active link match (defaults to location.pathname)
 * @param {string} opts.contentHtml · main content HTML
 */
export function renderShell({ persona, title, activePath, contentHtml }) {
  const path = activePath ?? location.pathname;
  const groups = isAdmin(persona)
    ? [...NAV_GROUPS, ADMIN_GROUP]
    : NAV_GROUPS;

  const nameInitials = getInitials(persona);
  const fullName =
    [persona.nombre, persona.apellidos].filter(Boolean).join(" ") || "Alumno";
  const avatarUrl = (persona.avatarUrl || "").trim();
  const avatarHtml = avatarUrl
    ? `<div class="sidebar__avatar sidebar__avatar--photo"><img src="${escapeHtml(avatarUrl)}" alt="" referrerpolicy="no-referrer"></div>`
    : `<div class="sidebar__avatar">${escapeHtml(nameInitials)}</div>`;

  // Detect if the static skeleton is in place (set by shell-skeleton.js).
  const hasSkeleton = document.body.classList.contains("shell--skeleton");

  if (hasSkeleton) {
    // FAST PATH: only update what changed. Sidebar stays mounted.
    document.body.classList.remove("shell--skeleton");

    // 1. Update user info in sidebar footer
    const userBtn = document.getElementById("userMenuBtn");
    if (userBtn) {
      userBtn.disabled = false;
      userBtn.innerHTML = `
        ${avatarHtml}
        <div class="sidebar__user-info">
          <div class="sidebar__user-name">${escapeHtml(fullName)}</div>
          <div class="sidebar__user-role">${escapeHtml(persona.rol || "participante")}</div>
        </div>
      `;
    }

    // 2. Mark active sidebar link
    document.querySelectorAll(".sidebar__link").forEach((a) => {
      const href = a.getAttribute("href");
      const active = path === href || path.startsWith(href + "/");
      a.classList.toggle("is-active", active);
    });

    // 3. If admin, ensure the admin nav group is rendered (skeleton doesn't include it)
    if (isAdmin(persona) && !document.querySelector('.sidebar__link[href="/app/admin"]')) {
      const navEl = document.querySelector(".sidebar__nav");
      if (navEl) {
        navEl.insertAdjacentHTML("beforeend", renderGroup(ADMIN_GROUP, path));
      }
    }

    // 4. Update header title
    const titleEl = document.querySelector(".app-header__title");
    if (titleEl) titleEl.textContent = title;

    // 5. Replace main content
    const mainEl = document.querySelector(".app-main");
    if (mainEl) mainEl.innerHTML = contentHtml;
  } else {
    // FALLBACK: full mount (used when navigating to a page that doesn't
    // include shell-skeleton.js, or in tests).
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
            ${avatarHtml}
            <div class="sidebar__user-info">
              <div class="sidebar__user-name">${escapeHtml(fullName)}</div>
              <div class="sidebar__user-role">${escapeHtml(persona.rol || "participante")}</div>
            </div>
          </button>
          <button class="sidebar__logout-mobile" id="logoutBtnMobile" type="button">
            ${sidebarIcon("logout")}
            <span>Salir</span>
          </button>
        </div>
      </aside>
      <header class="app-header">
        <button class="app-header__hamburger" id="hamburgerBtn" type="button" aria-label="Abrir menú">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <h1 class="app-header__title">${escapeHtml(title)}</h1>
        <div class="app-header__actions">
          <button class="btn btn-ghost app-header__logout-desktop" id="logoutBtn" type="button">
            ${sidebarIcon("logout")}
            <span>Salir</span>
          </button>
        </div>
      </header>
      <div class="sidebar-backdrop" id="sidebarBackdrop" aria-hidden="true"></div>
      <main class="app-main">
        ${contentHtml}
      </main>
    `;
  }

  // Wire events (re-bound on every renderShell call regardless of path)
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    if (confirm("¿Cerrar sesión?")) logout();
  });
  document.getElementById("logoutBtnMobile")?.addEventListener("click", () => {
    if (confirm("¿Cerrar sesión?")) logout();
  });
  document.getElementById("userMenuBtn")?.addEventListener("click", () => {
    location.href = "/app/perfil";
  });

  wireCursosTree();

  // Hamburguesa móvil: toggle del sidebar como drawer + backdrop
  const hamburger = document.getElementById("hamburgerBtn");
  const sidebar = document.querySelector(".sidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  function openDrawer() {
    sidebar?.classList.add("is-open");
    backdrop?.classList.add("is-visible");
    document.body.classList.add("sidebar-open");
  }
  function closeDrawer() {
    sidebar?.classList.remove("is-open");
    backdrop?.classList.remove("is-visible");
    document.body.classList.remove("sidebar-open");
  }
  hamburger?.addEventListener("click", openDrawer);
  backdrop?.addEventListener("click", closeDrawer);
  // Cerrar drawer al clickear cualquier link del sidebar (excepto el user btn)
  sidebar?.querySelectorAll(".sidebar__link").forEach((a) =>
    a.addEventListener("click", closeDrawer),
  );

  // Fade out el splash overlay (si existe). Garantizamos un mínimo de
  // ~400ms visible para evitar el "blink" cuando el bootstrap es muy
  // rápido (cache hit típicamente <100ms).
  const splash = document.getElementById("appSplash");
  if (splash) {
    const MIN_DISPLAY_MS = 400;
    const FADE_MS = 350;
    const started = window.__sophiaSplashStart || Date.now();
    const elapsed = Date.now() - started;
    const delay = Math.max(0, MIN_DISPLAY_MS - elapsed);
    setTimeout(() => {
      splash.classList.add("is-fading");
      setTimeout(() => { splash.remove(); }, FADE_MS + 50);
    }, delay);
  }
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

// ─── Árbol de cursos → temario en el sidebar (bajo "Mis cursos") ───
// Aditivo y tolerante a fallos: si algo truena, el link normal de
// "Mis cursos" sigue funcionando. Carga perezosa (lazy) en cada expand.
function wireCursosTree() {
  const link = document.querySelector('.sidebar__link[href="/app/cursos"]');
  if (!link || link.dataset.treeWired) return;
  link.dataset.treeWired = "1";

  const caret = document.createElement("button");
  caret.type = "button";
  caret.className = "sidebar__tree-caret";
  caret.setAttribute("aria-label", "Mostrar mis cursos");
  caret.innerHTML = icon("chevronRight");
  link.appendChild(caret);

  const tree = document.createElement("div");
  tree.className = "sidebar__tree";
  link.insertAdjacentElement("afterend", tree);

  let loaded = false;
  caret.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const open = tree.classList.toggle("is-open");
    caret.classList.toggle("is-open", open);
    if (open && !loaded) {
      loaded = true;
      loadCursosTree(tree);
    }
  });

  // Auto-abrir cuando estamos dentro de un curso específico
  if (location.pathname === "/app/curso" && new URLSearchParams(location.search).get("slug")) {
    caret.click();
  }
}

async function loadCursosTree(tree) {
  tree.innerHTML = `<div class="sidebar__tree-msg">Cargando…</div>`;
  try {
    const data = await api.misCursos();
    const cursos = data?.cursos || [];
    if (!cursos.length) {
      tree.innerHTML = `<div class="sidebar__tree-msg">Sin cursos activos</div>`;
      return;
    }
    tree.innerHTML = cursos.map(cursoNodeHtml).join("");
    tree.querySelectorAll(".sidebar__course").forEach(wireCourseNode);
  } catch (e) {
    console.warn("[sidebar] cursos:", e);
    tree.innerHTML = `<div class="sidebar__tree-msg">No se pudieron cargar</div>`;
  }
}

function cursoNodeHtml(c) {
  const slug = c.slug || c.id;
  return `
    <div class="sidebar__course" data-slug="${escapeHtml(slug)}">
      <button class="sidebar__course-btn" type="button">
        <span class="sidebar__course-caret">${icon("chevronRight")}</span>
        <span class="sidebar__course-name">${escapeHtml(c.titulo || slug)}</span>
      </button>
      <div class="sidebar__modules"></div>
    </div>`;
}

function wireCourseNode(node) {
  const btn = node.querySelector(".sidebar__course-btn");
  const caret = node.querySelector(".sidebar__course-caret");
  const box = node.querySelector(".sidebar__modules");
  const slug = node.dataset.slug;
  let loaded = false;
  btn.addEventListener("click", () => {
    const open = box.classList.toggle("is-open");
    caret.classList.toggle("is-open", open);
    if (open && !loaded) {
      loaded = true;
      loadModulesTree(box, slug);
    }
  });
  // Auto-abrir el curso actual (si su slug está en la URL)
  const cur = new URLSearchParams(location.search).get("slug");
  if (cur && cur === slug) btn.click();
}

async function loadModulesTree(box, slug) {
  box.innerHTML = `<div class="sidebar__tree-msg">Cargando…</div>`;
  try {
    const data = await api.curso(slug);
    const modulos = data?.modulos || [];
    if (!modulos.length) {
      box.innerHTML = `<div class="sidebar__tree-msg">Sin módulos</div>`;
      return;
    }
    box.innerHTML = modulos.map((m) => `
      <a class="sidebar__module-link" title="${escapeHtml(m.titulo || "")}"
         href="/app/curso?slug=${encodeURIComponent(slug)}&tab=temario#modulo-${encodeURIComponent(m.id)}">
        <span class="sidebar__module-num">${escapeHtml(String(m.orden))}</span>
        <span class="sidebar__module-name">${escapeHtml(m.titulo || "")}</span>
      </a>`).join("");
  } catch (e) {
    console.warn("[sidebar] modulos:", e);
    box.innerHTML = `<div class="sidebar__tree-msg">No se pudieron cargar</div>`;
  }
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

/**
 * Live-update del avatar del sidebar sin re-renderear todo el shell.
 * Útil después de subir/quitar la foto en /app/perfil o /app/bienvenida.
 *
 * @param {string} url · URL nueva, vacía para volver a iniciales
 * @param {{nombre?: string, apellidos?: string}} [persona] · para iniciales fallback
 */
export function updateSidebarAvatar(url, persona) {
  const wrap = document.querySelector(".sidebar__user .sidebar__avatar")
    || document.querySelector(".sidebar__avatar");
  if (!wrap) return;

  const cleanUrl = (url || "").trim();
  if (cleanUrl) {
    wrap.classList.add("sidebar__avatar--photo");
    wrap.innerHTML = `<img src="${escapeHtml(cleanUrl)}" alt="" referrerpolicy="no-referrer">`;
  } else {
    wrap.classList.remove("sidebar__avatar--photo");
    const a = (persona?.nombre || "").trim()[0] || "";
    const b = (persona?.apellidos || "").trim()[0] || "";
    const initials = (a + b).toUpperCase() || "S";
    wrap.innerHTML = escapeHtml(initials);
  }
}
