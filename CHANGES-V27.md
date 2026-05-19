# SOPHIA Portal — Cambios V27

## Migración Autoconocimiento al sistema genérico

`submit-test-autoconocimiento` y `get-resultados-autoconocimiento` ya pueden
darse de baja en Supabase. Autoconocimiento ahora corre sobre el mismo stack
que los otros 7 pilares.

### Cambios en el repo

**`assets/js/curso.js`**
- `api.resultadosAutoconocimiento()` → `api.resultadosAutoeval("autoconocimiento")`
- `bandaColor` se resuelve desde `autoeval-defs.js` (ya no viene del backend)
- Links de resultados: `/app/test-autoconocimiento/resultados?id=…`
  → `/app/autoevaluacion/resultados?autoeval=autoconocimiento&id=…`
- Agrega `import { bandaColor as autoevalBandaColor } from "./autoeval-defs.js"`

**`app/test-autoconocimiento/index.html`**
- Carga `autoeval.js` en lugar de `test-autoconocimiento.js`
- `autoeval.js` ya tiene fallback a `autoconocimiento` cuando no hay `?autoeval=`
  → las URLs existentes `/app/test-autoconocimiento/` siguen funcionando

**`app/test-autoconocimiento/resultados.html`**
- Carga `autoeval-resultados.js` en lugar de `test-autoconocimiento-resultados.js`

### Deploy

**Vercel**: redeploy estático (los 3 archivos cambiados son assets del front).

**Supabase** (nuevas — deployar antes del front):
- `submit-autoeval`
- `get-resultados-autoeval`

**Supabase** (retirar después de verificar):
- `submit-test-autoconocimiento`
- `get-resultados-autoconocimiento`

### Airtable (pendiente)
- Renombrar tabla `Capítulos` → `Módulos`
- Crear 7 lecciones tipo `autoeval` con clave del pilar en `Url_Externa`:
  `bienestar_emocional`, `bienestar_fisico`, `presencia_consciente`,
  `trabajo_proposito`, `vinculos_vitales`, `estetica_existencial`, `fe_filosofia`
