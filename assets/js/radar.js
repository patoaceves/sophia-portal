// SOPHIA Portal · Radar de Bienestar Psicologico (modulo compartido).
//
// Renderiza un radar (hexagono) de 6 ejes, uno por dimension de la Escala
// RYFF. Cada eje va de 0 a 100% (centro = 0, borde = 100). Dibuja anillos
// hexagonales de referencia, el poligono de datos, vertices coloreados por
// dimension y (opcional) etiquetas con nombre + %.
//
// Uso:
//   import { mountRadar } from "./radar.js";
//   mountRadar({
//     svg: document.getElementById("miRadar"),
//     dims: [{ key, nombre, color, pct }, ...],  // en orden de eje (horario desde arriba)
//     animate: true,
//     labels: true,     // false = preview compacto sin texto
//   });

const SVGNS = "http://www.w3.org/2000/svg";

function ns(tag) {
  return document.createElementNS(SVGNS, tag);
}

// Geometria base. El viewBox deja margen para etiquetas cuando labels=true.
const VB = 360, CX = 180, CY = 180, MAX_R = 120;

// Angulos de los 6 ejes (en grados), en sentido horario desde arriba.
const AXIS_ANGLES = [-90, -30, 30, 90, 150, 210];

function pointFor(angleDeg, r) {
  const a = (angleDeg) * Math.PI / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

function polygonPoints(rValues) {
  return AXIS_ANGLES.map((ang, i) => {
    const p = pointFor(ang, rValues[i]);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(" ");
}

/**
 * Monta el radar dentro de un <svg> existente.
 * @param {object} opts
 * @param {SVGElement} opts.svg
 * @param {Array<{key:string,nombre:string,color:string,pct:number}>} opts.dims
 * @param {boolean} [opts.animate=true]
 * @param {boolean} [opts.labels=true]
 * @param {string}  [opts.fill="#C0112F"]  color del poligono de datos
 */
export function mountRadar({ svg, dims, animate = true, labels = true, fill = "#C0112F" }) {
  if (!svg || !Array.isArray(dims) || dims.length !== 6) return;
  if (labels) {
    svg.setAttribute("viewBox", `0 0 ${VB} ${VB}`);
  } else {
    // Sin etiquetas (preview): recorta el margen para que el radar llene el
    // contenedor en vez de quedar chico con aire alrededor.
    const pad = 14;
    const min = CY - MAX_R - pad;
    const span = (MAX_R + pad) * 2;
    svg.setAttribute("viewBox", `${min} ${min} ${span} ${span}`);
  }
  svg.innerHTML = "";

  // ── Anillos hexagonales de referencia (20%..100%) ──
  [0.2, 0.4, 0.6, 0.8, 1].forEach((f) => {
    const ring = ns("polygon");
    ring.setAttribute("points", polygonPoints(AXIS_ANGLES.map(() => MAX_R * f)));
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", "#e3dccd");
    ring.setAttribute("stroke-width", f === 1 ? "1.4" : "1");
    if (f !== 1) ring.setAttribute("stroke-dasharray", "2 4");
    svg.appendChild(ring);
  });

  // ── Lineas radiales (ejes) ──
  AXIS_ANGLES.forEach((ang) => {
    const p = pointFor(ang, MAX_R);
    const line = ns("line");
    line.setAttribute("x1", CX);
    line.setAttribute("y1", CY);
    line.setAttribute("x2", p.x.toFixed(1));
    line.setAttribute("y2", p.y.toFixed(1));
    line.setAttribute("stroke", "#e3dccd");
    line.setAttribute("stroke-width", "1");
    svg.appendChild(line);
  });

  // ── Poligono de datos ──
  const targetR = dims.map((d) => MAX_R * Math.max(0, Math.min(100, d.pct || 0)) / 100);

  const poly = ns("polygon");
  poly.setAttribute("fill", fill);
  poly.setAttribute("fill-opacity", "0.16");
  poly.setAttribute("stroke", fill);
  poly.setAttribute("stroke-width", "2");
  poly.setAttribute("stroke-linejoin", "round");
  svg.appendChild(poly);

  // ── Vertices (uno por dimension, color propio) ──
  const dots = dims.map((d, i) => {
    const c = ns("circle");
    c.setAttribute("r", labels ? "5" : "4");
    c.setAttribute("fill", d.color || fill);
    c.setAttribute("stroke", "#fff");
    c.setAttribute("stroke-width", "1.5");
    svg.appendChild(c);
    return c;
  });

  // ── Etiquetas (nombre + %) ──
  if (labels) {
    AXIS_ANGLES.forEach((ang, i) => {
      const d = dims[i];
      const lp = pointFor(ang, MAX_R + 22);
      const anchor = lp.x < CX - 4 ? "end" : lp.x > CX + 4 ? "start" : "middle";

      const g = ns("g");
      const t1 = ns("text");
      t1.setAttribute("x", lp.x.toFixed(1));
      t1.setAttribute("y", lp.y.toFixed(1));
      t1.setAttribute("text-anchor", anchor);
      t1.setAttribute("dominant-baseline", "middle");
      t1.setAttribute("font-size", "11");
      t1.setAttribute("font-weight", "600");
      t1.setAttribute("fill", "#1f1a14");
      t1.textContent = d.nombre;
      g.appendChild(t1);

      const t2 = ns("text");
      t2.setAttribute("x", lp.x.toFixed(1));
      t2.setAttribute("y", (lp.y + 14).toFixed(1));
      t2.setAttribute("text-anchor", anchor);
      t2.setAttribute("dominant-baseline", "middle");
      t2.setAttribute("font-size", "11");
      t2.setAttribute("font-weight", "700");
      t2.setAttribute("fill", d.color || fill);
      t2.textContent = `${Math.round(d.pct || 0)}%`;
      g.appendChild(t2);

      svg.appendChild(g);
    });
  }

  // ── Pintado (con o sin animacion) ──
  function paint(rValues) {
    poly.setAttribute("points", polygonPoints(rValues));
    rValues.forEach((r, i) => {
      const p = pointFor(AXIS_ANGLES[i], r);
      dots[i].setAttribute("cx", p.x.toFixed(1));
      dots[i].setAttribute("cy", p.y.toFixed(1));
    });
  }

  if (!animate) {
    paint(targetR);
    return;
  }

  const duration = 900;
  const t0 = performance.now();
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  function frame(now) {
    const p = Math.min((now - t0) / duration, 1);
    const e = easeOutCubic(p);
    paint(targetR.map((r) => r * e));
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
