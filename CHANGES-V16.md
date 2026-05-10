# SOPHIA Portal · v16 · Uploads nativos (imágenes, videos, archivos)

## Resumen

Reemplaza el "URL paste" por subida nativa de archivos. Aplica a:
- **Foto de perfil** (onboarding y `/app/perfil`): elige archivo de tu disco → sube a Supabase Storage → URL queda guardada.
- **Adjuntos en posts del foro**: imagen, video o archivo. Un adjunto por post.

## Stack del cambio

- **Supabase Storage** (bucket `sophia-portal-uploads`, público) — almacén de archivos.
- **Edge Function nueva `upload-asset`** — recibe multipart/form-data, valida MIME y tamaño, sube con service role, devuelve URL pública.
- **Airtable**: campo `Posts.Imagen URL` renombrado → `Posts.Adjunto URL`. Dos campos nuevos: `Adjunto tipo` (imagen/video/archivo) y `Adjunto nombre`.
- **Frontend**: `<input type="file">` invisible + botón visible. Preview optimista local (`URL.createObjectURL`) durante el upload, luego se sustituye por la URL de Storage. Progress bar nativa con XMLHttpRequest.

## Límites por tipo de adjunto

| Tipo    | MIMEs aceptados                                                          | Max     |
|---------|--------------------------------------------------------------------------|---------|
| Avatar  | `image/jpeg`, `image/png`, `image/webp`, `image/gif`                     | 5 MB    |
| Imagen  | `image/jpeg`, `image/png`, `image/webp`, `image/gif`                     | 5 MB    |
| Video   | `video/mp4`, `video/webm`, `video/quicktime`                             | 50 MB   |
| Archivo | PDF, Word (.doc/.docx), Excel (.xls/.xlsx), PowerPoint, txt, csv, zip    | 20 MB   |

El backend infiere `attachmentType` desde el MIME — no hay que mandarlo desde el frontend.

## Cambios en Airtable (ya hechos vía MCP)

Tabla **Posts** (`tblmLVl9ySzTXb2OK`):

| Field name      | Field ID              | Estado     | Tipo                                       |
|-----------------|-----------------------|------------|--------------------------------------------|
| Adjunto URL     | `fldmMwKgVz0lP3BO8`   | renombrado | url (era "Imagen URL")                     |
| Adjunto tipo    | `fldoKoSJCdGjZnhyD`   | nuevo      | singleSelect: imagen / video / archivo     |
| Adjunto nombre  | `fldpswnHcsl5He8M2`   | nuevo      | singleLineText                             |

Los posts viejos con `Imagen URL` siguen funcionando: el campo no se eliminó, solo se renombró. Las imágenes anteriores (URLs externas, ej. de Google) renderean igual mientras `Adjunto tipo` esté vacío — pero el frontend nuevo NO los muestra (porque renderAttachment requiere ambos campos). Si quieres que se vean, manualmente set `Adjunto tipo = imagen` en esos records, o simplemente déjalos así (eran tests).

## Pasos de deploy en orden

### 1. Crear el bucket de Storage en Supabase (UNA vez, manual)

Esto YO no lo puedo hacer por ti — la API del MCP no llega ahí. Es 1 minuto en el dashboard:

1. Entra a **Supabase Dashboard → Storage** (icono de carpeta en la sidebar izquierda).
2. Click **"New bucket"**.
3. Nombre exacto: **`sophia-portal-uploads`**.
4. **MARCA** la opción **"Public bucket"** (importantísimo — si no, las URLs no son accesibles directamente y se rompe todo).
5. **File size limit**: lo dejas en blanco o pones 50 MB (el límite real lo hace la edge function).
6. **Allowed MIME types**: déjalo vacío (igual, la edge function valida).
7. Click **Create bucket**.

Por defecto los buckets nuevos vienen sin RLS policies para INSERT/UPDATE/DELETE — eso es OK porque la edge function usa la service role key, que bypassa RLS. La lectura pública también funciona out-of-the-box porque marcaste "Public bucket".

### 2. Deploy de las edge functions

Tienes 3 functions que tocar (1 nueva + 2 modificadas):

**(a) Nueva: `upload-asset`** (archivo standalone `upload-asset.ts`)
- En el dashboard: **Edge Functions → New function → Name: `upload-asset`**
- Pega el contenido de `upload-asset.ts`
- Deploy
- Verifica que `verify_jwt = true` (el default; el code chequea el JWT manualmente igual)

**(b) Re-deploy: `create-foro-post`** (archivo `create-foro-post.ts`)
- Pega el contenido nuevo en la function existente
- Deploy

**(c) Re-deploy: `get-foro-posts`** (archivo `get-foro-posts.ts`)
- Pega el contenido nuevo
- Deploy

Las env vars necesarias (todas vienen por default en Supabase, no las tocas):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (o `SUPABASE_PUBLISHABLE_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` ← **crítica** para que upload-asset pueda escribir al bucket
- `AIRTABLE_PAT`

### 3. Push frontend a Vercel

```bash
cd ~/repo/sophia-portal
# (reemplaza con tu zip extraído)
git add -A
git commit -m "v16: native uploads para avatar y foro"
git push
```

## Cómo se prueba

1. Entra a `/app/perfil` → click "Cambiar foto" → elige una foto desde tu disco → ves preview local instantáneo + barra de progreso → al terminar, la foto se reemplaza con la URL de Storage. Click "Guardar cambios" para persistir en Airtable.

2. Entra a un curso → tab Foro → click "Adjuntar" en el composer → elige una imagen, video o PDF → ves el preview con progreso → publica.

3. Después de publicar verifica:
   - **Imagen**: se muestra inline, click abre tamaño completo en nueva pestaña.
   - **Video**: player nativo `<video controls>` con play/pause/fullscreen.
   - **Archivo**: card con icono + nombre + botón "Descargar".

## Validación de seguridad

`create-foro-post` ahora valida que `adjuntoUrl` venga **exclusivamente** del bucket `sophia-portal-uploads`:

```ts
return /\.supabase\.co$/.test(u.hostname) &&
       u.pathname.startsWith("/storage/v1/object/public/sophia-portal-uploads/");
```

Esto evita que un atacante con un JWT válido publique URLs externas como "adjunto" (vector de phishing/referer leak).

## Path patterns en Storage

```
avatars/{authUserId}/{timestamp}.{ext}
foro/{cursoId}/{authUserId}/{timestamp}-{filename-sanitized}
```

Filenames se sanitizan: lowercase, sin acentos, solo `[a-z0-9._-]`, max 80 chars. Si el filename original tiene caracteres raros, queda algo como `foto-de-mi-cumpleaños.jpg` → `foto-de-mi-cumpleanos.jpg`.

## Archivos del paquete

- `sophia-portal-v16.zip` — todo el repo
- `upload-asset.ts` — function nueva (lo que va en `/upload-asset/index.ts`)
- `create-foro-post.ts` — function modificada
- `get-foro-posts.ts` — function modificada

## Lo que NO está en v16 (futuro)

- Múltiples adjuntos por post (ahora 1 max)
- Crop/resize de avatar antes de subir (ahora se sube as-is, el browser maneja el aspect ratio con object-fit:cover)
- Lightbox para imágenes (ahora abre en pestaña nueva)
- Cleanup de orphan files (si subes algo y no publicas, queda en el bucket)
