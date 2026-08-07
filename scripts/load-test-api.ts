/**
 * Load test solo API liviana (/api/pricing) para comparar vs SSR.
 *   npx tsx scripts/load-test-api.ts --concurrency=25,50,100,150
 */

export {};

function argValue(name: string, fallback: string) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

async function main() {
  const base = argValue("base", "https://veotv.cloud");
  const durationSec = Number(argValue("duration", "10")) || 10;
  const stages = argValue("concurrency", "25,50,100,150")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => n > 0);

  console.log(`API-only load test → ${base}/api/pricing\n`);

  for (const c of stages) {
    const stop = Date.now() + durationSec * 1000;
    const samples: { ok: boolean; ms: number; status: number }[] = [];
    await Promise.all(
      Array.from({ length: c }, async () => {
        while (Date.now() < stop) {
          const t0 = Date.now();
          try {
            const r = await fetch(`${base}/api/pricing`, {
              headers: { "User-Agent": "VeoTV-LoadTest/1.0" },
              signal: AbortSignal.timeout(12000),
            });
            await r.arrayBuffer();
            samples.push({ ok: r.ok, ms: Date.now() - t0, status: r.status });
          } catch {
            samples.push({ ok: false, ms: Date.now() - t0, status: 0 });
          }
        }
      })
    );
    const ok = samples.filter((s) => s.ok).length;
    const lat = samples.map((s) => s.ms).sort((a, b) => a - b);
    const p50 = lat[Math.floor(lat.length * 0.5)] || 0;
    const p95 = lat[Math.min(lat.length - 1, Math.ceil(lat.length * 0.95) - 1)] || 0;
    console.log(
      `conc=${String(c).padStart(3)}  req=${String(samples.length).padStart(5)}  rps=${(samples.length / durationSec).toFixed(1).padStart(6)}  p50=${String(p50).padStart(5)}ms  p95=${String(p95).padStart(5)}ms  ok=${((100 * ok) / Math.max(1, samples.length)).toFixed(1)}%`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
