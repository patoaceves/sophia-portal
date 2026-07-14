// SOPHIA Portal · PDF "Mi avance de autoevaluaciones"
//
// Arma un documento imprimible con el resultado de las autoevaluaciones que el
// alumno lleva completadas (las 8 dimensiones del modelo de felicidad) y abre
// el diálogo de impresión del browser, donde puede guardarlo como PDF.
//
// Sin dependencias: el documento se escribe en un iframe oculto y se imprime
// desde ahí. Iframe en vez de window.open para no pelearnos con bloqueadores
// de popups, y esperamos a document.fonts.ready antes de imprimir para que no
// salga con la tipografía de respaldo.
//
// El PDF se adapta a lo que haya: con 3 pilares tomados salen 3 fichas y una
// lista de pendientes; con los 8, sale completo y sin pendientes.

import { PILARES, DIM_COLOR, moduloDePilar, pilaresTomados, pilaresPendientes } from "./pilares-defs.js";
import { AUTOEVALS, bandaColor, NOTE } from "./autoeval-defs.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function fechaLarga(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

// ¿Hay algo que reportar? Si no, no tiene caso ofrecer la descarga.
export function tieneAvance(resultadosAutoeval) {
  return PILARES.some((p) => resultadosAutoeval?.[p.key]?.tieneResultados);
}

// Texto de banda y siguientes pasos. Los intentos v2 solo guardan números en
// la BD (total, pct, banda); el texto vive en autoeval-defs.js. Los v1 legacy
// sí traían lead/steps embebidos en el payload, así que esos ganan si existen.
function textosDeBanda(key, res) {
  const def = AUTOEVALS[key]?.bandas?.[res.banda] ?? {};
  return {
    lead: res.lead || def.lead || "",
    steps: Array.isArray(res.steps) && res.steps.length ? res.steps : (def.steps || []),
  };
}

// ── Línea base: el Test de Felicidad ───────────────────────────────────
// Colores por nivel, alineados con las bandas de las autoevaluaciones.
const NIVEL_COLOR = {
  "Fortaleza": "#2E7D32",
  "En crecimiento": "#1565C0",
  "Vulnerable": "#B00020",
};

function renderLineaBase(slug, resultadoTest) {
  if (!resultadoTest?.tieneResultados || !resultadoTest.scores) return "";

  const filas = PILARES
    .slice()
    .sort((a, b) => moduloDePilar(slug, a.key, 0) - moduloDePilar(slug, b.key, 0))
    .map((p) => {
      const score = resultadoTest.scores[p.key];
      if (typeof score !== "number") return "";
      const nivel = resultadoTest.niveles?.[p.key] || "";
      const color = NIVEL_COLOR[nivel] || "#6d6a66";
      return `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td class="n">${score}<small>/10</small></td>
          <td class="lvl" style="color: ${color};">${escapeHtml(nivel)}</td>
        </tr>
      `;
    })
    .join("");

  if (!filas) return "";

  const fecha = fechaLarga(resultadoTest.completedAt);

  return `
    <section class="base">
      <h2 class="sec-title">Tu línea base · Test de Felicidad</h2>
      <p class="base__note">
        Dónde estabas al empezar${fecha ? `, según el Test de Felicidad que tomaste el ${escapeHtml(fecha)}` : ""}.
        Sirve para contrastar contra tus autoevaluaciones por módulo.
      </p>
      <table>${filas}</table>
    </section>
  `;
}

