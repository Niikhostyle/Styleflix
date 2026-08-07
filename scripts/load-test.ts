/**
 * Prueba de clientes simultáneos contra VeoTV.
 *
 * Uso:
 *   npx tsx scripts/load-test.ts
 *   npx tsx scripts/load-test.ts --base=https://veotv.cloud --concurrency=10,25,50,100 --duration=20
 *
 * Cada "cliente" hace un ciclo realista:
 *   GET / → GET /login → GET /api/pricing → GET /api/settings/preview
 *
 * Reporta: RPS, latencia p50/p95, errores, y el umbral donde falla >5%.
 */

const UA =
  "VeoTV-LoadTest/1.0 (+capacity-check; contact=soporte@veotv.cloud)";

function argValue(name: string, fallback: string) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return sorted[idx];
}

type Sample = {
  ok: boolean;
  status: number;
  ms: number;
  path: string;
  err?: string;
};

async function hit(base: string, path: string, timeoutMs: number): Promise<Sample> {
  const url = `${base.replace(/\/$/, "")}${path}`;
  const t0 = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/json,*/*",
        "Accept-Language": "es-CL,es;q=0.9",
      },
      signal: ac.signal,
    });
    // consumir body (simula cliente real)
    await res.arrayBuffer().catch(() => undefined);
    const ms = Date.now() - t0;
    const ok = res.status >= 200 && res.status < 500 && res.status !== 429;
    // 3xx redirect a login cuenta como ok para rutas protegidas
    const softOk =
      ok || (res.status >= 300 && res.status < 400) || res.status === 401;
    return { ok: softOk, status: res.status, ms, path };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - t0,
      path,
      err: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(timer);
  }
}

const PATHS = ["/", "/login", "/api/pricing", "/api/settings/preview"] as const;

async function clientLoop(
  base: string,
  stopAt: number,
  timeoutMs: number,
  out: Sample[]
) {
  while (Date.now() < stopAt) {
    for (const p of PATHS) {
      if (Date.now() >= stopAt) break;
      out.push(await hit(base, p, timeoutMs));
    }
    await sleep(50);
  }
}

async function runStage(opts: {
  base: string;
  concurrency: number;
  durationSec: number;
  timeoutMs: number;
}) {
  const samples: Sample[] = [];
  const stopAt = Date.now() + opts.durationSec * 1000;
  const workers = Array.from({ length: opts.concurrency }, () =>
    clientLoop(opts.base, stopAt, opts.timeoutMs, samples)
  );
  await Promise.all(workers);

  const latencies = samples.map((s) => s.ms).sort((a, b) => a - b);
  const errors = samples.filter((s) => !s.ok);
  const byStatus = new Map<number, number>();
  for (const s of samples) {
    byStatus.set(s.status, (byStatus.get(s.status) || 0) + 1);
  }
  const elapsedSec = Math.max(0.001, opts.durationSec);
  const rps = samples.length / elapsedSec;
  const errRate = samples.length ? errors.length / samples.length : 1;

  return {
    concurrency: opts.concurrency,
    requests: samples.length,
    rps: Math.round(rps * 10) / 10,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    errRate,
    errors: errors.length,
    byStatus: Object.fromEntries([...byStatus.entries()].sort((a, b) => a[0] - b[0])),
    sampleErrors: errors.slice(0, 5).map((e) => ({
      path: e.path,
      status: e.status,
      ms: e.ms,
      err: e.err,
    })),
  };
}

async function main() {
  const base = argValue("base", "https://veotv.cloud");
  const durationSec = Math.max(5, Number(argValue("duration", "15")) || 15);
  const timeoutMs = Math.max(3000, Number(argValue("timeout", "15000")) || 15000);
  const concRaw = argValue("concurrency", "5,10,25,50,75,100");
  const stages = concRaw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  console.log(`\n=== VeoTV load test ===`);
  console.log(`base=${base}`);
  console.log(`stages=${stages.join(" → ")} concurrent clients`);
  console.log(`duration/stage=${durationSec}s  timeout=${timeoutMs}ms`);
  console.log(`cycle: ${PATHS.join(" → ")}\n`);

  // warm-up
  console.log("warm-up…");
  await hit(base, "/", timeoutMs);
  await hit(base, "/api/pricing", timeoutMs);

  const results = [];
  let breaking: number | null = null;

  for (const c of stages) {
    console.log(`\n--- ${c} clientes × ${durationSec}s ---`);
    const r = await runStage({
      base,
      concurrency: c,
      durationSec,
      timeoutMs,
    });
    results.push(r);
    console.log(
      `req=${r.requests}  rps=${r.rps}  p50=${r.p50}ms  p95=${r.p95}ms  p99=${r.p99}ms  err=${(r.errRate * 100).toFixed(1)}%`
    );
    console.log(`status:`, r.byStatus);
    if (r.sampleErrors.length) {
      console.log("ej. errores:", r.sampleErrors);
    }
    if (breaking == null && r.errRate > 0.05) {
      breaking = c;
      console.log(`⚠ umbral >5% errores desde ${c} concurrentes`);
    }
    // respirar entre stages
    await sleep(2000);
  }

  console.log(`\n=== Resumen ===`);
  console.log(
    "conc".padStart(6),
    "rps".padStart(8),
    "p50".padStart(8),
    "p95".padStart(8),
    "err%".padStart(8)
  );
  for (const r of results) {
    console.log(
      String(r.concurrency).padStart(6),
      String(r.rps).padStart(8),
      `${r.p50}ms`.padStart(8),
      `${r.p95}ms`.padStart(8),
      `${(r.errRate * 100).toFixed(1)}%`.padStart(8)
    );
  }

  const best = [...results].reverse().find((r) => r.errRate <= 0.05);
  if (best) {
    console.log(
      `\n✅ Soporta ~${best.concurrency} clientes simultáneos (err≤5%, p95=${best.p95}ms, ${best.rps} req/s).`
    );
  }
  if (breaking != null) {
    console.log(
      `❌ Empieza a degradar cerca de ${breaking} concurrentes (>5% errores).`
    );
  } else {
    console.log(
      `\n✅ No se alcanzó el umbral de fallo en estos stages. Probá --concurrency=100,150,200,250`
    );
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
