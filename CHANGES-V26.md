# SOPHIA Portal · v26 — "Módulo" + Autoevaluaciones 2.0 + fixes de v25

Tres bloques de cambios: (1) renombrado global **capítulo → Módulo**,
(2) las **8 autoevaciones** del modelo, replicando el formato de la de
Autoconocimiento con su banco de preguntas, color y puntaje propios,
(3) correcciones a lo introducido en v25.

---

## 1. Renombrado: capítulo → Módulo

La palabra "capítulo" era incorrecta; la unidad del curso es un **Módulo**.
("Lección" se mantiene igual.)

**Repo** — se renombró en todo el código, sin dejar una sola ocurrencia de
`capitul`/`capítul`:

- **Texto visible** (UI): "Capítulo N" → "Módulo N", "X capítulos" → "X módulos", etc.
- **Claves JSON del API**: `capitulo` → `modulo`, `capitulos` → `modulos`,
  `capituloId` → `moduloId`. Renombradas en lockstep en las edge functions
  que las emiten (`get-leccion`, `get-curso`, `get-mis-cursos`) y en el
  front que las consume (`curso.js`, `leccion.js`, `temario.js`, `api.js`).
- **Identificadores de código**: variables, funciones y constantes
  (`TABLES.CAPITULOS`→`TABLES.MODULOS`, `FIELDS.CAPITULOS`→`FIELDS.MODULOS`,
  `FIELDS.LECCIONES.CAPITULO`→`FIELDS.LECCIONES.MODULO`, etc.).
  Los **valores** de los field IDs de Airtable NO cambian (no contienen la palabra).
- **Clases CSS**: `.capitulo-card*`→`.modulo-card*`, `.curso-capitulos`→`.curso-modulos`,
  `.capitulos-list`→`.modulos-list`, `…__crumb-cap`→`…__crumb-modulo`, etc.
  Renombradas en `shell.css` y en el HTML que las genera.
- **Carpetas de docs**: `docs/contenido-capitulo-1/2` → `docs/contenido-modulo-1/2`.
- Comentarios, `README.md`, `CHANGES-*` y docs actualizados.

**Airtable** — pendiente, hazlo en el dashboard (es seguro: el código usa
field IDs, no nombres, así que renombrar no rompe nada):

1. Base `SOPHIA - Portal` → renombrar la **tabla `Capítulos` → `Módulos`**.
2. En la tabla `Cursos`, renombrar el campo **`Capítulos` → `Módulos`**.
3. En la tabla `Lecciones`, renombrar el campo link **`Capítulo` → `Módulo`**.
4. (Opcional) Ajustar nombres de vistas/automatizaciones que digan "Capítulo".

> Si prefieres, puedo correr el renombrado de Airtable por el conector.

**Deploy**: redeploy del repo en Vercel + redeploy de `get-leccion`,
`get-curso` y `get-mis-cursos` (cambió el nombre de las claves JSON que
devuelven; front y back deben ir juntos en el mismo deploy).

---

## 2. Autoevaluaciones 2.0 — las 8 autoevaluaciones

Antes solo existía la autoevaluación de **Autoconocimiento**. Ahora los
**8 pilares** del modelo SOPHIA tienen autoevaluación, replicando el mismo
formato: 8 preguntas (una por nivel de integración), Likert 1–5, suma 8–40
→ % de integración → 4 bandas (Fortaleza Actual / Zona de Crecimiento /
Área de Atención / Área Vulnerable). Cada pilar tiene **su propio banco de
preguntas (PDF 2.0), su color y su puntaje**.

### Enfoque: un sistema genérico

En vez de duplicar el wizard 7 veces, se construyó **un solo sistema
genérico** parametrizado por la clave del pilar (`autoconocimiento`,
`bienestar_emocional`, `bienestar_fisico`, `presencia_consciente`,
`trabajo_proposito`, `vinculos_vitales`, `estetica_existencial`,
`fe_filosofia`), mismo patrón que el sistema de quizzes (`quiz-defs.js`).

**Autoconocimiento NO se tocó:** conserva su wizard y edge functions
propios (`test-autoconocimiento.js`, `submit-test-autoconocimiento`,
`get-resultados-autoconocimiento`), que están en producción. El sistema
genérico atiende los **otros 7 pilares**. (El sistema genérico es capaz de
correr Autoconocimiento también; migrarlo queda como mejora opcional.)

### Archivos nuevos

- **`assets/js/autoeval-defs.js`** — banco central. Las 64 preguntas del
  PDF 2.0 (8 pilares × 8), un `accentColor` por pilar, los textos de banda
  (lead + 2 pasos por cada una de las 4 bandas) y el modelo de puntaje
  compartido. Única fuente de verdad del contenido.
- **`assets/js/autoeval.js`** — wizard genérico. `mountWizard({container,
  autoevalKey, inscripcionId, leccionId, cursoSlug, embedded, onComplete})`.
  Generalización 1:1 del wizard de Autoconocimiento.
- **`assets/js/autoeval-resultados.js`** — página de resultados genérica
  (wedge SVG + banda + lead + pasos), teñida con el color del pilar.
