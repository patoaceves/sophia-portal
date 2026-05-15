# SOPHIA Portal · v23 — Popup lateral con análisis completo

## Cambio respecto a v22

El popup del pilar ya no se despliega hacia abajo; ahora sale **al lado**
(a la derecha por default, a la izquierda para cards en la última columna)
y muestra el **análisis sintetizado** además del diagrama.

## Contenido del popup

| Elemento | Descripción |
|---|---|
| Eyebrow | "Tu autoevaluación · 15 de mayo de 2026" |
| Top row | Mini-wedge (100px) con % + banda tag al lado |
| Lead | Texto descriptivo completo del análisis (viene de `resultadoAutoconocimiento.lead`) |
| Siguiente paso | Primeros 2 steps de la lista |
| Link | "Ver resultado completo →" para abrir la página de resultados con todo |

Los datos `lead` y `steps` ya venían del endpoint `get-resultados-autoconocimiento`,
solo no se estaban usando en el contexto del dashboard.

## Posicionamiento del popup

- **Desktop 4-col (default)**: derecha de la card, centrado verticalmente
- **Última columna (nth-child(4n))**: invierte a la izquierda
- **Tablet 2-col (<900px)**: cards pares a la izquierda, impares a la derecha
- **Mobile (<540px)**: fallback a despliegue inferior, ancho ajustado

Si el popup es más alto que el viewport, agrega scroll interno (`max-height: 70vh`).

## Archivos

- `assets/js/curso.js` — `renderPillarAutoevalPopup()` ampliada con lead + steps
- `assets/css/shell.css` — `.pillar-icon__popup` reposicionado lateral, nuevas
  reglas `.pillar-icon__popup-top`, `__popup-lead`, `__popup-steps`

## Deploy

Solo frontend (JS + CSS). Sin cambios en edge functions ni Airtable.
