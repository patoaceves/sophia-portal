// SOPHIA Portal · Prueba de carga de uploads (k6)
// =============================================================================
// Aísla el endpoint upload-asset, que es el que más presión de memoria genera
// (cada archivo pasa por la Edge Function). Sube imágenes pequeñas en paralelo
// para verificar que el streaming + el guard de Content-Length aguantan
// concurrencia sin degradar.
//
// NO subas archivos enormes en este test salvo que quieras provocar 413 a
// propósito: el objetivo es validar concurrencia de uploads NORMALES.
//
// USO:
//   SUPABASE_URL=https://ajvjyisplqsrjsessayo.supabase.co \
//   ANON_KEY=<anon_key> \
//   JWT=<access_token> \
//   CURSO_ID=<recXXXX> \
//   k6 run -e VUS=20 -e DURATION=1m load-tests/sophia-upload.js
// =============================================================================

import http from "k6/http";
import { check } from "k6";
import { Trend, Rate } from "k6/metrics";

const SUPABASE_URL = __ENV.SUPABASE_URL || "https://ajvjyisplqsrjsessayo.supabase.co";
const ANON_KEY = __ENV.ANON_KEY || "";
const JWT = __ENV.JWT || "";
const CURSO_ID = __ENV.CURSO_ID || "";
const VUS = parseInt(__ENV.VUS || "10", 10);
const DURATION = __ENV.DURATION || "30s";

const tUpload = new Trend("ep_upload_asset", true);
const errUpload = new Rate("errors_upload");

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    ep_upload_asset: ["p(95)<5000"], // uploads son más lentos; margen amplio
    errors_upload: ["rate<0.02"],
  },
};

// Genera un PNG válido pequeño (~1KB) en memoria, una sola vez.
const PNG_1x1 = (() => {
  // PNG mínimo de 1x1 px transparente, en bytes.
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  return b64;
})();

export default function () {
  if (!CURSO_ID) {
    throw new Error("Falta CURSO_ID");
  }
  // Construye multipart manualmente con un payload pequeño.
  const fileBin = http.file(
    Uint8Array.from(atob(PNG_1x1), (c) => c.charCodeAt(0)).buffer,
    `loadtest-${__VU}-${__ITER}.png`,
    "image/png",
  );

  const res = http.post(
    `${SUPABASE_URL}/functions/v1/upload-asset`,
    {
      file: fileBin,
      kind: "foro-attachment",
      cursoId: CURSO_ID,
    },
    {
      headers: {
        Authorization: `Bearer ${JWT}`,
        apikey: ANON_KEY,
      },
    },
  );

  tUpload.add(res.timings.duration);
  const ok = res.status >= 200 && res.status < 300;
  errUpload.add(!ok);
  check(res, { "upload 2xx": () => ok });
}
