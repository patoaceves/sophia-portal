# SOPHIA Portal · v15

**TL;DR:** Onboarding rediseñado con teléfono y foto editable, perfil 100% editable, redirect post-login siempre a `/app/cursos`, dashboard reestructurado (strip de progreso pegado al hero, foro preview en el resumen, test-cajita más justo) y 2 templates de email branded para pegar al Supabase Dashboard.

---

## Cambios

### Airtable · Personas (CRM)

3 campos nuevos en `tbl5XKtg0mRfLeFYH`:

| Campo                | ID                       | Tipo           |
|----------------------|--------------------------|----------------|
| Teléfono país        | `fld0psZVirGYHs2AQ`      | singleLineText |
| Teléfono número      | `fld3fDQA1tfiNPXN5`      | phoneNumber    |
| Perfil completado    | `fldB98L7JqQM27Z9I`      | checkbox       |

> **`Perfil completado`** distingue usuarios recién creados (Google sign-in con datos parciales) de los que ya pasaron por el onboarding. Default `false`. Submit del onboarding lo pone a `true`.

### Backend · `auth-bootstrap`

- Acepta nuevos campos en body: `telefonoPais`, `telefonoNumero`, `avatarUrl`, `perfilCompletado`.
- Refactor: helpers `buildResponse(p, isNew)` y `buildUpdates(p, { force })`. Cuando `body.perfilCompletado === true`, los valores del body **sobreescriben** los existentes (modo edición). Si no, solo rellenan campos vacíos (modo backfill).
- Response ahora incluye: `email`, `avatarUrl`, `telefonoPais`, `telefonoNumero`, `perfilCompletado`.

### Frontend · onboarding (`/app/bienvenida`)

- Trigger: `Persona.perfilCompletado === false`. Esto cubre **todos** los nuevos: magic link **y** Google sign-in.
- Form completo: avatar (URL paste para v15, upload nativo en v16) + nombre + apellidos + email (read-only) + clave país (dropdown 23 países LATAM/US/España) + teléfono.
- Submit llama `updatePersonaProfile({...campos, perfilCompletado: true})` y redirige a `/app/cursos`.

### Frontend · perfil (`/app/perfil`)

Reescrito como form 100% editable con los mismos campos del onboarding. Email sigue read-only (cambiar email = cambiar identidad de auth, complejo). Botón "Guardar cambios" muestra ✓ y se reactiva tras 1.8s.

### Post-login redirect

`auth/callback.html`: ya no manda al curso del invite (`/app/curso?slug=X&welcome=1`). Siempre va a `/app/cursos` después del login, donde el usuario ve **todos** sus cursos. La inscripción del invite ya está canjeada (no se pierde).

### Dashboard · `/app/curso?slug=X`

Layout reestructurado:

**ANTES:**
```
[hero]
[tabs]
  [resumen]
    ┌─ continue card ─┬─ test cajita ─┐
    │ "Tu camino"     │ rueda          │
    │ progress + btn  │                │
    └────────────────┴────────────────┘
```

**AHORA:**
```
[hero]
[ ↓ progress strip: barra + "Continuar con: <lección>" + botón → ]
[tabs]
  [resumen]
    ┌─ foro preview ──┬─ test cajita ─┐
    │ últimos 3 posts │ rueda (tighter) │
    │ "Ver foro →"    │                │
    └────────────────┴────────────────┘
```

- **`renderProgressStrip(ctx)`**: nueva función. Strip horizontal full-width entre hero y tabs. Muestra progress bar 6px + texto "Capítulo X · <título lección> · Y de Z lecciones (W%)" + botón. En curso completado muestra "¡Felicidades!" sin botón.
- **`renderForoPreviewCard(ctx)`**: sustituye al `renderContinuePanel` (eliminado). Skeleton inicial, luego `fetchForoPreview()` carga los últimos 3 posts (filtra eliminados) y los pinta con avatar + autor + fecha relativa + excerpt 2 líneas.
- **`renderTestCajita`**: sin cambios de estructura. CSS reduce `.test-cajita` gap de `--s-3` a `--s-2` y `.test-cajita__chart` quita los `var(--s-3) 0` de padding. La rueda mantiene `max-width: 416px`.