- **`supabase/functions/submit-autoeval/index.ts`** — edge function
  genérica. Valida las 8 respuestas Likert, calcula total/pct/banda y
  guarda en `RespuestasAutoeval`. El payload lleva `autoevalKey` como
  discriminador; **no guarda texto** (el contenido vive en el front).
- **`supabase/functions/get-resultados-autoeval/index.ts`** — lee el último
  resultado (o uno específico) de un pilar para el usuario. Reconoce además
  los registros legacy de Autoconocimiento.
- **`app/autoevaluacion/index.html`** y **`app/autoevaluacion/resultados.html`**
  — páginas standalone del sistema genérico (`?autoeval=<pilar>`).

### Archivos modificados

- **`assets/js/api.js`** — métodos `submitAutoeval(autoevalKey, ...)` y
  `resultadosAutoeval(autoevalKey, ...)`. Los de Autoconocimiento se
  conservan.
- **`assets/js/leccion.js`** — una lección tipo `autoeval` se rutea así:
  Autoconocimiento → wizard propio; uno de los otros 7 pilares → wizard
  genérico (la clave del pilar se lee de `urlExterna`); cualquier otro
  caso → Test de Felicidad.

### Lo que falta hacer en Airtable (pendiente para ti)

El sistema **no requiere** crear registros en la tabla `Autoevaluaciones`
(la clave del pilar en el payload basta como discriminador). Pero sí hace
falta:

1. **Crear las 7 lecciones de autoevaluación** (una por módulo nuevo), tipo
   `autoeval`.
2. En cada una, poner en el campo **`Url_Externa`** la clave del pilar:
   `bienestar_emocional`, `bienestar_fisico`, `presencia_consciente`,
   `trabajo_proposito`, `vinculos_vitales`, `estetica_existencial`,
   `fe_filosofia`. (Así `leccion.js` sabe qué pilar montar.)

### Pendientes de contenido (importante)

- **Textos de banda provisionales:** solo los de **Autoconocimiento** son
  definitivos (Lic. Mariana Riojas). Los lead/pasos de las 4 bandas de los
  **otros 7 pilares** en `autoeval-defs.js` están redactados como **borrador
  provisional** y marcados con `// PROVISIONAL`. Hay que revisarlos /
  aprobarlos con la Lic. Riojas antes de publicar esos módulos.
- **Paleta de colores:** el `accentColor` de los 7 pilares nuevos es una
  propuesta inicial; ajústala a gusto en `autoeval-defs.js`.

> Correcciones de transcripción del PDF: se corrigieron erratas obvias
> ("permitirte"→"permitirme", "tu día a día"→"mi día a día", "actividad
> físico"→"física", "harmonía"→"armonía", "lo que haces"→"lo que hago") y
> se normalizaron las preguntas a afirmaciones en primera persona, acorde
> a la escala de acuerdo del wizard.

**Deploy**: redeploy del repo en Vercel + deploy de las 2 edge functions
nuevas: `submit-autoeval` y `get-resultados-autoeval`.

---

## 3. Correcciones a v25

- **`icons.js`** — `lessonIcon()` y `lessonTipoLabel()` no tenían caso para
  los tipos `quiz` ni `pdf` (introducidos en v25). Agregados: `quiz` →
  "Actividad en clase" (ícono `lessonTest`), `pdf` → "Documento" (ícono
  `lessonDocumento`).
- **`submit-quiz`** — `inscripcionId` ahora es **obligatorio**. Antes era
  opcional, pero `get-resultados-quiz` solo encuentra registros con link de
  inscripción del usuario; un quiz enviado sin él quedaba huérfano. La
  validación de ownership ahora corre siempre.
- **`get-resultados-quiz`** — ya no hace un scan de toda la tabla
  "Actividades en Clase": filtra server-side por el link de Lección con
  `filterByFormula` (usando field ID, según la regla de oro).
- **`.gitignore`** (NUEVO) + se quitaron del repo los `.DS_Store`
  versionados y la basura `__MACOSX`.
- **`quiz.js`** — `renderResumen()` ya no recibe un parámetro `state` que
  no usaba (limpieza menor).

**Deploy de edge functions** (Supabase): `submit-quiz` y `get-resultados-quiz`.

---

## Resumen de deploy

1. **Vercel**: redeploy del repo (incluye el rename, el sistema de
   autoevaluaciones, `icons.js`, `.gitignore`).
2. **Supabase edge functions**:
   - Nuevas: `submit-autoeval`, `get-resultados-autoeval`.
   - Por el rename de claves JSON: `get-leccion`, `get-curso`,
     `get-mis-cursos` (deben ir junto con el deploy de Vercel).
   - Fixes v25: `submit-quiz`, `get-resultados-quiz`.
   - `submit-test-autoconocimiento` / `get-resultados-autoconocimiento` NO
     necesitan redeploy (Autoconocimiento no se tocó).
3. **Airtable**:
   - Renombrar tabla `Capítulos`→`Módulos` y campos asociados (sección 1).
   - Crear las 7 lecciones de autoevaluación de los módulos nuevos y poner
     la clave del pilar en `Url_Externa` (sección 2).
4. **Contenido**: revisar con la Lic. Mariana Riojas los textos de banda
   provisionales de los 7 pilares nuevos antes de publicarlos.