function construirDocumento({ persona, curso, slug, resultadosAutoeval, resultadoTest }) {
  const tomados = pilaresTomados(slug, resultadosAutoeval);
  const pendientes = pilaresPendientes(slug, resultadosAutoeval);

  const nombre = [persona?.nombre, persona?.apellidos].filter(Boolean).join(" ") || "";
  const hoy = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

  // Barra de avance: un segmento por dimensión, en orden de módulo del curso.
  const track = PILARES
    .slice()
    .sort((a, b) => moduloDePilar(slug, a.key, 0) - moduloDePilar(slug, b.key, 0))
    .map((p) => {
      const done = !!resultadosAutoeval?.[p.key]?.tieneResultados;
      const bg = done ? (DIM_COLOR[p.dim] || "#66a3f4") : "#dcd8d2";
      // Etiqueta corta: primera palabra, para que quepan las 8.
      const corto = p.name.split(" ")[0];
      return `
        <div class="track__seg">
          <div class="track__bar" style="background: ${bg};"></div>
          <div class="track__name">${escapeHtml(corto)}</div>
        </div>
      `;
    })
    .join("");

  const fichas = tomados.map((p) => {
    const res = resultadosAutoeval[p.key];
    const pct = typeof res.pct === "number" ? res.pct : 0;
    const banda = res.banda || "";
    const color = bandaColor(banda);
    const { lead, steps } = textosDeBanda(p.key, res);
    const mod = moduloDePilar(slug, p.key, 0);
    const fecha = fechaLarga(res.completedAt);

    const stepsHtml = steps.length
      ? `
        <div class="pilar__steps">
          <div class="pilar__steps-label">Tus siguientes pasos</div>
          <ul>${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
        </div>
      `
      : "";

    return `
      <article class="pilar">
        <div class="pilar__head">
          <div>
            <h3 class="pilar__name">${escapeHtml(p.name)}</h3>
            <div class="pilar__mod">Módulo ${mod}${fecha ? ` · ${escapeHtml(fecha)}` : ""}</div>
          </div>
          <div class="pilar__score">
            <div class="pilar__pct" style="color: ${color};">${pct}%</div>
            <div class="pilar__banda" style="color: ${color};">${escapeHtml(banda)}</div>
          </div>
        </div>
        <div class="pilar__bar"><div class="pilar__bar-fill" style="width: ${pct}%; background: ${color};"></div></div>
        ${lead ? `<p class="pilar__lead">${escapeHtml(lead)}</p>` : ""}
        ${stepsHtml}
      </article>
    `;
  }).join("");

  const pendientesHtml = pendientes.length
    ? `
      <section class="pendientes">
        <h2 class="sec-title">Te faltan</h2>
        <ul class="pend-list">
          ${pendientes.map((p) => `
            <li>
              <span class="dot" style="background: ${DIM_COLOR[p.dim] || "#999"};"></span>
              ${escapeHtml(p.name)}
              <span class="mod">Módulo ${moduloDePilar(slug, p.key, 0)}</span>
            </li>
          `).join("")}
        </ul>
      </section>
    `
    : "";

  const completo = pendientes.length === 0;
  const dek = completo
    ? "Completaste las ocho dimensiones del modelo de felicidad. Este es el retrato de qué tan integrada tienes cada una. No es una calificación: es una línea desde dónde seguir."
    : "Un retrato de qué tan integrada tienes cada dimensión del modelo de felicidad, según las autoevaluaciones que has completado hasta hoy. No es una calificación: es una línea desde dónde seguir.";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Mi avance de autoevaluaciones</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poltawski+Nowy:ital,wght@0,400..700;1,400..700&family=Karla:wght@300;400;500;600;700&display=swap">
<style>
  :root {
    --accent: #d21744;
    --ink: #16130f;
    --muted: #6d6a66;
    --rule: #dcd8d2;
    --serif: "Poltawski Nowy", "Iowan Old Style", Georgia, serif;
    --sans: "Karla", -apple-system, "Segoe UI", sans-serif;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: var(--sans); color: var(--ink); background: #fff; }

  .doc-head {
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 24px; padding-bottom: 12px; border-bottom: 2px solid var(--accent);
  }
  .brand {
    font-family: var(--serif); font-size: 22px; line-height: 1;
    letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent);
  }
  .brand small {
    display: block; margin-top: 4px; font-family: var(--sans);
    font-size: 9px; letter-spacing: 0.22em; text-transform: uppercase;
    color: var(--muted); font-weight: 600;
  }
  .doc-meta { text-align: right; font-size: 11px; color: var(--muted); line-height: 1.7; }
  .doc-meta b { display: block; color: var(--ink); font-size: 13px; font-weight: 600; }

  h1 {
    font-family: var(--serif); font-weight: 400; font-size: 34px;
    line-height: 1.15; margin: 26px 0 8px; letter-spacing: -0.01em;
  }
  .dek { font-size: 13px; line-height: 1.6; color: var(--muted); max-width: 62ch; margin: 0 0 26px; }

  .avance {
    display: grid; grid-template-columns: auto 1fr; gap: 26px; align-items: center;
    padding: 18px 22px; background: #faf8f6;
    border: 1px solid var(--rule); border-left: 3px solid var(--accent);
    margin-bottom: 30px;
  }
  .avance__num { font-family: var(--serif); font-size: 44px; line-height: 1; color: var(--accent); }
  .avance__num span { font-size: 20px; color: var(--muted); }
  .avance__label {
    font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--muted); font-weight: 600; margin-top: 6px;
  }
  .track { display: flex; gap: 4px; }
  .track__seg { flex: 1; min-width: 0; }
  .track__bar { height: 7px; border-radius: 2px; }
  .track__name {
    margin-top: 6px; font-size: 8px; line-height: 1.3; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.05em;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  .sec-title {
    font-family: var(--sans); font-size: 9px; font-weight: 700;
    letter-spacing: 0.2em; text-transform: uppercase; color: var(--accent);
    padding-bottom: 6px; border-bottom: 1px solid var(--rule); margin: 0 0 18px;
  }

  .pilar {
    break-inside: avoid; page-break-inside: avoid;
    padding: 18px 0; border-bottom: 1px solid var(--rule);
  }
  .pilar:last-child { border-bottom: 0; }
  .pilar__head { display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: baseline; }
  .pilar__name { font-family: var(--serif); font-size: 20px; font-weight: 400; margin: 0; }
  .pilar__mod {
    font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--muted); font-weight: 600; margin-top: 3px;
  }
  .pilar__score { text-align: right; white-space: nowrap; }
  .pilar__pct { font-family: var(--serif); font-size: 26px; line-height: 1; }
  .pilar__banda { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; margin-top: 4px; }
  .pilar__bar { height: 5px; background: var(--rule); margin: 12px 0 14px; }
  .pilar__bar-fill { height: 100%; }
  .pilar__lead { font-size: 12px; line-height: 1.62; margin: 0 0 12px; max-width: 78ch; }
  .pilar__steps { background: #faf8f6; border-left: 2px solid var(--rule); padding: 10px 14px; }
  .pilar__steps-label {
    font-size: 8px; font-weight: 700; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--muted); margin-bottom: 5px;
  }
  .pilar__steps ul { margin: 0; padding-left: 16px; }
  .pilar__steps li { font-size: 11.5px; line-height: 1.55; margin-bottom: 3px; }
  .pilar__steps li:last-child { margin-bottom: 0; }

  .pendientes { margin-top: 30px; break-inside: avoid; }
  .pend-list { list-style: none; margin: 0; padding: 0; }
  .pend-list li {
    display: flex; align-items: baseline; gap: 10px; padding: 8px 0;
    border-bottom: 1px dotted var(--rule); font-size: 12px;
  }
  .pend-list li:last-child { border-bottom: 0; }
  .pend-list .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; opacity: 0.35; }
  .pend-list .mod {
    margin-left: auto; font-size: 9px; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--muted); font-weight: 600;
  }

  .base { margin-top: 34px; break-inside: avoid; page-break-inside: avoid; }
  .base table { width: 100%; border-collapse: collapse; }
  .base td { padding: 7px 0; border-bottom: 1px solid var(--rule); font-size: 12px; }
  .base td.n { text-align: right; width: 52px; font-family: var(--serif); font-size: 15px; }
  .base td.n small { font-size: 10px; color: var(--muted); font-family: var(--sans); }
  .base td.lvl { width: 110px; text-align: right; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; }
  .base__note { font-size: 11px; color: var(--muted); margin: 0 0 14px; }

  .doc-foot {
    margin-top: 36px; padding-top: 12px; border-top: 1px solid var(--rule);
    font-size: 10px; line-height: 1.6; color: var(--muted);
    display: flex; justify-content: space-between; gap: 20px;
  }

  @page { size: A4; margin: 16mm; }
