# Contenido · Módulo 1: Introducción a Happiness Workshop

Estos archivos contienen el HTML que va en el campo `Contenido_HTML` (rich text) de cada lección.
Cópialos a Airtable así:

| # | Archivo | Lección | Tipo | Etiqueta |
|---|---|---|---|---|
| 1 | `01-bienvenida.html` | Bienvenida al Happiness Workshop | `texto` |, |
| 2 | `02-claustro.html` | Claustro: Tus ponentes | `texto` |, |
| 3 | `03-nota-tecnica.html` | Nota técnica: Hablemos de felicidad | `texto` | PRE |
| 4 | `04-caso.html` | Caso 1: No es tu ruta, ni la mía | `texto` | PRE |
| 5 | `05-test-felicidad.html` | Test de Felicidad | `autoeval` | PRE |

## Sobre las imágenes

Las imágenes se referencian con paths absolutos `/assets/img/...` que apuntan al deploy en Vercel.
Esto funciona cuando Airtable renderiza el HTML dentro del portal (vía la Edge Function `get-leccion`),
pero **NO** funciona cuando ves la lección directamente en Airtable.

Si quieres ver el preview correcto en Airtable, reemplaza `/assets/img/` por la URL completa:
`https://portal.sophiamx.org/assets/img/...` después de hacer el primer deploy.

## Imágenes incluidas

- `intro-hw.png`, Foto de comunidad (Bienvenida)
- `mariana-riojas.png`, Retrato de Mariana (Bienvenida)
- `claustro-1.jpg` y `claustro-2.jpg`, Páginas del PDF de ponentes
- `modelo-felicidad-rueda.png`, Rueda de los 8 elementos (Nota técnica)
- `modelo-felicidad-niveles.png`, Fan/gradient de niveles de integración (Nota técnica)
- `aristoteles.png`, Busto de Aristóteles (Nota técnica)

## Lección 5 (Test de Felicidad)

El campo `Contenido_HTML` lleva el contenido de `05-test-felicidad.html`.
Adicionalmente, esta lección debe estar:

- `Tipo` = `autoeval`
- `Autoeval` linkeada a un registro de la tabla `Autoevaluaciones` con:
  - Título: "Test de Felicidad"
  - Tipo: `evalfelicidad`

El portal renderiza automáticamente el botón "Comenzar Test de Felicidad →" cuando detecta que
una lección es tipo `autoeval` linkeada a una autoeval con `Tipo = evalfelicidad`. El botón abre
`/app/test-felicidad?inscripcion={id}&leccion={id}` que es el formulario integrado al portal.
