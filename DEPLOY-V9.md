# Deploy v9 · pasos exactos

Tres cosas que tocar:

1. **Supabase**, deployar 1 nueva edge function (copy + paste en el dashboard)
2. **Vercel**, push del repo (frontend completo)
3. **Airtable**, configurar la automation que manda el email (cuando tengas Resend)

---

## 1 · Supabase, deploy `claim-invitation`

Sólo una function nueva. Las existentes (`auth-bootstrap`, `get-mis-cursos`, etc.) NO cambiaron, no las toques.

### Pasos en el dashboard

1. Supabase → tu proyecto → **Edge Functions** → **Create a new function**
2. Nombre: `claim-invitation`
3. **Code:** copia y pega TODO el contenido de:

   ```
   supabase/functions/claim-invitation/index.ts
   ```

   Es un solo archivo, ~480 líneas. Auto-contenido, sin imports de `_shared`.

4. **Secrets necesarios:** ya los tienes (`AIRTABLE_PAT`, `SUPABASE_URL`, etc.)
5. **Deploy.**

### Verificación

Desde el dashboard, prueba el endpoint con un POST:
- URL: `https://TU_PROJECT_ID.supabase.co/functions/v1/claim-invitation`
- Headers: `Authorization: Bearer YOUR_ANON_KEY`, `Content-Type: application/json`
- Body: `{"token":"inv_test_inexistente"}`

Esperado: `404 { "error": "Invitación no encontrada", "code": "not_found" }`. Si te da eso, la function está corriendo bien.

---

## 2 · Vercel, push del frontend

Borra tu carpeta local del repo, descarga el zip, descomprime, y haz push:

```bash
git add -A
git commit -m "v9, cohortes y invitaciones tokenizadas"
git push
```

Vercel detecta y deploya. Lo único que cambió:

- `index.html` (login page, captura `?invite=`)
- `auth/callback.html` (canjea después del login)
- `assets/js/auth.js` (helpers de invite)
- `assets/js/api.js` (método `claimInvitation`)
- `assets/js/cursos.js` (retry + empty state mejorado)

Lo demás del repo es idéntico a tu v8.

---

## 3 · Airtable, automation del email de bienvenida

Esto NO está activo todavía. Necesitas decidir Resend (recomendado) o Airtable nativo. Ver `docs/resend-cloudflare-setup.md` para los pasos completos.

### Antes de mandar el primer email, sube la foto de Natalia

El email referencia `{{directoraFoto}}`, que ya pre-llené en la cohort apuntando a:
`https://portal.sophiamx.org/assets/img/brand/natalia-arriaga.jpg`

Necesitas subir esa imagen. Recomendaciones:
- Formato: JPG (peso menor que PNG, mejor para email)
- Dimensiones: cuadrada, mínimo 200x200, idealmente 400x400 (se renderiza a 56x56 en email, pero retina displays usan 2x)
- Crop: cabeza y hombros, fondo neutro
- Peso: <100KB después de compresión

Súbela como `assets/img/brand/natalia-arriaga.jpg` en el repo y push. Vercel la sirve automáticamente desde `https://portal.sophiamx.org/assets/img/brand/natalia-arriaga.jpg`.

Para futuras cohortes con otra coordinadora, sube su foto al mismo folder y actualiza el campo "Directora foto" en la cohort.

**Mientras tanto, puedes testear el flow del portal sin email:**

1. Crea una invitación manualmente en Airtable:
   - Tabla: Invitaciones
   - Token: `inv_test001` (cualquier cosa que empiece con `inv_`)
   - Cohorte: linkea a "Happiness Workshop - 12.05.2026"
   - Email destinatario: tu cuenta de Google de prueba (una que NO esté ya en CRM)
   - Origen: `manual`
   - Estatus: `activa`

2. Abre en ventana incógnita: `https://portal.sophiamx.org/?invite=inv_test001`
3. Login con la cuenta de Google del email de prueba.
4. Deberías acabar en `/app/curso?slug=happiness-workshop&welcome=1`.
5. Verifica en Airtable:
   - La invitación ahora tiene Estatus = `canjeada`, Persona linkeada, Fecha canje.
   - Hay una nueva Inscripción con Cohorte = "Happiness Workshop - 12.05.2026".

---

## Si algo falla

### `claim-invitation` devuelve 425 sync_pending

Es el sync CRM-Portal de Airtable que tarda. Es esperado en el primer login de un usuario completamente nuevo. El frontend reintenta automáticamente cuando el usuario llega a `/app/cursos`. Si pasa 5+ minutos y sigue fallando, revisa que tu automation de "Persona-CRM creada → crear Persona-Portal" esté activa.

### Aparece "Esta invitación es para otro correo"

El email destinatario en la invitación no coincide con el email del Google login. Revisa que el email en Airtable esté en minúsculas y sin espacios.

### El usuario llega al portal pero no ve cursos

Probablemente el sync CRM→Portal no terminó. Que recargue `/app/cursos` después de 1-2 min y debería aparecer.

### Logs

Supabase → Edge Functions → claim-invitation → Logs. Cada call queda registrada.

---

## Test de smoke completo

Para verificar que TODO está funcionando antes de mandar la primera invitación real a alguien:

1. Crea cuenta Google nueva de prueba (gmail.com, lo que sea).
2. En Airtable, crea invitación con ese email y token `inv_smoke001`.
3. Ventana incógnita, abre `https://portal.sophiamx.org/?invite=inv_smoke001`.
4. Login con la cuenta nueva.
5. Verifica:
   - [ ] Caes en `/app/curso?slug=happiness-workshop&welcome=1`
   - [ ] El sidebar muestra tu nombre
   - [ ] Ves el contenido del Módulo 1
   - [ ] La lección "Bienvenida" se abre
   - [ ] El test de felicidad funciona
   - [ ] En Airtable: Persona-CRM creada, Persona-Portal sincronizada (puede tardar), Inscripción con Cohorte y Curso, Invitación en estado `canjeada`
6. Si todo OK, ya estás listo para invitar gente real.
