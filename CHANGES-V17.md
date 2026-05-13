# SOPHIA Portal · v17 · Cap 2 Autoconocimiento + Autoeval VIA

Continúa la línea de Cap 1: contenido (nota técnica + caso) +
autoevaluación que se conecta al dashboard del curso. Esta vez es la
**clasificación VIA de fortalezas de carácter** (Peterson & Seligman,
2004): 24 fortalezas agrupadas en 6 virtudes universales.

## Qué cambia para el participante

- En el temario del Happiness Workshop ahora hay 3 lecciones nuevas en Cap 2:
  - **Nota técnica: Autoconocimiento** (con retrato de Seligman + tabla VIA)
  - **Caso 2: La casa detrás del ventanal** (Valeria, 40 años, journaling)
  - **Autoevaluación VIA: Tus fortalezas de carácter** (24 preguntas, ~7 min)

- Al terminar la autoeval, ve sus resultados con:
  - **Top 5 Fortalezas firma** (las que más lo definen hoy)
  - **Ranking completo** de las 24, color por virtud, animación stagger
  - **6 virtudes** con promedio, banda (Alto/Medio/Bajo) y análisis textual
  - Pregunta de reflexión para la libreta de journaling

- En el dashboard del Resumen aparece una nueva **cajita VIA** debajo
  del row foro+felicidad:
  - Si no la ha tomado: invitación a comenzar
  - Si ya la tomó: sus 3 fortalezas firma + link al ranking completo

## Qué cambia técnicamente

### Files nuevos

```
app/test-autoconocimiento/
  index.html                       Standalone entry para el wizard VIA
  resultados.html                  Página de resultados

assets/js/
  test-autoconocimiento.js         Wizard de 24 preguntas (export mountWizard)
  test-autoconocimiento-resultados.js   Render de signature, virtudes, ranking

assets/img/happiness-workshop/autoconocimiento/
  martin-seligman.png              Retrato Seligman (nota técnica)
  fortalezas-de-caracter.png       Tabla VIA Peterson & Seligman 2004

supabase/functions/
  submit-test-autoconocimiento/index.ts       Calcula ranking + virtudes + analisis
  get-resultados-autoconocimiento/index.ts    Lee respuestas (3 modos)

docs/contenido-capitulo-2/
  README.md                        Guía para pegar a Airtable
  01-nota-tecnica.html             Contenido lección 1 (rich text)
  02-caso.html                     Contenido lección 2 (rich text)
  03-autoeval.html                 Contenido lección 3 (rich text)
```

### Files modificados

```
assets/js/
  api.js                  + submitAutoconocimiento + resultadosAutoconocimiento
  leccion.js              Dispatch del wizard según autoevalTipo
                          + path rewrites para martin-seligman / fortalezas-de-caracter
  curso.js                Fetch del resultado VIA en Promise.all
                          + renderAutoconocimientoCajita en Resumen

assets/css/shell.css      + ~500 líneas de estilos para .via-signature,
                          .via-virtud-card, .via-rank-row, .via-cajita,
                          .via-reflexion, etc.

supabase/functions/
  get-leccion/index.ts    + KNOWN_AUTOEVAL_IDS map
                          + autoevalTipo en la respuesta

docs/
  airtable-schema.md      Nota sobre los 2 record IDs conocidos de Autoevaluaciones
```

## Arquitectura · cómo decide el portal qué wizard montar

El portal soporta múltiples tipos de autoeval con el mismo `tipo: "autoeval"`
en la tabla Lecciones. Para diferenciar entre **felicidad** y
**autoconocimiento**, `get-leccion` ahora compara el `autoevalId` (record ID
del Autoevaluacion linkeado) contra el mapa `KNOWN_AUTOEVAL_IDS`:

```ts
// supabase/functions/get-leccion/index.ts
const KNOWN_AUTOEVAL_IDS: Record<string, "felicidad" | "autoconocimiento"> = {
  "recjMR4P4TFLvFQ4A": "felicidad",
  "recREPLACE_ME_AUTOCONOCIMIENTO": "autoconocimiento",
};
```

La respuesta de `get-leccion` ahora trae `autoevalTipo`. En `leccion.js`:

```js
if (leccion.autoevalTipo === "autoconocimiento") {
  mountAutoconocimientoWizard({...});
} else {
  mountTestWizard({...});  // default: felicidad (compat)
}
```

Cuando agreguemos un Cap 3 con su propio autoeval, basta con:
1. Crear el record en Autoevaluaciones (con su Tipo)
2. Pegar el ID en `KNOWN_AUTOEVAL_IDS`
3. Crear las edge functions `submit-test-<tipo>` y `get-resultados-<tipo>`
4. Crear `test-<tipo>.js` y `test-<tipo>-resultados.js`
5. Importar `mountWizard` en `leccion.js` y agregar el `if` correspondiente

