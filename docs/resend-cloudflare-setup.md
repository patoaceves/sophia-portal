# Migración Wix → Cloudflare + setup Resend

## Antes de empezar, lee esto

**Wix tiene un comportamiento molesto:** si compraste el dominio `sophiamx.org` *a través de Wix* (Wix es tu registrar), Wix **bloquea el cambio de nameservers**. No te deja apuntarlo a Cloudflare directamente. Es política de ellos.

Antes de tocar nada, identifica en cuál de estos 3 casos estás:

### Caso A. Dominio registrado en Wix (lo más común)

Compraste el dominio en Wix, va incluido en tu plan o lo pagas anual con ellos. **Tienes que transferir el dominio a otro registrar** (proceso de 7 a 14 días) para poder cambiar nameservers.

### Caso B. Dominio registrado en otro lado, sólo conectado a Wix

Compraste el dominio en GoDaddy, Namecheap, Google Domains, etc. y lo conectaste a Wix. **Sólo cambias nameservers en tu registrar real**, no tocas Wix.

### Caso C. No estoy seguro

Ve a [whois.com](https://www.whois.com/whois/) y busca `sophiamx.org`. Mira el campo "Registrar":
- Si dice **"Wix.com Ltd."** o **"Wix.com"** → Caso A
- Si dice cualquier otra cosa (GoDaddy, Namecheap, MarkMonitor, etc.) → Caso B

Comprueba esto antes de seguir leyendo.

---

## Caso A · Transferir dominio de Wix a Cloudflare (camino realista)

### Paso 0. Verificaciones previas

- [ ] Tu dominio tiene >60 días desde la última transferencia o registro (regla ICANN, no se puede saltar).
- [ ] El correo asociado al dominio en Wix (admin contact) es uno al que tienes acceso. Si no, actualízalo PRIMERO en Wix.
- [ ] Tienes 1 hora libre para arrancar y luego tolerancia de 1 semana para que se complete la transferencia.

### Paso 1. En Wix, desbloquear el dominio y pedir el código de autorización (EPP)

1. Wix → Dashboard → **Settings** → **Domains** → click en `sophiamx.org` → **Advanced**.
2. Busca la sección **"Transfer Away from Wix"** o **"Transfer to another registrar"**.
3. **Unlock the domain.** Si Wix te pide confirmar por email, hazlo.
4. **Request authorization code (EPP code).** Wix te lo manda al email del admin contact. Suele tardar de minutos a un día.

> **Si Wix Customer Support te friega:** algunos usuarios reportan que Wix CS no quiere desbloquear o tarda en mandar el EPP code. Insiste por chat con esto: *"I want to transfer my domain to another registrar. Please unlock the domain and send me the EPP authorization code to my admin email."* Si te dan vueltas, escala con un supervisor. Es tu derecho como dueño del dominio.

### Paso 2. Decide tu camino, dos opciones

#### Opción 1. Transferir directo a Cloudflare Registrar (más barato, ~$10/año)

**Esto puede tener un catch 22:** Cloudflare a veces requiere que el zone esté activo (con sus nameservers ya apuntados) antes de aceptar la transferencia, pero Wix bloquea cambiar nameservers. Si te pasa, ve a la Opción 2.

1. Cloudflare → [cloudflare.com](https://www.cloudflare.com/) → crear cuenta gratis.
2. **Add a site** → escribe `sophiamx.org` → plan Free.
3. Cloudflare escanea el DNS actual y replica records.
4. Cloudflare → **Domain Registration** → **Transfer Domains** → escribe `sophiamx.org`.
5. Pega el EPP code de Wix → paga ~$10 USD/año + ICANN fee → confirma.
6. Esperar 5 a 7 días para que Wix libere y Cloudflare reciba.

#### Opción 2. Transferir primero a Namecheap, después a Cloudflare (camino seguro)

**Recomendado.** Namecheap te deja cambiar nameservers libremente, sin restricciones.

1. Crea cuenta en [namecheap.com](https://www.namecheap.com/).
2. Namecheap dashboard → **Transfers** → escribe `sophiamx.org` → ingresa el EPP code de Wix → paga ~$10 USD por 1 año + ICANN fee.
3. Espera 5 a 7 días. Te llegan emails de Wix y Namecheap, autoriza los que pidan confirmación.
4. Una vez en Namecheap, en su dashboard verás `sophiamx.org`. Continúa al Paso 3.
5. (Opcional, en 60 días) puedes transferir DE Namecheap a Cloudflare Registrar para ahorrar el markup. Pero no urge, Namecheap funciona perfecto.

### Paso 3. En Cloudflare, agregar el sitio (si no lo hiciste)

1. [cloudflare.com](https://www.cloudflare.com/) → cuenta nueva o existente.
2. **Add a site** → `sophiamx.org` → plan Free.
3. Cloudflare escanea el DNS actual de Wix y replica los records que encuentra. Verifica:
   - `A` o `CNAME` apuntando al sitio Wix (algo tipo `sophiamx-site.wixsite.com` o IP de Wix)
   - `MX` records si tienes correo (`*.googlemail.com`, `aspmx.l.google.com`, etc.)
   - Cualquier `TXT` (verificación Google, SPF, etc.)
4. Si te falta alguno, agrégalo manualmente.
5. Cloudflare te muestra los **2 nameservers** que tienes que apuntar, algo tipo `clara.ns.cloudflare.com` y `lars.ns.cloudflare.com`. Copia los exactos que te dan a ti.

### Paso 4. Apuntar nameservers a Cloudflare desde Namecheap (o tu nuevo registrar)

En Namecheap:
1. Dashboard → tu dominio → **Manage**.
2. Sección **Nameservers** → cambia de "Namecheap BasicDNS" a **"Custom DNS"**.
3. Pega los 2 nameservers de Cloudflare.
4. Guarda. Propaga en minutos a horas.
5. Cloudflare detecta que ya apuntan, te manda email "Your zone is now active".

### Paso 5. Verificar que todo sigue funcionando

- [ ] `sophiamx.org` carga el sitio Wix igual que antes.
- [ ] Tu correo `@sophiamx.org` (si tienes Google Workspace o Zoho) sigue recibiendo.
- [ ] Stripe / cualquier verificación TXT que tenías sigue activa.

Si algo se rompe, los DNS records están en Cloudflare → DNS → puedes editarlos al instante.

### ¿Cuánto tiempo total?

- Pedir EPP code en Wix: 1 día
- Transferencia Wix → Namecheap: 5 a 7 días
- Cambiar nameservers a Cloudflare: 1 hora
- **Total real: ~1 semana end-to-end**

---

## Caso B · Dominio en otro registrar (no en Wix)

Aquí es trivial. Wix sólo tiene el sitio, no el dominio.

1. Cloudflare → **Add a site** → `sophiamx.org` → plan Free.
2. Cloudflare escanea, replica los DNS records que encuentra de Wix.
3. Cloudflare te da 2 nameservers.
4. Entra a tu registrar real (GoDaddy, Namecheap, Google Domains, etc.) → DNS → Nameservers → "Custom" → pega los de Cloudflare.
5. Espera 5 a 30 minutos.
6. Listo.

Tu sitio Wix sigue cargando (los DNS records ya replicados apuntan a Wix). Tu correo sigue funcionando. Sólo cambia QUIÉN responde las consultas DNS.

**Total: 1 hora.**

---

## Plan B si no quieres pelearte con Wix · "Pointing method"

Si el caso A te parece mucho rollo, hay una alternativa: **mantener Wix como registrar y DNS, pero agregar los records de Resend directamente en Wix**.

Es la opción "no migro a Cloudflare, pero sí mando emails con Resend". Pierdes los beneficios de Cloudflare DNS (velocidad, editor moderno, automation), pero te ahorras la transferencia.

Pasos:
1. Crear cuenta Resend, agregar dominio (Parte 2 abajo).
2. Resend te da 4 records DNS.
3. Wix → Settings → Domains → tu dominio → **Manage DNS Records** → Add Record.
4. Agregar uno por uno los TXT, MX, etc. de Resend.
5. Verificar en Resend.

Funciona. Es menos elegante pero llegas al mismo resultado para mandar emails.

> Nota importante: Wix oficialmente no soporta DNSSEC ni "DNS Proxies como Cloudflare". Lo del proxy aplica si quisieras enrutar tráfico HTTP por Cloudflare (cosa que no necesitas para Wix). Sólo cuida que en Cloudflare uses los records con la nube **gris (DNS only)**, no la naranja (proxy), para los records que apuntan al sitio Wix.

**Mi recomendación:** si planeas crecer SOPHIA y vas a agregar más subdominios (app.sophiamx.org, landing.sophiamx.org, etc.) con frecuencia, vale la pena el caso A. Si sólo quieres mandar emails con Resend ya, el plan B te resuelve hoy.

---

## Parte 2 · Setup de Resend (después de tener DNS resuelto)

Independiente de si migraste a Cloudflare o no, los pasos de Resend son los mismos.

### 1. Verificar dominio en Resend

1. [resend.com](https://resend.com), sign up con tu Google.
2. **Add domain** → `sophiamx.org`.
3. Resend te muestra 4 records DNS para agregar. Algo así:

   ```
   Type   Name                            Value
   MX     send.sophiamx.org               feedback-smtp.us-east-1.amazonses.com  (priority 10)
   TXT    send.sophiamx.org               v=spf1 include:amazonses.com ~all
   TXT    resend._domainkey.sophiamx.org  p=MIIBIj... (DKIM, larga)
   TXT    _dmarc.sophiamx.org             v=DMARC1; p=none;
   ```

4. **Si ya estás en Cloudflare:** entra a Cloudflare → DNS → Add record. Pegas los 4. 30 segundos por record. Importante: marca "DNS only" (nube gris) en cada uno, NO el proxy naranja.
5. **Si sigues en Wix:** Settings → Domains → Manage DNS Records → Add. Va más lento porque la UI de Wix es torpe pero funciona.
6. Vuelve a Resend, click **Verify**. Si todo está bien, en menos de 5 min te marca "Verified".

### 2. Crear API key

Resend Dashboard → **API Keys** → **Create API Key**.
- Permission: `Sending access`
- Domain: `sophiamx.org`

Copia la key (empieza con `re_xxxxx...`). Sólo la ves una vez. Guárdala en tu password manager.

### 3. Test rápido de envío

```bash
curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer re_TU_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "SOPHIA <hola@sophiamx.org>",
    "to": ["TU_EMAIL_PERSONAL@gmail.com"],
    "subject": "Test desde Resend",
    "html": "<p>Llegó. Funciona.</p>"
  }'
```

Si te llega al inbox (no spam), perfecto. Si cae en spam, revisa que SPF y DKIM estén verdes en Resend.

### 4. Conectar Resend con Airtable, dos opciones

#### Opción A. Airtable Automation (rápido, lo armas hoy)

Airtable PORTAL → Automations → **+ Create**.

**Trigger:** "When record matches conditions"
- Tabla: Invitaciones
- Conditions: `Estatus = activa` AND `Email destinatario` is not empty AND `Persona` is empty

**Action 1:** "Find records" en Cohortes (para sacar fecha de primera sesión, directora, foto, etc.)

**Action 2:** "Find records" en Cursos (para sacar el título, ej. "Happiness Workshop")

**Action 3:** "Run a script". El script interpola las variables del template `bienvenida.html` y manda a Resend. Yo te lo armo completo cuando ya tengas la API key, son ~80 líneas.

#### Opción B. Edge function en Supabase (más limpio)

Una Supabase function dedicada `send-invitation-email` que:
- Recibe `{ invitationId }`
- Lee la invitación + cohorte + curso de Airtable
- Renderiza `bienvenida.html` con las variables
- Manda vía Resend

Pros: el HTML del email vive en archivo en git (no embebido en script de Airtable), versionado, fácil de testear.
Cons: 1 deployment más en Supabase.

**Esto te lo armo cuando ya tengas Resend funcionando.** Avísame y lo agrego al repo.

---

## Mi recomendación específica para ti

1. **Hoy:** confirma en whois.com en qué caso estás. Si Caso B, migra a Cloudflare hoy mismo (1 hora). Si Caso A, decide:
   - ¿Tienes urgencia de mandar emails YA? → Plan B (agregar records de Resend en Wix), te resuelve hoy.
   - ¿Puedes esperar 1 semana? → Caso A bien hecho (Wix → Namecheap → Cloudflare).

2. **Mañana o cuando tengas DNS listo:** verifica `sophiamx.org` en Resend, crea API key, test curl.

3. **Cuando me digas "Resend listo":** te armo la edge function `send-invitation-email` y el script de Airtable Automation. La Automation queda activa, mandas tu primera invitación de prueba.

4. **Mientras tanto:** puedes seguir testeando el flow del portal a mano (creando invitación en Airtable, mandándole el link por WhatsApp). El frontend funciona igual sin el email automatizado.

---

## Resumen visual

```
Caso A (registrado en Wix):
  Wix unlock + EPP → Namecheap (5-7 días) → Cloudflare nameservers → Resend
                                                                        ↑
                                                            por aquí empieza
                                                            el dolor

Caso B (registrado en otro lado):
  Cloudflare add site → cambiar nameservers en tu registrar → Resend
  (1 hora total)

Plan B (no migrar, agregar records en Wix):
  Quedarte en Wix → agregar 4 records DNS de Resend en Wix → Resend funciona
  (30 min total, pero sin beneficios de Cloudflare)
```
