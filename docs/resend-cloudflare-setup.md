# Resend + Cloudflare · setup guide

Este doc cubre dos cosas separadas pero relacionadas:

1. **Resend**, para mandar el email de bienvenida con buen branding y deliverability.
2. **DNS migration de Wix a Cloudflare**, recomendado pero opcional.

---

## Parte 1 · ¿Vale la pena migrar el dominio de Wix a Cloudflare?

**Recomendación corta: sí, migra a Cloudflare.**

### Por qué

| Cosa | Wix DNS | Cloudflare DNS |
|---|---|---|
| Costo | gratis (incluido en plan Wix) | gratis |
| Velocidad propagación | minutos a horas | segundos |
| Editor de DNS | limitado, lento, esconde algunos tipos de records | completo, todos los tipos, instantáneo |
| TXT records (SPF, DKIM, DMARC, verificaciones) | a veces te limita el largo | sin límites prácticos |
| Wildcards y SRV | varía | sin restricción |
| API para automatizar DNS | no | sí (Terraform, scripts) |
| Soporte CNAME flattening en raíz | no | sí (clave si quieres usar `sophiamx.org` como CNAME) |
| Email forwarding gratis | sí pero limitado | sí, hasta 200 reglas, robusto |
| Analytics, WAF, page rules | no | sí, gratis |

### Por qué te conviene específicamente a ti

1. **Resend, Stripe, Supabase y otros SaaS te van a pedir agregar TXT y CNAME records con frecuencia.** En Cloudflare es 30 segundos. En Wix es un dolor.

2. **Eventualmente vas a querer subdominios:** `app.sophiamx.org`, `landing.sophiamx.org`, `cdn.sophiamx.org`. En Cloudflare cada uno es un click y propaga al instante.

3. **Si algún día migras el sitio principal de Wix a otro lado** (Webflow, Framer, Astro en Vercel), Cloudflare ya está listo. Sólo cambias el A/CNAME al nuevo host.

4. **Email forwarding gratis con Cloudflare Email Routing.** Si quieres `hola@sophiamx.org` que reenvíe a tu Gmail, Cloudflare lo hace mejor que Wix.

### Qué NO cambia con la migración

- El sitio principal `sophiamx.org` (hosteado en Wix) sigue funcionando idéntico. Sólo cambia *quién resuelve el DNS*, no *quién sirve el contenido*.
- Tu correo `@sophiamx.org` (si lo tienes con Wix Email o Google Workspace) sigue funcionando idéntico. Los registros MX se replican en Cloudflare al migrar.

### Pasos para migrar (30 minutos, hazlo en horario tranquilo)

