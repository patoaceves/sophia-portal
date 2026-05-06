# Changelog

## v0.2 — 2026-05-06

### Fixed
- **Loop de auth tras Google sign-in**. Cuando `auth-bootstrap` fallaba, el frontend redirigía a `/`, donde `redirectIfAuthed` veía la sesión válida y mandaba de vuelta a `/app/cursos`, formando un loop infinito. Ahora se muestra el error en pantalla con el mensaje exacto de Airtable.
- **Rol "alumno" rechazado por Airtable**. El schema real usa `participante` como opción del select Rol. Cambio aplicado en:
  - `auth-bootstrap` Edge Function (DEFAULT_ROL = "participante")
  - `_shared/auth.ts` (fallback role)
  - `assets/js/ui-shell.js` (display)
  - `app/perfil.html` (display)
  - README + DEPLOY

### Added
- **Defensive create de Persona**. Si Airtable rechaza el create completo (por opción de select inválida, etc.), `auth-bootstrap` reintenta con solo Nombre, Apellidos, Email y Auth User ID — para que el usuario al menos quede registrado.
- **Soporte CORS para Vercel preview deploys**. El regex `/^https:\/\/sophia-portal[\w-]*\.vercel\.app$/` permite que cualquier preview de Vercel pueda llamar a las Edge Functions sin tener que agregar manualmente cada URL al allowlist.
- **Pantalla de error fatal en frontend**. Cuando algo falla durante el bootstrap, se renderiza un mensaje claro con detalles del error y botones "Reintentar" / "Cerrar sesión", en lugar del loop silencioso.
- **Detalle de errores en respuestas de Edge Function**. `errorResponse` ahora incluye un campo opcional `details` con info de debug (sin exponer secrets).

### Changed
- Mejor parsing del nombre del usuario al crear Persona: ahora intenta `given_name` / `first_name` / `name` / `full_name` en orden, y separa apellidos del nombre completo si vienen juntos (Google manda `name` con todo).

## v0.1 — 2026-05-06

- Scaffold inicial: estructura del repo, Edge Functions `auth-bootstrap` y `get-mis-cursos`, frontend con login (Google + Microsoft + magic link), shell del portal, página de Mis Cursos.
