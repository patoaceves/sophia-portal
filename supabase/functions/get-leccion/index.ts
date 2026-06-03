// ════════════════════════════════════════════════════════════════════
// SHARED HELPERS (inlined for dashboard deploy)
// Mantener sincronizado con _shared/ si en algún momento se usa CLI deploy.
// ════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ── ApiError + CORS + responses ─────────────────────────────────────
class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

const ALLOWED_ORIGINS = [
  "https://portal.sophiamx.org",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5500",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  return null;
}

function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

// Igual que jsonResponse pero con Cache-Control para que el browser pueda
// reutilizar la respuesta en recargas/navegación (solo para 200 de lectura).
function jsonCacheableResponse(req: Request, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=60",
      Vary: "Origin, Authorization",
    },
  });
}

function errorResponse(req: Request, err: unknown): Response {
  if (err instanceof ApiError) {
    return jsonResponse(req, { error: err.message, code: err.code, details: err.details }, err.status);
  }
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[edge] unhandled error:", msg, err);
  return jsonResponse(req, { error: msg, code: "internal_error" }, 500);
}

// ── DB singleton (service_role, bypassa RLS) ────────────────────────
let _db: SupabaseClient | null = null;
function getDb(): SupabaseClient {
  if (_db) return _db;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  _db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });
  return _db;
}

// ── Persona + JWT validation ─────────────────────────────────────────
type Persona = {
  id: string;
  auth_user_id: string;
  email: string;
  nombre: string;
  apellidos: string;
  rol: string;
  avatar_url: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function requireUser(req: Request): Promise<Persona> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new ApiError(401, "missing_auth", "Falta header Authorization");

  const url = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !publicKey) throw new ApiError(500, "config_error", "Supabase env no configurado");

  const authClient = createClient(url, publicKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) throw new ApiError(401, "invalid_token", "Token inválido o expirado");

  const authUserId = user.id;
  const email = normalizeEmail(user.email ?? "");
  if (!email) throw new ApiError(401, "no_email", "El usuario no tiene email");

  const db = getDb();
  let { data: persona, error: pErr } = await db
    .from("personas")
    .select("id, auth_user_id, email, nombre, apellidos, rol, avatar_url")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (pErr) throw new ApiError(500, "db_error", pErr.message);

  if (!persona) {
    const { data: byEmail, error: eErr } = await db
      .from("personas")
      .select("id, auth_user_id, email, nombre, apellidos, rol, avatar_url")
      .eq("email", email)
      .maybeSingle();
    if (eErr) throw new ApiError(500, "db_error", eErr.message);
    if (!byEmail) throw new ApiError(403, "no_persona", "No hay persona vinculada a este email");
    if (!byEmail.auth_user_id) {
      const { error: uErr } = await db.from("personas").update({ auth_user_id: authUserId }).eq("id", byEmail.id);
      if (uErr) throw new ApiError(500, "db_error", uErr.message);
      byEmail.auth_user_id = authUserId;
    } else if (byEmail.auth_user_id !== authUserId) {
      throw new ApiError(409, "email_conflict", "Email ya vinculado a otra cuenta");
    }
    persona = byEmail;
  }
  return persona as Persona;
}

// ── Observability ────────────────────────────────────────────────────
const SLOW_THRESHOLD_MS = 2000;
function startSpan(name: string, extra: Record<string, unknown> = {}) {
  const t0 = performance.now();
  return {
    end(more: Record<string, unknown> = {}) {
      const ms = Math.round(performance.now() - t0);
      const slow = ms > SLOW_THRESHOLD_MS;
      console.log(JSON.stringify({
        span: name, ms, ...(slow ? { slow: true } : {}),
        ts: new Date().toISOString(), ...extra, ...more,
      }));
      return ms;
    },
  };
}

// ════════════════════════════════════════════════════════════════════
// END OF SHARED HELPERS — handler de la función comienza abajo
// ════════════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════════════
// HTML SANITIZER (inlined, sincronizado con _shared/html-sanitizer.ts)
// ════════════════════════════════════════════════════════════════════

