# Contenido · Capítulo 2: Autoconocimiento

Estos archivos contienen el HTML que va en el campo `Contenido_HTML` (rich text) de cada lección.
Cópialos a Airtable así:

| # | Archivo | Lección | Tipo | Etiqueta |
|---|---|---|---|---|
| 1 | `01-nota-tecnica.html` | Nota técnica: Autoconocimiento | `texto` | PRE |
| 2 | `02-caso.html` | Caso 2: La casa detrás del ventanal | `texto` | PRE |
| 3 | `03-autoeval.html` | Autoevaluación VIA: Tus fortalezas de carácter | `autoeval` | PRE |

## Sobre las imágenes

Las imágenes nuevas viven en `/assets/img/happiness-workshop/autoconocimiento/`:

- `martin-seligman.png`, Retrato de Martin Seligman (Nota técnica, sección 2)
- `fortalezas-de-caracter.png`, Tabla VIA Peterson & Seligman 2004 (Nota técnica, sección 3)

Como en el Cap 1, los paths absolutos `/assets/img/...` funcionan dentro del portal vía
`get-leccion`, pero NO funcionan al ver la lección directamente en Airtable. Si quieres
preview en Airtable, sustituye por `https://portal.sophiamx.org/assets/img/...` después
del deploy.

`sanitizeLessonContent()` en `leccion.js` reescribe estos paths si vienen "bare" (sin
slash inicial) o desde la ubicación legacy, así que puedes pegar el HTML tal cual sin
preocuparte por rutas.

## Lección 3 (Autoevaluación VIA)

El campo `Contenido_HTML` lleva el contenido de `03-autoeval.html`.
Adicionalmente, esta lección debe estar:

- `Tipo` = `autoeval`
- `Autoeval` linkeada al registro **`recDLCMOgTZChS6Yf`** en la tabla
  `Autoevaluaciones` (ya creado, título "Autoevaluación VIA: Fortalezas de carácter")

El portal detecta automáticamente el tipo de autoeval vía el nuevo campo
`autoevalTipo` que devuelve `get-leccion`, y monta el wizard correcto
(felicidad vs autoconocimiento) sin necesidad de tocar la lección.
