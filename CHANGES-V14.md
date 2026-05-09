# SOPHIA Portal · v14 · Foro listo para deploy

**TL;DR:** Continuación de v13. La tabla `Posts` ya está creada en Airtable, los IDs ya están aplicados al código, y se agregó la opción A para tombstones de mensajes eliminados con comentarios.

---

## Lo que cambió respecto a v13

### Airtable

- **Tabla `Posts` creada** en base PORTAL (`app0S6GrJQ8YatvCc`).
  - Table ID: `tblmLVl9ySzTXb2OK`
  - 7 campos creados (ver `docs/foro-airtable-schema.md` para los IDs).
  - 3 link fields apuntando a Personas Portal, Cursos, y a sí misma (Post Padre).

### Backend

- **3 Edge Functions con IDs reales** (no más placeholders `_TODO_`). Listas para pegar al Supabase Dashboard tal cual.
- **`create-foro-post`**: ahora escribe el campo `Fecha` con `new Date().toISOString()` en cada create. Necesario para que el sort por fecha funcione (Airtable no auto-popula campos `dateTime`).
- **`get-foro-posts` con tombstones (opción A)**: la formula ahora carga `activo` + `eliminado`. Para los `eliminado`:
  - Si tiene comentarios vivos → se devuelve con `eliminado: true`, sin contenido ni autor identificable, solo `fechaISO` y los comentarios.
  - Si no tiene comentarios → se filtra (no aparece).
  - Comentarios `eliminado` se ocultan siempre.
  - `oculto` se omite siempre (reservado para moderación admin v15).

### Frontend

- **`assets/js/foro.js`**: `renderPost` ahora detecta `p.eliminado` y renderiza el tombstone:
  > ⊘ &nbsp; Mensaje eliminado &nbsp; · &nbsp; hace 2 d
  > 
  > [comentarios vivos colgando aquí]
- **Borrar UI**: si borras un post top-level que tiene comentarios, el cliente hace re-fetch del feed para que el tombstone aparezca (en vez de inserte manual). Si no tiene comentarios o es comentario, lo quita del DOM directo.
- **`assets/css/shell.css`**: estilos nuevos `.foro-post--tombstone`, `.foro-post__avatar--tombstone`, `.foro-post__tombstone`. Borde dashed, fondo subtle, texto en cursiva.

### Docs

- **`docs/foro-airtable-schema.md`** actualizado con los IDs reales y explicación de la decisión de tombstones (opción A).

---

## Pasos de deploy

### 1. Edge Functions (Supabase Dashboard) — **3 funciones nuevas**

Para cada una, en Supabase Dashboard → Edge Functions → **Deploy a new function**:

1. **`get-foro-posts`** — pega el contenido de `supabase/functions/get-foro-posts/index.ts`
2. **`create-foro-post`** — pega el contenido de `supabase/functions/create-foro-post/index.ts`
3. **`delete-foro-post`** — pega el contenido de `supabase/functions/delete-foro-post/index.ts`

> El secret `AIRTABLE_PAT` ya está configurado para las otras 8 funciones, no requiere cambio.

### 2. Frontend (Vercel)

```bash
git add -A
git commit -m "v14: foro de cursos con tombstones (Posts table conectada)"
git push
```

Vercel detecta y deploya.

### 3. Test end-to-end

1. Abre `https://portal.sophiamx.org/app/curso?slug=happiness-workshop&tab=foro`. Deberías ver el composer + empty state.
2. Publica un post de prueba con texto + URL de imagen pública (Unsplash, etc.).
3. Verifica en Airtable que se creó el record con autor, curso, contenido, imagen URL, estatus = `activo`, Fecha llena.
4. Click "Responder" → escribe → publica. Aparece anidado.
5. Click el ícono de basura del comentario → confirma. Desaparece del DOM.
6. Click el ícono de basura del post top-level (ahora sin comentarios). Desaparece del feed completo.
7. Crea otro post → comenta tú mismo → borra el post (con comentario vivo). Refresh: el post se muestra como tombstone "Mensaje eliminado · hace X" con el comentario abajo.
8. En Airtable verifica que el record quedó como `eliminado` (no se borró).

---

## Lo que NO cambió

- `auth-bootstrap`, `claim-invitation`, `get-curso`, `get-leccion`, `get-mis-cursos`, `get-resultados-test`, `marcar-leccion`, `submit-test-felicidad` — sin tocar.
- Test de felicidad, anuncios, calendario, perfil, sidebar, hero — sin tocar.

---

## Pendientes

- [ ] **Email branding** (Supabase email templates HTML SOPHIA-branded). No requiere repo. Si quieres, te genero los 2 templates listos para pegar al dashboard.
- [ ] **v15 · Uploads nativos**: Supabase Storage para subir imágenes/videos/archivos sin tener que pegar URL.
- [ ] **v16 · Reacciones + notificaciones**: tabla `Reacciones` (likes), notificaciones por email vía Resend.
- [ ] **Renombrar el inverse field "Posts copy" → "Comentarios"** en la tabla Posts (en Airtable, manualmente). Es solo cosmético.
