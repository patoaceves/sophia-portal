# Airtable Schema · SOPHIA Portal

Bases:
- **`SOPHIA - Portal`** (`app0S6GrJQ8YatvCc`), contenido de cursos, inscripciones, cohortes, invitaciones
- **`SOPHIA - CRM`** (`app1SbOC98k2OP5m1`), Personas (canónico)

> Regla de oro del codebase: **`filterByFormula` siempre con field IDs**, nunca con field names.
> Filtrado pesado por linked records se hace en JS post-fetch porque `ARRAYJOIN({linkField})`
> devuelve los valores del primary field, no los record IDs.

## Cómo obtener field IDs

```bash
curl https://api.airtable.com/v0/meta/bases/app0S6GrJQ8YatvCc/tables \
  -H "Authorization: Bearer $AIRTABLE_PAT" \
  | jq '.tables[] | {id, name, fields: [.fields[] | {id, name, type}]}'
```

---

## Modelo de datos · visión general

```
Cursos                ← template del contenido (capítulos, lecciones)
  │
  └── Cohortes        ← cada generación = 1 cohorte (fecha inicio, capacidad)
        │
        ├── Invitaciones    ← tokens de un solo uso para inscribir gente
        │
        └── Inscripciones   ← persona + cohorte + estatus + progreso
              │
              └── ProgresoLecciones, IntentosTest, RespuestasAutoeval, ...
```

Cada vez que se abre una nueva generación (Happiness Gen 1, Gen 2, Liderazgo Gen 1, etc.):
1. Se crea una **Cohorte** linked al **Curso** template.
2. Por cada persona que paga / pide cortesía → se crea una **Invitación** con un token único.
3. El email se envía automáticamente con `https://portal.sophiamx.org/?invite={token}`.
4. La persona hace click → login con Google → la edge function `claim-invitation` crea la **Inscripción** ligada a la cohorte.

Ver `docs/onboarding-flow.md` para el detalle paso a paso.

---

## Tablas

### Cursos (`tblJpUGeBsLNkk9UO`)

Template del curso. Define el contenido pero no la fecha ni la cohorte específica.

| Field | ID | Tipo | Notas |
|---|---|---|---|
| Título | `fldrskH4P70JPikaS` | singleLineText | primary |
| Slug | `fldnbvTXzNFOGxOYs` | singleLineText | único, kebab-case |
| Descripción corta | `fldUyd2c5OJjRjPz0` | multilineText | |
| Descripción larga | `fldxvb0leR5o2MaH1` | richText | |
| Cover image | `fld6kHgjdRxGfswko` | multipleAttachments | |
| Instructor | `fldja8z8xNZCz7gd6` | singleLineText | |
| Color primario | `fldF45BjJoMU90jUP` | singleLineText | hex |
| Modalidad | `fldwRC5bsmiwqsUlP` | singleSelect | |
| Estatus | `fld6yNo5RZiHHWO8X` | singleSelect | |
| Capítulos | `fldAkJ8rPjrZr2llL` | multipleRecordLinks | ← Capítulos.Curso |
| Inscripciones | `fldEcnmyKO9EqQerO` | multipleRecordLinks | ← Inscripciones.Curso (legacy) |
| **Cohortes** | `flddYCyaYUFnuSysI` | multipleRecordLinks | ← Cohortes.Curso |

> Las inscripciones tienen tanto `Curso` como `Cohorte` linked durante la transición.
> El nuevo flow usa `Cohorte` como source of truth; `Curso` se mantiene poblado para
> backwards compatibility con `get-mis-cursos`.

### Cohortes (`tblMwkKfk6U7a75Ja`), **NUEVA**

Cada generación específica de un curso. Una cohorte = 1 curso template + 1 fecha de inicio + grupo definido de alumnos.

