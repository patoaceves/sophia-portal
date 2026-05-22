# Airtable schema

Esquema de las dos bases de Airtable usadas por el portal. Todas las llamadas API usan **field IDs**, no field names — los nombres pueden cambiar sin romper el código.

> **Base Portal:** `app0S6GrJQ8YatvCc`
> **Base CRM:** `app1SbOC98k2OP5m1`

---

## Base Portal (`app0S6GrJQ8YatvCc`)

### Cursos (`tblJpUGeBsLNkk9UO`)

| Field | ID | Tipo | Notas |
|---|---|---|---|
| Nombre | `fld6Q1HVCxN9HiKsR` | singleLineText | primary |
| Slug | `fldNcMlrxbXVgIB1m` | singleLineText | URL-friendly, ej. `happiness-workshop` |
| Descripción | `fldDgcv8gpwxhMjsH` | multilineText | |
| Instructor | `fldgPCAUgwx6Z2BTH` | singleLineText | |
| Módulos | `fldwGGdGfQUjr3FdC` | multipleRecordLinks | → Módulos |
| Cohortes | `fldDshhTpRu3jcEcg` | multipleRecordLinks | → Cohortes |

### Cohortes (`tblMwkKfk6U7a75Ja`)

| Field | ID | Tipo | Notas |
|---|---|---|---|
| Nombre | `fldbp3zZdJr03jCVD` | singleLineText | primary. Formato: `<Curso> - <DD.MM.YYYY>` |
| Curso | `fldj0pnwgY14VNtqI` | multipleRecordLinks | → Cursos |
| Fecha inicio | `fldoqWrG9zEdeKWGt` | date | |
| Fecha fin | `fldnm9B7nvIjyKZre` | date | |
| Modalidad | `fldNJKOcwbBLs3Ozx` | singleSelect | `presencial` / `hibrido` / `online` |
| Capacidad | `fldCAOufF8MXcTv0K` | number | |
| Estatus | `fld87QVcZl6GvQg2k` | singleSelect | `planeada` / `abierta` / `cerrada` / `completada` |
| Primera sesión hora | `fld65dDf16bS1wR25` | singleLineText | Ej. `9:00 A.M.` |
| Director | `fldU2xqvEFk0dHo4T` | singleLineText | Nombre del coordinador del programa |
| Director email | `fldfNGBjnefsgapH7` | email | |
| Coordinador WhatsApp | `fldcfirbPH4TmB7OW` | phoneNumber | Formato internacional con `+` |
| Coordinador Foto URL | `fld4RobmNveKH3dLs` | url | URL pública servida desde el portal |
| Coordinador Mensaje | `fldZlEH4zEhdrekEc` | multilineText | Cita que aparece en el email de bienvenida |
| Notas | `fldYYDB17G3BaYRzR` | multilineText | |
| Invitaciones | `fldmndmZrTFcEq2jl` | multipleRecordLinks | ← Invitaciones.Cohorte |
| Inscripciones | `fldwACwKCvt6uGnQr` | multipleRecordLinks | ← Inscripciones.Cohorte |

**Reglas de estatus para el flujo de invitación:**

| Estatus | Aparece en `/embed` | `claim-invitation` permite canjear |
|---|---|---|
| `planeada` | No | Sí |
| `abierta` | Sí | Sí |
| `cerrada` | No | No |
| `completada` | No | No |

### Invitaciones (`tblzNARG9ahLsKR9c`)

Tokens de un solo uso, creados por la Automation cuando se sube alguien al portal.

| Field | ID | Tipo | Notas |
|---|---|---|---|
| Token | `fldn1D8JFG7n2RYfA` | singleLineText | primary. Formato: `inv_xxxxxxxx...` (32 chars total) |
| Cohorte | `fldKDSCMDaJgHKZ60` | multipleRecordLinks | → Cohortes |
| Email destinatario | `fldZK5s5m208cR5r6` | email | |
| Estatus | `fldHtt9NUtcU0795f` | singleSelect | `pendiente` / `canjeada` / `expirada` / `cancelada` |
| Origen | `fldw4WgogSTJamWsq` | singleSelect | `alta-ventas` / `manual` / etc. |
| Persona | `fldXW2phqZuQyQnFj` | multipleRecordLinks | → Personas Portal (se llena al canjear) |
| Fecha canje | `fld5bV3P0iNSJpaBV` | dateTime | |
| Expira el | `fldQQSYSLabCd9eeP` | dateTime | (opcional) |
| Notas | `fldtrTgvBPmUiOkdh` | multilineText | |

