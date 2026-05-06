// SOPHIA Portal · public client config
//
// La anon key de Supabase está DISEÑADA para ser pública: la seguridad
// real vive en Row Level Security (RLS) de la base de datos, no en
// ocultar la key. Por eso la commiteamos junto al código — exactamente
// como Supabase recomienda en su doc oficial.
//
// → Settings → API en el dashboard de Supabase.
// → "Project URL" y "anon / public" key.
//
// La service_role key (NO la pongas aquí) sí es secreta — esa solo
// vive en los Supabase Secrets de las Edge Functions.

window.PORTAL_CONFIG = {
  SUPABASE_URL: 'https://ajvjyisplqsrjsessayo.supabase.co',

  // Anon key — pública por diseño (la seguridad real vive en RLS).
  // Si la rotas en Supabase, también actualízala aquí y haz redeploy.
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqdmp5aXNwbHFzcmpzZXNzYXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMTA2NDIsImV4cCI6MjA5MzU4NjY0Mn0.Q9nnRffenm78Qil6Q2Tu3kpTI4m3JolW2S8iM6PMlfA',

  // Base URL de las Edge Functions
  EDGE_FUNCTIONS_URL: 'https://ajvjyisplqsrjsessayo.supabase.co/functions/v1'
};
