// SOPHIA Portal · Supabase client (singleton)
// Carga el SDK desde CDN y exporta una instancia única.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const PORTAL_CONFIG = window.PORTAL_CONFIG || {};

if (!PORTAL_CONFIG.SUPABASE_URL || !PORTAL_CONFIG.SUPABASE_ANON_KEY) {
  console.error(
    '[supabase-client] Falta config. Revisa que /assets/js/config.js esté cargado y exponga ' +
    'window.PORTAL_CONFIG = { SUPABASE_URL, SUPABASE_ANON_KEY }.'
  );
}

export const supabase = createClient(
  PORTAL_CONFIG.SUPABASE_URL || '',
  PORTAL_CONFIG.SUPABASE_ANON_KEY || '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  }
);

window.__sb = supabase; // útil para debug en consola