### Inscripciones (`tblIT40GILMUHhLKK`)

| Field | ID | Tipo | Notas |
|---|---|---|---|
| ID | `fldJ2bjSM3L5EclHC` | autoNumber | primary, numérico |
| Persona | `fldsgcanUDaXzX20x` | multipleRecordLinks | → Personas Portal |
| Curso | `fldTjcS2GiOe3Q9N0` | multipleRecordLinks | → Cursos (backwards compat) |
| Cohorte | `fldeML5okrUfcNBM3` | multipleRecordLinks | → Cohortes |
| Estatus | `flduEWS1l327elsD6` | singleSelect | `activa` / `pendiente` / `finalizada` / `cancelada` |
| Fecha inscripción | `fldrfWGCdo6KZZhQz` | date | |
| Created | `fld2L1GyIb6FPAJml` | createdTime | |
| Last modified | `fldp99SpctG35RMHr` | lastModifiedTime | |

### Personas Portal (`tblwo4xOFhmx2TznJ`)

Tabla **synced** desde Personas CRM. NO se edita aquí — los cambios se hacen en CRM y se reflejan tras el sync.

| Field | ID | Tipo | Notas |
|---|---|---|---|
| Nombre | `fldhTiwmmXtIIS8dD` | singleLineText | primary |
| Email | `fldnRbi4mJRtfuAmV` | email | |
| Apellidos | `fldX8nE9wRJ5hpaij` | singleLineText | |
| Auth User ID | `fldExWxQzZBJSZk3v` | singleLineText | UUID de Supabase Auth |
| Rol | `fldZeOTpEcrXnyrgi` | singleSelect | sincronizado desde CRM |
| Inscripciones | `fldwXKCgOgWHLDxwe` | multipleRecordLinks | ← Inscripciones.Persona |
| Invitaciones | `fldXxhRtb5OPaayKv` | multipleRecordLinks | ← Invitaciones.Persona |

### Módulos (`tblFHDXmg47igVihD`)

| Field | ID | Tipo | Notas |
|---|---|---|---|
| Nombre | `fldgEUL8YBkkSMjPp` | singleLineText | primary |
| Orden | `fldB7gqJkXSdtdAQS` | number | |
| Descripción | `fldEUf3sKbXLwwhYW` | multilineText | |
| Curso | `fldZX9eaifBuC6Lb3` | multipleRecordLinks | → Cursos |
| Lecciones | `fld7Sp7hLfvjKZbKw` | multipleRecordLinks | ← Lecciones.Módulo |

### Lecciones (`tblBjfch6rc5ey7nn`)

| Field | ID | Tipo | Notas |
|---|---|---|---|
| Nombre | `fld6sZRP6Xj4zZkX2` | singleLineText | primary |
| Orden | `fldbiQuyN2MOTbBjk` | number | |
| Tipo | `fldDjLn2QnRPGT6xb` | singleSelect | `texto` / `video` / `pdf` / `quiz` / `tarea` / `autoeval` / `test` / `evaluacion-sesion` |
| Módulo | `fld4tWXMrETZ4VC1d` | multipleRecordLinks | → Módulos |
| Contenido | `fldRfDmIBefnLpwUO` | richText / multilineText | HTML para `texto` |
| URL externa | `fldtBV3GepkpC0YEf` | url / singleLineText | Para `video`, `pdf`, o key de autoeval |
| Tag | `fldYJpHzMQXMc2k7n` | singleSelect | `Actividad Previa a la Clase` / `Actividad Posterior a la Clase` / `Actividad` / `Evaluación` / `Grabaciones` |
| Quiz key | `fldQ23JLDbR1mEoDF` | singleLineText | Identificador del quiz def en `quiz-defs.js` |
| Autoeval tipo | `fldoXxxoyrBSWtcLs` | singleSelect | `pilar` / `felicidad` / `autoconocimiento` |

