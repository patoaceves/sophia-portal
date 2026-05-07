# SOPHIA Portal

Portal académico de SOPHIA. Frontend estático en Vercel, auth con Supabase, datos en Airtable.

> Producción: `portal.sophiamx.org`
> Curso piloto: **Happiness Workshop**

---

## Stack

- **Frontend**: HTML/CSS/JS estático, deploy en Vercel (`@vercel/static`). Sin frameworks.
- **Auth**: Supabase (Google + Magic Link, flow PKCE).
- **DB**: Airtable. Dos bases: `SOPHIA - Portal` (`app0S6GrJQ8YatvCc`) y `SOPHIA - CRM` (`app1SbOC98k2OP5m1`).
- **API layer**: 7 Supabase Edge Functions (Deno), self-contained, deployadas vía dashboard.

---

## Estructura

```
sophia-portal/
├── index.html                          # login (Google + Magic Link)
├── auth/
│   └── callback.html                   # PKCE callback (exchangeCodeForSession explícito)
├── app/                                # portal del alumno (auth required)
│   ├── index.html                      # redirect → /app/cursos
│   ├── cursos.html                     # mis cursos
│   ├── curso.html                      # ?slug=  → detalle con capítulos/lecciones
│   ├── leccion.html                    # ?id=    → reproductor de lección
│   ├── perfil.html                     # datos del usuario
│   ├── test-felicidad/
│   │   ├── index.html                  # formulario 16 preguntas
│   │   └── resultados.html             # rueda + análisis por pilar
│   └── admin/
│       └── index.html                  # gated por rol === "admin"
├── assets/
│   ├── css/
│   │   ├── base.css                    # design tokens, tipografía, botones, spinner
│   │   ├── login.css                   # estilos página de login
│   │   └── shell.css                   # sidebar + header + páginas internas
│   ├── js/
│   │   ├── supabase-client.js          # singleton (URL + anon key hardcodeados)
│   │   ├── auth.js                     # login/logout/requireAuth/bootstrapPersona/showFatalError
│   │   ├── api.js                      # callEdge() + ApiError + métodos por endpoint
│   │   ├── ui-shell.js                 # renderShell() con NAV_GROUPS + ICONS inline
│   │   ├── cursos.js                   # lógica /app/cursos
│   │   ├── curso.js                    # lógica /app/curso
│   │   ├── leccion.js                  # lógica /app/leccion
│   │   ├── perfil.js                   # lógica /app/perfil
│   │   ├── test-felicidad.js           # lógica formulario test
│   │   ├── test-felicidad-resultados.js  # lógica resultados con rueda SVG
│   │   └── admin.js                    # gate del panel admin
│   ├── icons/                          # 8 SVGs de pilares del Test de Felicidad
│   └── img/                            # portadas, fotos del Capítulo 1
├── supabase/
│   └── functions/                      # 7 Edge Functions auto-contenidas (sin _shared)
│       ├── auth-bootstrap/             # POST: crea/encuentra Persona en CRM
│       ├── get-mis-cursos/             # GET: lista cursos del alumno con %
│       ├── get-curso/                  # GET ?slug= → curso + capítulos + lecciones
│       ├── get-leccion/                # GET ?id= → contenido + prev/next
│       ├── marcar-leccion/             # POST: idempotente, marca completada
│       ├── submit-test-felicidad/      # POST: 16 respuestas → scores + análisis
│       └── get-resultados-test/        # GET: resultados (último o por id)
├── docs/
│   ├── airtable-schema.md
│   ├── deployment.md
│   └── contenido-capitulo-1/           # HTML del contenido del primer cap
├── vercel.json                         # @vercel/static + cleanUrls
└── README.md
```

---

## Patrón de páginas

Cada página de `/app/*` sigue la misma forma:

1. **HTML mínimo** (15 líneas): solo carga CSS + spinner + un `<script type="module" src="...">`
2. **JS por página** (`assets/js/<página>.js`):
   - `requireAuth()` → bloquea o devuelve la `persona`
   - `renderShell({ persona, title, contentHtml })` → pinta sidebar/header/main
   - Llama `api.<endpoint>()` para datos
   - Maneja errores con `ApiError`

```js
// Ejemplo: cursos.js
import { requireAuth } from "./auth.js";
import { api } from "./api.js";
import { renderShell } from "./ui-shell.js";

(async () => {
  const persona = await requireAuth();
  if (!persona) return;
  renderShell({ persona, title: "Mis cursos", contentHtml: "..." });
  const { cursos } = await api.misCursos();
  // render...
})();
```

`renderShell` arma la sidebar a partir del array `NAV_GROUPS` (en `ui-shell.js`), no fetch a partials. Cambiar la nav = editar el array.

---

## Setup local

```bash
git clone <repo> sophia-portal && cd sophia-portal
npx serve .       # o python3 -m http.server 8080
```

No hay variables de entorno locales — la URL y anon key viven hardcoded en `assets/js/supabase-client.js` (la anon key es pública por diseño).

---

## Deploy

### Frontend
```bash
vercel --prod
```

### Edge Functions (vía Dashboard)

Para cada función en `supabase/functions/<nombre>/index.ts`:
1. Supabase Dashboard → Edge Functions → Deploy a new function
2. Nombre = nombre de la carpeta
3. Borrar boilerplate, pegar el contenido del `index.ts`
4. Deploy

Las funciones son auto-contenidas (sin imports a `_shared/`), 1:1 con lo que se pega en el dashboard.

### Secrets de Edge Functions

```bash
supabase secrets set AIRTABLE_PAT=patXXXXX...
# SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY se inyectan automáticamente
```

### Auth providers

**Supabase → Authentication → URL Configuration:**
- Site URL: `https://portal.sophiamx.org`
- Redirect URLs: `https://portal.sophiamx.org/auth/callback`

**Google Cloud Console → OAuth Client → Authorized redirect URIs:**
- `https://ajvjyisplqsrjsessayo.supabase.co/auth/v1/callback`

(El redirect en Google apunta a Supabase, no al portal — Supabase es el intermediario.)

---

## Roles

Definidos en `Personas.Rol` (Airtable, base CRM):
- `participante` — default, acceso a `/app/*` excepto `/app/admin`
- `admin` — acceso completo, ve la sección "Administración" en sidebar
- `instructor` — futuro, no implementado

---

## Reglas del codebase (no romper)

1. **`vercel.json` solo lleva `@vercel/static`**. Nunca agregar `@vercel/node`.
2. **Filtros de Airtable usan field IDs**, nunca field names. Ver el bloque `FIELDS` al inicio de cada Edge Function.
3. **`filterByFormula` mínimo posible**, filtrado pesado en JS post-fetch.
4. **PAT de Airtable SOLO en Edge Functions** (Supabase secrets), nunca expuesta al cliente.
5. **Anon key sí va en cliente** (es pública por diseño).
6. **Cada Edge Function es auto-contenida** (sin imports a `_shared/`). Si actualizas el patrón de auth o CORS, hay que sincronizarlo en las 7.
7. **Páginas HTML son mínimas** — toda la lógica vive en `assets/js/<página>.js`. Para agregar una página nueva, copia este patrón.

---

Mantenido por Patricio (`pato@sophiamx.org`).