// SOPHIA Portal · HTML sanitizer (server-side, Deno)
//
// Defensa contra XSS almacenado en `contenidoHTML` que viene de la base de datos.
// Cualquier persona con acceso de escritura al contenido podría inyectar:
//   <script>steal_jwt()</script>
//   <img src=x onerror="...">
//   <a href="javascript:...">
//   <iframe src="evil.com">
//
// Esta función produce HTML "seguro": solo tags y atributos en la allowlist,
// URLs limitadas a http/https/mailto (nada de javascript:), y sin event
// handlers inline.
//
// Esta es una sanitización en SERVIDOR (parte de la defensa). El frontend
// también pasa DOMPurify antes de hacer innerHTML — belt and suspenders.
//
// Tradeoff: usamos regex en vez de un parser DOM real porque:
//   - Deno no tiene DOM nativo (necesitaríamos linkedom / deno-dom)
//   - Nuestro input es HTML editorial controlado, no HTML adversarial complejo
//   - El cliente hace la sanitización "real" con DOMPurify
//   - El servidor solo bloquea los vectores OBVIOS para que no lleguen al cliente
//
// Si el threat model cambia (ej. usuarios suben HTML), reemplazar por
// un parser real (deno-dom + allowlist iterativa por nodos).

// ─────────────────────────────────────────────────────────────────────
// Allowlist
// ─────────────────────────────────────────────────────────────────────

const ALLOWED_TAGS = new Set([
  // Estructura
  "p", "br", "hr", "div", "span", "article", "section", "header", "footer",
  // Encabezados
  "h1", "h2", "h3", "h4", "h5", "h6",
  // Listas
  "ul", "ol", "li",
  // Énfasis
  "strong", "em", "b", "i", "u", "s", "mark", "small", "sub", "sup",
  // Cita / código
  "blockquote", "code", "pre", "kbd",
  // Multimedia / links
  "a", "img", "figure", "figcaption",
  // Tablas
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
  // Otros
  "details", "summary",
]);

// Atributos permitidos globalmente
const GLOBAL_ATTRS = new Set(["class", "id", "title", "lang", "dir"]);

// Atributos permitidos por tag (además de los globales)
const TAG_SPECIFIC_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height", "loading", "decoding"]),
  table: new Set(["border", "cellpadding", "cellspacing"]),
  td: new Set(["colspan", "rowspan", "headers"]),
  th: new Set(["colspan", "rowspan", "scope", "headers"]),
  ol: new Set(["start", "type", "reversed"]),
  details: new Set(["open"]),
};

/**
 * Decide si una URL es segura para href/src.
 *
 * Lógica: si hay un scheme (algo antes del primer `:`, sin que aparezcan
 * `/`, `?` o `#` antes), el scheme DEBE ser http/https/mailto/tel, o ser
 * `data:image/*`. Si no hay scheme → es path relativo/absoluto/fragmento
 * y se permite.
 *
 * Esto cubre los vectores de la antigua regex (bloquea javascript:,
 * vbscript:, file:, data: no-imagen) y además permite paths bare como
 * `cat.jpg` y data:image/* que la regex anterior rechazaba por estricta.
 */
function isSafeUrl(rawValue: string): boolean {
  // Decode entidades por si hay payloads ofuscados con &#x6A;avascript:
  const decoded = decodeEntities(rawValue).trim().toLowerCase();
  // Detectar scheme: "word:" antes de cualquier /, ?, #
  const schemeMatch = decoded.match(/^([a-z][a-z0-9+.\-]*):/);
  if (!schemeMatch) return true; // sin scheme → relativo/absoluto/fragment → ok
  const scheme = schemeMatch[1];
  if (scheme === "http" || scheme === "https" || scheme === "mailto" || scheme === "tel") return true;
  if (scheme === "data" && decoded.startsWith("data:image/")) return true;
  return false; // javascript:, vbscript:, file:, data:text/..., etc.
}

// Tags peligrosos: SE ELIMINAN COMPLETAMENTE (con su contenido)
const DANGEROUS_TAGS = new Set([
  "script", "style", "iframe", "object", "embed", "link", "meta",
  "form", "input", "button", "select", "textarea", "option",
  "base", "applet", "audio", "video", "source", "track", "noscript",
  "frame", "frameset", "svg", "math",
]);

// ─────────────────────────────────────────────────────────────────────
// Sanitizer principal
// ─────────────────────────────────────────────────────────────────────

