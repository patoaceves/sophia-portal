# Email templates · Supabase Auth

Estos templates van directamente al **Supabase Dashboard**, NO al repo del portal. Vercel no los lee. Cada template es un archivo HTML standalone que pegas en el panel de Supabase.

## Archivos

| Archivo                              | Template Supabase     | Cuándo se dispara                                      |
|--------------------------------------|------------------------|--------------------------------------------------------|
| `supabase-magic-link.html`           | **Magic Link**         | Cada vez que un usuario pide entrar por email          |
| `supabase-confirm-signup.html`       | **Confirm signup**     | Primera vez que un email se registra (si está activado)|
| `bienvenida.html`                    | (Resend, no Supabase)  | Al crear una Invitación nueva en Airtable               |

> El **magic link** es el que más se va a disparar (cada login por email). El **confirm signup** solo se dispara si tienes "Confirm email" activado en Supabase Auth → Email provider, y solo la primera vez que ese email se registra.

## Cómo aplicarlos (5 min cada uno)

1. Entra a [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto
2. **Authentication** → **Email Templates**
3. Click el template (ej. "Magic Link")
4. **Subject** sugerido:
   - Magic Link → `Tu acceso al Portal SOPHIA`
   - Confirm signup → `Confirma tu cuenta del Portal SOPHIA`
5. **Message body (HTML)** → borra el HTML default, abre el archivo `.html` correspondiente, copia todo el contenido, pégalo
6. Click **Save**
7. Repite para el otro template

## Test rápido

Después de guardar, en otra ventana incógnita:
1. Ve a `portal.sophiamx.org`
2. Ingresa un email cualquiera (puedes usar `+test` para no contaminar tu inbox: `tu+test@gmail.com`)
3. Click "Enviar enlace"
4. Revisa el correo. Debe llegar con el branding rojo SOPHIA, logo, botón "Entrar al portal"

Si el correo aún llega con texto plano "Confirm your mail":
- Verifica que guardaste en el template correcto (Magic Link, no otro)
- Espera 1 min y reintenta (Supabase puede cachear)
- Revisa que el subject que pusiste no sea el default de Supabase

## Variables Supabase

Los templates usan estas variables que Supabase reemplaza al enviar:

| Variable                  | Qué contiene                                          |
|---------------------------|-------------------------------------------------------|
| `{{ .ConfirmationURL }}`  | Link único al portal (válido 60 min para magic link)  |
| `{{ .Email }}`            | Email del destinatario                                 |
| `{{ .Token }}`            | Código de 6 dígitos (alternativa al link)             |
| `{{ .SiteURL }}`          | Site URL configurado en Auth → URL Configuration      |

## Sobre el remitente (de quién aparece el correo)

Por default Supabase manda los correos desde su dominio `noreply@mail.supabase.com` o similar. Si quieres que digan `noreply@sophiamx.org`:

1. Configura **SMTP custom** en Supabase: Auth → SMTP Settings
2. Usa Resend (que ya tienes pensado para `bienvenida.html`):
   - Host: `smtp.resend.com`
   - Port: `465` (SSL) o `587` (TLS)
   - Username: `resend`
   - Password: tu API key de Resend
   - Sender email: `noreply@sophiamx.org` (debe estar verificado en Resend)
   - Sender name: `SOPHIA`

Esto requiere que el dominio `sophiamx.org` tenga DNS configurado (SPF, DKIM) — bloqueado actualmente por acceso a Wix DNS según `docs/resend-cloudflare-setup.md`.

**Mientras tanto**: deja Supabase con su SMTP default. Los correos llegan, solo el "from" no es de SOPHIA. El branding visual del cuerpo sí lo es, que es lo que importa.

## Cómo es el correo actual (default Supabase)

> Confirm your signup
>
> Follow this link to confirm your user:
> Confirm your mail
>
> You're receiving this email because you signed up for an application powered by Supabase ⚡️

Brutal. Lo cambias y queda como el `bienvenida.html` que ya mandas con Resend.
