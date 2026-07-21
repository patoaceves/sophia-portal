// SOPHIA Portal - acuerdo.js
//
// Componente de firma digital de un acuerdo de participacion. Se monta en las
// lecciones tipo "enlace" con etiqueta "Acuerdo". Muestra el PDF, las casillas
// de consentimiento y un campo de nombre como firma. Al firmar, guarda el
// registro via la edge function firmar-acuerdo y marca la leccion completa.

import { api } from "./api.js";
import { getAcuerdoDef } from "./acuerdo-defs.js";
import { mountPdfInto } from "./pdf-embed.js";

const MESES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fechaCorta(iso) {
  const d = iso ? new Date(iso) : new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}/${MESES[d.getMonth()]}/${d.getFullYear()}`;
}

function renderFirmado(container, def, firma) {
  const { nombreFirma, firmadoEn } = firma;
  container.innerHTML = `
    <div class="acuerdo-firmado" style="border:1px solid #bfe6cd;background:#eafaf1;border-radius:12px;padding:20px 22px;">
      <div style="display:inline-flex;align-items:center;gap:8px;color:#1f9d55;font-weight:700;font-size:0.95rem;">
        <span aria-hidden="true">✓</span> Acuerdo firmado
      </div>
      <h3 style="margin:12px 0 4px;font-size:1.35rem;">${escapeHtml(nombreFirma || "")}</h3>
      <p style="margin:2px 0;color:var(--color-text-muted,#666);font-size:0.9rem;">Firmado el <strong>${escapeHtml(fechaCorta(firmadoEn))}</strong></p>
      <p style="margin:2px 0;color:var(--color-text-muted,#666);font-size:0.9rem;">Documento: <strong>${escapeHtml(def.titulo)} (${escapeHtml(def.version)})</strong></p>
      <p style="margin:14px 0 0;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <button type="button" id="acuerdoDescargarBtn" class="btn btn-secondary">Descargar acuerdo firmado (PDF)</button>
        <span id="acuerdoDescargarHint" style="font-size:0.8rem;color:var(--color-text-muted,#666);" hidden></span>
      </p>
    </div>
  `;

  const btn = container.querySelector("#acuerdoDescargarBtn");
  const hint = container.querySelector("#acuerdoDescargarHint");
  btn?.addEventListener("click", async () => {
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = "Generando...";
    if (hint) { hint.hidden = true; hint.textContent = ""; }
    try {
      await descargarAcuerdoFirmado(def, { nombreFirma, firmadoEn });
    } catch (e) {
      console.error("descargarAcuerdoFirmado:", e);
      if (hint) { hint.hidden = false; hint.textContent = "No se pudo generar el PDF. Intenta de nuevo."; }
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  });
}

function fechaHora(iso) {
  const d = iso ? new Date(iso) : new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${MESES[d.getMonth()]}/${d.getFullYear()}, ${hh}:${mm} h`;
}

function slugNombre(s) {
  return (String(s || "firma").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40)) || "firma";
}

