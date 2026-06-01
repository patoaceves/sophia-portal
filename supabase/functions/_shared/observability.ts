// SOPHIA Portal · _shared/observability.ts
// =============================================================================
// Logging estructurado (JSON) + medición de duración para Edge Functions.
//
// Por qué JSON: los logs de Supabase Edge Functions son consultables. Si
// emites líneas JSON con campos consistentes (fn, status, ms, level), puedes
// filtrar por `level=error` o `slow=true` en el dashboard de Supabase y, sobre
// eso, configurar alertas (o exportar a un Logflare/Datadog sink).
//
// Uso típico dentro de un Deno.serve:
//
//   import { withObservability } from "../_shared/observability.ts";
//
//   Deno.serve((req) => withObservability("get-curso", req, async (log) => {
//     // ... tu lógica; devuelve un Response
//     // log.info("cache_hit", { slug });   // opcional, eventos de negocio
//     return jsonResponse(req, {...});
//   }));
//
// withObservability:
//   - mide la duración total
//   - loguea SIEMPRE una línea de resumen al terminar (con status y ms)
//   - marca slow=true si supera SLOW_MS
//   - eleva el nivel a "error" si el status es 5xx
//   - captura excepciones no controladas, las loguea como error y devuelve 500
// =============================================================================

const SLOW_MS = Number(Deno.env.get("SLOW_MS") ?? "2000"); // umbral "lenta"

type Level = "info" | "warn" | "error";

export interface Logger {
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
}

function emit(level: Level, fn: string, event: string, fields: Record<string, unknown>) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    fn,
    event,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function makeLogger(fn: string): Logger {
  return {
    info: (event, fields = {}) => emit("info", fn, event, fields),
    warn: (event, fields = {}) => emit("warn", fn, event, fields),
    error: (event, fields = {}) => emit("error", fn, event, fields),
  };
}

/**
 * Envuelve el handler de una Edge Function añadiendo logging estructurado y
 * medición de duración. El handler recibe (req, log) y debe devolver Response.
 */
export async function withObservability(
  fn: string,
  req: Request,
  handler: (log: Logger) => Promise<Response>,
): Promise<Response> {
  const start = performance.now();
  const log = makeLogger(fn);
  const method = req.method;
  let status = 0;

  try {
    const res = await handler(log);
    status = res.status;
    return res;
  } catch (e) {
    // Excepción no controlada → 500. La logueamos como error y respondemos algo
    // genérico (no filtramos el stack al cliente).
    status = 500;
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    log.error("unhandled_exception", { method, status, msg, stack });
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  } finally {
    const ms = Math.round(performance.now() - start);
    const slow = ms > SLOW_MS;
    // Nivel: error si 5xx, warn si lenta, info en lo normal.
    const level: Level = status >= 500 ? "error" : slow ? "warn" : "info";
    emit(level, fn, "request_complete", { method, status, ms, slow });
  }
}
