# SOPHIA Portal · v22 — Autoeval preview movido a hover en pillar cards

## El cambio

V21 dejaba el preview de la autoevaluación en una cajita standalone debajo
del resumen (siempre visible, full-width). Pato pidió moverlo: el preview
debe aparecer **al hacer hover sobre la card del pilar** (en las 8
dimensiones del bienestar).

## Implementación

### Dashboard / Resumen
- **Eliminada** la sección `<div class="autoeval-cajitas-grid">...</div>`
  del tab Resumen. La cajita ya no aparece debajo del resumen.
- `renderAutoconocimientoCajita()` queda en el código (dead code) por si
  hace falta volver a usarla; no se llama desde ningún lado.

### Pillar grid (las 8 cards)
- `renderPillarIcon()` ahora recibe un cuarto parámetro `autoevalCtx`
  con `{ resultadoAutoconocimiento, slug }`.
- Nueva función `renderPillarAutoevalPopup(pillar, ctx)` que devuelve el
  HTML del popup si ese pilar tiene autoeval respondida; vacío si no.
- Por ahora solo `pillar.key === "autoconocimiento"` produce popup
  (Cap 2 es la única con autoeval implementada). Cuando se agreguen las
  otras 7 autoevals, esta función se extiende.
- Cards con popup ganan la clase `pillar-icon--has-popup` (cursor pointer
  + stacking context en hover).

### CSS del popup
- `.pillar-icon__popup` — `position: absolute; top: 100% + 8px`, ancho
  `min(360px, viewport-margin)`, fondo elevado con sombra suave.
- Hidden por default (`opacity: 0; pointer-events: none`).
- Visible en `:hover` y `:focus-within` (accesibilidad).
- En las cards de la **segunda fila** (nth-child(n+5)) el popup se invierte
  y aparece **encima** de la card, no abajo — evita que se salga del
  viewport en la fila inferior.
- `.pillar-grid__grid` ahora tiene `overflow: visible` para que el popup
  pueda flotar fuera del grid.
- Mobile (<540px): popup-body cambia a una columna, centrado.

### Mini-wedge
- Antes se montaba en `#autoeval-mini-wedge` (id único de la cajita).
- Ahora se monta en `#pillar-popup-wedge-autoconocimiento` (dentro del
  popup). El ID incluye `pillar.key` para escalar a las otras dimensiones.
- Añadidas reglas genéricas `.autoeval-mini-wedge { width: 100%; height: 100% }`
  y `.autoeval-mini-wedge svg { width: 100%; height: 100% }` para que el
  SVG llene su contenedor independientemente del contexto.

## Resultado visual

- Resumen del curso: el row de "foro + diagrama" sigue arriba, debajo
  directamente vienen las 8 cards de dimensiones (sin cajita extra).
- Hover sobre Autoconocimiento → flota debajo de la card un panel con:
  fecha, mini-wedge (120px) con %, banda tag (color de la banda), link
  "Ver resultado completo →".
- Hover sobre las otras 7 dimensiones → sin popup (todavía no tienen
  autoeval). Cuando se publiquen, basta extender `renderPillarAutoevalPopup`.

## Deploy

Solo frontend (JS + CSS). Sin cambios en edge functions ni Airtable.