## Modelo VIA

24 fortalezas, 6 virtudes, 1 pregunta por fortaleza, Likert 1-5
(Casi nunca → Casi siempre).

```
I.   Sabiduría        S1 Creatividad  S2 Curiosidad  S3 Apertura  S4 Aprender  S5 Perspectiva
II.  Coraje           C1 Valentía     C2 Persistencia  C3 Integridad  C4 Vitalidad
III. Humanidad        H1 Amor         H2 Amabilidad  H3 Inteligencia social
IV.  Justicia         J1 Ciudadanía   J2 Justicia    J3 Liderazgo
V.   Moderación       M1 Perdón       M2 Humildad    M3 Prudencia  M4 Autorregulación
VI.  Trascendencia    T1 Belleza      T2 Gratitud    T3 Esperanza  T4 Humor  T5 Espiritualidad
```

- **Score por fortaleza**: 1-5 (= valor Likert)
- **Promedio por virtud**: avg de sus fortalezas
- **Banda**: Alto >= 4.0, Medio >= 2.6, Bajo < 2.6
- **Signature strengths**: top 5 del ranking (estable por orden canónico VIA)

Análisis textual hardcoded en `submit-test-autoconocimiento` (`ANALISIS` map),
3 párrafos por virtud según banda — mismo patrón que test-felicidad.

## DEPLOY · pasos en orden

> ✅ **El registro de Autoevaluación ya está creado en Airtable**:
> `recDLCMOgTZChS6Yf` ("Autoevaluación VIA: Fortalezas de carácter").
> Las 3 edge functions ya tienen el ID real (`recDLCMOgTZChS6Yf`),
> no hay placeholders pendientes.
>
> Nota: el campo `Tipo` quedó como `custom` porque la API no permite
> agregar opciones nuevas a singleSelects. Si prefieres `evalautoconocimiento`
> (paralelo a `evalfelicidad`), agrégala como opción en Airtable UI y
> cámbialo en el registro. El portal no lo lee — discrimina por record ID.

### 1) Deploy de Edge Functions

```bash
supabase functions deploy submit-test-autoconocimiento
supabase functions deploy get-resultados-autoconocimiento
supabase functions deploy get-leccion
```

(O subir vía dashboard de Supabase, función por función, igual que con felicidad.)

### 2) Airtable · Crear las lecciones del Cap 2

En la tabla **Capítulos**, capítulo de orden 2 ("Autoconocimiento") del
Happiness Workshop. Crear 3 lecciones linkeadas:

| Orden | Título | Tipo | Etiqueta | Contenido_HTML |
|---|---|---|---|---|
| 1 | Nota técnica: Autoconocimiento | `texto` | PRE | `docs/contenido-capitulo-2/01-nota-tecnica.html` |
| 2 | Caso 2: La casa detrás del ventanal | `texto` | PRE | `docs/contenido-capitulo-2/02-caso.html` |
| 3 | Autoevaluación VIA: Tus fortalezas de carácter | `autoeval` | PRE | `docs/contenido-capitulo-2/03-autoeval.html` |

Para la lección 3, además linkear el campo `Autoeval` al registro
`recDLCMOgTZChS6Yf` (Autoevaluación VIA).

### 3) Frontend (Vercel)

Push del repo a GitHub. Vercel autodeploya. No hay cambios de `vercel.json`
ni de paquetes.

### 4) Smoke test

- Login al portal
- Ir al Happiness Workshop > Resumen
- Verificar que aparece la "cajita VIA" abajo del row foro/felicidad,
  invitando a comenzar
- Ir al Cap 2, abrir la lección 3, completar el wizard
- Verificar redirect a `/app/test-autoconocimiento/resultados?id=...`
- Verificar las 4 secciones: signature, virtudes, ranking, reflexión
- Volver al dashboard, verificar que la cajita ahora muestra Top 3 firma

## Notas de diseño

- **Por qué no rueda**: 24 fortalezas no caben en una rueda legible. Usamos
  ranking horizontal con animación stagger — cada fila aparece con 50ms
  de delay, da sensación de "revelación" progresiva sin abrumar.
- **Color por virtud**: 6 colores distintos, asignados via `--virtud-color`
  CSS var inline en cada card. Permite que el azul (sabiduría) coincida
  con el color del pilar Autoconocimiento en el dashboard.
- **Fortalezas firma resaltadas en el ranking**: las primeras 5 filas
  tienen `.is-signature` con número en color sólido (vs outlined) y
  fortaleza en peso 600. El usuario las identifica visualmente sin
  necesidad de un divider.
- **Análisis textual al nivel de virtud, no de fortaleza**: el VIA tiene
  24 fortalezas pero solo 6 virtudes — escribir 24 textos por banda da
  72 textos. Con virtudes son 18, manejables y revisables. Las
  fortalezas individuales se entienden por su nombre.