1. **Crea cuenta en Cloudflare** (gratis): [cloudflare.com](https://www.cloudflare.com/)
2. **Add site**, escribe `sophiamx.org`, selecciona plan Free.
3. **Cloudflare escanea tu DNS actual de Wix** y replica todos los records que encuentra (A, CNAME, MX, TXT). Revisa que estén todos. Si falta alguno, agrégalo manualmente. Records críticos a verificar:
   - `A` o `CNAME` apuntando al sitio de Wix (algo tipo `sophiamx-site.wixsite.com` o IP de Wix)
   - `MX` records si tienes correo con Google Workspace o Zoho (`*.google.com`, etc.)
   - `TXT` con `v=spf1 include:_spf.google.com ~all` o equivalente
   - Cualquier TXT de verificación de dominio (Google Search Console, Stripe, etc.)
4. **Cloudflare te da 2 nameservers nuevos**, algo tipo `clara.ns.cloudflare.com` y `lars.ns.cloudflare.com`.
5. **En Wix**, ve a tu dominio, sección DNS / Nameservers, cambia los nameservers a los de Cloudflare. Esto es lo único que tocas en Wix.
6. **Espera la propagación.** Suele ser 5 a 30 minutos pero puede tardar hasta 24h en raros casos.
7. **Cloudflare te avisa por email** cuando ya está activo.
8. **Prueba:** entra a `sophiamx.org`, debe verse igual. Manda un correo a `hola@sophiamx.org`, debe llegar igual.

> **Si tienes el correo `@sophiamx.org` con Wix Mail directamente** (no Google Workspace ni Zoho), revisa primero qué tan crítico es y considera si quieres aprovechar para migrarlo a Google Workspace o a Cloudflare Email Routing antes de hacer este cambio.

### ¿Y si rompo algo?

- En Wix, los nameservers originales siguen disponibles. Cualquier momento puedes regresar el cambio (5 min más de propagación).
- Lleva un screenshot de los DNS records de Wix antes de migrar, por si acaso.

---

## Parte 2 · Resend, mandar el email de bienvenida

Resend es el servicio que vas a usar para mandar el email automático cuando se crea una invitación. Es la mejor opción para apps modernas (React Email, dashboard limpio, API simple, generoso free tier de 3,000 emails/mes).

### Por qué Resend en vez de Gmail SMTP o Airtable Send Email

| | Resend | Gmail SMTP | Airtable Send Email |
|---|---|---|---|
| Deliverability | excelente, IPs dedicadas | malo, Google bloquea por bulk | aceptable |
| HTML completo (el template que aprobaste) | sí, sin restricciones | sí, pero limitado | sí, pero el editor de Airtable es feo |
| Tracking (abrió, hizo click) | sí | no | no |
| Logs históricos | sí, con replay | no | no |
| API limpia | sí, JSON simple | requiere OAuth complicado | no, sólo desde automation |
| Costo | gratis hasta 3,000/mes | gratis pero con cap silencioso | "gratis" si tienes Pro |

### Pasos

#### 1. Crear cuenta y verificar dominio

1. [resend.com](https://resend.com), sign up con tu Google.
2. **Add domain** → `sophiamx.org`.
3. Resend te da 4 records DNS para agregar:
   - 1 `MX` record (para reply handling)
   - 2 `TXT` records (SPF + DKIM)
   - 1 `TXT` record DMARC (opcional pero recomendado)

   **Si ya migraste a Cloudflare**, los agregas en 2 minutos. Si aún estás en Wix, también funciona pero más tedioso.

4. En Resend, click **Verify**. Tarda de segundos a 10 minutos.

#### 2. Crear API key

Resend dashboard → API Keys → Create API Key → permission `Sending access`, restricted to domain `sophiamx.org`. Copia la key, empieza con `re_xxxxxxxxxxxx`.

#### 3. Probar mandando un correo

```bash
curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer re_TU_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "SOPHIA <hola@sophiamx.org>",
    "to": ["tu_email_personal@gmail.com"],
    "subject": "Test desde Resend",
    "html": "<p>¡Funciona!</p>"
  }'
```

Si te llega, todo bien.

#### 4. Hook con Airtable: 2 opciones

##### Opción A · Más simple: Airtable Automation con script

En la base PORTAL → Automations → "+ Create automation":

- **Trigger:** "When record matches conditions"
  - Tabla: Invitaciones
  - Conditions: `Estatus = activa` AND `Email destinatario` is not empty AND `Persona` is empty (o sea, no se ha canjeado todavía)

- **Action 1: "Find records"** (para enriquecer los datos)
  - Tabla: Cohortes
  - Condition: `Cohorte` matches the invitation's Cohorte field

- **Action 2: "Run a script"** (la mandas a Resend)

  Pegar este script (reemplaza `RESEND_API_KEY` con la tuya):

  ```js
  const apiKey = 'RESEND_API_KEY_AQUI';

  // Inputs from previous steps
  const invitation = input.config().invitation;
  const cohorte = input.config().cohorte;
  const cursoTitulo = input.config().cursoTitulo;

  const portalUrl = 'https://portal.sophiamx.org';
  const ctaUrl = `${portalUrl}/?invite=${invitation.token}`;

  // Format date in Spanish: "12 de mayo de 2026"
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const d = new Date(cohorte.fechaInicio + 'T12:00:00');
  const fechaFmt = `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;

  const html = `<!-- pega aquí el contenido de email-templates/bienvenida.html
                    con las variables ya interpoladas -->`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'SOPHIA <hola@sophiamx.org>',
      to: [invitation.emailDestinatario],
      subject: `Tu lugar en ${cursoTitulo} está confirmado · SOPHIA`,
      html,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  output.set('emailId', data.id);
  ```

  El problema: meter el HTML completo (el template) embebido en un script de Airtable es feo. Para esto está la opción B.

##### Opción B · Más limpio: Supabase Edge Function `send-invitation-email`

Una función dedicada en Supabase que:
- Recibe `{ invitationId }` (o `{ token }`)
- Lee la invitación + cohorte + curso de Airtable
- Renderiza el template (lee `bienvenida.html` desde el código)
- Manda vía Resend

**Pros:** versionado en git, fácil de testear, el HTML vive en archivo limpio.
**Cons:** más setup que la opción A.

Esto puedo armártelo cuando quieras, son ~150 líneas. Avísame y lo agrego como `supabase/functions/send-invitation-email/index.ts`.

##### Opción A simplificado · Airtable nativo (sin Resend)

Si quieres salir hoy sin meter Resend todavía, usa "Send email" nativo de Airtable. Limitaciones:
- HTML simple, vas a perder los estilos finos del template aprobado
- Mandado desde un dominio genérico de Airtable, no `@sophiamx.org`
- Sin tracking
- Pero funciona y arranca

Yo iría con Resend desde el principio porque ese email es la primera impresión de un alumno con SOPHIA, no querrás que vaya a spam.

---

## Recomendación para ti, en orden

1. **Hoy:** Migra DNS de Wix a Cloudflare (30 min, low risk).
2. **Esta semana:** Configura Resend con `sophiamx.org` ya en Cloudflare. Manda un test a tu correo para verificar que llega bien.
3. **Cuando tengas Resend listo:** Pídeme la edge function `send-invitation-email`. Te la armo en una sesión.
4. **Mientras tanto:** Si quieres testear el flow completo HOY, usa la opción A de Airtable Automation o mándale el link de invitación a la persona por WhatsApp manualmente (el flow del frontend funciona igual, sólo no automatizas el email).

---

## Cosas que NO te recomiendo

- **No uses la integración de email built-in de Wix Studio para esto.** Está diseñada para boletines/newsletters, no para emails transaccionales 1-a-1.
- **No mandes desde Gmail (con SMTP o nodemailer) para volúmenes >50/día.** Google empieza a marcar como bulk y los emails caen en promociones o spam.
- **No uses SendGrid si puedes evitarlo.** Es la opción "antigua" y su free tier es más restrictivo. Resend es mejor para tu caso.
- **No uses Postmark a menos que ya lo tengas.** Es excelente pero más caro y para tu volumen Resend cubre todo.
