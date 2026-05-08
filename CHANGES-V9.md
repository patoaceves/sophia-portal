# SOPHIA Portal · v9 · Cohortes + Invitaciones tokenizadas

**TL;DR:** Refactor del onboarding para que escale a múltiples generaciones y múltiples cursos. Las personas entran al portal con un link tokenizado tipo `portal.sophiamx.org/?invite=inv_xxx`, no auto-inscritas.

---

## Lo que cambió

### Airtable (PORTAL · `app0S6GrJQ8YatvCc`)

**Tablas nuevas:**
1. **Cohortes** (`tblMwkKfk6U7a75Ja`), cada generación de un curso. Una cohort = 1 curso template + 1 fecha + grupo definido.
2. **Invitaciones** (`tblzNARG9ahLsKR9c`), tokens de un solo uso. Cada token = 1 cohorte + (opcionalmente) 1 email destinatario.

**Tablas modificadas:**
3. **Inscripciones**, ahora linkea a Cohorte (campo `fldeML5okrUfcNBM3`). El campo `Curso` se mantiene para backwards compat.
4. **Personas (Portal)**, agregado campo inverso `Invitaciones` (`fld6Rl8lQSO3ndBDQ`).
5. **Cursos**, agregado campo inverso `Cohortes` (`flddYCyaYUFnuSysI`).

**Datos sembrados:**
- 1 cohorte: **Happiness Workshop - 12.05.2026** (`recAtCr3VWNfpzmyh`), estatus `abierta`.
- Las 4 inscripciones existentes (Mary, Mateo, Patricio + 1) ya migradas a esta cohorte.
- 0 invitaciones, listas para crearse cuando quieras testear el flow.

---

### Backend · Supabase Edge Functions

**Nueva:** `claim-invitation` (`supabase/functions/claim-invitation/index.ts`)
- POST con `{ token }` y JWT.
- Valida invitación (estatus, expiración, email match, cohorte abierta).
- Reintenta hasta 4.5s buscando PersonaPortal (mientras espera el sync CRM→Portal).
- Crea inscripción ligada a la cohorte + curso (legacy).
- Marca invitación como canjeada con persona + fecha canje.
- Idempotente: si recargas y ya canjeaste, devuelve `alreadyClaimed: true` sin error.

Códigos de error que devuelve (en `error.payload.code`):
- `invalid_token`, formato no es `inv_xxx`
- `not_found`, token no existe
- `already_claimed`, alguien más ya lo canjeó
- `expired`, pasó la fecha de expiración (también marca el record en Airtable)
- `revoked`, fue revocado manualmente
- `email_mismatch`, el destinatario es otro
- `cohort_closed`, la cohorte está `cerrada` o `completada`
- `sync_pending` (425), el sync CRM→Portal aún no termina; el frontend reintenta automáticamente

---

### Frontend

**Cambios:**

1. **`assets/js/auth.js`**, agregadas:
   - `captureInviteFromUrl()`, extrae `?invite=xxx` y lo guarda en sessionStorage. Limpia la URL.
   - `getPendingInvite()`, `clearPendingInvite()`
   - `tryClaimPendingInvite()`, envuelve la llamada a la edge function. Devuelve un objeto tipado `{ kind: "claimed" | "already" | "retry" | "fatal" | "none" }` para que el caller decida qué hacer.

2. **`assets/js/api.js`**, agregado método `api.claimInvitation(token)`.

3. **`index.html` (login)**, al cargar, captura `?invite=` antes de cualquier redirect. Si hay token pendiente, muestra "Tienes una invitación pendiente. Inicia sesión para activarla."

4. **`auth/callback.html`**, después de que la sesión esté lista, intenta canjear. Si tiene éxito, redirige al curso recién canjeado (`/app/curso?slug=xxx&welcome=1`). Si el sync está pendiente, mete al portal normalmente, `cursos.html` reintentará.

5. **`assets/js/cursos.js`**, al cargar la página, si hay token pendiente, intenta canjear de nuevo (cubre el caso del sync delay). Empty state mejorado: "Si pagaste recientemente, busca tu email de bienvenida, no hay self-enroll."

