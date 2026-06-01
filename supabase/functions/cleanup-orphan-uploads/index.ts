// SOPHIA Portal · cleanup-orphan-uploads (Postgres)
//
// Borra archivos del bucket sophia-portal-uploads que no estén referenciados
// en ninguna tabla:
//   - personas.avatar_url
//   - posts.adjunto_url
//   - entregas_tarea.archivos[].url (jsonb array)
//
// Diseñado para correr como cron job (GitHub Actions cada 24h).
//
// POST /cleanup-orphan-uploads
// Headers: Authorization: Bearer <CLEANUP_SECRET>   (no JWT)
// Body: { dryRun?: boolean, maxAgeHours?: number }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STORAGE_BUCKET = "sophia-portal-uploads";

function urlToStoragePath(publicUrl: string): string | null {
  try {
    const u = new URL(publicUrl);
    const prefix = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    if (!u.pathname.startsWith(prefix)) return null;
    return decodeURIComponent(u.pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  // Auth: secret token (no JWT)
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
  const dryRun = body.dryRun ?? false;
  const maxAgeHours = body.maxAgeHours ?? 6;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    // 1) Recopilar URLs referenciadas en Postgres
    const referencedPaths = new Set<string>();

    const { data: personas } = await sb.from("personas").select("avatar_url").not("avatar_url", "is", null);
    for (const p of personas ?? []) {
      const path = urlToStoragePath(p.avatar_url as string);
      if (path) referencedPaths.add(path);
    }

    const { data: posts } = await sb.from("posts").select("adjunto_url").not("adjunto_url", "is", null);
    for (const p of posts ?? []) {
      const path = urlToStoragePath(p.adjunto_url as string);
      if (path) referencedPaths.add(path);
    }

    const { data: entregas } = await sb.from("entregas_tarea").select("archivos");
    for (const e of entregas ?? []) {
      const archivos = Array.isArray(e.archivos) ? e.archivos : [];
      for (const a of archivos) {
        if (a && typeof a.url === "string") {
          const path = urlToStoragePath(a.url);
          if (path) referencedPaths.add(path);
        }
      }
    }

    // 2) Listar archivos en el bucket (avatars/ + foro/ + tareas/)
    const prefixes = ["avatars", "foro", "tareas"];
    const allFiles: { path: string; created_at?: string }[] = [];

    async function listRecursive(prefix: string, depth = 0) {
      if (depth > 4) return;
      const { data, error } = await sb.storage.from(STORAGE_BUCKET)
        .list(prefix, { limit: 1000, sortBy: { column: "created_at", order: "asc" } });
      if (error) {
        console.warn(`list error at ${prefix}:`, error.message);
        return;
      }
      for (const item of data ?? []) {
        if (!item.name) continue;
        const isFolder = !item.id; // Supabase folder items have id=null
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        if (isFolder) {
          await listRecursive(fullPath, depth + 1);
        } else {
          allFiles.push({ path: fullPath, created_at: (item as any).created_at });
        }
      }
    }
    for (const p of prefixes) await listRecursive(p);

    // 3) Filtrar: solo borrar archivos más viejos que maxAgeHours y no referenciados
    const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
    const toDelete: string[] = [];
    const skipped: string[] = [];

    for (const file of allFiles) {
      const createdMs = file.created_at ? new Date(file.created_at).getTime() : 0;
      const isOldEnough = createdMs > 0 && createdMs < cutoff;
      if (!referencedPaths.has(file.path) && isOldEnough) {
        toDelete.push(file.path);
      } else {
        skipped.push(file.path);
      }
    }

    // 4) Borrar (si no es dry run)
    if (!dryRun && toDelete.length > 0) {
      // Batch de 100 paths por request
      for (let i = 0; i < toDelete.length; i += 100) {
        const batch = toDelete.slice(i, i + 100);
        const { error } = await sb.storage.from(STORAGE_BUCKET).remove(batch);
        if (error) throw new Error(`Storage delete error: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        deleted: toDelete, skipped: skipped.length, total: allFiles.length,
        referencedPaths: referencedPaths.size, dryRun,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
