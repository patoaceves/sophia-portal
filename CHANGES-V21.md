# SOPHIA Portal · v21 — Dashboard polish + flow después de autoeval

## 1. Cajitas de autoevaluación en grid 2 columnas

La cajita de "Tu integración del Autoconocimiento" en el dashboard ocupaba
todo el ancho. Ahora se mete en un grid `.autoeval-cajitas-grid` que en
pantallas >= 880px deja **2 columnas × 4 filas** cuando vengan las otras 7
autoevaluaciones (una por dimensión). En mobile cae a 1 columna.

- `assets/js/curso.js` — envoltura `<div class="autoeval-cajitas-grid">`
- `assets/css/shell.css` — nueva regla `.autoeval-cajitas-grid` con
  `grid-template-columns: repeat(auto-fill, minmax(420px, 1fr))`

## 2. Barra de progreso de módulos: color uniforme

Antes cada pilar tenía su color (Autoconocimiento navy via `--pillar-mental`,
otros con sus dim colors). Ahora **todos los progress-fills usan el rojo de
marca** (`--color-accent`) y el estado `--in-progress` perdió su gradient
especial. Resultado: Autoconocimiento se ve igual que los demás caps,
solo con la barra avanzada.

- `assets/css/shell.css` — removidos los selectores per-dim y el gradient
  state. Una sola regla: `.pillar-icon__progress-fill { background: var(--color-accent); }`

## 3. Línea delgada entre el título y la checkpoint-bar (header de lecciones)

V20 dejó el header unificado pero sin separador visual entre el row del
título y la checkpoint-bar. Ahora el `.app-header__row` (cuando está en
variant `--with-checkpoints`) tiene `border-bottom: 1px solid var(--color-border)`,
misma intensidad que el border-bottom inferior del header.

- `assets/css/shell.css`

## 4. Intro screen en la Evaluación de la sesión

El wizard ahora arranca con una pantalla de bienvenida (currentIndex = -1)
antes de la primera pregunta:

> Agradecemos que tomes un par de minutos para darnos retroalimentación
> de la sesión y de tu instructor. Tus datos y respuestas se mantienen
> confidenciales. Te agradecemos que seas completamente honesto/a.

El usuario presiona "Comenzar evaluación" y arranca el wizard. Mismo patrón
que las autoevaluaciones (test-felicidad y test-autoconocimiento).

- `assets/js/evaluacion-sesion.js` — `currentIndex` default `-1`,
  nueva función `renderIntro()`, handler para action `start`.

## 5. Flow: después de test/autoeval → siguiente lección, no dashboard

Antes: después de enviar el Test de Felicidad o la Autoevaluación de
Autoconocimiento, el CTA "Volver a Mi Curso" mandaba al alumno al
dashboard, donde se brincaba la **Evaluación de la sesión** (el siguiente
paso natural). Si volvía a entrar al cap, le tocaba hacerla otra vez.

Ahora: si el test/autoeval se completó desde el contexto de una lección
(hay `nextId`), el CTA primario apunta directo a esa siguiente lección.
Es decir:

| Estado | CTA primario | A dónde va |
|---|---|---|
| Test/autoeval con next | **Continuar →** (accent) | `/app/leccion?id=<nextId>` |
| Test/autoeval sin next | ← Volver a Mi Curso | `/app/curso?slug=...` |
| Eval. sesión última del cap | ← Volver a Mi Curso | `/app/curso?slug=...` |

El parámetro `next` se pasa desde `leccion.js` al hacer el redirect a
resultados; las páginas de resultados lo leen del URL y construyen el CTA.

- `assets/js/leccion.js` — onComplete de ambos tests incluye `&next=<nextId>`
- `assets/js/test-felicidad-resultados.js` — lee `next`, CTA dinámico
- `assets/js/test-autoconocimiento-resultados.js` — idem

## 6. "Curso" siempre con C mayúscula

- `leccion.js`: "Volver al curso" → "Volver a Mi Curso" (cuando no hay nextId)
- Otros lugares ya estaban correctos (`Volver a Mi Curso`)

## Deploy

Solo frontend. Sin cambios en edge functions ni Airtable.
