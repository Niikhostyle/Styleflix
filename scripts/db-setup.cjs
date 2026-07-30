#!/usr/bin/env node
/**
 * En build (Vercel/local): crea tablas + seed admin.
 * Sin DATABASE_URL postgres: avisa y continúa (catálogo TMDB igual puede desplegarse).
 */
const { execSync } = require("node:child_process");

function run(cmd) {
  execSync(cmd, { stdio: "inherit", env: process.env });
}

const url = process.env.DATABASE_URL || "";

if (!url || url.startsWith("file:")) {
  console.warn(
    "[db-setup] Configura DATABASE_URL PostgreSQL (Neon) para login/historial. Continuando el build…"
  );
  process.exit(0);
}

try {
  run("npx prisma db push --skip-generate");
  run("npx tsx prisma/seed.ts");
  console.log("[db-setup] Base de datos lista.");
} catch (err) {
  console.error("[db-setup] Error:", err?.message || err);
  console.error(
    "[db-setup] Revisa DATABASE_URL (debe ser postgresql://… de Neon u otro Postgres)."
  );
  process.exit(1);
}
