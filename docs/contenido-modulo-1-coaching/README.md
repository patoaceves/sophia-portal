# Contenido · Fundamentos de Coaching · Módulo 1: Identidad y Ética Profesional

Curso: **Fundamentos de Coaching SOPHIA** (Coaching I)
Slug propuesto: `fundamentos-de-coaching`
Facilitador sesión 1: Daniel Contreras (con Mariana Riojas en sesiones puntuales)
Directora del programa: Irelda Walls Boone · `irelda.walls@sophiamx.org`

Estos archivos contienen el HTML que va en el campo `Contenido_HTML` (rich text) de cada lección en Airtable.

## Estructura del módulo

| # | Archivo | Lección en Airtable | Tipo | Etiqueta |
|---|---|---|---|---|
| 1 | *(PDF: `/assets/pdf/coaching-carta-bienvenida.pdf`)* | Carta de bienvenida | `pdf` | PRE |
| 2 | `02-trabajo-previo.html` | Trabajo previo a la sesión | `texto` | PRE |
| 3 | *(PDF: `/assets/pdf/coaching-happy-secret.pdf`)* | Quiz: The happy secret to better work | `pdf` | PRE |
| 4 | *(PDF: `/assets/pdf/coaching-handbook-cap1.pdf`)* | Lectura: Capítulo 1 del Complete Handbook of Coaching | `pdf` | PRE |
| 5 | `05-reflexion-personal.html` | Reflexión personal: Identidad y Ética Profesional | `texto` | PRE |
| 6 | `06-journaling.html` | Journaling: Identidad y Ética Profesional | `texto` | PRE |
| 7 | *(PDF pendiente: `/assets/pdf/coaching-evaluacion-s1.pdf`)* | Evaluación | `pdf` | — |
| 8 | `08-tarea.html` | Tarea | `texto` | — |
| 9 | — | Grabación de la sesión | `video` | — |

## Cómo copiar a Airtable

**Lecciones tipo `texto` (2, 5, 6, 8):**
1. Abre el archivo `.html` correspondiente
2. Copia el contenido completo al campo `Contenido_HTML` de la lección en Airtable

**Lecciones tipo `pdf` (1, 3, 4, 7):**
- No requieren `Contenido_HTML`
- Llenar `Url_Externa` con el path del PDF en Vercel:
  - `https://portal.sophiamx.org/assets/pdf/coaching-carta-bienvenida.pdf`
  - `https://portal.sophiamx.org/assets/pdf/coaching-happy-secret.pdf`
  - `https://portal.sophiamx.org/assets/pdf/coaching-handbook-cap1.pdf`
  - `https://portal.sophiamx.org/assets/pdf/coaching-evaluacion-s1.pdf` *(pendiente)*

**Lección 9 (`video`, Grabación de la sesión):**
- Crear la lección vacía en Airtable con tipo `video`
- Llenar el campo `Url_Video` después de la sesión en vivo (YouTube/Vimeo/Drive)
- El portal mostrará un placeholder mientras esté vacía

## PDFs en el repo

Ya incluidos en `/assets/pdf/`:
- ✅ `coaching-carta-bienvenida.pdf` (1.3 MB) — versión corregida (tabla dice "sábados", ya no "jueves")
- ✅ `coaching-happy-secret.pdf` (81 KB)
- ✅ `coaching-handbook-cap1.pdf` (1.3 MB)
- ✅ `coaching-evaluacion-s1.pdf` (4.7 KB) — quiz de 5 preguntas con respuestas marcadas

## Portada del curso

Ya incluida en el repo:
- ✅ `/assets/img/fundamentos-de-coaching/portada.png` (618 KB)

El slug `fundamentos-de-coaching` está registrado en `assets/js/cursos.js` como `LOCAL_COVERS`,
por lo que el portal mostrará automáticamente esta portada como fallback aunque Airtable no tenga
todavía el `Cover image` cargado. Cuando se suba la portada a Airtable, esa toma precedencia.

