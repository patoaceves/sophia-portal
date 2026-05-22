# Email templates

Plantillas de email, versionadas en el repo para trazabilidad. Las plantillas reales viven en sus respectivos servicios (GHL o Supabase Auth).

---

## Archivos

| Archivo | Servicio | Para qué |
|---|---|---|
| `bienvenida-ghl.html` | GHL | Email de bienvenida al inscribirse en un curso |
| `supabase-confirm-signup.html` | Supabase Auth | Confirmación de cuenta nueva (signup) |
| `supabase-magic-link.html` | Supabase Auth | Magic link de login |
| `bienvenida.html` | (legacy) | Versión vieja, mantenida como referencia histórica |

---

## bienvenida-ghl.html — Setup en GHL

### Paso 1 — Crear custom fields

Settings → Custom Fields → Add Field. Todos tipo **Single line**, en folder "Portal - SOPHIA":

| Field name | Key (auto-generada) |
|---|---|
| Curso | `{{contact.curso}}` |
| Link Invitacion | `{{contact.link_invitacion}}` |
| Primera Sesion Fecha | `{{contact.primera_sesion_fecha}}` |
| Primera Sesion Hora | `{{contact.primera_sesion_hora}}` |
| Coordinador Nombre | `{{contact.coordinador_nombre}}` |
| Coordinador Email | `{{contact.coordinador_email}}` |
| Coordinador WhatsApp | `{{contact.coordinador_whatsapp}}` |
| Coordinador WhatsApp Digits | `{{contact.coordinador_whatsapp_digits}}` |
| Coordinador WhatsApp Pretty | `{{contact.coordinador_whatsapp_pretty}}` |
| Coordinador Foto URL | `{{contact.coordinador_foto_url}}` |
| Coordinador Mensaje | `{{contact.coordinador_mensaje}}` |
| Coordinador Iniciales | `{{contact.coordinador_iniciales}}` |
| Rol | `{{contact.rol}}` |

### Paso 2 — Workflow → Trigger → Inbound Webhook

URL del webhook: la que está configurada en el `GHL_WEBHOOK` constante del `airtable-automation-script.js`.

### Paso 3 — Workflow → Action 1 → Create Contact

Mapeos (15 fields):

| Field GHL | Value |
|---|---|
| First Name | `{{inboundWebhookRequest.nombre}}` |
| Last Name | `{{inboundWebhookRequest.apellidos}}` |
| Email | `{{inboundWebhookRequest.email}}` |
| Curso | `{{inboundWebhookRequest.cursoNombre}}` |
| Link Invitacion | `{{inboundWebhookRequest.linkInvitacion}}` |
| Primera Sesion Fecha | `{{inboundWebhookRequest.primeraSesionFecha}}` |
| Primera Sesion Hora | `{{inboundWebhookRequest.primeraSesionHora}}` |
| Coordinador Nombre | `{{inboundWebhookRequest.coordinadorNombre}}` |
| Coordinador Email | `{{inboundWebhookRequest.coordinadorEmail}}` |
| Coordinador WhatsApp | `{{inboundWebhookRequest.coordinadorWhatsapp}}` |
| Coordinador WhatsApp Digits | `{{inboundWebhookRequest.coordinadorWhatsappDigits}}` |
| Coordinador WhatsApp Pretty | `{{inboundWebhookRequest.coordinadorWhatsappPretty}}` |
| Coordinador Foto URL | `{{inboundWebhookRequest.coordinadorFotoUrl}}` |
| Coordinador Mensaje | `{{inboundWebhookRequest.coordinadorMensaje}}` |
| Coordinador Iniciales | `{{inboundWebhookRequest.coordinadorIniciales}}` |
| Rol | `{{inboundWebhookRequest.rol}}` |

### Paso 4 — Workflow → Action 2 → Send Email

- **Subject:** `Tu acceso a SOPHIA ya está listo`
- **From:** la dirección de bienvenida que estés usando (típicamente algo como `coordinacion@sophiamx.org`)
- **Body:** copy-paste el contenido completo de `bienvenida-ghl.html`

### Paso 5 — Publicar

Guardar y publicar el workflow.

---

## Variables disponibles en el template

Todas se llenan dinámicamente desde la cohorte en Airtable:

| Placeholder | Origen | Ejemplo |
|---|---|---|
| `{{contact.first_name}}` | Webhook → `nombre` | Ana |
| `{{contact.email}}` | Webhook → `email` | ana@example.com |
| `{{contact.curso}}` | Cohorte nombre | Fundamentos de Coaching - 23.05.2026 |
| `{{contact.link_invitacion}}` | Generado por script | https://portal.sophiamx.org/?invite=inv_xxx |
| `{{contact.primera_sesion_fecha}}` | Cohorte fecha_inicio | Sábado, 23 de mayo de 2026 |
| `{{contact.primera_sesion_hora}}` | Cohorte hora_inicio | 9:00 AM |
| `{{contact.coordinador_nombre}}` | Cohorte Director | Irelda Walls Boone |
| `{{contact.coordinador_email}}` | Cohorte Director email | irelda.walls@sophiamx.org |
| `{{contact.coordinador_whatsapp}}` | Cohorte Coordinador WhatsApp | +528180111608 |
| `{{contact.coordinador_whatsapp_digits}}` | Calculado (sin "+") | 528180111608 |
| `{{contact.coordinador_whatsapp_pretty}}` | Calculado (formato legible) | +52 81 8011 1608 |
| `{{contact.coordinador_foto_url}}` | Cohorte Coordinador Foto URL | https://portal.sophiamx.org/assets/img/brand/irelda-walls.png |
| `{{contact.coordinador_mensaje}}` | Cohorte Coordinador Mensaje | "El coaching en SOPHIA es..." |
| `{{contact.coordinador_iniciales}}` | Calculado del nombre | IW |

---

## Editar el template

1. Modificar `email-templates/bienvenida-ghl.html` en el repo (para versionarlo)
2. Copy-paste el HTML actualizado a GHL → workflow → action "Send Email"
3. Mandar test desde GHL antes de publicar
4. Publish

---

## supabase-confirm-signup.html y supabase-magic-link.html

Plantillas de Supabase Auth. Editar en:

Supabase Dashboard → Authentication → Email Templates

Variables disponibles (sintaxis Go template):
- `{{ .Email }}`
- `{{ .ConfirmationURL }}`
- `{{ .Token }}`
- `{{ .RedirectTo }}`
