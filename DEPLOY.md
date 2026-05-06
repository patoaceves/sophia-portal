# Deploy a producción

Pasos secuenciales para desplegar el portal a `portal.sophiamx.org`.

## 1. Configurar Supabase Auth

### URL Configuration

En tu proyecto Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://portal.sophiamx.org`
- **Redirect URLs** (agrega ambas):
  - `https://portal.sophiamx.org/auth/callback`
  - `http://localhost:5500/auth/callback` (para dev local)

### OAuth Providers

Ya los tienes configurados según mencionaste. Solo verifica que las redirect URIs en cada provider apunten a:

```
https://ajvjyisplqsrjsessayo.supabase.co/auth/v1/callback
```

(Esa es la URL del provider OAuth — no la del portal. Supabase la maneja internamente y redirige después al portal.)

### Email templates (opcional pero recomendado)

En **Authentication → Email Templates**, edita el template "Magic Link" para que tenga lenguaje y branding SOPHIA. Asunto sugerido: "Tu enlace de acceso a SOPHIA".

## 2. Configurar secretos para Edge Functions

Necesitas el Personal Access Token de Airtable. Si no lo tienes:

1. Ve a https://airtable.com/create/tokens → "Create new token"
2. Name: `SOPHIA Portal Edge Functions`
3. Scopes: `data.records:read`, `data.records:write`, `schema.bases:read`
4. Access: agrega `SOPHIA - CRM` y `SOPHIA - Portal`
5. Copia el token (`patXXX...`)

Luego, instala el Supabase CLI si no lo tienes:

```bash
npm install -g supabase
supabase login
supabase link --project-ref ajvjyisplqsrjsessayo
```

Configura los secretos:

```bash
supabase secrets set AIRTABLE_PAT=patXXXXXXXXXXXXX
supabase secrets set AIRTABLE_BASE_PORTAL=app0S6GrJQ8YatvCc
supabase secrets set AIRTABLE_BASE_CRM=app1SbOC98k2OP5m1
```

(`SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` ya están disponibles automáticamente en Edge Functions, no las pongas a mano.)

## 3. Deploy de Edge Functions

```bash
supabase functions deploy auth-bootstrap
supabase functions deploy get-mis-cursos
```

Verifica:

```bash
supabase functions list
```

Debes ver ambas con status `ACTIVE`.

## 4. Deploy del frontend a Vercel

```bash
npm install -g vercel
vercel login
cd sophia-portal
vercel --prod
```

En el primer deploy te va a preguntar:
- Setup and deploy? **Y**
- Which scope? Tu cuenta personal o team
- Link to existing project? **N**
- Project name? `sophia-portal`
- Directory? `./` (default)
- Override settings? **N**

## 5. Conectar dominio personalizado

En Vercel dashboard → tu proyecto → **Settings → Domains**:

1. Agregar `portal.sophiamx.org`
2. Vercel te dará registros DNS para apuntar
3. En tu DNS (Cloudflare según tu setup de tr4nsfer.me y otros): agregar el CNAME que indique Vercel

Espera a que el SSL se aprovisione (1-5 min).

## 6. Probar el flujo completo

1. Ve a `https://portal.sophiamx.org`
2. Click en "Continuar con Google"
3. Tras autenticar, te redirige a `/auth/callback` y luego a `/app/cursos`
4. Verifica en Airtable CRM que se creó tu Persona automáticamente
5. Para probar con un curso: en Airtable Portal, crea un Curso de prueba, un Capítulo, una Lección, y una Inscripción que te ligue a ese curso. Recarga `/app/cursos` y debería aparecer.

## 7. Hacerte admin

Para acceder al panel admin (cuando lo construyamos), edita tu fila en Airtable CRM → Personas → cambia el campo `Rol` de `participante` a `admin`. Cierra sesión y vuelve a entrar para que el cache se refresque.

## Troubleshooting

**"Invalid JWT" en Edge Function**: el token no se está mandando. Revisa la consola del browser que `callEdge` está adjuntando el `Authorization: Bearer ...`.

**"AIRTABLE_PAT not configured"**: el secret no se aplicó. Verifica con `supabase secrets list`.

**Magic link redirige a localhost**: revisaste que la Site URL en Supabase apunte al dominio de producción.

**Login se queda colgado en /auth/callback**: probablemente el toggle "Confirm email" está activado en Supabase. Apágalo en **Authentication → Providers → Email**. (Mismo issue que tuviste con tr4nsfer.me.)

**Los cursos no aparecen aunque tengo Inscripción**: verifica que la Inscripción tenga el campo Persona poblado correctamente, y que la Persona vinculada sea la del CRM (la synced en Portal mantiene el mismo recordId que el CRM, así que sirve cualquiera).
