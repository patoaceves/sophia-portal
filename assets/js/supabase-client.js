// SOPHIA Portal · Supabase client singleton
//
// La anon key es PÚBLICA por diseño (la seguridad real vive en RLS de
// la base de datos). Por eso se hardcodea aquí y se commitea · exactamente
// como recomienda la doc oficial de Supabase para sitios estáticos.
//
// La service_role key (NUNCA aquí) sí es secreta · vive en Supabase Secrets
// de las Edge Functions.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const SUPABASE_URL = "https://ajvjyisplqsrjsessayo.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqdmp5aXNwbHFzcmpzZXNzYXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMTA2NDIsImV4cCI6MjA5MzU4NjY0Mn0.Q9nnRffenm78Qil6Q2Tu3kpTI4m3JolW2S8iM6PMlfA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});