</style>
</head>
<body>
  <header class="doc-head">
    <div class="brand">
      Sophia
      <small>Learn. Connect. Grow.</small>
    </div>
    <div class="doc-meta">
      ${nombre ? `<b>${escapeHtml(nombre)}</b>` : ""}
      ${escapeHtml(curso?.titulo || "Happiness Workshop")}<br>
      ${escapeHtml(hoy)}
    </div>
  </header>

  <h1>Mi avance de autoevaluaciones</h1>
  <p class="dek">${escapeHtml(dek)}</p>

  <section class="avance">
    <div>
      <div class="avance__num">${tomados.length}<span>/${PILARES.length}</span></div>
      <div class="avance__label">Autoevaluaciones</div>
    </div>
    <div class="track">${track}</div>
  </section>

  <h2 class="sec-title">Tus resultados</h2>
  ${fichas}
  ${pendientesHtml}
  ${renderLineaBase(slug, resultadoTest)}

  <footer class="doc-foot">
    <span>${escapeHtml(NOTE.replace(/^Nota:\s*/, ""))}</span>
    <span style="white-space: nowrap;">portal.sophiamx.org</span>
  </footer>
</body>
</html>`;
}

/**
 * Genera el documento y abre el diálogo de impresión ("Guardar como PDF").
 *
 * @param {object} opts
 * @param {object} opts.persona · para el nombre en el encabezado
 * @param {object} opts.curso · para el título del curso
 * @param {string} opts.slug · determina el orden de módulos de los pilares
 * @param {object} opts.resultadosAutoeval · mapa { <pilarKey>: {...} }
 * @param {object} [opts.resultadoTest] · línea base opcional (Test de Felicidad)
 */
export function descargarAvancePdf(opts) {
  const doc = construirDocumento(opts);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);

  const limpiar = () => setTimeout(() => iframe.remove(), 1000);

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) return limpiar();

    const imprimir = () => {
      try {
        win.focus();
        win.onafterprint = limpiar;
        win.print();
        // Red de seguridad: onafterprint no dispara en todos los browsers.
        setTimeout(limpiar, 60000);
      } catch (err) {
        console.error("avance pdf print failed:", err);
        limpiar();
      }
    };

    // Esperamos a que carguen Poltawski Nowy y Karla; si no, el documento se
    // imprime con la tipografía de respaldo y pierde la identidad del portal.
    const fonts = iframe.contentDocument?.fonts;
    if (fonts?.ready) {
      fonts.ready.then(imprimir).catch(imprimir);
    } else {
      imprimir();
    }
  };

  iframe.srcdoc = doc;
}
