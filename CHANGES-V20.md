# SOPHIA Portal · v20 — Fix definitivo del header/checkpoint-bar

## El bug

En v19 el header de las lecciones unificaba el título + la checkpoint-bar
con `position: sticky`, pero al hacer scroll **el header se arrastraba con
la página** ("el header se empalma con la barra de progreso").

## Causa raíz

El `.shell` usa `grid-template-rows: auto 1fr`. La fila 1 se ajusta al
contenido del header. Cuando el header crece con la checkpoint-bar (de
64px a ~141px), la fila del grid crece igual a 141px. **Resultado: la
fila contenedora tiene exactamente la altura del elemento sticky — cero
"travel room" — y `position: sticky` se degrada a comportamiento normal,
es decir, scrollea con la página.**

Sin sticky efectivo, el header tall se desliza para arriba y se ve el
empalme con el contenido (o cualquier otro elemento fijo) al pasar.

## Fix

1. **`position: fixed`** en el variant `.app-header--with-checkpoints`,
   en vez de heredar el sticky del base. Pin absoluto al viewport,
   garantizado independientemente del grid.
2. **JS mide la altura real** del header después del `relocateCheckpointBarIntoHeader()`
   y la guarda en la var CSS `--lesson-header-h` (en `documentElement`).
3. **`.app-main` agrega `padding-top: calc(var(--lesson-header-h, 141px) + var(--s-6))`**
   cuando `.shell:has(> .app-header--with-checkpoints)`. Sin esto, como
   el header fixed no ocupa espacio en el grid, el contenido inicial de
   la lección quedaría escondido bajo el header.
4. **Re-medir en resize** — un listener (registrado una sola vez) actualiza
   `--lesson-header-h` cuando el viewport cambia de tamaño.
5. **Mobile**: el variant usa `left: 0` (sin sidebar) para que el header
   llene todo el ancho.

## Archivos modificados

- `assets/css/shell.css` — variant `.app-header--with-checkpoints` ahora
  `position: fixed`. Nueva regla `.shell:has(> .app-header--with-checkpoints) .app-main`
  con `padding-top` dinámico vía CSS var.
- `assets/js/leccion.js` — `relocateCheckpointBarIntoHeader()` ahora también
  llama a `measureAndSetLessonHeaderHeight()` (con `requestAnimationFrame`
  para esperar el layout). Listener de resize agregado una vez.

## Compatibilidad

- `:has()` — baseline en navegadores modernos (Chrome 105+, Safari 15.4+,
  Firefox 121+). Si un usuario tiene navegador muy antiguo, el `.app-main`
  cae a su `padding-top` por defecto (32px) y vería contenido bajo el
  header. Acceptable: el portal apunta a navegadores recientes.

## Deploy

Solo frontend (CSS + JS). Sin cambios en edge functions.
