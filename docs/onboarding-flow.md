# Onboarding flow · SOPHIA Portal

Cómo una persona pasa de "le interesa un curso" → "ya está adentro del portal con su inscripción activa".

---

## Modelo mental

```
PAGA / RECIBE CORTESÍA
  │
  ▼
[1] CREAR INVITACIÓN  (manual o automation)
  │   token: inv_xxxxxxxx
  │   cohorte: Happiness Workshop - 12.05.2026
  │   email destinatario: usuario@gmail.com (opcional)
  │
  ▼
[2] EMAIL AUTOMÁTICO  (Airtable Automation)
  │   Sujeto: "Tu lugar en Happiness Workshop está confirmado"
  │   Body: email-templates/bienvenida.html
  │   CTA: https://portal.sophiamx.org/?invite=inv_xxxxxxxx
  │
  ▼
[3] USUARIO HACE CLICK
  │   Llega a portal.sophiamx.org/?invite=inv_xxxxxxxx
  │   index.html captura el token → sessionStorage["sophia_pending_invite"]
  │   Limpia la URL (history.replaceState)
  │
  ▼
[4] LOGIN CON GOOGLE
  │   redirectTo: /auth/callback
  │
  ▼
[5] CALLBACK
  │   - Espera a que la sesión esté lista
  │   - auth-bootstrap crea Persona en CRM
  │   - claim-invitation canjea el token:
  │       a) Busca PersonaPortal (retry hasta 4.5s mientras espera el sync CRM→Portal)
  │       b) Valida invitación (estatus, expiración, email, cohorte abierta)
  │       c) Crea Inscripción ligada a la cohorte
  │       d) Marca invitación como canjeada
  │   - Redirige a /app/curso?slug={cursoSlug}&welcome=1
  │
  ▼
[6] BIENVENIDA
      Usuario adentro, inscrito, con acceso al contenido del Capítulo 1.
```

---

## Casos que esto resuelve

### Caso 1 · Pato vende vía transferencia
1. Recibe comprobante por WhatsApp.
2. Va a Airtable → tabla **Invitaciones** → "+ New record".
3. Escoge cohorte = "Happiness Workshop - 12.05.2026", pone email destinatario, Origen = "transferencia", Notas = "Pagó $X el día Y, comprobante en Drive".
4. La automation manda el email automáticamente.
5. La persona hace click → entra → ya está adentro.

### Caso 2 · Pato vende vía Stripe (futuro)
- Stripe webhook → Supabase function → crea invitación con Origen = "stripe", token único, email destinatario del checkout.
- Mismo flow desde [2] en adelante.

### Caso 3 · Cortesía / beca / referido
- Se crea invitación con Origen = "cortesia", **sin email destinatario**.
- La primera persona que use el link queda inscrita.
- Para becas multi-uso, generar varias invitaciones (no soportado one-token-many-uses por diseño, un token, un canje).

### Caso 4 · Bulk import de cohorte completa
- Pato sube CSV de invitaciones a Airtable o usa script de la base.
- Automation manda emails masivos.
- Cada quien activa cuando quiera.

### Caso 5 · Persona ya tiene cuenta y se inscribe a otra cohorte
- Mismo flow. La Persona-CRM no se duplica (auth-bootstrap detecta auth_user_id existente).
- Se crea una inscripción adicional ligada a la nueva cohorte.

### Caso 6 · Persona entra al portal SIN invitación
- Login con Google funciona (auth-bootstrap crea la Persona).
- /app/cursos muestra empty state: "Si pagaste recientemente, busca tu email de bienvenida."
- No hay self-enroll automático.

---

## Edge cases manejados

| Escenario | Respuesta |
|---|---|
| Token inválido (formato) | 400 `invalid_token` |
| Token no existe | 404 `not_found` |
| Token ya canjeado por otra persona | 400 `already_claimed` |
| Token ya canjeado por mí (recargué) | 200 `alreadyClaimed: true` (idempotente) |
| Token expirado por fecha | 400 `expired` (y se marca como `expirada` en Airtable) |
| Token revocado manualmente | 400 `revoked` |
| Email destinatario no coincide | 403 `email_mismatch` |
| Cohorte cerrada/completada | 400 `cohort_closed` |
| Sync CRM→Portal pendiente | 425 `sync_pending` (frontend reintenta) |

---

## Cómo crear invitaciones desde Airtable

Hay **3 formas** según la situación:

### A) Manual, 1 sola invitación
1. Tabla **Invitaciones** → "+ New record".
2. Llenar:
   - **Token:** `inv_` + 8-12 chars random. Genera uno con [random.org](https://www.random.org/strings/?num=1&len=12&digits=on&upperalpha=on&loweralpha=on).
   - **Cohorte:** linkear a la cohorte correspondiente.
   - **Email destinatario:** el email de la persona (recomendado).
   - **Origen:** según corresponda.
   - **Estatus:** `activa`.
   - **Notas:** contexto de cómo pagó/por qué.
3. La automation (configurar abajo) manda el email.

### B) Script en Airtable · bulk
Pegar este script en una vista de **Invitaciones** → menú → Run a script:

```js
// Bulk: crea invitaciones para una cohorte a partir de una lista de emails
const cohorteTable = base.getTable("Cohortes");
const invTable = base.getTable("Invitaciones");

const cohortes = await cohorteTable.selectRecordsAsync({ fields: ["Nombre"] });
const cohorte = await input.recordAsync("¿A qué cohorte?", cohortes);
if (!cohorte) return;

const emailsRaw = await input.textAsync(
  "Pega los emails (uno por línea o separados por coma)"
);
const emails = emailsRaw
  .split(/[\n,;]+/)
  .map((e) => e.trim().toLowerCase())
  .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));

const records = emails.map((email) => ({
  fields: {
    "Token": "inv_" + Math.random().toString(36).slice(2, 12),
    "Cohorte": [{ id: cohorte.id }],
    "Email destinatario": email,
    "Origen": { name: "bulk" },
    "Estatus": { name: "activa" },
  },
}));

// Airtable script: crear de 50 en 50
for (let i = 0; i < records.length; i += 50) {
  await invTable.createRecordsAsync(records.slice(i, i + 50));
}

output.text(`✅ Creadas ${records.length} invitaciones para "${cohorte.name}"`);
```

### C) Stripe webhook (próxima fase)
Cuando se conecte Stripe, un webhook → Supabase function `stripe-webhook` →
crea la invitación automáticamente con Origen = "stripe" y los metadatos del payment intent.

---

## Airtable Automation: enviar el email de bienvenida

**Trigger:** When record matches conditions
- Tabla: Invitaciones
- Condición: `Estatus = activa` AND `Email destinatario` is not empty AND `Origen` ≠ vacío

**Action:** Send email (o vía Resend si quieres branding mejor)
- To: `{Email destinatario}`
- Subject: `Tu lugar en {Cohorte → Curso → Título} está confirmado`
- Body: Renderizar `email-templates/bienvenida.html` con interpolación.

Variables a interpolar (ya tienes los lookups):
- `{{nombre}}`, opcional. Si no tienes el nombre todavía, usa `Hola` solo. La automation puede dejarlo vacío.
- `{{curso}}`, desde Cohorte → Curso → Título
- `{{portalUrl}}`, `https://portal.sophiamx.org`
- `{{primeraSesionFecha}}`, desde Cohorte → Fecha inicio (formatear como "12 de mayo de 2026")
- `{{primeraSesionHora}}`, hardcoded por ahora ("7:30 P.M.")
- `{{directora}}`, desde Cohorte → Directora
- `{{directoraEmail}}`, la dejamos manual por ahora (`natalia.arriaga@sophiamx.org`)
- **CTA href:** `{{portalUrl}}/?invite={{Token}}`, que es justo el campo URL de la invitación.

> Recomendación: si quieres mejor deliverability + tracking, manda el email vía
> **Resend** desde una Supabase function `send-invitation-email` que se llame desde la
> automation con un webhook. Yo te armo esa función cuando lo decidas.

---

## Estados a monitorear (vista útil en Airtable)

Crear vista **"Pendientes"** en Invitaciones:
- Filtros: `Estatus = activa` AND `Fecha canje is empty`
- Ordenar por: `Created at` desc

Crear vista **"Canjeadas hoy"**:
- Filtros: `Estatus = canjeada` AND `Fecha canje is within: today`

Crear vista **"Expirando pronto"**:
- Filtros: `Estatus = activa` AND `Expira el is within next 7 days`

---

## Cosas que NO hace este sistema (todavía)

- **Renvío de invitaciones.** Si el email se pierde, hay que crear una nueva invitación o dispararle al usuario el link manualmente.
- **Refunds.** Si Pato quiere revocar una invitación canjeada, necesita: (a) marcar invitación como `revocada`, (b) marcar inscripción como `cancelada`. Manual por ahora.
- **Recordatorios automáticos antes de la primera sesión.** Próxima fase.
- **Multi-uso tokens.** Por diseño cada token es de un solo uso. Si necesitas 30 personas con un mismo "código" para una promo, genera 30 tokens distintos.
