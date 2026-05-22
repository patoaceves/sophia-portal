# Deployment

Cómo desplegar cambios a cada capa del stack.

---

## 1. Frontend (Vercel)

El frontend es estático. Vercel deploya automáticamente cada push a `main`.

### Setup inicial (una sola vez)

- Proyecto conectado al repo en Vercel
- `vercel.json` usa `@vercel/static` **únicamente** — NO agregar `@vercel/node`
- Dominio: `portal.sophiamx.org` (apuntado a Vercel via DNS)

### Deploy normal

```bash
git push origin main
```

Vercel detecta el push, builds (no hay build step real), y publica en ~30 segundos. URL del deploy aparece en la PR de GitHub si abriste una.

### vercel.json

```json
{
  "version": 2,
  "builds": [
    { "src": "**", "use": "@vercel/static" }
  ]
}
```

No tocar este archivo. Si necesitas redirects/rewrites, agregarlos como `"routes"` o `"rewrites"`.

---

## 2. Edge Functions (Supabase)

Despliegue manual desde el dashboard. No hay CLI configurado.

### Pasos

1. Ir a Supabase dashboard → Project → Edge Functions
2. Seleccionar la función a desplegar
3. Click en **"Deploy"** → pegar el contenido de `supabase/functions/<nombre>/index.ts`
4. Si la función usa helpers de `_shared/`, asegurarse de que también estén actualizados
5. Click **"Deploy function"**

### Funciones que comparten código

Varias edge functions importan helpers de `_shared/`:
- `_shared/cors.ts`
- `_shared/airtable.ts`
- `_shared/auth.ts`

Si modificas alguno, hay que re-deployar **todas** las funciones que lo usan.

### Variables de entorno (Secrets)

Settings → Edge Functions → Secrets:

| Secret | Para qué |
|---|---|
| `AIRTABLE_PAT` | PAT con scope read/write a ambas bases |
| `AIRTABLE_INSCRIPCION_WEBHOOK` | URL del webhook de Airtable Automation |
| `IMPORT_PUBLIC_TOKEN` | Token compartido con `/embed/importar-participantes` |

---

## 3. Airtable Automation Script

Cambios al script `airtable-automation-script.js`:

1. Abrir base **CRM** en Airtable
2. **Automations** → "Inscribir Participantes Webhook"
3. Click en la acción **"Run a script — Crear invitación SOPHIA"**
4. Borrar todo el código existente, pegar el nuevo
5. **Verificar Input variables**: confirma que el panel tenga
   - `nombre`, `apellidos`, `email`, `rol` ← Trigger > participantes > <field>
   - `cohorteId`, `cohorteNombre` ← Trigger > <field>
   - `portalPat` ← (texto fijo)
6. Click **"Run a test"** con un participante de prueba
7. Si pasa → **"Publish"** (botón verde arriba)

---

## 4. Email template (GHL)

Cambios al template de bienvenida:

1. Editar `email-templates/bienvenida-ghl.html` en el repo (para versionarlo)
2. En GHL: Workflows → workflow de onboarding → action **Send Email**
3. Editar el body → pegar el HTML nuevo
4. **Send test** desde GHL para verificar render
5. **Publish**

Para agregar/modificar custom fields del contact, ver `email-templates/README.md`.

---

## Orden recomendado al hacer cambios cross-capa

Si un cambio afecta varias capas (ej. agregar una variable nueva al correo):

1. **Repo:** modificar `airtable-automation-script.js` y `email-templates/bienvenida-ghl.html`
2. **GHL:** crear el custom field nuevo, mapearlo en Create Contact
3. **GHL:** pegar el HTML nuevo en Send Email
4. **Airtable:** pegar el script nuevo en la Automation, run test, publish
5. **Test end-to-end:** alta de prueba en `/embed/importar-participantes`

Hacerlo en este orden evita ventanas en las que el script manda una variable que GHL todavía no sabe recibir.

---

## Rollback

### Frontend
```bash
git revert <commit> && git push origin main
```

### Edge Function
Re-deployar la versión anterior pegando código del commit anterior.

### Airtable Automation
Airtable mantiene "Runs history" pero no versionado del script. Hay que pegar la versión anterior manualmente (del repo, vía `git log` del archivo `airtable-automation-script.js`).

### GHL template
GHL guarda histórico de versiones del workflow. Settings del workflow → Versions → restore.