## Datos del curso para Airtable

### Curso template (tabla `Cursos`)
- **Título:** Fundamentos de Coaching SOPHIA
- **Slug:** `fundamentos-de-coaching`
- **Descripción corta, larga, cover image, color primario, instructor:** *pendiente definir*

### Cohorte inicial (tabla `Cohortes`)
- **Nombre:** `Fundamentos de Coaching - 23.05.2026`
- **Fecha inicio:** 23 May 2026 (sábado)
- **Fecha fin:** 26 Sep 2026 (sábado)
- **Modalidad:** online (Zoom)
- **Horario:** Sábados, 9:00 A.M. a 12:00 P.M.
- **Directora:** Irelda Walls Boone
- **Directora email:** `irelda.walls@sophiamx.org`
- **Primera sesión hora:** "9:00 A.M."

### Calendario completo de sesiones (19 sesiones, sábados)

| # | Fecha | Sesión |
|---|---|---|
| 1 | 23/May/2026 | Introducción al coaching |
| 2 | 30/May/2026 | Introducción a la metodología |
| 3 | 06/Jun/2026 | Bases de la metodología |
| 4 | 13/Jun/2026 | Marcos de pensamiento |
| 5 | 20/Jun/2026 | Lab 1 |
| 6 | 27/Jun/2026 | Phenomenological |
| 7 | 04/Jul/2026 | Las preguntas del acaso |
| 8 | 11/Jul/2026 | Neurociencia en el coaching |
| 9 | 18/Jul/2026 | Niveles existenciales |
| 10 | 25/Jul/2026 | Niveles existenciales 2 |
| 11 | 01/Ago/2026 | Lab 2 |
| 12 | 08/Ago/2026 | Existencialismo |
| 13 | 15/Ago/2026 | Herramientas aplicadas al coaching |
| 14 | 22/Ago/2026 | Dialectics |
| 15 | 29/Ago/2026 | Lab 3 |
| 16 | 05/Sep/2026 | Identificación de tiempo y creatividad |
| 17 | 12/Sep/2026 | Preguntas de imaginación y comprensión |
| 18 | 19/Sep/2026 | Transformational / transcendental |
| 19 | 26/Sep/2026 | Superación de los miedos y creación del proyecto |

### Acceso a sesiones (Zoom)
- **Link:** `https://us06web.zoom.us/j/84222590212?pwd=pClVWtjOanIkdZE4t8nbUhIGFwpKLD.1`
- **Meeting ID:** 842 2259 0212
- **Passcode:** SOPHIA

## Estado actual (20/may/2026)

✅ **Curso creado en Airtable:** `recDnA1GTjUi54GMJ` — "Fundamentos de Coaching SOPHIA"
✅ **Módulo 1 creado:** `recFpQjCqJhrzTecM` — "Sesión 1: Identidad y Ética Profesional"
✅ **9 Lecciones creadas y linkeadas al módulo** — incluye 4 quizzes y 1 tarea
✅ **Cohorte inicial:** `recaVisdV1jQYktY8` (23/may → 04/oct/2026)
✅ **3 invitaciones `pendiente`** para Pedro, Mateo, Patricio
✅ **Foto de Irelada Walls Boone** en `/assets/img/brand/irelda-walls.png`

## Mapeo final de lecciones

| # | Lección | Tipo | Quiz key / contenido |
|---|---|---|---|
| 1 | Carta de bienvenida | `pdf` | `/assets/pdf/coaching-carta-bienvenida.pdf` |
| 2 | Trabajo previo a la sesión | `texto` | HTML con link YouTube |
| 3 | Quiz: The happy secret to better work | `quiz` | `coaching-happy-secret` (reflexivo, sin score) |
| 4 | Lectura: Capítulo 1 del Complete Handbook | `pdf` | `/assets/pdf/coaching-handbook-cap1.pdf` |
| 5 | Reflexión personal | `quiz` | `coaching-reflexion-s1` (1 pregunta texto) |
| 6 | Journaling | `quiz` | `coaching-journaling-s1` (1 pregunta texto) |
| 7 | Evaluación | `quiz` | `coaching-evaluacion-s1` (5 preguntas CON SCORE, retry) |
| 8 | Tarea | `tarea` | Upload de N archivos (max 20MB c/u) + comentario |
| 9 | Grabación de la sesión | `video` | — (vacía) |