/**
 * Sanitiza un string de HTML aplicando una allowlist estricta de tags y
 * atributos. Bloquea event handlers, javascript:, scripts, iframes, etc.
 *
 * @param html · HTML potencialmente inseguro (ej. del contenido editorial)
 * @returns HTML sanitizado y seguro para insertar vía innerHTML
 */
function sanitizeHtml(html: string): string {
  if (!html || typeof html !== "string") return "";

  let out = html;

  // 1) Eliminar comentarios HTML (pueden ocultar payloads en algunos parsers)
  out = out.replace(/<!--[\s\S]*?-->/g, "");

  // 2) Eliminar tags peligrosos CON su contenido. Usamos un regex robusto
  //    que tolera atributos, whitespace, mayúsculas, y self-closing.
  for (const tag of DANGEROUS_TAGS) {
    // <tag ...>...</tag>
    const blockRe = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi");
    out = out.replace(blockRe, "");
    // <tag ... /> o <tag ...> sin cierre (huérfano)
    const selfRe = new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi");
    out = out.replace(selfRe, "");
  }

  // 3) Recorrer cada tag restante y filtrar atributos
  out = out.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g, (_match, slash, tagName, attrs) => {
    const tag = tagName.toLowerCase();

    // Tag no en allowlist → strip pero conservar contenido (texto)
    if (!ALLOWED_TAGS.has(tag)) {
      return "";
    }

    // Closing tag: sin atributos
    if (slash === "/") {
      return `</${tag}>`;
    }

    // Opening tag: limpiar atributos
    const cleanedAttrs = sanitizeAttributes(tag, attrs);
    return `<${tag}${cleanedAttrs}>`;
  });

  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Atributos
// ─────────────────────────────────────────────────────────────────────

function sanitizeAttributes(tagName: string, rawAttrs: string): string {
  if (!rawAttrs || !rawAttrs.trim()) return "";

  const allowedForTag = TAG_SPECIFIC_ATTRS[tagName] ?? new Set<string>();
  const result: string[] = [];

  // Regex para parsear atributos: name="value" | name='value' | name=value | name
  const attrRe = /([a-zA-Z_:][a-zA-Z0-9_:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(rawAttrs)) !== null) {
    const name = m[1].toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? "";

    // BLOQUEAR: cualquier on* (onclick, onerror, onload, ...)
    if (name.startsWith("on")) continue;
    // BLOQUEAR: style (vector de CSS injection y expression())
    if (name === "style") continue;
    // BLOQUEAR: formaction, srcdoc, sandbox (vectores menos comunes)
    if (name === "formaction" || name === "srcdoc" || name === "background") continue;

    // VALIDAR allowlist
    const isAllowed = GLOBAL_ATTRS.has(name) || allowedForTag.has(name);
    if (!isAllowed) continue;

    // VALIDAR URLs en href/src — scheme-based, ver isSafeUrl()
    if (name === "href" || name === "src") {
      if (!isSafeUrl(value)) continue;
    }

    // Forzar target="_blank" → agregar rel="noopener noreferrer"
    if (name === "target" && tagName === "a" && value.toLowerCase() === "_blank") {
      result.push(`target="_blank"`);
      // Se agregará rel="noopener noreferrer" abajo si no hay rel propio
      continue;
    }

    // Sanitizar el valor (escape de comillas dobles)
    const escapedValue = value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    if (value === "" && !m[0].includes("=")) {
      // Atributo booleano: <details open>
      result.push(name);
    } else {
      result.push(`${name}="${escapedValue}"`);
    }
  }

  // Si el tag tiene target="_blank" y no tiene rel, agregar uno seguro
  const hasTargetBlank = result.some(a => a === `target="_blank"`);
  const hasRel = result.some(a => a.startsWith("rel="));
  if (hasTargetBlank && !hasRel && tagName === "a") {
    result.push(`rel="noopener noreferrer"`);
  }

  return result.length > 0 ? " " + result.join(" ") : "";
}