| Field | ID | Tipo | Notas |
|---|---|---|---|
| Nombre | `fldbp3zZdJr03jCVD` | singleLineText | primary. Formato: `<Curso> - <DD.MM.YYYY>`, ej. `Happiness Workshop - 12.05.2026` |
| Curso | `fldj0pnwgY14VNtqI` | multipleRecordLinks → Cursos | |
| Fecha inicio | `fldoqWrG9zEdeKWGt` | date | |
| Fecha fin | `fldnm9B7nvIjyKZre` | date | |
| Modalidad | `fldNJKOcwbBLs3Ozx` | singleSelect | `presencial` / `hibrido` / `online` |
| Capacidad | `fldCAOufF8MXcTv0K` | number | cupo máximo |
| Estatus | `fld87QVcZl6GvQg2k` | singleSelect | `planeada` / `abierta` / `cerrada` / `completada` |
| Directora | `fldU2xqvEFk0dHo4T` | singleLineText | nombre completo, ej. "Natalia Arriaga" |
| Directora email | `fldfNGBjnefsgapH7` | email | usado por el email de bienvenida |
| Directora foto | `fldBjeY6gJJABVrFB` | url | URL pública, mostrada en el email |
| Primera sesion hora | `fld65dDf16bS1wR25` | singleLineText | ej. "7:30 P.M." |
| Notas | `fldYYDB17G3BaYRzR` | multilineText | |
| Invitaciones | `fldmndmZrTFcEq2jl` | multipleRecordLinks | ← Invitaciones.Cohorte |
| Inscripciones | `fldwACwKCvt6uGnQr` | multipleRecordLinks | ← Inscripciones.Cohorte |

**Reglas de estatus:**
- `planeada`, la cohorte aún no abre. `claim-invitation` permite canjear.
- `abierta`, aceptando inscripciones. `claim-invitation` permite canjear.
- `cerrada`, ya inició y no acepta más alumnos. `claim-invitation` rechaza.
- `completada`, terminó. `claim-invitation` rechaza.

### Invitaciones (`tblzNARG9ahLsKR9c`), **NUEVA**

Tokens de un solo uso. Se crean cuando alguien paga / recibe cortesía. El email automático manda el link al portal.

| Field | ID | Tipo | Notas |
|---|---|---|---|
| Token | `fldn1D8JFG7n2RYfA` | singleLineText | primary. Formato: `inv_xxxxxxxx` |
| Cohorte | `fldKDSCMDaJgHKZ60` | multipleRecordLinks → Cohortes | |
| Email destinatario | `fldZK5s5m208cR5r6` | email | si se llena, sólo ese email puede canjear |
| Origen | `fldw4WgogSTJamWsq` | singleSelect | `manual` / `stripe` / `transferencia` / `cortesia` / `bulk` |
| Estatus | `fldHtt9NUtcU0795f` | singleSelect | `activa` / `canjeada` / `expirada` / `revocada` |
| Persona | `fldXW2phqZuQyQnFj` | multipleRecordLinks → Personas (Portal) | se llena al canjear |
| Fecha canje | `fld5bV3P0iNSJpaBV` | dateTime | se llena al canjear |
| Expira el | `fldQQSYSLabCd9eeP` | date | opcional |
| Notas | `fldtrTgvBPmUiOkdh` | multilineText | "Pagó vía Stripe pi_abc123", etc. |
| URL | `fldxkuEoHpHDZRAWu` | formula | `'https://portal.sophiamx.org/?invite=' & {Token}` |

**Convención del token:** `inv_` + 8-16 chars `[A-Za-z0-9_-]`. Generar con
`crypto.randomBytes(8).toString('base64url')` o `crypto.randomUUID().slice(0,12)`.
Fácil de teclear si hace falta y suficientemente impredecible.

### Inscripciones (`tblIT40GILMUHhLKK`)

