# SOPHIA Portal · Pruebas de carga (k6)

Suite mínima de load testing para detectar el **scaling cliff de Airtable**
(lecturas de tabla completa en las Edge Functions) antes de que ocurra en
producción con una cohorte grande.

## Por qué

Varias Edge Functions leen tablas completas de Airtable y filtran en memoria
(`get-mis-cursos`, `get-curso`, `get-leccion`, `marcar-leccion`,
`get-foro-posts`). Con pocos usuarios va bien; con miles de registros la
latencia sube y se acerca al **rate limit de Airtable (5 req/seg por base)**.
Estas pruebas te dicen *a cuántos usuarios concurrentes* empieza a doler.

## Instalar k6

```bash
# macOS
brew install k6
# otros: https://k6.io/docs/get-started/installation/
```

## Conseguir un JWT de prueba

1. Inicia sesión en el portal en el navegador (con un usuario de prueba que ya
   esté inscrito a un curso).
2. DevTools → Application → Local Storage → busca la key de Supabase auth →
   copia el `access_token`.

> El magic-link no se automatiza bien en k6. Usar un token pre-generado es el
> patrón estándar para load testing de Supabase. El token expira en ~1h, así
> que regéralo si el test falla con 401.

También necesitas: `CURSO_SLUG`, `CURSO_ID` (recXXX), `LECCION_ID`,
`INSCRIPCION_ID` de ese mismo usuario/curso.

## Correr

### Recorrido del alumno (dashboard → curso → lección → foro)

```bash
SUPABASE_URL=https://ajvjyisplqsrjsessayo.supabase.co \
ANON_KEY=<anon_key> \
JWT=<access_token> \
CURSO_SLUG=<slug> \
CURSO_ID=<recXXXX> \
LECCION_ID=<recYYYY> \
INSCRIPCION_ID=<recZZZZ> \
k6 run load-tests/sophia-load.js
```

Perfiles (`-e STAGE=`):

| STAGE    | Carga                          | Para qué |
|----------|--------------------------------|----------|
| `smoke`  | 1 usuario, 30s (default)       | Sanity check, ¿funciona? |
| `ramp`   | sube a 100 VUs en ~7min        | Carga realista de cohorte |
| `stress` | sube a 500 VUs en ~10min       | Encontrar el punto de quiebre |

```bash
k6 run -e STAGE=ramp load-tests/sophia-load.js
```

### Uploads (presión de memoria)

```bash
SUPABASE_URL=https://ajvjyisplqsrjsessayo.supabase.co \
ANON_KEY=<anon_key> \
JWT=<access_token> \
CURSO_ID=<recXXXX> \
k6 run -e VUS=20 -e DURATION=1m load-tests/sophia-upload.js
```

## Cómo leer resultados

- **`ep_*` (Trend):** latencia por endpoint. Mira `p(95)`.
- **`errors_endpoint` / `errors_upload` (Rate):** % de respuestas no-2xx.
  Si sube bajo carga, probablemente son **429 de Airtable** (rate limit) o
  timeouts.
- **Thresholds:** k6 marca el run como fallido si se cruzan. Los defaults son
  p95 < 1.5s en lecturas y error rate < 1%.

### Señal de alarma

Si en `ramp` (≤100 VUs) ya ves error rate > 1% o p95 > 2s en `ep_mis_cursos` /
`ep_curso`, **ese es el cliff de Airtable**. Es la señal para priorizar mover
las tablas transaccionales (progreso, inscripciones, posts) a Postgres.

## Limpieza

El test de uploads crea archivos reales en Storage (`foro/<cursoId>/...`).
La función `cleanup-orphan-uploads` los recoge si no quedan asociados, pero
conviene correr el test contra un curso de prueba y limpiar el bucket después.
