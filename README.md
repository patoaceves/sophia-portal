# SOPHIA Portal

Portal académico de SOPHIA. Frontend estático en Vercel, auth con Supabase, datos en Airtable.

> Dominio de producción: `portal.sophiamx.org`
> Curso piloto: **Happiness Workshop**

---

## Stack

- **Frontend**: HTML/CSS/JS estático, deploy en Vercel (`@vercel/static`). Sin frameworks.
- **Auth**: Supabase (Google + Microsoft + Magic Link)
- **DB**: Airtable. Base `SOPHIA - Portal` (`app0S6GrJQ8YatvCc`) con tablas synced desde `SOPHIA - CRM`.
- **API layer**: Supabase Edge Functions (Deno) que leen/escriben Airtable. El PAT de Airtable nunca toca el cliente.
- **Storage**: Supabase Storage (entregas de tareas; los avatars y portadas se sirven de `/assets/img/`).

---

## Estructura del repo

```
sophia-portal/
├── index.html                       # landing + login (rutea a /app si hay sesión)
├── auth/
│   └── callback.html                # OAuth + magic link landing
├── app/                             # portal del alumno (auth required)
│   ├── cursos.html                  # mis cursos
│   ├── curso.html                   # ?slug=happiness-workshop  → course player
│   ├── perfil.html                  # datos del alumno
│   └── test-felicidad/
│       ├── index.html               # formulario 16 preguntas
│       └── resultados.html          # dashboard rueda 8 pilares
├── assets/
│   ├── css/main.css                 # design system completo
│   ├── js/
│   │   ├── supabase-client.js       # cliente singleton
│   │   ├── auth.js                  # guard, getSession, signOut
│   │   ├── api.js                   # wrapper de fetch a Edge Functions
│   │   └── ui-shell.js              # carga sidebar/header en /app
│   ├── icons/                       # 8 SVGs de pilares
│   └── img/                         # portadas, fotos, imágenes Nota Técnica
├── partials/
│   ├── sidebar.html
│   └── header.html
├── supabase/
│   └── functions/                  # Cada función es auto-contenida (paste en dashboard)
│       ├── auth-bootstrap/         # primera vez: linkea sesión con Persona del CRM
│       ├── get-mis-cursos/         # lista de cursos del alumno con % progreso
│       ├── get-curso/              # detalle curso + capítulos + lecciones
│       ├── get-leccion/            # contenido de una lección
│       ├── marcar-leccion/         # marca lección completada
│       ├── submit-test-felicidad/  # recibe respuestas, calcula scores, guarda
│       └── get-resultados-test/    # devuelve scores y análisis para dashboard
├── docs/
│   ├── airtable-schema.md           # tabla de field IDs por tabla
│   └── deployment.md                # cómo deployar
├── .env.example
├── vercel.json                      # solo @vercel/static
├── package.json                     # solo para dev tooling (opcional)
└── README.md
```

---

## Setup local (dev)

```bash
# 1. Clona y entra al repo
git clone <repo-url> sophia-portal && cd sophia-portal

# 2. Copia las variables
cp .env.example .env.local

# 3. Sirve estático (cualquier servidor)
npx serve .
# o: python3 -m http.server 8080
```

Las variables de entorno del frontend viven en `assets/js/config.js` (gitignored). Para producción se inyectan en build/deploy (ver `docs/deployment.md`).

---

## Setup de servicios

### 1. Supabase

1. Proyecto: `sophia-portal` (region us-east o us-west)
2. Auth → Providers:
   - Google: client ID/secret de Google Cloud Console (autorizar `https://portal.sophiamx.org/auth/callback` y `http://localhost:*/auth/callback`)
   - Microsoft (Azure AD): mismo callback
   - Email (magic link): activar
3. Auth → URL Configuration:
   - Site URL: `https://portal.sophiamx.org`
   - Redirect URLs: agregar `https://portal.sophiamx.org/auth/callback`
4. **IMPORTANTE**: Auth → Email → desactivar "Confirm email" si quieres que el magic link funcione sin double-opt-in. (Ver nota en `docs/deployment.md`.)

### 2. Airtable

Bases:
- `SOPHIA - Portal` (`app0S6GrJQ8YatvCc`) — cursos, capítulos, lecciones, inscripciones, progreso, autoeval.
- `SOPHIA - CRM` (`app1SbOC98k2OP5m1`) — Personas (con `Auth User ID` linkeado a Supabase).

Crear un **Personal Access Token** con scopes:
- `data.records:read`, `data.records:write` (ambas bases)
- `schema.bases:read` (ambas bases)

Guardar como secret de Supabase Edge Functions: `AIRTABLE_PAT`.

### 3. Variables de Edge Functions

```bash
# Vía dashboard (Settings → Edge Functions → Secrets) o CLI:
supabase secrets set AIRTABLE_PAT=patXXXXX...
# SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY (o SUPABASE_ANON_KEY) ya están auto-inyectadas.
```

---

## Deploy

```bash
# Frontend
vercel --prod
```

**Edge Functions: deploy via Supabase Dashboard.** Cada archivo en `supabase/functions/<nombre>/index.ts` es auto-contenido (sin imports a `_shared/`), listo para pegar tal cual en el dashboard:

1. Supabase Dashboard → Edge Functions → Deploy a new function
2. Nombre = nombre de la carpeta (`auth-bootstrap`, `get-curso`, etc.)
3. Borrar boilerplate, pegar contenido de `index.ts`
4. Deploy

(Si prefieres CLI, también sirve: `supabase functions deploy <nombre>` desde la raíz del repo.)

---

## Reglas del codebase (no romper)

1. **`vercel.json` solo lleva `@vercel/static`**. Nunca agregar `@vercel/node`.
2. **Filtros de Airtable usan field IDs**, nunca field names. Ver el bloque `FIELDS` al inicio de cada Edge Function.
3. **`filterByFormula` mínimo posible**, filtrado pesado en JS post-fetch.
4. **PAT de Airtable SOLO en Edge Functions** (Supabase secrets), nunca expuesta al cliente.
5. **Anon key sí va en cliente**, es la clave que valida JWT del usuario.
6. **Cada Edge Function es auto-contenida** (todo el helper code inline). No hay carpeta `_shared/`. Si actualizas el patrón de auth o CORS, actualízalo en las 7 funciones.

---

## Estado actual del Happiness Workshop

- ✅ 9 capítulos creados (Capítulo 1 con contenido, Capítulos 2-9 vacíos pendientes)
- ✅ Capítulo 1 con 5 lecciones: Bienvenida, Claustro, Nota técnica, Caso 1, Test de Felicidad
- ✅ Test de Felicidad integrado al portal (form + dashboard rueda)
- ⏳ Sesiones live (lecciones tipo `sesion_live`) las agrega Pato manualmente cuando tenga URLs de Zoom

---

Mantenido por Patricio (`pato@sophiamx.org`).
