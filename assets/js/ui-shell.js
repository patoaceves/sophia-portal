// SOPHIA Portal · UI Shell
// Carga sidebar/header partials e inyecta estado del usuario.
import { supabase } from './supabase-client.js';
import { signOut } from './auth.js';

export async function mountShell() {
  // Cargar sidebar partial
  const sidebarHost = document.getElementById('sidebar-mount');
  if (sidebarHost) {
    const html = await fetch('/partials/sidebar.html').then(r => r.text());
    sidebarHost.innerHTML = html;

    // Marcar item activo según pathname
    const path = window.location.pathname;
    sidebarHost.querySelectorAll('.sidebar-nav a').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (path === href || (href !== '/app' && path.startsWith(href))) {
        a.classList.add('is-active');
      }
    });

    // Llenar datos del usuario
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const u = session.user;
      const name = u.user_metadata?.full_name || u.user_metadata?.name || u.email.split('@')[0];
      const email = u.email;
      const initial = (name || email).charAt(0).toUpperCase();

      const $name = sidebarHost.querySelector('[data-user-name]');
      const $email = sidebarHost.querySelector('[data-user-email]');
      const $avatar = sidebarHost.querySelector('[data-user-avatar]');
      if ($name) $name.textContent = name;
      if ($email) $email.textContent = email;
      if ($avatar) $avatar.textContent = initial;
    }

    // Botón de logout
    const $signout = sidebarHost.querySelector('[data-signout]');
    if ($signout) $signout.addEventListener('click', signOut);
  }
}