function decodeEntities(s: string): string {
  // Decode mínimo de entidades HTML para detectar payloads ofuscados como
  // javascript&#58;alert(1) o &#x6A;avascript:...
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// SOPHIA Portal · get-leccion (Postgres) — v3 RPC
// Returns full lesson content + prev/next IDs within the same chapter.
// Validates enrollment in the parent course.
//
// v3: las 5 queries (lección, módulo, inscripción, hermanas, progreso) se
// colapsaron en UNA llamada a public.rpc_get_leccion (migración
// 20260603_005_rpc_leccion_y_cursor_foro.sql). El RPC regresa el HTML
// crudo (contenidoHtmlRaw); la sanitización XSS se queda AQUÍ en el edge.
// Prev/next ahora ordenan por (orden, id) — estable con órdenes duplicados.
//
// v2 agregó Cache-Control: private, max-age=60 al 200 (jsonCacheableResponse).
//
// GET /get-leccion?id=<leccionId>
//   id puede ser UUID o un airtable_id (recXXX) para compatibilidad con
//   bookmarks viejos.
// Headers: Authorization: Bearer <supabase_jwt>
//
// Returns 200: { leccion, modulo, cursoId, inscripcionId, prevId, nextId }

const KNOWN_AUTOEVAL_IDS: Record<string, "felicidad" | "autoconocimiento"> = {
  "recjMR4P4TFLvFQ4A": "felicidad",
  "recDLCMOgTZChS6Yf": "autoconocimiento",
};

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  if (req.method !== "GET") {
    return errorResponse(req, new ApiError(405, "method_not_allowed", "Use GET"));
  }

  const span = startSpan("get-leccion");

  try {
    const url = new URL(req.url);
    const idParam = url.searchParams.get("id")?.trim();
    if (!idParam) {
      throw new ApiError(400, "missing_id", "Falta parámetro id");
    }

    const persona = await requireUser(req);
    const db = getDb();

    // Una sola llamada: el RPC resuelve lección (UUID o recXXX), módulo,
    // inscripción, prev/next y progreso en Postgres.
    const { data, error: rpcErr } = await db.rpc("rpc_get_leccion", {
      p_persona_id: persona.id,
      p_id: idParam,
    });
    if (rpcErr) throw new ApiError(500, "db_error", rpcErr.message);

    if (data?.error === "invalid_id") {
      throw new ApiError(400, "invalid_id", "id debe ser UUID o recXXX");
    }
    if (data?.error === "leccion_not_found") {
      throw new ApiError(404, "leccion_not_found", "Lección no encontrada");
    }
    if (data?.error === "not_enrolled") {
      throw new ApiError(403, "not_enrolled", "No estás inscrito a este curso");
    }
    if (data?.error === "data_error") {
      throw new ApiError(500, "data_error", "Módulo huérfano");
    }
    if (!data?.leccion) {
      throw new ApiError(500, "rpc_error", "Respuesta inesperada de rpc_get_leccion");
    }

    // Sanitización XSS del contenido editorial — SIEMPRE en el edge, sobre
    // el HTML crudo que regresa el RPC.
    const l = data.leccion;
    const evaluacionRef: string | null = l.evaluacionRef ?? null;
    const leccion = {
      id: l.id,
      titulo: l.titulo ?? "",
      subtitulo: l.subtitulo ?? "",
      orden: l.orden ?? 0,
      tipo: l.tipo ?? "texto",
      etiqueta: l.etiqueta ?? "",
      contenidoHTML: sanitizeHtml(l.contenidoHtmlRaw ?? ""),
      urlVideo: l.urlVideo ?? null,
      urlExterna: l.urlExterna ?? null,
      archivoUrl: l.archivoUrl ?? null,
      archivoNombre: l.archivoNombre ?? null,
      autoevalId: evaluacionRef,
      autoevalTipo: evaluacionRef ? (KNOWN_AUTOEVAL_IDS[evaluacionRef] ?? null) : null,
      completada: Boolean(l.completada),
      completadaEn: l.completadaEn ?? null,
    };

    span.end({ persona: persona.id, leccion: leccion.id });
    return jsonCacheableResponse(req, {
      leccion,
      moduloId: data.moduloId,
      modulo: data.modulo,
      cursoId: data.cursoId,
      inscripcionId: data.inscripcionId,
      prevId: data.prevId ?? null,
      nextId: data.nextId ?? null,
    });
  } catch (err) {
    span.end({ error: true });
    return errorResponse(req, err);
  }
});
