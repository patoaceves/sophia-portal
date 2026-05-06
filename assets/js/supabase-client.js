// SOPHIA Portal — Supabase client singleton
// Uses the publishable key (new Supabase auth format, replaces anon key).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const SUPABASE_URL = "https://ajvjyisplqsrjsessayo.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_S_Jb79kSSmjLvGNIP2J7kA_uMiJrSvx";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});
