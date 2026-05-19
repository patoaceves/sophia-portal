# SOPHIA Portal · v19 — Wizard UX + color de pilar + fixes visuales

Continuación de v18. Cambios de esta iteración:

## 1. Wizard: botón "Enviar" en vez de auto-envío

Antes los wizards se auto-enviaban al contestar la última pregunta. Ahora,
al contestar la última, se re-renderea y aparece un botón **"Enviar"** que el
usuario presiona cuando esté listo.

- `test-felicidad.js` — quitado `submitTest` automático del handler `answer`;
  ahora hace `renderInto(state)`. Botón final "Ver resultados" → **"Enviar"**.
- `test-autoconocimiento.js` — mismo cambio. Botón → **"Enviar"**.
- `evaluacion-sesion.js` — botón "Enviar evaluación" → **"Enviar"** (ya no
  auto-enviaba; solo cambió el label).

## 2. Color de pilar en el wizard de autoevaluación

Cada autoevaluación tiene un color. Ahora **solo el wizard** (no todo el
módulo) refleja ese color: barra de progreso, bolitas (hover + activas),
eyebrow del pilar, chips del intro y el botón "Enviar".

- `test-autoconocimiento.js` — setea `--wizard-accent: #66a3f4` en el
  container vía `style.setProperty`.
- `shell.css` — `.test-progress__fill`, `.test-question__pilar`,
  `.test-intro__eyebrow`, `.test-intro__pillar`, `.dot-option:hover`,
  `.dot-option.is-active`, `.test-wizard .btn-accent` ahora usan
  `var(--wizard-accent, var(--color-accent))`. El Test de Felicidad no
  define la var → cae al rojo de marca (sin cambios visuales ahí).
- Box-shadow del dot activo migrado de `--color-accent-faint` hardcodeado
  a `color-mix()` con `--wizard-accent`.

## 3. Band tag sin bolita

Quitada la `<span class="autoeval-band-dot">` del band tag, tanto en la
página de resultados como en la cajita del dashboard. CSS `.autoeval-band-dot`
eliminado.

- `test-autoconocimiento-resultados.js`, `curso.js`, `shell.css`

## 4. Checkpoint-bar con la composición del header

La barra de progreso de lecciones se veía desconectada del header (sólida vs.
header translúcido). Ahora `.checkpoint-bar` usa el mismo
`background: rgba(250,246,238,.85)` + `backdrop-filter: blur(8px)` y el mismo
padding horizontal (`var(--s-8)`) que `.app-header`. Se leen como una sola
capa sticky coherente.

- `shell.css`

## 5. Fotos Mariana / Seligman: clases CSS en vez de inline styles

**Causa raíz**: el sanitizer (`FORBID_ATTR: ["style"]` en client + server)
borra todos los `style=` inline del HTML de Airtable. Por eso las fotos
seguían a tamaño natural aunque el HTML tenía `width:100px`.

**Fix**: clases CSS (el atributo `class` sí sobrevive ambos sanitizers).

- `shell.css` — nuevas clases:
  - `.leccion-html .hw-figure-avatar` — avatar circular centrado 100×100
    (foto de Mariana, creadora del programa).
  - `.leccion-html .hw-figure-portrait` — retrato flotado 110px con marco
    de color `--hw-frame` (default azul `#66a3f4`) (foto de Seligman).
- `docs/contenido-modulo-1/01-bienvenida.html` — `<figure class="hw-figure-avatar">`
- `docs/contenido-modulo-2/01-nota-tecnica.html` — `<figure class="hw-figure-portrait">`
- Airtable: `recZPBwbvzDU1xOCQ` y `recwSO28ZC75ZSGB2` sincronizados.

## Deploy

**Sin cambios en edge functions** en esta iteración. Solo frontend (JS + CSS)
y contenido de Airtable. Basta con desplegar el repo estático actualizado.

---

## Iteración adicional (post-feedback)

### Cap 3 vacío
Borrada `rec2koFk6gp3qJGoG` (Evaluación de la sesión del Cap 3). Cap 3 ahora
sin lecciones, según pidió Pato.

### Header de lección unificado (fix definitivo del "empalme")

Causa raíz: header y checkpoint-bar eran DOS elementos sticky/fixed
separados con sus propias capas translúcidas. Por más alineados que
estuvieran, se leían como dos planos distintos.

Fix estructural: ahora son **una sola unidad sticky** vertical.

- `leccion.js` — nuevo helper `relocateCheckpointBarIntoHeader()` que, tras
  `renderShell`, mueve la `.checkpoint-bar` al interior del `.app-header`,
  envuelve el contenido original del header en un `.app-header__row` y
  añade la clase `.app-header--with-checkpoints` al header.
- `shell.css`:
  - `.shell { grid-template-rows: auto 1fr }` (era `var(--header-h) 1fr`)
    para que el header pueda crecer verticalmente.
  - `.app-header { min-height: var(--header-h) }` — garantiza altura mínima
    en páginas sin checkpoints (sin cambios visuales para esas).
  - `.app-header.app-header--with-checkpoints` — `flex-direction: column`,
    `padding: 0`, altura libre.
  - `.app-header__row` — recupera el layout horizontal original
    (hamburguesa · título · acciones) dentro del header columnar.
  - `.app-header.app-header--with-checkpoints .checkpoint-bar` — anula
    el `position: fixed`, `background`, `backdrop-filter` y `border-bottom`
    propios; hereda todo del header.
  - Doble especificidad (`.app-header.app-header--with-checkpoints`) para
    batir al override mobile de `.app-header`.

Resultado: cuando bajas en la lección, header + checkpoints se quedan
pegados al top como **una sola capa translúcida coherente**. Sin empalme.
