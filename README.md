# SOPHIA Portal

Portal académico de SOPHIA. Frontend estático en Vercel, auth con Supabase, datos en Airtable, emails de bienvenida vía GoHighLevel (GHL).

> **Producción:** `portal.sophiamx.org`
> **Cursos activos:** Happiness Workshop, Fundamentos de Coaching I

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | HTML/CSS/JS estático en Vercel (`@vercel/static`). Sin frameworks. |
| Auth | Supabase Auth (Google OAuth + Magic Link, flujo PKCE) |
| Datos | Airtable. Bases: `SOPHIA - Portal` (`app0S6GrJQ8YatvCc`) y `SOPHIA - CRM` (`app1SbOC98k2OP5m1`) |
| API | Supabase Edge Functions (Deno) |
| Emails | GHL workflows (bienvenida + onboarding). Supabase Auth (magic link + signup confirmation) |
| Almacenamiento | Supabase Storage bucket `sophia-portal-uploads` para entregas de tarea |

---

## Estructura del repo

```
sophia-portal/
├── index.html                          # login (Google + Magic Link)
├── auth/callback.html                  # PKCE callback
├── app/                                # portal del alumno (auth required)
│   ├── cursos.html                     # mis cursos
│   ├── curso.html                      # ?slug= → detalle con módulos/lecciones
│   ├── leccion.html                    # ?id= → reproductor (texto/video/pdf/quiz/autoeval/tarea)
│   ├── perfil.html                     # datos del usuario
│   ├── progreso.html                   # progreso global
│   ├── test-felicidad/                 # Test de Felicidad (HW)
│   ├── autoevaluacion/                 # autoeval genérico de los 8 pilares (HW)
│   ├── test-autoconocimiento/          # autoeval Autoconocimiento (legacy alias)
│   └── admin/                          # gated por rol === "admin"
├── embed/
│   └── importar-participantes.html     # form de alta de ventas (sin login)
├── assets/
│   ├── css/                            # base.css, shell.css, login.css
│   ├── js/                             # módulos por página
│   ├── img/brand/                      # logos, fotos de coordinadoras
│   ├── img/<slug>/                     # portadas por curso
│   └── pdf/                            # PDFs servidos inline
├── supabase/functions/                 # edge functions (Deno)
├── email-templates/                    # plantillas HTML versionadas (referencia)
├── docs/                               # documentación operativa
└── airtable-automation-script.js       # script de la Automation "Inscribir Participantes Webhook"
```

---

## Edge Functions

| Function | Para qué |
|---|---|
| `claim-invitation` | Canjea `inv_xxx` post-login → crea inscripción |
| `get-curso` | Detalle de curso con módulos y lecciones |
| `get-leccion` | Lección individual + estado de progreso |
| `marcar-leccion` | Marca lección completada |
| `mis-cursos` | Lista de cursos del alumno |
| `submit-quiz` / `get-resultados-quiz` | Quizzes (con respuestas, idempotente) |
| `submit-tarea` / `delete-entrega-archivo` | Entregas de tarea (multipart) |
| `submit-autoeval` / `get-resultados-autoeval` | Autoeval de pilares HW |
| `submit-test-felicidad` / `get-resultados-test` | Test de Felicidad HW |
| `submit-autoconocimiento` / `get-resultados-autoconocimiento` | (legacy alias) |
| `enviar-evaluacion-sesion` | Wizard de evaluación del ponente |
| `proxy-inscripcion` | Proxy server-side a Airtable Automation (CORS) |
| `list-cursos-publico` | Lista cohortes abiertas (público, validado por token) |
| `delete-my-account` | Borrado completo (data + Auth user) |
| `foro-listar` / `foro-publicar` / `foro-eliminar` | Foro por curso |

Despliegue: dashboard de Supabase. Cada función es self-contained con `index.ts` + `_shared/`.

---

## Onboarding (alta de participantes)

Resumen del flujo (detalle completo en `docs/onboarding-flow.md`):

```
/embed/importar-participantes  (form de ventas)
  ↓
proxy-inscripcion (Supabase)  (CORS + token check)
  ↓
Airtable Automation "Inscribir Participantes Webhook"
  ↓  ejecuta airtable-automation-script.js
  → Crea/reusa Persona CRM con rol
  → Crea Invitación con token inv_xxx
  → Lee datos del coordinador desde la cohorte
  → Llama webhook GHL
  ↓
GHL Workflow → Send Email (bienvenida-ghl.html)
  ↓
Alumno hace click en CTA → portal.sophiamx.org/?invite=inv_xxx
  ↓
Login (Google / Magic Link) → claim-invitation
  ↓
Inscripción activa → /app/cursos
```

El engine es **agnóstico al curso**. Todos los datos específicos (curso, fecha, hora, coordinador, mensaje, foto) salen de los campos de la cohorte en Airtable.

---

## Cursos

Hoy activos:
- **Happiness Workshop** (slug `happiness-workshop`)
- **Fundamentos de Coaching I** (slug `fundamentos-de-coaching`)

Agregar un curso nuevo no requiere cambios de código. Ver `docs/onboarding-flow.md` § "Agregar un curso nuevo".

---

## Despliegue

### Frontend
```bash
git push origin main   # Vercel deploya automático
```
Vercel sirve el ZIP del repo tal cual; usa `vercel.json` con `@vercel/static`.

### Edge Functions
Manual desde dashboard Supabase (no hay CLI configurado). Ver `docs/deployment.md`.

### Airtable Automation Script
Copy-paste `airtable-automation-script.js` en la base CRM → Automation "Inscribir Participantes Webhook" → action "Crear invitación SOPHIA" → publicar.

### Email template (GHL)
Copy-paste `email-templates/bienvenida-ghl.html` en GHL workflow → action "Send Email". Ver `email-templates/README.md` para el setup completo de custom fields y mapeos.

---

## Variables de entorno (Supabase Secrets)

| Variable | Para qué |
|---|---|
| `AIRTABLE_PAT` | Personal Access Token con scope read/write a ambas bases |
| `AIRTABLE_INSCRIPCION_WEBHOOK` | URL del webhook de la Automation "Inscribir Participantes Webhook" |
| `IMPORT_PUBLIC_TOKEN` | Token estático compartido con `/embed/importar-participantes` |

---

## Convenciones del proyecto

- **Vercel:** SIEMPRE `@vercel/static`, nunca `@vercel/node`
- **Pure HTML/CSS/JS**, sin frameworks
- **Comunicación en español**
- **Archivos completos al subir cambios** (no diffs, no snippets parciales)
- **Field IDs siempre**, no field names, en llamadas a Airtable API
- **filterByFormula con linked records:** devuelve nombres, no IDs — filtrar en JS si necesitas IDs
- **Idempotency-Key:** sanitizar a ASCII antes de mandarlo a la Airtable API

---

## Docs operativos

| Doc | Para qué |
|---|---|
| `docs/onboarding-flow.md` | Flujo end-to-end de alta de participantes |
| `docs/airtable-schema.md` | Esquema de tablas + field IDs |
| `docs/foro-airtable-schema.md` | Esquema del foro |
| `docs/deployment.md` | Detalles de despliegue (Vercel, Supabase) |
| `email-templates/README.md` | Plantillas de email y mapeo de GHL |
