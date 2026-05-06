# Airtable Schema · SOPHIA Portal

Base: **`SOPHIA - Portal`** (`app0S6GrJQ8YatvCc`)

> Regla de oro del codebase: **`filterByFormula` siempre con field IDs**, nunca con field names.
> Filtrado pesado se hace en JS post-fetch.

## Cómo obtener los field IDs

```bash
curl https://api.airtable.com/v0/meta/bases/app0S6GrJQ8YatvCc/tables \
  -H "Authorization: Bearer $AIRTABLE_PAT" \
  | jq '.tables[] | {id, name, fields: [.fields[] | {id, name, type}]}'
```

Pega los IDs reales en `supabase/functions/_shared/airtable.ts` antes de deployar.

## Tablas

### Cursos (`tblXXXXXXXXXXXXXX` — completar)

| Field | Tipo | Notas |
|---|---|---|
| Título | singleLineText | primary |
| Slug | singleLineText | único; lowercase, kebab-case |
| Descripción corta | multilineText | máx 250 char |
| Descripción larga | richText | |
| Cover image | multipleAttachments | 16:9 |
| Instructor | multipleRecordLinks | → Personas |
| Color primario | singleLineText | hex |
| Tema | singleSelect | light / dark |
| Logo player | multipleAttachments | |
| Estatus | singleSelect | draft / published / archived |
| Modalidad | singleSelect | online / hybrid / in-person |
| Fecha inicio | date | |
| Fecha fin | date | |
| % requerido para completar | number | default 100 |
| Certificado habilitado | checkbox | |
| Drip habilitado | checkbox | |
| Drip tipo | singleSelect | enrollment / start / date |
| Capítulos | multipleRecordLinks | ← Capítulos.Curso |
| Inscripciones | multipleRecordLinks | ← Inscripciones.Curso |

### Capítulos (`tblXXXXXXXXXXXXXX`)

| Field | Tipo |
|---|---|
| Curso | multipleRecordLinks → Cursos |
| Orden | number |
| Título | singleLineText |
| Descripción | multilineText |
| Drip días desde enrollment | number (opcional) |
| Drip fecha específica | date (opcional) |
| Lecciones | multipleRecordLinks ← Lecciones.Capítulo |

### Lecciones (`tblBjfch6rc5ey7nn`) — confirmado

| Field | Tipo | Notas |
|---|---|---|
| Capítulo | multipleRecordLinks → Capítulos | |
| Orden | number | |
| Título | singleLineText | primary |
| **Tipo** | singleSelect (`fldALQfCvsjblaV2f`) | `texto`, `video`, `pdf`, `audio`, `enlace`, `descarga`, `quiz`, `examen`, `autoeval`, `tarea`, `sesion_live`, `multimedia`, `presentacion` |
| Etiqueta | singleSelect | PRE / EN CLASE / POST (opcional) |
| Es prerequisito | checkbox | |
| Es preview gratis | checkbox | |
| Discusiones habilitadas | checkbox | |
| Drip días | number | |
| Estatus | singleSelect | draft / published |
| Contenido_HTML | richText | para tipo=texto |
| URL_Video | url | tipo=video |
| URL_Externa | url | tipo=enlace, sesion_live |
| Archivo | multipleAttachments | tipo=pdf, audio, descarga |
| Test | multipleRecordLinks → Tests | tipo=quiz, examen |
| Autoeval | multipleRecordLinks → Autoevaluaciones | tipo=autoeval |
| Tarea | multipleRecordLinks → Tareas | tipo=tarea |
| Sesion | multipleRecordLinks → Sesiones | tipo=sesion_live |

### Inscripciones (`tblIT40GILMUHhLKK`) — confirmado

| Field | Tipo |
|---|---|
| Persona | multipleRecordLinks → Personas (synced) |
| Curso | multipleRecordLinks → Cursos |
| Organización | multipleRecordLinks → Organizaciones (synced) |
| Estatus | singleSelect (active / paused / completed / cancelled) |
| Fecha inicio | date |
| Progreso (computed) | rollup desde ProgresoLecciones (opcional) |

### ProgresoLecciones

| Field | Tipo |
|---|---|
| Inscripción | multipleRecordLinks → Inscripciones |
| Lección | multipleRecordLinks → Lecciones |
| CompletadaEn | dateTime |
| % video visto | number (opcional, para tipo=video) |

### Autoevaluaciones (`tblgAs76X617TRgjT`) — confirmado

| Field | Tipo | Notas |
|---|---|---|
| Título | singleLineText | "Test de Felicidad" |
| Tipo | singleSelect | likert / wedge / fan / **evalfelicidad** / custom |
| URL Externa | url | (legacy, no se usa para evalfelicidad portal) |
| Configuración JSON | multilineText | preguntas, escala, dimensiones (opcional) |

### RespuestasAutoeval

| Field | Tipo | Notas |
|---|---|---|
| Inscripción | multipleRecordLinks → Inscripciones | |
| Autoevaluación | multipleRecordLinks → Autoevaluaciones | |
| Fecha | dateTime | |
| Respuestas JSON | multilineText | `{ "AC1": 4, "AC2": 3, ... }` |
| Resultados JSON | multilineText | `{ scores, analisis, completedAt }` |

### Sesiones (live)

| Field | Tipo |
|---|---|
| Curso | multipleRecordLinks |
| Capítulo | multipleRecordLinks |
| Fecha y hora | dateTime |
| URL Zoom | url |
| Grabación | url |
| Estatus | singleSelect (programada / en vivo / terminada / cancelada) |

### Personas (synced del CRM)

| Field | Tipo |
|---|---|
| Nombre | singleLineText |
| Apellidos | singleLineText |
| Email | email |
| Teléfono | phone |
| Organización | multipleRecordLinks |

### Organizaciones (`tbliYq6OnTTUa6WOm`) — synced

(Solo lectura desde aquí.)

## Linked field formulas — patrón estándar

Para buscar inscripciones de una persona:
```
FIND('recXXXXXXXXX', ARRAYJOIN({fldPersonaId}))
```
NO usar `{Persona}=...` porque rompe con linked fields multivalor.

Para buscar registros con dos linked fields:
```
AND(
  FIND('recPersona', ARRAYJOIN({fldPersona})),
  FIND('recCurso',   ARRAYJOIN({fldCurso}))
)
```