function wrapLines(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (line && font.widthOfTextAtSize(test, size) > maxWidth) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Genera una copia del acuerdo con una hoja de "Constancia de firma" agregada
// al final (nombre + fecha + casillas). NO modifica las páginas originales.
async function descargarAcuerdoFirmado(def, firma) {
  const { PDFDocument, StandardFonts, rgb } = await import("https://esm.sh/pdf-lib@1.17.1");
  const bytes = await fetch(def.pdfUrl).then((r) => {
    if (!r.ok) throw new Error("No se pudo leer el PDF original");
    return r.arrayBuffer();
  });

  const pdf = await PDFDocument.load(bytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = pdf.addPage();
  const { width, height } = page.getSize();
  const M = 56;
  const crimson = rgb(0.753, 0.067, 0.184); // #c0112f
  const dark = rgb(0.1, 0.1, 0.1);
  const gray = rgb(0.4, 0.4, 0.4);
  let y = height - 72;

  page.drawText("Constancia de firma", { x: M, y, size: 20, font: bold, color: crimson });
  y -= 14;
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 1, color: crimson });
  y -= 28;

  for (const ln of wrapLines("Este acuerdo fue leído y aceptado de forma electrónica por la persona firmante.", font, 11, width - M * 2)) {
    page.drawText(ln, { x: M, y, size: 11, font, color: gray });
    y -= 16;
  }
  y -= 16;

  const rows = [
    ["Nombre (firma)", firma.nombreFirma || ""],
    ["Fecha y hora", fechaHora(firma.firmadoEn)],
    ["Documento", `${def.titulo} (${def.version})`],
    ["Consentimiento", `Confirmó las ${def.casillas.length} casillas del acuerdo`],
  ];
  for (const [k, v] of rows) {
    page.drawText(k, { x: M, y, size: 9, font: bold, color: gray });
    y -= 17;
    for (const ln of wrapLines(String(v), font, 13, width - M * 2)) {
      page.drawText(ln, { x: M, y, size: 13, font, color: dark });
      y -= 18;
    }
    y -= 12;
  }

  y -= 4;
  page.drawText("Casillas confirmadas", { x: M, y, size: 9, font: bold, color: gray });
  y -= 16;
  for (const c of def.casillas) {
    for (const ln of wrapLines("- " + c.texto, font, 9.5, width - M * 2)) {
      if (y < 56) break;
      page.drawText(ln, { x: M, y, size: 9.5, font, color: rgb(0.25, 0.25, 0.25) });
      y -= 13;
    }
    y -= 3;
  }

  const out = await pdf.save();
  const blob = new Blob([out], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `acuerdo-firmado-${slugNombre(firma.nombreFirma)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function renderFormulario(container, def, ctx) {
  const casillasHtml = def.casillas.map((c) => `
    <label class="acuerdo-check" style="display:flex;gap:12px;padding:12px 14px;border-radius:9px;align-items:flex-start;cursor:pointer;">
      <input type="checkbox" data-k="${escapeHtml(c.id)}" style="margin-top:3px;width:18px;height:18px;flex:0 0 auto;accent-color:var(--color-accent,#c21f49);cursor:pointer;">
      <span style="font-size:0.95rem;line-height:1.45;">${escapeHtml(c.texto)}</span>
    </label>
  `).join("");

  container.innerHTML = `
    <div class="acuerdo">
      <p style="color:var(--color-text-muted,#666);margin:0 0 var(--s-3,14px);">${escapeHtml(def.intro || "")}</p>

      <div class="acuerdo-doc" style="margin-bottom:var(--s-4,20px);">
        <div class="leccion-pdf" data-pdf-src="${escapeHtml(def.pdfUrl)}">
          <div class="leccion-pdf__loading">
            <div class="leccion-pdf__spinner" aria-hidden="true"></div>
            <span>Cargando documento…</span>
          </div>
        </div>
        <p class="leccion-pdf__alt" style="margin-top:8px;font-size:0.85rem;color:var(--color-text-muted,#666);">
          ¿Prefieres verlo aparte?
          <a href="${escapeHtml(def.pdfUrl)}" target="_blank" rel="noopener" style="color:var(--color-accent,#c21f49);font-weight:600;">Abrir el PDF en otra pestaña</a>
        </p>
      </div>

      <h3 style="font-size:1.05rem;margin:0 0 10px;">Confirma que leíste y estás de acuerdo</h3>
      <div class="acuerdo-checks" style="border:1px solid var(--color-border,#e6e6e6);border-radius:12px;padding:6px 4px;margin-bottom:var(--s-4,20px);">
        ${casillasHtml}
      </div>

      <h3 style="font-size:1.05rem;margin:0 0 10px;">Firma con tu nombre</h3>
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end;">
        <div style="flex:1 1 260px;min-width:220px;">
          <label class="acuerdo-flabel" for="acuerdoNombre" style="display:block;font-size:0.8rem;font-weight:600;color:var(--color-text-muted,#666);margin-bottom:6px;">${escapeHtml(def.firmaLabel || "Escribe tu nombre como firma")}</label>
          <input type="text" id="acuerdoNombre" autocomplete="name" placeholder="Tu nombre"
            style="width:100%;padding:11px 13px;border:1px solid var(--color-border,#e6e6e6);border-radius:10px;font-size:1.1rem;">
        </div>
        <div style="flex:0 0 150px;">
          <label class="acuerdo-flabel" style="display:block;font-size:0.8rem;font-weight:600;color:var(--color-text-muted,#666);margin-bottom:6px;">Fecha</label>
          <div style="padding:11px 13px;border:1px dashed var(--color-border,#e6e6e6);border-radius:10px;color:var(--color-text-muted,#666);">${escapeHtml(fechaCorta())}</div>
        </div>
      </div>

      <p style="font-size:0.75rem;color:var(--color-text-muted,#666);margin:14px 0 0;line-height:1.5;">
        Al escribir tu nombre y firmar, otorgas tu consentimiento de forma electrónica. Se registrará tu nombre,
        la fecha y hora, la versión del documento y las casillas confirmadas. Puedes revocar este consentimiento
        contactando al responsable del programa (derechos ARCO).
      </p>

      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:20px;">
        <button type="button" id="acuerdoFirmarBtn" class="btn btn-accent" disabled>Firmar y continuar</button>
        <span id="acuerdoHint" style="font-size:0.8rem;color:var(--color-text-muted,#666);">Marca las ${def.casillas.length} casillas y escribe tu nombre.</span>
      </div>
      <p id="acuerdoError" style="color:#c0392b;font-size:0.85rem;margin:10px 0 0;" hidden></p>
    </div>
  `;

  const boxes = Array.from(container.querySelectorAll('.acuerdo-checks input[type="checkbox"]'));
  const nombre = container.querySelector("#acuerdoNombre");
  const btn = container.querySelector("#acuerdoFirmarBtn");
  const hint = container.querySelector("#acuerdoHint");
  const errBox = container.querySelector("#acuerdoError");

  function validate() {
    const allChecked = boxes.every((b) => b.checked);
    const hasName = nombre.value.trim().length >= 3;
    btn.disabled = !(allChecked && hasName);
    if (!allChecked) hint.textContent = `Marca las ${def.casillas.length} casillas para continuar.`;
    else if (!hasName) hint.textContent = "Escribe tu nombre como firma.";
    else hint.textContent = "Todo listo. Puedes firmar.";
  }
  boxes.forEach((b) => b.addEventListener("change", validate));
  nombre.addEventListener("input", validate);
  validate();

  // Render del PDF a canvas (sin iframe ni barra de miniaturas del navegador).
  mountPdfInto(container.querySelector(".acuerdo-doc .leccion-pdf"), def.pdfUrl);

  btn.addEventListener("click", async () => {
    errBox.hidden = true;
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = "Firmando...";
    const casillas = {};
    boxes.forEach((b) => { casillas[b.getAttribute("data-k")] = b.checked; });
    try {
      const res = await api.firmarAcuerdo({
        inscripcionId: ctx.inscripcionId,
        leccionId: ctx.leccionId,
        cursoId: ctx.cursoId,
        documentoClave: def.version,
        nombreFirma: nombre.value.trim(),
        casillas,
      });
      renderFirmado(container, def, {
        nombreFirma: nombre.value.trim(),
        firmadoEn: res?.firmadoEn,
      });
      if (typeof ctx.onComplete === "function") await ctx.onComplete();
    } catch (e) {
      btn.disabled = false;
      btn.textContent = original;
      errBox.hidden = false;
      errBox.textContent = e?.message ? `No se pudo firmar: ${e.message}` : "No se pudo firmar. Intenta de nuevo.";
    }
  });
}

export async function mountAcuerdo(opts) {
  const { container, clave, inscripcionId, leccionId, cursoId, yaCompletada, onComplete } = opts;
  if (!container) return;

  const def = getAcuerdoDef(clave);
  if (!def) {
    container.innerHTML = `<p style="color:var(--color-text-muted,#666);">Este acuerdo no está configurado todavía.</p>`;
    return;
  }

  const ctx = { inscripcionId, leccionId, cursoId, onComplete };

  // Si ya esta firmado, pintar estado read-only. Si la verificacion falla
  // (ej. edge function no desplegada), caemos al formulario sin bloquear.
  try {
    const prev = await api.getAcuerdoFirmado(def.version, inscripcionId);
    if (prev && prev.firmado) {
      renderFirmado(container, def, { nombreFirma: prev.nombreFirma, firmadoEn: prev.firmadoEn });
      if (typeof onComplete === "function") await onComplete();
      return;
    }
  } catch (e) {
    console.warn("No se pudo verificar firma previa del acuerdo:", e);
  }

  renderFormulario(container, def, ctx);
}
