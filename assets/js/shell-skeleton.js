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

  // Inline-SVG icons matching the ones in icons.js (kept tiny + sync).
  const ICONS = {
    cursos:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    calendario:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    progreso:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>',
    anuncios:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
    recursos:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
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

  // Loader content (matches loader.js output but inline + sync)
  const LOADER_MESSAGES = {
    generic:   ["Cargando", "Un momento"],
    portal:    ["Cargando tu progreso", "Preparando tus cursos", "Casi listo"],
    curso:     ["Cargando el curso", "Buscando tus avances"],
    leccion:   ["Cargando la lección", "Preparando el contenido"],
    test:      ["Preparando el test", "Cargando preguntas"],
    resultados:["Cargando tus resultados", "Construyendo tu rueda"],
    progreso:  ["Cargando tu progreso", "Sumando tus avances"],
    calendario:["Cargando tu calendario", "Buscando próximas sesiones"],
  };
  const msgs = LOADER_MESSAGES[loaderContext] || LOADER_MESSAGES.generic;

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
      </div>
    </aside>
    <header class="app-header">
      <h1 class="app-header__title">${initialTitle}</h1>
      <div class="app-header__actions">
        <button class="btn btn-ghost" id="logoutBtn" type="button">
          <span class="sidebar__icon">${ICONS.logout}</span>
          <span>Salir</span>
        </button>
      </div>
    </header>
    <main class="app-main">
      <div class="page-loader" data-context="${loaderContext}">
        <div class="page-loader__inner">
          <div class="spinner" role="status" aria-live="polite"></div>
          <div class="page-loader__text">
            <span class="page-loader__msg" id="bootMsg">${msgs[0]}</span><span class="page-loader__dots"><span>.</span><span>.</span><span>.</span></span>
          </div>
        </div>
      </div>
    </main>
  `;

  // Rotate loader messages until the bootstrap script replaces the loader.
  let i = 0;
  const el = document.getElementById("bootMsg");
  const iv = setInterval(function () {
    if (!el || !document.body.contains(el)) { clearInterval(iv); return; }
    i = (i + 1) % msgs.length;
    el.style.transition = "opacity 0.22s ease";
    el.style.opacity = "0";
    setTimeout(function () { if (el) { el.textContent = msgs[i]; el.style.opacity = "1"; } }, 220);
  }, 2200);
})();
