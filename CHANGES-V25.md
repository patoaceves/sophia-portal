# SOPHIA Portal · v25 — Reestructuración del Módulo 2 (Autoconocimiento)

Se reorganizó el Cap 2 a **6 lecciones** y se agregaron **dos formatos de
lección nuevos** que el portal no tenía: visor de PDF nativo y wizard de quiz.

## Nuevo orden del Módulo 2

| # | Lección | Formato | Cambio |
|---|---|---|---|
| 1 | Cuestionario VIA · Fortalezas con Estilo SOPHIA | `texto` (rich text) | **nueva** |
| 2 | Nota técnica: Autoconocimiento | `pdf` (visor nativo) | era `texto` → `pdf` |
| 3 | Caso 2: La casa detrás del ventanal | `pdf` (visor nativo) | era `texto` → `pdf` |
| 4 | Actividad en clase: Gnóthi Seautón | `quiz` (wizard) | **nueva** |
| 5 | Autoevaluación: Tu integración del Autoconocimiento | `autoeval` | sin cambios (reordenada) |
| 6 | Evaluación de la sesión | `enlace` | sin cambios (reordenada) |

## 1. Visor de PDF nativo (`tipo=pdf`)

Antes el portal solo tenía `documento` (botón de descarga). Ahora `pdf`
embebe el documento inline a **proporción carta (8.5 × 11)** usando el visor
de PDF integrado del navegador.

- `leccion.js` · nuevo `case "pdf"` en `renderContent()` + función
  `renderPdfViewer()` (iframe `#view=FitH`, con enlace de respaldo para
  abrir en otra pestaña).
- `shell.css` · `.leccion-pdf` con `aspect-ratio: 8.5 / 11` y `max-height: 88vh`.
- El PDF se lee de `leccion.urlExterna`. Los archivos viven en el repo:
  - `assets/pdf/autoconocimiento-nota-tecnica.pdf`
  - `assets/pdf/autoconocimiento-caso.pdf`
- No requiere cambios de CSP: `frame-src 'self'` (de v24) ya cubre PDFs
  del mismo origen.

## 2. Wizard de quiz / actividades en clase (`tipo=quiz`)

Las "actividades en clase" son wizards reflexivos. A diferencia de las
autoevaluaciones, **no puntúan**: solo registran las respuestas del alumno.

**Front-end**
- `quiz-defs.js` (nuevo) · registro de quizzes. Las preguntas viven
  hardcodeadas aquí. Incluye `gnothi-seauton` (9 preguntas: 3 de opción
  única sobre la relación con pasado/presente/futuro + 6 de texto libre).
- `quiz.js` (nuevo) · `mountQuiz()`. Wizard una-pregunta-por-pantalla con
  intro, barra de progreso, tipos `choice` y `texto`, y pantalla de
  resumen al terminar. Al volver a entrar a una actividad ya completada,
  muestra directo el resumen (consulta `get-resultados-quiz` al montar).
  Borrador local en `sessionStorage` mientras está en progreso.
- `leccion.js` · detección `isQuiz` + branch de montaje. La clave del quiz
  se lee de `leccion.urlExterna` (ej. `"gnothi-seauton"`).
- `api.js` · métodos `submitQuiz()` y `resultadosQuiz()`.
- `shell.css` · `.quiz-choice-list`, `.quiz-choice`, `.quiz-resumen*`,
  `.quiz-loading`, `.quiz-error`, `.quiz-optional-note`. El resto reutiliza
  las clases `.test-*` existentes.

**Back-end (Supabase Edge Functions — NUEVAS, requieren deploy)**
- `submit-quiz` · POST. Guarda las respuestas en la tabla "Actividades en
  Clase". Valida ownership de la inscripción.
- `get-resultados-quiz` · GET `?leccionId=`. Devuelve la última respuesta
  del usuario a esa actividad.

**Airtable**
- Tabla nueva **"Actividades en Clase"** (`tbllM76FnC50EHRCx`) en la base
  SOPHIA-Portal. Campos: Resumen, Actividad, Lección (link), Inscripción
  (link), Respuestas JSON, Fecha de envío, Completado.

## 3. Lección rich-text "Cuestionario VIA"

Convertida del PDF a HTML nativo del portal: qué son las fortalezas VIA,
enlace al cuestionario oficial de viacharacter.org, por qué importan, las
24 fortalezas en 6 virtudes con su pregunta-guía, e instrucciones finales.
El enlace externo abre en pestaña nueva automáticamente (`sanitizeLessonContent()`
ya marca todos los links externos de las lecciones).

## Archivos tocados

```
assets/js/leccion.js        · case pdf, renderPdfViewer, isQuiz, mount quiz
assets/js/quiz.js           · NUEVO · wizard de quiz
assets/js/quiz-defs.js      · NUEVO · definiciones de quizzes (Gnóthi Seautón)
assets/js/api.js            · submitQuiz(), resultadosQuiz()
assets/css/shell.css        · .leccion-pdf, estilos de quiz
assets/pdf/                 · NUEVO · 2 PDFs (nota técnica, caso)
supabase/functions/submit-quiz/index.ts        · NUEVO
supabase/functions/get-resultados-quiz/index.ts · NUEVO
```

## Ajustes posteriores (mismo v25)

- **Visor de PDF** — el `<iframe>` daba "portal.sophiamx.org refused to
  connect" porque dependía de los headers `X-Frame-Options` /
  `frame-ancestors`, que no se comportaban bien en el deploy. Se cambió a
  **render con PDF.js** (vendorizado en `assets/vendor/pdfjs/`): el PDF se
  descarga vía fetch y se dibuja en `<canvas>`, sin `<iframe>`. No depende
  de ningún header de framing. Cubierto por la CSP actual (`script-src
  'self'`, `connect-src 'self'`). Como mejora aparte, el header global
  pasó de `X-Frame-Options: DENY` a `SAMEORIGIN` (ya no es necesario para
  el PDF, pero es la postura correcta).
- **Intro del quiz amontonada**: `introLead` ahora es un arreglo de
  párrafos; `renderIntro()` los pinta como `<p>` separados.
- **Tag de la lección**: el encabezado de lección ya no muestra la
  etiqueta (PRE / En clase / …) junto al tipo — solo el tipo. La etiqueta
  sigue visible en la lista del módulo.
- **Pantalla final del quiz**: se quitó el resumen de respuestas, la
  fecha de envío y la mención a "resumen". Ahora solo confirma
  "Actividad completada" y el botón para continuar.
- **Barra de avance**: el anillo que pulsa en la lección actual se
  cortaba arriba (el contenedor recorta en vertical por su scroll
  horizontal). Se reacomodó el padding para darle aire sin cambiar la
  altura total de la barra.

## Deploy

1. **Repo → Vercel**: redeploy normal (JS, CSS, PDFs, **vercel.json**).
2. **Supabase**: edge functions `submit-quiz` y `get-resultados-quiz`
   (ya desplegadas).
