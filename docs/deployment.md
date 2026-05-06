# Deployment · SOPHIA Portal

## Pre-flight checklist

Antes del primer deploy, asegúrate de tener:

- [ ] Cuenta de Vercel y dominio `portal.sophiamx.org` apuntando ahí
- [ ] Proyecto de Supabase con auth providers configurados
- [ ] Personal Access Token de Airtable con scopes correctos
- [ ] Field IDs reales pegados en `supabase/functions/_shared/airtable.ts`

## Paso 1 — Configurar variables de entorno

### En el frontend (`assets/js/config.js`, gitignored)

```js
window.PORTAL_CONFIG = {
  SUPABASE_URL: 'https://xxxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOi...',
  EDGE_FUNCTIONS_URL: 'https://xxxxx.supabase.co/functions/v1'
};
```

### En Supabase Edge Functions (secrets)

```bash
supabase login
supabase link --project-ref xxxxx

supabase secrets set AIRTABLE_PAT=patXXXXX...
supabase secrets set AIRTABLE_BASE_ID=app0S6GrJQ8YatvCc
# SUPABASE_URL y SUPABASE_ANON_KEY se inyectan automáticamente
```

## Paso 2 — Deploy frontend a Vercel

```bash
vercel --prod
```

Vercel detecta automáticamente la `vercel.json` y deploya como sitio estático.

**Importante:** después del primer deploy, configura en Vercel Dashboard:
- Production Domain: `portal.sophiamx.org`
- Edit Domain → DNS records (apunta a Vercel)

## Paso 3 — Deploy Edge Functions

```bash
supabase functions deploy auth-bootstrap
supabase functions deploy get-mis-cursos
supabase functions deploy get-curso
supabase functions deploy get-leccion
supabase functions deploy marcar-leccion
supabase functions deploy submit-test-felicidad
supabase functions deploy get-resultados-test
```

O en un loop:
```bash
for fn in auth-bootstrap get-mis-cursos get-curso get-leccion marcar-leccion submit-test-felicidad get-resultados-test; do
  supabase functions deploy "$fn"
done
```

## Paso 4 — Configurar Auth providers

En Supabase Dashboard → Authentication → Providers:

### Google
1. Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID
2. Authorized redirect URIs:
   - `https://xxxxx.supabase.co/auth/v1/callback`
3. Copia Client ID y Secret a Supabase
4. **Save**

### Microsoft (Azure)
1. Azure Portal → App Registrations → New
2. Redirect URI: `https://xxxxx.supabase.co/auth/v1/callback`
3. Client Secrets → New client secret
4. Copia Application (client) ID y Secret a Supabase

### Magic Link
1. Authentication → Providers → Email → enable
2. **IMPORTANTE — Confirm email**: si esta opción está activada, los magic links no funcionarán correctamente porque Supabase espera el flujo de confirmación.
   **Desactiva "Confirm email" para que el magic link funcione directamente.**

### URL Configuration
- Site URL: `https://portal.sophiamx.org`
- Redirect URLs (lista permitida):
  - `https://portal.sophiamx.org/auth/callback`
  - `http://localhost:3000/auth/callback` (para dev)
  - `http://localhost:8080/auth/callback`

## Paso 5 — Crear el Test de Felicidad en Airtable

En la tabla `Autoevaluaciones`, crear un registro:
- Título: `Test de Felicidad`
- Tipo: `evalfelicidad`

Después, en la lección 5 del Capítulo 1 de Happiness Workshop, linkearla a este registro.

## Paso 6 — Cargar contenido del Capítulo 1

Abre los archivos en `docs/contenido-capitulo-1/` y copia el HTML al campo `Contenido_HTML`
de cada lección. Ver el README de esa carpeta para los detalles.

## Paso 7 — Crear inscripción de prueba (Pato)

En la tabla `Inscripciones`, crear un registro:
- Persona: link a tu Persona del CRM (la que tiene `pato@sophiamx.org`)
- Curso: link al curso `Happiness Workshop`
- Estatus: `active`
- Fecha inicio: hoy

Listo. Entra a `https://portal.sophiamx.org/`, login con `pato@sophiamx.org`, deberías ver el curso.

## Troubleshooting

### "Authentication required" al cargar `/app`
- Revisa que el navegador haya guardado la sesión (`localStorage.supabase.auth.token`)
- Revisa que `assets/js/config.js` tenga la URL y anon key correctas

### Edge Function devuelve 500
- `supabase functions logs <name> --tail` para ver el error real
- El más común: field IDs incorrectos en `airtable.ts`
- O: PAT de Airtable sin scopes suficientes

### "Curso no encontrado" pero sí existe
- Probable: el campo `Slug` del curso no tiene exactamente el slug que pides
- O: el filterByFormula está usando field name en vez de field ID

### Magic link rebota
- Confirm email activado → desactivar
- Site URL no configurada → ponerla a `https://portal.sophiamx.org`
- Redirect URL no en allowlist → agregarla
