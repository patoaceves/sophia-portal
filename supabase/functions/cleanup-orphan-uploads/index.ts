// SOPHIA Portal · cleanup-orphan-uploads
//
// Borra archivos del bucket sophia-portal-uploads que no estén referenciados
// en la tabla Posts de Airtable (campo Adjunto URL) ni en Personas (Avatar URL).
//
// Diseñado para correr como cron job (ej. GitHub Actions cada 24h).
//
// Endpoint: POST /cleanup-orphan-uploads
// Headers:  Authorization: Bearer <CLEANUP_SECRET>   (no JWT de usuario)
// Body:     { dryRun?: boolean, maxAgeHours?: number }
//
// Response 200:
//   { deleted: string[], skipped: string[], dryRun: boolean }
//
// Secrets requeridos:
//   CLEANUP_SECRET          · token secreto para autenticar el cron job
//   SUPABASE_SERVICE_ROLE_KEY
//   SUPABASE_URL
//   AIRTABLE_PAT

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STORAGE_BUCKET = "sophia-portal-uploads";
const AIRTABLE_API   = "https://api.airtable.com/v0";

const BASES  = { PORTAL: "app0S6GrJQ8YatvCc", CRM: "app1SbOC98k2OP5m1" } as const;
const TABLES = {
  POSTS:    "tblmLVl9ySzTXb2OK",
  PERSONAS: "tbl5XKtg0mRfLeFYH",
} as const;
const FIELDS = {
  POSTS_ADJUNTO_URL:    "fldmMwKgVz0lP3BO8",
  PERSONAS_AVATAR_URL:  "fldVctJnKuTRUGcIn",
} as const;

// ─── helpers ────────────────────────────────────────────────────────────────

function getPAT(): string {
  const p = Deno.env.get("AIRTABLE_PAT");
  if (!p) throw new Error("AIRTABLE_PAT not configured");
  return p;
}

async function fetchAllFieldValues(
  baseId: string,
  tableId: string,
  fieldId: string,
): Promise<string[]> {
  const pat    = getPAT();
  const values: string[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(`${AIRTABLE_API}/${baseId}/${tableId}`);
    url.searchParams.set("fields[]", fieldId);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const res  = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${pat}` },
    });
    if (!res.ok) throw new Error(`Airtable error ${res.status}`);
    const json = await res.json() as { records: { fields: Record<string, unknown> }[]; offset?: string };

    for (const rec of json.records) {
      const v = rec.fields[fieldId];
      if (typeof v === "string" && v.includes("supabase.co/storage")) {
        values.push(v);
      }
    }
    offset = json.offset;
  } while (offset);

  return values;
}

function urlToStoragePath(publicUrl: string): string | null {
  try {
    const u    = new URL(publicUrl);
    const prefix = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    if (!u.pathname.startsWith(prefix)) return null;
    return u.pathname.slice(prefix.length);
  } catch {
    return null;
  }
}

// ─── main ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  // Auth: secret token (no JWT de usuario)
  const secret = Deno.env.get("CLEANUP_SECRET");
  if (!secret) {
    return new Response(JSON.stringify({ error: "CLEANUP_SECRET not configured" }), { status: 500 });
  }
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let body: { dryRun?: boolean; maxAgeHours?: number } = {};
  try { body = await req.json(); } catch { /* no body */ }
  const dryRun      = body.dryRun ?? false;
  const maxAgeHours = body.maxAgeHours ?? 6;

  const supabaseUrl            = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    // 1. Recopilar todas las URLs referenciadas en Airtable
    const [postUrls, avatarUrls] = await Promise.all([
      fetchAllFieldValues(BASES.PORTAL, TABLES.POSTS,    FIELDS.POSTS_ADJUNTO_URL),
      fetchAllFieldValues(BASES.CRM,    TABLES.PERSONAS, FIELDS.PERSONAS_AVATAR_URL),
    ]);

    const referencedPaths = new Set<string>();
    for (const url of [...postUrls, ...avatarUrls]) {
      const path = urlToStoragePath(url);
      if (path) referencedPaths.add(path);
    }

    // 2. Listar archivos en el bucket
    const prefixes = ["avatars/", "foro/"];
    const allFiles: { name: string; created_at?: string }[] = [];

    for (const prefix of prefixes) {
      const { data, error } = await sb.storage
        .from(STORAGE_BUCKET)
        .list(prefix.slice(0, -1), { limit: 1000, sortBy: { column: "created_at", order: "asc" } });
      if (error) throw new Error(`Storage list error: ${error.message}`);

      // Para avatares y foro, los archivos están en sub-carpetas
      for (const item of data ?? []) {
        if (item.name.endsWith("/") || !item.name) continue;
        // list() devuelve nombres dentro del prefix, reconstruir path completo
        allFiles.push({ name: `${prefix}${item.name}`, created_at: (item as any).created_at });
      }
    }

    // 3. Filtrar: solo borrar archivos más viejos que maxAgeHours y no referenciados
    const cutoff    = Date.now() - maxAgeHours * 60 * 60 * 1000;
    const toDelete: string[] = [];
    const skipped:  string[] = [];

    for (const file of allFiles) {
      const createdMs = file.created_at ? new Date(file.created_at).getTime() : 0;
      const isOldEnough = createdMs > 0 && createdMs < cutoff;
      if (!referencedPaths.has(file.name) && isOldEnough) {
        toDelete.push(file.name);
      } else {
        skipped.push(file.name);
      }
    }

    // 4. Borrar (si no es dry run)
    if (!dryRun && toDelete.length > 0) {
      const { error } = await sb.storage.from(STORAGE_BUCKET).remove(toDelete);
      if (error) throw new Error(`Storage delete error: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ deleted: toDelete, skipped, dryRun, total: allFiles.length }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