## ⚠️ Requiere deploy

### Frontend (Vercel)
- `assets/js/quiz.js`, `quiz-defs.js`, `tarea.js` (NUEVO), `api.js`, `leccion.js`, `icons.js`
- `assets/css/shell.css`
- `assets/pdf/coaching-*.pdf` (4 archivos)
- `assets/img/fundamentos-de-coaching/portada.png`
- `assets/img/brand/irelda-walls.png`

### Edge Functions (Supabase)
- `submit-quiz` (MODIFICADA — idempotente upsert para reintentos)
- `submit-tarea` (NUEVA — upload de archivos)
- `delete-entrega-archivo` (NUEVA — quitar archivos de la entrega)
- `get-resultados-quiz` (MODIFICADA — devuelve archivos + comentario)

### Airtable (ya aplicado)
- Tabla "Actividades en Clase" — 2 nuevos campos:
  - `Archivos` (multipleAttachments) → `fldbUYXX6v8m4oLIv`
  - `Comentario` (multilineText) → `fldLLBYOl8SPkCDmA`
- 4 lecciones convertidas a tipo `quiz` con sus `Url_Externa`
- Lección 8 cambiada a tipo `tarea`

## Notas técnicas

- **Quiz con scoring** retro-compatible: pregunta tipo `choice` con `correcta: <índice>` se evalúa. Sin `correcta`, comportamiento original (sin score).
- **Reintentos de quiz**: el frontend resetea respuestas, el backend hace upsert por (Lección × Inscripción) — no crea duplicados.
- **Reflexión y Journaling**: implementados como quizzes de 1 pregunta tipo `texto`.
- **Tarea con upload**:
  - Bucket reusa `sophia-portal-uploads` (público) con path `tareas/{leccionId}/{personaPortalId}/{uuid}-{filename}`
  - Reusa tabla "Actividades en Clase" — 1 record por (Lección × Inscripción), N archivos en `multipleAttachments`
  - Sin límite de archivos por entrega, 20 MB por archivo, cualquier formato
  - Drag & drop + click-to-pick, barra de progreso, lista con delete individual
  - Textarea de comentario con save independiente
- **Sanitizer bloquea iframes y `style`** en HTML de Airtable. Los embeds de YouTube usan `<a class="btn btn-accent">`.
- **Airtable richText escapa `_`** en atributos HTML. Los links se dejan sin `target="_blank"`.
- **Invitaciones nuevas**: estatus `pendiente` (no `activa`) para que la reconciliación huérfana las detecte.

## Pendientes

1. Push + deploy a Vercel
2. Re-deploy de 4 edge functions a Supabase (ver instrucciones más abajo)
3. **Módulo 0** — Sesión inaugural 23/may, pendiente contenido
4. Módulos 2–19 conforme se reciba temario

## Cómo deployar edge functions

**Desde dashboard de Supabase** (más rápido):
1. https://supabase.com/dashboard → tu proyecto → Edge Functions
2. Para cada función (`submit-quiz`, `submit-tarea`, `delete-entrega-archivo`, `get-resultados-quiz`):
   - Click el botón de edición
   - Reemplaza el código con el contenido de `supabase/functions/{nombre}/index.ts`
   - Deploy

**Con Supabase CLI**:
```bash
supabase functions deploy submit-quiz
supabase functions deploy submit-tarea
supabase functions deploy delete-entrega-archivo
supabase functions deploy get-resultados-quiz
```
