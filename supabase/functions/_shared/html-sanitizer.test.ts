// Test del sanitizer — corre con `deno test sanitizer_test.ts` o ejecuta este
// archivo directo. NO se despliega como edge function, es solo verificación.

import { sanitizeHtml } from "./html-sanitizer.ts";

const tests: { name: string; input: string; expected: (out: string) => boolean }[] = [
  // ── Vectores de XSS clásicos ──────────────────────────────────────
  {
    name: "<script> es eliminado completamente",
    input: '<p>Hola</p><script>alert(1)</script><p>Mundo</p>',
    expected: (out) => !out.includes("script") && !out.includes("alert") && out.includes("Hola") && out.includes("Mundo"),
  },
  {
    name: "<script> con atributos también",
    input: '<script src="evil.js"></script>',
    expected: (out) => out === "",
  },
  {
    name: "<img onerror> bloquea el event handler pero conserva la imagen",
    input: '<img src="cat.jpg" onerror="alert(1)">',
    expected: (out) => out.includes("cat.jpg") && !out.includes("onerror") && !out.includes("alert"),
  },
  {
    name: "<a href=javascript:> es bloqueado",
    input: '<a href="javascript:alert(1)">click</a>',
    expected: (out) => !out.includes("javascript") && !out.includes("href"),
  },
  {
    name: "javascript: encodeado con entidades hex también",
    input: '<a href="&#x6A;avascript:alert(1)">click</a>',
    expected: (out) => !out.includes("alert") && !out.includes("href"),
  },
  {
    name: "<iframe> es eliminado completamente",
    input: '<p>Antes</p><iframe src="evil.com"></iframe><p>Después</p>',
    expected: (out) => !out.includes("iframe") && out.includes("Antes") && out.includes("Después"),
  },
  {
    name: "<style> con CSS malicioso bloqueado",
    input: '<style>body{background:url("javascript:alert(1)")}</style>',
    expected: (out) => out === "",
  },
  {
    name: "Atributo style inline bloqueado",
    input: '<p style="background:red">texto</p>',
    expected: (out) => out.includes("<p") && out.includes("texto") && !out.includes("style"),
  },
  {
    name: "data:image/png permitido en img",
    input: '<img src="data:image/png;base64,iVBORw0KGgo=" alt="pixel">',
    expected: (out) => out.includes("data:image/png"),
  },
  {
    name: "data:text/html bloqueado en img",
    input: '<img src="data:text/html,<script>alert(1)</script>">',
    expected: (out) => !out.includes("data:text") && !out.includes("script"),
  },
  {
    name: "target=_blank agrega rel automáticamente",
    input: '<a href="https://example.com" target="_blank">link</a>',
    expected: (out) => out.includes("rel=") && out.includes("noopener"),
  },

  // ── HTML legítimo que debe pasar limpio ──────────────────────────
  {
    name: "Encabezados se conservan",
    input: "<h1>Título</h1><h2>Subtítulo</h2>",
    expected: (out) => out.includes("<h1>Título</h1>") && out.includes("<h2>Subtítulo</h2>"),
  },
  {
    name: "Listas se conservan",
    input: "<ul><li>uno</li><li>dos</li></ul>",
    expected: (out) => out.includes("<ul>") && out.includes("<li>uno</li>"),
  },
  {
    name: "Imágenes legítimas se conservan",
    input: '<img src="/assets/img/foto.png" alt="Foto" width="200">',
    expected: (out) => out.includes("/assets/img/foto.png") && out.includes(`alt="Foto"`),
  },
  {
    name: "Clases CSS se conservan",
    input: '<div class="claustro-card"><article class="bio">contenido</article></div>',
    expected: (out) => out.includes(`class="claustro-card"`) && out.includes(`class="bio"`),
  },
  {
    name: "Links normales funcionan",
    input: '<a href="https://sophia.mx">SOPHIA</a>',
    expected: (out) => out.includes("https://sophia.mx") && out.includes("SOPHIA"),
  },
  {
    name: "Tablas se conservan",
    input: '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>',
    expected: (out) => out.includes("<table>") && out.includes("<th>A</th>"),
  },
];

let passed = 0;
let failed = 0;
for (const t of tests) {
  const out = sanitizeHtml(t.input);
  const ok = t.expected(out);
  if (ok) {
    passed++;
    console.log(`  ✓ ${t.name}`);
  } else {
    failed++;
    console.log(`  ✗ ${t.name}`);
    console.log(`    Input:  ${t.input}`);
    console.log(`    Output: ${out}`);
  }
}

console.log(`\n${passed}/${passed + failed} tests passed${failed ? ` (${failed} FAILED)` : ""}`);
if (failed > 0) Deno.exit(1);
