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

Pendiente:
- ⏳ `coaching-evaluacion-s1.pdf` — el quiz de 5 preguntas con respuestas marcadas se entregará como PDF

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

## Pendientes para que el curso quede activo

1. Recibir `coaching-evaluacion-s1.pdf` (lección 7)
2. Definir color primario del curso (hex)
3. Definir descripción corta y larga del curso
4. Crear en Airtable: Curso → Módulo 1 → 9 Lecciones → Cohorte inicial
5. Foto de Irelda Walls Boone (para el email de bienvenida del portal)
6. Continuar con módulos 2–19 conforme se reciba el temario
