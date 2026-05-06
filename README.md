# SOPHIA Portal

Portal académico de SOPHIA. Frontend estático en Vercel, auth con Supabase, datos en Airtable.

## Stack

- **Frontend**: HTML/CSS/JS estático, deploy en Vercel (`@vercel/static`)
- **Auth**: Supabase (Google + Microsoft + Magic Link)
- **DB**: Airtable (2 bases: `SOPHIA - CRM` master, `SOPHIA - Portal` con tablas synced)
- **API layer**: Supabase Edge Functions (Deno) que leen/escriben Airtable
- **Storage de archivos**: Supabase Storage (entregas de alumnos)

## Estructura

```
sophia-portal/
├── index.html              # landing + login
├── auth/callback.html      # OAuth + magic link landing
├── app/                    # portal del alumno (auth required)
│   ├── cursos.html
│   ├── curso.html          # ?slug=
│   ├── perfil.html
│   └── admin/              # solo rol=admin
├── assets/css/             # estilos
├── assets/js/              # cliente Supabase, auth, api wrappers, ui shell
├── partials/               # sidebar, header (cargados por fetch)
└── supabase/functions/     # Edge Functions (TypeScript/Deno)
```

## Setup local

1. Clona el repo
2. Copia `.env.example` a `.env.local` y llena los valores (ver sección abajo)
3. Para development: cualquier servidor estático (`npx serve`, `python -m http.server`, etc.)
4. Las Edge Functions se prueban con `supabase functions serve`

## Variables de entorno

### Frontend (público, se hardcodea en `assets/js/supabase-client.js`)

```
SUPABASE_URL=https://ajvjyisplqsrjsessayo.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_S_Jb79kSSmjLvGNIP2J7kA_uMiJrSvx
```

### Edge Functions (secrets en Supabase, NO al repo)

```
AIRTABLE_PAT=patXXXXXXXXXXXXX...
AIRTABLE_BASE_PORTAL=app0S6GrJQ8YatvCc
AIRTABLE_BASE_CRM=app1SbOC98k2OP5m1
```

Configurar con:
```bash
supabase secrets set AIRTABLE_PAT=patXXX
supabase secrets set AIRTABLE_BASE_PORTAL=app0S6GrJQ8YatvCc
supabase secrets set AIRTABLE_BASE_CRM=app1SbOC98k2OP5m1
```

## Deploy a producción

### Frontend (Vercel)

```bash
vercel --prod
```

Configurar dominio personalizado: `portal.sophiamx.org` apuntando al deployment.

### Edge Functions (Supabase)

```bash
supabase functions deploy auth-bootstrap
supabase functions deploy get-mis-cursos
```

### OAuth callbacks

En Supabase → Authentication → URL Configuration:
- **Site URL**: `https://portal.sophiamx.org`
- **Redirect URLs**: `https://portal.sophiamx.org/auth/callback`

En Google Cloud Console y Microsoft Entra ID, configurar:
- **Authorized redirect URI**: `https://ajvjyisplqsrjsessayo.supabase.co/auth/v1/callback`

## Reglas del proyecto

- En Edge Functions, `filterByFormula` SIEMPRE con field IDs (constantes en `_shared/airtable.ts`), nunca con field names
- Filtrado pesado en JS post-fetch
- `vercel.json` queda lockeado a `@vercel/static` — NO agregar `@vercel/node`
- Email de Personas: unicidad validada en Edge Function (lowercase + trim), no en Airtable
- Slug de Cursos: unicidad validada en Edge Function

## Roles

Definidos en `Personas.Rol` (Airtable, base CRM):
- `alumno` (default)
- `admin` — acceso a `/app/admin/*` y operaciones de escritura globales
- `instructor` — futuro, no implementado aún
