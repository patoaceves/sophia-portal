# Onboarding flow

Cómo una persona pasa de "le interesa un curso" → "ya está adentro del portal con su inscripción activa".

---

## Diagrama del flujo

```
[1] /embed/importar-participantes  (form externo, sin login)
    │   El equipo de ventas selecciona cohorte + agrega 1–15 participantes
    │   Submit
    ↓ POST
[2] proxy-inscripcion  (Supabase Edge)
    │   Valida IMPORT_PUBLIC_TOKEN
    │   Reenvía body a AIRTABLE_INSCRIPCION_WEBHOOK
    ↓ POST
[3] Airtable Automation "Inscribir Participantes Webhook"  (base CRM)
    │   Trigger: webhook received
    │   Action: Run a script (airtable-automation-script.js)
    │     Por cada participante:
    │       - Encuentra/crea Persona CRM con rol
    │       - Genera token inv_xxx
    │       - Crea Invitación en Portal (estatus = "pendiente")
    │       - Lee datos del coordinador desde la cohorte
    │       - Llama webhook GHL con payload completo
    ↓ HTTP webhook
[4] GHL Workflow
    │   Action 1: Create Contact con custom fields (curso, coordinador, etc.)
    │   Action 2: Send Email con bienvenida-ghl.html
    ↓ correo
[5] Alumno hace click en "Entrar al Portal"
    │   Link: https://portal.sophiamx.org/?invite=inv_xxx
    ↓
[6] index.html (landing)
    │   Captura token → sessionStorage["sophia_pending_invite"]
    │   history.replaceState para limpiar URL
    │   Muestra login (Google / Magic Link)
    ↓
[7] auth/callback.html (PKCE)
    │   exchangeCodeForSession
    │   Lee pending_invite → llama claim-invitation
    ↓ POST
[8] claim-invitation  (Supabase Edge)
    │   Busca invitación → cohorte → curso
    │   Encuentra Persona Portal (synced de CRM, con retry)
    │   Crea inscripción (estatus = "activa")
    │   Marca invitación como "canjeada"
    │   Devuelve cursoSlug
    ↓
[9] /app/cursos
    Alumno ve su curso disponible
```

---

## Pieza por pieza

### 1. Form de alta (`/embed/importar-participantes`)

Página HTML estática, sin login. Embedible (sin nav del portal).

Config inline en el HTML:
- `CURSOS_ENDPOINT` → URL del edge function `list-cursos-publico`
- `WEBHOOK_URL` → URL del edge function `proxy-inscripcion`
- `PUBLIC_TOKEN` → token compartido con Supabase

Carga las cohortes con estatus `abierta` y arma payload:

```json
{
  "token": "<PUBLIC_TOKEN>",
  "cohorteId": "rec...",
  "cohorteNombre": "Fundamentos de Coaching - 23.05.2026",
  "participantes": [
    { "nombre": "Ana", "apellidos": "Martínez", "email": "ana@x.com", "rol": "participante" }
  ]
}
```

Roles disponibles: `participante`, `profesor`, `facilitador`, `coordinador`, `admin`.

### 2. proxy-inscripcion (Supabase Edge)

Proxy server-side hacia el webhook de Airtable. Necesario porque Airtable no sirve CORS — el browser no puede llamar `hooks.airtable.com` directamente.

Responsabilidades:
- Validar `IMPORT_PUBLIC_TOKEN`
- Validar 1–15 participantes
- Reenviar body completo al webhook de Airtable Automation

### 3. Airtable Automation

**Base:** CRM (`app1SbOC98k2OP5m1`)
**Automation:** "Inscribir Participantes Webhook"

Estructura:
1. **Trigger** — When webhook is received
2. **Action** — Run a script: `airtable-automation-script.js`

Input variables del script (panel "Input variables"):

| Variable | Origen |
|---|---|
| `nombre` | Trigger → participantes → nombre |
| `apellidos` | Trigger → participantes → apellidos |
| `email` | Trigger → participantes → email |
| `rol` | Trigger → participantes → rol |
| `cohorteId` | Trigger → cohorteId |
| `cohorteNombre` | Trigger → cohorteNombre |
| `portalPat` | (texto fijo) Personal Access Token de Airtable |

El script:
1. Hace fetch a la cohorte para leer fecha, hora y datos del coordinador
2. Carga todas las Personas CRM una vez (lookup por email)
3. Loop por participante:
   - Si no existe la persona → crear con rol asignado
   - Generar token `inv_` + 28 chars hex
   - Crear Invitación en Portal vía REST API
   - Llamar webhook GHL con payload

### 4. Payload al webhook de GHL

```json
{
  "email": "ana@x.com",
  "nombre": "Ana",
  "apellidos": "Martínez",
  "rol": "participante",
  "cursoNombre": "Fundamentos de Coaching - 23.05.2026",
  "primeraSesionFecha": "Sábado, 23 de mayo de 2026",
  "primeraSesionHora": "9:00 AM",
  "linkInvitacion": "https://portal.sophiamx.org/?invite=inv_xxx",
  "coordinadorNombre": "Irelda Walls Boone",
  "coordinadorEmail": "irelda.walls@sophiamx.org",
  "coordinadorWhatsapp": "+528180111608",
  "coordinadorWhatsappDigits": "528180111608",
  "coordinadorFotoUrl": "https://portal.sophiamx.org/assets/img/brand/irelda-walls.png",
  "coordinadorMensaje": "El coaching en SOPHIA no es solo...",
  "coordinadorIniciales": "IW"
}
```