---

### Email

**`email-templates/bienvenida.html`** · el HTML que aprobaste, con la nota de directora corregida ("Voy a coordinar el programa contigo durante estas semanas. Si surge cualquier pregunta sobre el material, las sesiones o la logística, escríbeme y te respondo el mismo día.").

Variables a interpolar al enviar:
- `{{nombre}}` (opcional)
- `{{curso}}`, desde Cohorte → Curso → Título
- `{{portalUrl}}`, `https://portal.sophiamx.org`
- `{{primeraSesionFecha}}`, `{{primeraSesionHora}}`
- `{{directora}}`, `{{directoraEmail}}`
- **CTA href:** usa el campo `URL` de la invitación (formula auto-genera `https://portal.sophiamx.org/?invite={Token}`)

---

### Docs

**`docs/airtable-schema.md`** · actualizado con cohortes + invitaciones + IDs de campos.
**`docs/onboarding-flow.md`** · NUEVO. Step-by-step del flow, casos de uso, edge cases, scripts para crear invitaciones bulk, propuesta de Airtable Automation.

---

## Pasos para activar todo (orden importa)

### 1. Deploy `claim-invitation` en Supabase
```
- Crear nueva Edge Function `claim-invitation`
- Pegar el contenido de `supabase/functions/claim-invitation/index.ts`
- Asegurarse que el secret `AIRTABLE_PAT` está disponible (ya lo tienes para las otras funciones)
- Deploy
```

### 2. Deploy frontend a Vercel
```bash
git add -A
git commit -m "v9: cohortes + invitaciones tokenizadas"
git push
# Vercel detecta y deploya
```

### 3. Configurar Airtable Automation (manda el email)

Trigger: When record matches conditions
- Tabla: Invitaciones
- Estatus = `activa`
- Email destinatario is not empty

Action: Send email
- To: `{Email destinatario}`
- Subject: `Tu lugar en {Cohorte → Curso → Título} está confirmado · SOPHIA`
- Body: pega `email-templates/bienvenida.html` con las variables interpoladas

### 4. Test end-to-end

1. En Airtable → Invitaciones → "+ New record".
   - Token: `inv_test001`
   - Cohorte: Happiness Workshop - 12.05.2026
   - Email destinatario: tu correo de prueba (uno que NO esté ya en CRM)
   - Origen: `manual`
   - Estatus: `activa`
2. Abre `https://portal.sophiamx.org/?invite=inv_test001` en una ventana incógnita.
3. Login con la cuenta Google del email de prueba.
4. Deberías acabar en `/app/curso?slug=happiness-workshop&welcome=1`.
5. Verificar en Airtable que la invitación quedó como `canjeada` y que se creó una nueva inscripción.

### 5. Limpiar inscripciones de prueba (si las creaste)

Borrar a Mateo / pruebas viejas y dejar solo lo que quieras conservar.

---

## Lo que NO cambió (por si acaso)

- Las edge functions existentes (`auth-bootstrap`, `get-mis-cursos`, etc.), sin tocar.
- El sidebar, el shell, el test de felicidad, los anuncios, todo sigue igual.
- La cuenta de Mateo y la tuya siguen funcionando porque sus inscripciones ya tienen Cohorte ligada.

---

## Pendientes / próximas fases

- [ ] **Resend integration**: para mandar el email con mejor deliverability + tracking. Hoy sale del Airtable Automation (suficiente para arrancar).
- [ ] **Stripe webhook**: cuando conectes Stripe, una function `stripe-webhook` crea invitaciones automáticamente al recibir un pago.
- [ ] **Migrar `get-mis-cursos`** para leer Curso vía Cohorte (en vez de campo Curso directo). Eventualmente puedes deprecar el campo Curso en Inscripciones.
- [ ] **Recordatorios automáticos** N días antes de la primera sesión de cada cohorte.
- [ ] **Vista admin** en /app/admin para ver invitaciones pendientes/canjeadas y crear nuevas sin abrir Airtable.
