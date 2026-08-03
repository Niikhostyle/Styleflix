#!/usr/bin/env node
/**
 * Crea tablas + seed admin al arrancar el contenedor.
 * Si la DB no está disponible, avisa y deja arrancar Next
 * (así Coolify no entra en crash-loop).
 */
const { execSync } = require("node:child_process");

function run(cmd, env) {
  execSync(cmd, { stdio: "inherit", env });
}

let url = (process.env.DATABASE_URL || "").trim();
if (
  (url.startsWith('"') && url.endsWith('"')) ||
  (url.startsWith("'") && url.endsWith("'"))
) {
  url = url.slice(1, -1).trim();
}

if (!url || url.startsWith("file:")) {
  console.warn(
    "[db-setup] Sin DATABASE_URL postgres. Login/historial deshabilitados."
  );
  process.exit(0);
}

if (!/^postgres(ql)?:\/\//i.test(url)) {
  console.error(
    "[db-setup] DATABASE_URL inválida (debe ser postgresql:// o postgres://)."
  );
  console.error("[db-setup] Inicio del valor:", url.slice(0, 60));
  process.exit(0);
}

// En Docker/Coolify, localhost = el propio contenedor de la app (incorrecto)
if (/@(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url)) {
  console.error(
    "[db-setup] DATABASE_URL usa localhost. En Coolify debes pegar la URL INTERNA de styleflix-db (no la de tu PC)."
  );
  console.error(
    "[db-setup] Ejemplo: postgres://postgres:CLAVE@NOMBRE-O-UUID-DE-LA-DB:5432/postgres"
  );
  process.exit(0);
}

const env = { ...process.env, DATABASE_URL: url };

try {
  run("npx prisma db push --skip-generate", env);
  run("npx tsx prisma/seed.ts", env);
  console.log("[db-setup] Base de datos lista.");
} catch (err) {
  console.error("[db-setup] Error:", err?.message || err);
  console.error(
    "[db-setup] Comprueba que styleflix-db esté Running y que DATABASE_URL sea la URL interna."
  );
  // No tumbar el proceso: el catálogo TMDB puede seguir sirviendo
  process.exit(0);
}
