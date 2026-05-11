// SOPHIA Portal · shell skeleton (sync, runs immediately).
//
// Mounts the sidebar + header + main scaffolding into <body> the moment
// the script tag is parsed. This means the user sees the sidebar from
// the very first paint, even before any module loads or authentication
// completes. The page-specific scripts then call renderShell() which
// only replaces the dynamic parts (user info, active link, header
// title, main content) · the sidebar layout never disappears.
//
// IMPORTANT: this runs before authentication so it shows generic data
// (no user name, no avatar). Those are populated later by renderShell.
//
// Loader text and rotation messages can be customized via data-attrs on
// the script tag:
//   <script src="/assets/js/shell-skeleton.js"
//           data-title="Mis cursos"
//           data-loader-context="portal"
//           data-active="/app/cursos"></script>

(function () {
  // Allow customization via data-attrs on the script tag itself.
  const me = document.currentScript;
  const initialTitle = me?.dataset?.title || "";
  const initialActive = me?.dataset?.active || "";
  const loaderContext = me?.dataset?.loaderContext || "generic";

  // ════════════════════════════════════════════════════════════════════
  // PRE-CHECK DE SESIÓN
  // Antes de renderizar NADA del shell, verificamos sincrónicamente que
  // exista un token de Supabase en localStorage. Si no hay token, redirigir
  // a / inmediatamente — evita el "flash" de dashboard cuando un usuario
  // sin sesión navega directo a /app/* (ej: link bookmarkeado, refresh
  // después de logout, JWT borrado por el browser).
  //
  // Si hay token pero está stale (JWT invalidado server-side), el flow
  // normal de bootstrap detectará el 401 y redirigirá con auth.js
  // showFatalError → location.replace("/?session_expired=1"). El splash
  // overlay (ver abajo) sigue tapando la UI durante ese redirect, así que
  // tampoco hay flash del dashboard.
  try {
    const SUPABASE_PROJECT_REF = "ajvjyisplqsrjsessayo";
    const tokenKey = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
    const tokenRaw = localStorage.getItem(tokenKey);
    if (!tokenRaw) {
      // Guardar destino para volver después del login
      try {
        sessionStorage.setItem("sophia_post_login_redirect", location.pathname + location.search);
      } catch {}
      location.replace("/");
      return;
    }
  } catch { /* localStorage bloqueado → seguir, el bootstrap manejará */ }

  // Pre-flight: si ya tenemos cacheada una Persona y le falta perfilCompletado,
  // redirige a /app/bienvenida ANTES de pintar el shell. Evita el flash de
  // "mis cursos" que el usuario veía cuando todavía debía completar el onboarding.
  // Si no hay cache, dejamos que requireAuth() en la página específica maneje
  // el redirect tras el bootstrap.
  try {
    if (!location.pathname.startsWith("/app/bienvenida")) {
      const cached = JSON.parse(sessionStorage.getItem("sophia_persona") || "null");
      const persona = cached?.persona || cached; // soporta ambos formatos (con wrapper ts y sin él)
      if (persona && persona.personaId && persona.perfilCompletado === false) {
        location.replace("/app/bienvenida");
        return;
      }
    }
  } catch (e) { /* corrupt cache → proceed normally */ }

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

  // Inline-SVG icons matching the ones in icons.js (kept tiny + sync).
  const ICONS = {
    cursos:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 12v5c3.33 2 8.67 2 12 0v-5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    calendario:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    progreso:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>',
    anuncios:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
    recursos:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9.5 2A6.5 6.5 0 0 1 16 8.5c0 2.06-.96 3.9-2.46 5.1l.46 2.4H10l.46-2.4A6.5 6.5 0 0 1 9.5 2z" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 16h4M9 20h6M12 20v2" stroke-linecap="round"/></svg>',
    biblioteca:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 6h7M9 10h7"/></svg>',
    certificados:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.5 13.5L17 22l-5-3-5 3 1.5-8.5"/></svg>',
    perfil:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    ayuda:         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    logout:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  };

  function renderLink(l) {
    const isActive = l.href === initialActive;
    return `
      <a class="sidebar__link ${isActive ? "is-active" : ""}" href="${l.href}">
        <span class="sidebar__icon">${ICONS[l.icon] || ""}</span>
        <span>${l.label}</span>
      </a>
    `;
  }

  function renderGroup(g) {
    return `
      <div class="sidebar__group-label">${g.label}</div>
      ${g.links.map(renderLink).join("")}
    `;
  }

  document.body.className = "shell shell--skeleton";
  document.body.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar__brand">
        <img src="/assets/img/brand/logo-horizontal-rojo.png" alt="SOPHIA" class="sidebar__logo">
      </div>
      <nav class="sidebar__nav">
        ${NAV_GROUPS.map(renderGroup).join("")}
      </nav>
      <div class="sidebar__footer">
        <button class="sidebar__user" id="userMenuBtn" type="button" disabled>
          <div class="sidebar__avatar sidebar__avatar--placeholder"></div>
          <div class="sidebar__user-info">
            <div class="sidebar__user-name sidebar__user-name--placeholder"></div>
            <div class="sidebar__user-role sidebar__user-role--placeholder"></div>
          </div>
        </button>
        <button class="sidebar__logout-mobile" id="logoutBtnMobile" type="button">
          ${ICONS.logout}
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
      <h1 class="app-header__title">${initialTitle}</h1>
      <div class="app-header__actions">
        <button class="btn btn-ghost app-header__logout-desktop" id="logoutBtn" type="button">
          <span class="sidebar__icon">${ICONS.logout}</span>
          <span>Salir</span>
        </button>
      </div>
    </header>
    <div class="sidebar-backdrop" id="sidebarBackdrop" aria-hidden="true"></div>
    <main class="app-main"></main>
    <div class="app-splash" id="appSplash" aria-hidden="true">
      <div class="app-splash__inner">
        <img src="/assets/img/brand/logo-vertical-rojo.png" alt="SOPHIA" class="app-splash__logo">
        <div class="app-splash__spinner" aria-hidden="true"></div>
      </div>
    </div>
  `;

  // Marca el tiempo de aparición del splash. renderShell() lo respetará
  // para garantizar un mínimo de ~400ms visible antes del fade-out, evitando
  // el glitch de "aparece y desaparece" cuando el bootstrap es muy rápido
  // (caso típico: cache hit).
  try { window.__sophiaSplashStart = Date.now(); } catch {}
})();
