# SOPHIA Portal · v18 — Pivot a modelo de 8 niveles SOPHIA

## Resumen

- **REDO del Cap 2 autoevaluación**: se abandonó el modelo VIA (24 fortalezas, signature strengths) y se adoptó el modelo SOPHIA de **8 niveles de integración** aplicados al pilar Autoconocimiento. Mismo patrón visual del legacy `evalfelicidad.sophiamx.org`.
- Foto Mariana Riojas (cap 1 bienvenida) reducida a la mitad (200×200 → 100×100, figure 320 → 160).
- Foto Martin Seligman (cap 2 nota técnica) reducida a la mitad (220 → 110 max-width).
- **Cap 3** ahora incluye lección "Evaluación de la sesión" (tipo enlace) igual que cap 1.

## Modelo nuevo (8 preguntas)

8 preguntas Likert 1-5 sobre los 8 niveles de integración del modelo SOPHIA, aplicados a Autoconocimiento:

1. `adecuadamente` — ¿Reconozco y utilizo mis fortalezas en el momento y lugar adecuados…?
2. `disfrute` — ¿He experimentado alegría o satisfacción al descubrir aspectos nuevos de mí mismo…?
3. `emociones_pos` — ¿De qué manera el conocerme mejor influye en mi capacidad para generar estados emocionales armoniosos?
4. `compromiso` — ¿Me comprometo de manera persistente con mi propio crecimiento personal…?
5. `logro` — ¿He superado una limitación personal o he potenciado una fortaleza gracias a mi autoconocimiento?
6. `satisfaccion` — ¿Siento que el conocimiento que tengo de mí mismo corresponde con la persona que quiero llegar a ser?
7. `sentido` — ¿De qué forma conocer mis fortalezas y debilidades me ayuda a encontrar un propósito más profundo…?
8. `trascendencia` — ¿Cómo puede mi autoconocimiento contribuir al bienestar de otros…?

## Cálculo

- `total` = suma de las 8 respuestas (rango 8–40)
- `pct` = `((total - 8) / 32) * 100` (0–100)
- `banda`:
  - ≥31 → **Fortaleza Actual** (#2E7D32)
  - 21–30 → **Zona de Crecimiento** (#1565C0)
  - 11–20 → **Área de Atención** (#C88D2D)
  - ≤10 → **Área Vulnerable** (#B00020)

Cada banda incluye `lead` (texto descriptivo), 2 `steps` (siguientes pasos 1–2 semanas) y una `note` genérica.

## Visualización

- **Página de resultados**: wedge SVG (cuarto de círculo dividido en 5 anillos concéntricos, llenado proporcional al %), color del pilar `#66a3f4`, opacidades decrecientes (1, 0.75, 0.55, 0.38, 0.22).
- **Cajita del dashboard**: mismo wedge en versión mini (140×140) + band tag + link a resultados completos.

## Archivos modificados

### Frontend

- `assets/js/test-autoconocimiento.js` — wizard de 8 preguntas (era VIA de 24)
- `assets/js/test-autoconocimiento-resultados.js` — wedge SVG + banda + lead + steps (era ranking 24 + virtudes + signature)
- `assets/js/curso.js` — `renderAutoconocimientoCajita` rewritten (mini-wedge + banda en lugar de top-3 fortalezas firma); helper `drawMiniWedge` agregado al final
- `assets/css/shell.css` — borrados ~500 líneas de `.via-*` (signature, ranking, virtud, cajita); agregadas ~250 líneas de `.autoeval-*` (result page + cajita + band tag + wedge containers)
- `docs/contenido-modulo-1/01-bienvenida.html` — foto Mariana 200×200 → 100×100
- `docs/contenido-modulo-2/01-nota-tecnica.html` — foto Seligman 220 → 110 max-width (contenido VIA educativo intacto: la nota técnica enseña el modelo VIA, el test mide integración SOPHIA)
- `docs/contenido-modulo-2/03-autoeval.html` — intro reescrita: 8 preguntas, ~3 min, bandas, no más "24 fortalezas firma"

### Backend (edge functions)

- `supabase/functions/submit-test-autoconocimiento/index.ts` — Recibe 8 respuestas, computa total/pct/banda, guarda en RespuestasAutoeval con payload completo
- `supabase/functions/get-resultados-autoconocimiento/index.ts` — Devuelve `{tieneResultados, total, pct, banda, bandaColor, lead, steps, note, completedAt, respuestas}`
- `supabase/functions/get-leccion/index.ts` — sin cambios (KNOWN_AUTOEVAL_IDS map sigue mapeando recDLCMOgTZChS6Yf → autoconocimiento)

## Airtable (ya sincronizado vía MCP en esta sesión)

- **Autoevaluaciones** `recDLCMOgTZChS6Yf`: título → "Autoevaluación de Autoconocimiento" (era "Autoevaluación VIA: Fortalezas de carácter"); descripción y notas internas actualizadas al nuevo modelo
- **Lecciones**:
  - `recZPBwbvzDU1xOCQ` (Cap 1 Bienvenida) — Contenido_HTML actualizado con foto Mariana 100×100
  - `recwSO28ZC75ZSGB2` (Cap 2 Nota técnica) — Contenido_HTML actualizado con foto Seligman 110px
  - `rec6E99tdjAq7nEIC` (Cap 2 Autoeval) — título "Autoevaluación: Tu integración del Autoconocimiento"; Contenido_HTML reescrito
  - `rec2koFk6gp3qJGoG` (Cap 3 Evaluación de la sesión, NEW) — tipo `enlace`, URL del mismo Google Form del Cap 1

## Deploy

Re-deploy estas 2 edge functions en Supabase dashboard:
- `submit-test-autoconocimiento` (sobrescribir si existe, crear si no)
- `get-resultados-autoconocimiento` (sobrescribir si existe, crear si no)

`get-leccion` no cambió respecto a v17.