### Progreso Lecciones (`tbllSrA7i4RxR6rqD`)

| Field | ID | Tipo | Notas |
|---|---|---|---|
| Nombre | `fldoTk9NlReRRDH4j` | formula | primary, autocompuesto |
| Inscripción | `fld5osGXDLBrvgW63` | multipleRecordLinks | → Inscripciones |
| Lección | `fldftZaLhQcHyKrBo` | multipleRecordLinks | → Lecciones |
| Completado | `fldtGaRMNd69jcK3D` | checkbox | |
| Completado en | `fldEImFE2Osckh2wZ` | dateTime | |

### Actividades (`tbllM76FnC50EHRCx`)

Respuestas a quizzes, tareas y autoevals.

| Field | ID | Tipo | Notas |
|---|---|---|---|
| Nombre | `fld2KuJYNFGdKnZxR` | formula | primary, autocompuesto |
| Inscripción | `fldoZwq6JeRdjm3gj` | multipleRecordLinks | → Inscripciones |
| Tipo actividad | `fldumUkw9GPp8gF9A` | singleLineText | Key del quiz / autoeval / etc. |
| Respuestas JSON | `fldCt8h2tJZjVKnK5` | multilineText | Payload completo |
| Score | `fldKKHQOPdU6FbU2J` | number | (solo quizzes scored) |
| Aprobado | `fldXrtjBkqgZxJrUf` | checkbox | |

---

## Base CRM (`app1SbOC98k2OP5m1`)

### Personas CRM (`tbl5XKtg0mRfLeFYH`)

Fuente de verdad de personas. La tabla Personas Portal en la base Portal se sincroniza desde aquí.

| Field | ID | Tipo | Notas |
|---|---|---|---|
| Nombre | `fldEbEI3pLEAmlYAe` | singleLineText | primary |
| Apellidos | `fldCnRa0XFvH1FtfQ` | singleLineText | |
| Email | `fldJlxMp6NKCpvAuv` | email | |
| Teléfono país | `fld0psZVirGYHs2AQ` | singleLineText | Ej. `+52` |
| Teléfono número | `fld3fDQA1tfiNPXN5` | singleLineText | |
| Estatus | `fld8Ig1z8qSAzVo3M` | singleSelect | `activo` / `inactivo` |
| Rol | `fldOF0bnjfErxEOCO` | singleSelect | `participante` / `admin` / `instructor` / `profesor` / `facilitador` / `coordinador` |
| Auth User ID | `fldg3kYs6c4xOoYkq` | singleLineText | UUID de Supabase Auth, llenado al signup |
| Origen | `fldR2ZD5Pi8Qsnm3i` | singleSelect | `signup` / `manual` / `alta-ventas` |
| Versión | `fld7RdS5XJump9Evw` | singleLineText | |
| Productos | `fldzj1HkWzIHZwdyn` | multipleSelects | `portal` / etc. |

Otras tablas en CRM (no usadas activamente por el portal): leads, deals, etc.

---

## Patrones de uso

### filterByFormula con linked records

El campo "name" de un linked record devuelve **el nombre del primary del registro vinculado, no su ID**. Para filtrar por ID hay que hacerlo en JS después del fetch.

```ts
// ❌ Esto NO funciona como esperarías
filterByFormula: `FIND('${recordId}', ARRAYJOIN({Persona}))`

// ✅ Mejor: traer y filtrar en JS
const records = await listRecords(...);
const filtered = records.filter(r =>
  (r.fields[FIELDS.PERSONA] as string[])?.includes(recordId)
);
```

### Idempotency-Key con caracteres no ASCII

La API de Airtable rechaza `Idempotency-Key` con caracteres no ASCII (acentos, ñ, etc.). Sanitizar antes:

```ts
function sanitizeIdempotencyKey(key: string): string {
  return key.replace(/[^\x20-\x7E]/g, '_');
}
```

### Sync delay Personas Portal

La tabla `Personas Portal` se sincroniza desde Personas CRM cada minuto aprox. Después de crear una Persona CRM nueva, hay un delay antes de que aparezca en Personas Portal. `claim-invitation` implementa retry con backoff exponencial (hasta 5 intentos) para manejar esto.