### 5. GHL Workflow

Setup (ver `email-templates/README.md` para detalle):

1. **Custom Fields** del contact (folder "Portal - SOPHIA"): 12 fields tipo `Single line`
2. **Trigger** — Inbound Webhook
3. **Action 1** — Create Contact con 15 mapeos `{{inboundWebhookRequest.<key>}}`
4. **Action 2** — Send Email usando `bienvenida-ghl.html`

### 6. claim-invitation (Supabase Edge)

Post-login. Recibe `{ token, authUserId }`. Hace:

1. Busca la invitación por token. Formato válido: `/^inv_[A-Za-z0-9_-]{4,40}$/`
2. Verifica estatus = `pendiente` y no expirada
3. Lee cohorte → resuelve curso link
4. Encuentra Persona Portal por `authUserId` o `email` (con retry por sync delay)
5. Si ya hay inscripción a esa cohorte → reutiliza, si no → crea con estatus `activa`
6. Marca invitación como `canjeada` + fecha + persona link
7. Devuelve `cursoSlug` para redirect

### Estados de invitación

| Estatus | Significado |
|---|---|
| `pendiente` | Recién creada, sin canjear |
| `canjeada` | Ya se usó, inscripción creada |
| `expirada` | Pasó la fecha de expiración (opcional) |
| `cancelada` | Manualmente cancelada |

---

## Agregar un curso nuevo

1. **Crear Curso** en base Portal → tabla `Cursos`: nombre, slug, descripción, instructor
2. **Crear Cohorte** → tabla `Cohortes`: vinculada al curso, con
   - Fecha inicio/fin, hora primera sesión, modalidad, capacidad
   - **Coordinador**: nombre, email, foto URL, WhatsApp, mensaje
   - Estatus inicial: `planeada`
3. **Crear Módulos** → tabla `Módulos`: vinculados al curso
4. **Crear Lecciones** → tabla `Lecciones`: vinculadas a sus módulos
5. **Subir portada** del curso a `assets/img/<slug>/portada.{jpg,png}`
6. **Registrar slug + extensión** en `LOCAL_COVERS` de `assets/js/cursos.js` y `curso.js`
7. **Activar cohorte** cambiando estatus a `abierta` → aparece en el dropdown del form de alta

**No se requieren cambios al script de Airtable Automation ni al template del email** — todo es dinámico.

---

## Mantenimiento del template de email

Para cambiar el contenido del correo:

1. Editar `email-templates/bienvenida-ghl.html` (para versionarlo en el repo)
2. Copy-paste el HTML actualizado en GHL → workflow → action "Send Email"
3. Mandar test desde GHL antes de publicar

Para agregar una variable nueva al correo:

1. Agregarla al payload del webhook en `airtable-automation-script.js`
2. Crear el custom field correspondiente en GHL
3. Mapear `{{inboundWebhookRequest.<key>}}` al field en la action "Create Contact"
4. Usar `{{contact.<field>}}` en el template

---

## Configuración del coordinador (por cohorte)

Cada cohorte tiene los siguientes campos en Airtable que se inyectan al correo de bienvenida:

| Field | ID | Origen del valor en el correo |
|---|---|---|
| Director | `fldU2xqvEFk0dHo4T` | Nombre que aparece debajo del avatar |
| Director email | `fldfNGBjnefsgapH7` | Email + mailto link |
| Coordinador WhatsApp | `fldcfirbPH4TmB7OW` | Botón de WhatsApp (formato `+52...`) |
| Coordinador Foto URL | `fld4RobmNveKH3dLs` | Avatar circular |
| Coordinador Mensaje | `fldZlEH4zEhdrekEc` | Cita entre comillas |

Las iniciales del avatar (fallback si la foto no carga) se calculan automáticamente en el script desde el nombre.

---

## Troubleshooting

| Problema | Causa probable | Solución |
|---|---|---|
| Cohorte no aparece en dropdown | Estatus no es `abierta` | Cambiar a `abierta` |
| Email no llega | Falló alguno de los webhooks | Revisar Run history del Automation Airtable y logs del GHL workflow |
| Link de invitación da 404 | Token mal formado | Verificar regex `/^inv_[A-Za-z0-9_-]{4,40}$/` |
| Login OK pero curso no aparece | Sync delay de Persona Portal | Esperar 1–2 min, el sync de Airtable corre cada minuto |
| Email llega sin foto del coordinador | Falta el campo `Coordinador Foto URL` en la cohorte | Llenar el campo o el avatar muestra solo iniciales |
| Email llega con typo en mensaje | Está en el campo `Coordinador Mensaje` de la cohorte | Editar Airtable directo |
