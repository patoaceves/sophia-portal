# Foro · Schema de tabla en Airtable

Base: **SOPHIA - Portal** (`app0S6GrJQ8YatvCc`)

---

## Tabla `Posts` — `tblmLVl9ySzTXb2OK`

| Field         | ID                       | Tipo                 | Notas                                                                  |
|---------------|--------------------------|----------------------|------------------------------------------------------------------------|
| **Contenido** | `fldPmHX3Pt0f4r1pv`      | multilineText        | Primary. Plain text, max 4000 chars (validado por backend).            |
| Imagen URL    | `fldmMwKgVz0lP3BO8`      | url                  | Opcional. URL pública externa (jpg/png/gif). v14 reemplaza con uploads.|
| Estatus       | `fldy88bnFeG7QEIQN`      | singleSelect         | `activo` / `oculto` / `eliminado`. Backend escribe `activo` al crear.  |
| Fecha         | `fldPzXu1gkRN4YSYQ`      | dateTime (ISO, MX)   | El backend lo escribe en cada create. Usado para sort.                 |
| Autor         | `fldjOVXCAkwoNENnX`      | multipleRecordLinks  | → Personas (Portal). Backend usa el `personaPortalId` del JWT.         |
| Curso         | `fldFiySrT6wjout5k`      | multipleRecordLinks  | → Cursos.                                                              |
| Post Padre    | `fldq82v7aJfKlu6i1`      | multipleRecordLinks  | → Posts (recursivo). Si está set, este record es comentario (1 nivel).|

**Inverse links creados automáticamente:**
- En `Personas (Portal)`: campo `Posts` (`fldrm7BeIc3IocLVE`)
- En `Cursos`: campo `Posts` (`fldjJBrNRKRSIEg5y`)
- En `Posts` mismo: campo `Posts copy` (`fld6PIlOluaFWjiKx`) — apunta a los hijos. Renómbralo a "Comentarios" en Airtable si quieres.

## Permisos / RLS

No hay RLS en Airtable; la seguridad vive en las Edge Functions:
- **get-foro-posts**: requiere JWT + verifica que el usuario está inscrito al curso. Devuelve activos + tombstones (eliminados con comentarios vivos). Los `oculto` se omiten siempre.
- **create-foro-post**: requiere JWT + verifica inscripción + valida longitud (max 4000 chars), URL de imagen `http(s)`, parent existe y está activo, parent no es ya un comentario.
- **delete-foro-post**: requiere JWT + autor del post **o** rol `admin`. Soft-delete (`Estatus → eliminado`).

El PAT de Airtable está en Supabase Secrets como `AIRTABLE_PAT` (ya configurado para las otras 8 funciones).

## Decisiones de diseño

- **Comentarios = Posts con `Post Padre` set**. No hay tabla separada. Permite evolucionar a hilos profundos en el futuro si quieres (por ahora el backend rechaza anidamiento >1 nivel).
- **Soft delete con tombstone visible** (opción A): cuando borras un post top-level que tiene comentarios vivos, el frontend lo muestra como "Mensaje eliminado" para conservar el contexto del hilo. Si no tiene comentarios, desaparece completamente. Comentarios eliminados se ocultan siempre.
- **Sin reacciones / likes** en MVP. Se agregan en v15 con tabla `Reacciones`.
- **Sin upload nativo de archivos** en MVP. Solo URL de imagen externa. v14 (próximo) agrega Supabase Storage.
- **Sin notificaciones por email** en MVP. v15.
- **Estatus `oculto`**: reservado para moderación admin futura. Si lo seteas manualmente en Airtable, el post desaparece para todos. v15 agregará un endpoint `moderar-foro-post` para que admins puedan ocultar/destacar desde el portal.

## Datos de prueba

Para probar end-to-end sin abrir el portal, puedes crear manualmente un record:

| Field      | Valor                                                  |
|------------|--------------------------------------------------------|
| Contenido  | "Bienvenida a la generación 12.05.2026 del Workshop"   |
| Autor      | (link a tu propio Persona Portal)                       |
| Curso      | (link a Happiness Workshop)                             |
| Estatus    | activo                                                  |
| Fecha      | (ISO ahora, ej. `2026-05-12T10:00:00.000Z`)             |

Refresca `/app/curso?slug=happiness-workshop&tab=foro` y deberías ver el post.