### Email branding · 2 templates HTML

`/email-templates/`:
- `supabase-magic-link.html` — el de cada login por email
- `supabase-confirm-signup.html` — el de primera registración
- `README.md` — instrucciones para pegarlos al Supabase Dashboard

> No requieren deploy de código. Pegado manual al panel de Supabase.

---

## Deploy

### 1. Re-deployar `auth-bootstrap`

Solo esta función cambió. Las otras 8 quedan igual.

1. Supabase Dashboard → Edge Functions → `auth-bootstrap`
2. Pega el contenido de `supabase/functions/auth-bootstrap/index.ts` (o sube el `auth-bootstrap.ts` standalone)
3. Deploy

### 2. Push frontend a Vercel

```bash
git add -A
git commit -m "v15: onboarding con teléfono, perfil editable, dashboard restructure"
git push
```

### 3. Email templates (5 min, opcional pero recomendado)

Sigue las instrucciones de `email-templates/README.md`. Resumen:
1. Supabase Dashboard → Authentication → Email Templates → Magic Link → pega `supabase-magic-link.html`
2. Mismo lugar → Confirm signup → pega `supabase-confirm-signup.html`

### 4. Test end-to-end

**Escenario A — Usuario nuevo magic link:**
1. Ventana incógnita → `portal.sophiamx.org`
2. Email → "Enviar enlace"
3. Llega el correo SOPHIA-branded → click
4. Después del callback aterrizas en `/app/bienvenida`
5. Form prellenado solo con email read-only. Llena nombre, apellidos, opcionalmente teléfono. Click "Continuar al portal"
6. Aterrizas en `/app/cursos` (no en el curso específico). ✓

**Escenario B — Usuario nuevo con Google:**
1. Mismo flow pero "Continuar con Google"
2. Aterrizas en `/app/bienvenida` con foto de Google + nombre + apellidos prellenados
3. Solo agregas teléfono opcional → submit → `/app/cursos` ✓

**Escenario C — Usuario existente regresa:**
1. Login → callback → `/app/cursos` directo (sin pasar por bienvenida) ✓

**Escenario D — Editar perfil:**
1. `/app/perfil` muestra form editable con todos los datos
2. Cambia teléfono o nombre → "Guardar cambios" → ✓ Guardado
3. Refresh: cambios persistieron ✓

**Escenario E — Dashboard:**
1. `/app/curso?slug=happiness-workshop`
2. Hero arriba (info del curso + directora + capítulo)
3. Strip horizontal **debajo del hero**: barra de progreso + "Continuar con..." + botón
4. Tabs
5. Resumen: izquierda = "Conversación reciente" con últimos posts del foro / derecha = test cajita con rueda más justa (sin tanto whitespace) ✓

---

## Pendientes para v16

- [ ] Upload nativo de fotos vía Supabase Storage (sustituye URL paste actual)
- [ ] Posts del foro con uploads de imágenes nativos (mismo Storage)
- [ ] Reactions (likes) + notificaciones por email vía Resend
- [ ] Renombrar inverse field "Posts copy" → "Comentarios" en Airtable (cosmético, no afecta código)
- [ ] Sync los nuevos campos de teléfono a Personas Portal si quieres mostrarlos en el directorio del foro (ahorita los leemos directo de Personas CRM en bootstrap)

---

## Notas técnicas

- Si tienes usuarios existentes en Personas CRM con `Perfil completado = false` (default), la **próxima vez que entren** los va a mandar al onboarding. Si no quieres molestarlos, marca el checkbox manualmente en Airtable para los usuarios actuales (o haz un bulk update vía script).
- El campo `Teléfono` que ya existía en Personas CRM no se tocó. Los nuevos campos son `Teléfono país` + `Teléfono número`. Si quieres consolidar, escríbelo en una fórmula nueva.
- El sort del foro depende de que `Fecha` esté llena. Posts viejos creados antes de v14 quizá no tengan Fecha — aparecerán al final. Si quieres backfillearlos, copia `Created time` (auto-Airtable) a `Fecha` con un script o automation.