| Field | ID | Tipo | Notas |
|---|---|---|---|
| ID Inscripción | `fldJ2bjSM3L5EclHC` | autoNumber | primary |
| Persona | `fldsgcanUDaXzX20x` | multipleRecordLinks → Personas (Portal synced) | |
| Curso | `fldTjcS2GiOe3Q9N0` | multipleRecordLinks → Cursos | legacy, mantener |
| **Cohorte** | `fldeML5okrUfcNBM3` | multipleRecordLinks → Cohortes | **fuente de verdad** |
| Organización | `fldPXcOiJEuaF2MHl` | multipleRecordLinks | opcional B2B |
| Estatus | `flduEWS1l327elsD6` | singleSelect | `activa` / `finalizada` / `cancelada` / `pendiente` |
| Fecha inscripción | `fldrfWGCdo6KZZhQz` | date | |
| Progreso % | `fldLoqPH7FVUgBm4T` | number | computed |

> El campo `Curso` se sigue poblando por `claim-invitation` por compatibilidad con
> `get-mis-cursos`. Eventualmente migrar a leer Curso vía Cohorte.Curso.

### Personas (Portal) (`tblwo4xOFhmx2TznJ`)

Tabla en el base PORTAL que mantiene una copia (mantenida por automation) de Personas-CRM.
Las inscripciones e invitaciones linkean acá, no a Personas-CRM directamente.

| Field | ID | Tipo |
|---|---|---|
| Nombre | `fldhTiwmmXtIIS8dD` | singleLineText |
| Apellidos | `fldvZE8Y5Y4rVCOKa` | singleLineText |
| Email | `fldnRbi4mJRtfuAmV` | email |
| Auth User ID | `fldSKACBNXloxYRBc` | singleLineText |
| Inscripciones | `fldwXKCgOgWHLDxwe` | multipleRecordLinks |
| **Invitaciones** | `fld6Rl8lQSO3ndBDQ` | multipleRecordLinks |
| Rol | `fldRcBDK58Mu2tkWj` | singleSelect |
| Estatus | `fldcDzrpuL0dwZ4TA` | singleSelect |

> ⚠️ Importante: el sync CRM→Portal puede tardar segundos/minutos. La función
> `claim-invitation` reintenta hasta 4.5s antes de devolver `425 sync_pending`,
> y el frontend reintenta automáticamente cuando el usuario llega a `/app/cursos`.

### Personas (CRM) (`tbl5XKtg0mRfLeFYH`)

Tabla canónica. `auth-bootstrap` crea/actualiza acá. La sync propaga a Portal.

| Field | ID | Tipo |
|---|---|---|
| Nombre | `fldEbEI3pLEAmlYAe` | singleLineText |
| Apellidos | `fldCnRa0XFvH1FtfQ` | singleLineText |
| Email | `fldJlxMp6NKCpvAuv` | email |
| Auth User ID | `fldg3kYs6c4xOoYkq` | singleLineText |
| Rol | `fldOF0bnjfErxEOCO` | singleSelect |
| Avatar URL | `fldVctJnKuTRUGcIn` | url |
| Productos | `fldzj1HkWzIHZwdyn` | multipleSelects |
| Origen | `fldR2ZD5Pi8Qsnm3i` | singleSelect |
| Estatus | `fld8Ig1z8qSAzVo3M` | singleSelect |

### Resto de tablas

Sin cambios respecto a v8: Capítulos, Lecciones, ProgresoLecciones, Tests, Tareas, Autoevaluaciones, Sesiones, Anuncios, Certificados, Organizaciones.

---

## Patrones de filterByFormula

Para buscar inscripciones de una persona:
```
FIND('recPersonaPortalId', ARRAYJOIN({fldsgcanUDaXzX20x}))
```
NO usar `{Persona}=...`, rompe con linked fields multivalor.

Para filtrar cohortes activas dado un curso:
```
AND(
  FIND('recCursoId', ARRAYJOIN({fldj0pnwgY14VNtqI})),
  OR({fld87QVcZl6GvQg2k}='abierta', {fld87QVcZl6GvQg2k}='planeada')
)
```

Para buscar invitación por token (usado en `claim-invitation`):
```
{fldn1D8JFG7n2RYfA} = 'inv_xxxxxxxx'
```
