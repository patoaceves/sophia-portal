// SOPHIA Portal · HTML sanitizer (server-side, Deno)
//
// Defensa contra XSS almacenado en `contenidoHTML` que viene de Airtable.
// Cualquier persona con acceso a Airtable podría inyectar:
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
 * @param html · HTML potencialmente inseguro (ej. de Airtable)
 * @returns HTML sanitizado y seguro para insertar vía innerHTML
 */
export function sanitizeHtml(html: string): string {
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
