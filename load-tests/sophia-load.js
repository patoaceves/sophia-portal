// SOPHIA Portal · Pruebas de carga (k6)
// =============================================================================
// Cubre el "happy path" de un alumno: bootstrap → dashboard → curso → lección →
// marcar lección → foro (page 1 + Ver más). Es la ruta crítica que más pega a
// las Edge Functions y, por ende, a Airtable.
//
// Mide latencia y tasa de error por endpoint para detectar el "scaling cliff"
// de Airtable (lecturas de tabla completa) ANTES de que pase en producción.
//
// -----------------------------------------------------------------------------
// REQUISITOS
//   1. Instalar k6:  https://k6.io/docs/get-started/installation/
//      macOS:  brew install k6
//   2. Necesitas un JWT de Supabase válido de un usuario de PRUEBA que ya esté
//      inscrito a un curso. La forma más fácil de obtenerlo:
//        - Inicia sesión en el portal en el navegador
//        - DevTools → Application → Local Storage → busca la key de supabase
//          auth → copia `access_token`
//      (El magic-link no se automatiza bien en k6; usar un token pre-generado
//       es el patrón estándar para load testing de Supabase.)
//   3. Necesitas el `slug` de un curso y el `cursoId` (recXXX) de ese curso,
//      y el `id` de una lección dentro de él.
//
// -----------------------------------------------------------------------------
// USO
//   SUPABASE_URL=https://ajvjyisplqsrjsessayo.supabase.co \
//   ANON_KEY=<tu_anon_key> \
//   JWT=<access_token_de_prueba> \
//   CURSO_SLUG=<slug> \
//   CURSO_ID=<recXXXX> \
//   LECCION_ID=<recYYYY> \
//   INSCRIPCION_ID=<recZZZZ> \
//   k6 run load-tests/sophia-load.js
//
//   Para un escenario más agresivo:
//   k6 run -e STAGE=stress load-tests/sophia-load.js
// =============================================================================

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

// ── Config desde entorno ─────────────────────────────────────────────────────
const SUPABASE_URL = __ENV.SUPABASE_URL || "https://ajvjyisplqsrjsessayo.supabase.co";
const ANON_KEY = __ENV.ANON_KEY || "";
const JWT = __ENV.JWT || "";
const CURSO_SLUG = __ENV.CURSO_SLUG || "";
const CURSO_ID = __ENV.CURSO_ID || "";
const LECCION_ID = __ENV.LECCION_ID || "";
const INSCRIPCION_ID = __ENV.INSCRIPCION_ID || "";
const STAGE = __ENV.STAGE || "smoke";

const FN = (name) => `${SUPABASE_URL}/functions/v1/${name}`;

// ── Métricas por endpoint ────────────────────────────────────────────────────
const tMisCursos = new Trend("ep_mis_cursos", true);
const tCurso = new Trend("ep_curso", true);
const tLeccion = new Trend("ep_leccion", true);
const tMarcar = new Trend("ep_marcar_leccion", true);
const tForoP1 = new Trend("ep_foro_page1", true);
const tForoMas = new Trend("ep_foro_ver_mas", true);
const errEndpoint = new Rate("errors_endpoint");

// ── Perfiles de carga ────────────────────────────────────────────────────────
// smoke: 1 usuario, sanity check. ramp: sube gradual. stress: busca el cliff.
const PROFILES = {
  smoke: {
    vus: 1,
    duration: "30s",
  },
  ramp: {
    stages: [
      { duration: "1m", target: 10 },
      { duration: "3m", target: 50 },
      { duration: "2m", target: 100 },
      { duration: "1m", target: 0 },
    ],
  },
  stress: {
    stages: [
      { duration: "2m", target: 100 },
      { duration: "3m", target: 300 },
      { duration: "3m", target: 500 },
      { duration: "2m", target: 0 },
    ],
  },
};

export const options = {
  scenarios: {
    alumno: Object.assign(
      { executor: PROFILES[STAGE].stages ? "ramping-vus" : "constant-vus" },
      PROFILES[STAGE],
    ),
  },
  thresholds: {
    // Objetivos: p95 < 1.5s en lecturas, error rate < 1%.
    http_req_duration: ["p(95)<1500"],
    errors_endpoint: ["rate<0.01"],
    ep_mis_cursos: ["p(95)<1500"],
    ep_curso: ["p(95)<1500"],
    ep_foro_page1: ["p(95)<2000"],
  },
};

// ── Headers comunes ──────────────────────────────────────────────────────────
function authHeaders() {
  return {
    Authorization: `Bearer ${JWT}`,
    apikey: ANON_KEY,
    "Content-Type": "application/json",
  };
}

function track(trend, res) {
  trend.add(res.timings.duration);
  const ok = res.status >= 200 && res.status < 300;
  errEndpoint.add(!ok);
  return ok;
}

// ── Escenario principal: recorrido de un alumno ──────────────────────────────
export default function () {
  const headers = authHeaders();

  group("dashboard", () => {
    const res = http.get(FN("get-mis-cursos"), { headers });
    check(res, { "mis-cursos 200": (r) => track(tMisCursos, r) });
  });
  sleep(1);

  group("curso", () => {
    if (!CURSO_SLUG) return;
    const res = http.get(`${FN("get-curso")}?slug=${encodeURIComponent(CURSO_SLUG)}`, { headers });
    check(res, { "curso 200": (r) => track(tCurso, r) });
  });
  sleep(1);

  group("leccion", () => {
    if (!LECCION_ID) return;
    const res = http.get(`${FN("get-leccion")}?id=${encodeURIComponent(LECCION_ID)}`, { headers });
    check(res, { "leccion 200": (r) => track(tLeccion, r) });
  });
  sleep(1);

  group("marcar-leccion", () => {
    if (!LECCION_ID || !INSCRIPCION_ID) return;
    const body = JSON.stringify({ leccionId: LECCION_ID, inscripcionId: INSCRIPCION_ID });
    const res = http.post(FN("marcar-leccion"), body, { headers });
    check(res, { "marcar 2xx": (r) => track(tMarcar, r) });
  });
  sleep(1);

  group("foro", () => {
    if (!CURSO_ID) return;
    // Página 1
    const p1 = http.get(`${FN("get-foro-posts")}?cursoId=${encodeURIComponent(CURSO_ID)}&limit=20`, { headers });
    const ok = check(p1, { "foro p1 200": (r) => track(tForoP1, r) });
    // "Ver más" si hay cursor
    if (ok) {
      let next = null;
      try { next = p1.json("nextCursor"); } catch (_) { next = null; }
      if (next) {
        const p2 = http.get(
          `${FN("get-foro-posts")}?cursoId=${encodeURIComponent(CURSO_ID)}&limit=20&cursor=${encodeURIComponent(next)}`,
          { headers },
        );
        check(p2, { "foro ver-mas 200": (r) => track(tForoMas, r) });
      }
    }
  });
  sleep(2);
}
