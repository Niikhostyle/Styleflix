#!/usr/bin/env node
/**
 * Crea tablas + seed admin.
 * Se ejecuta al ARRRANCAR el contenedor (no en el build de Docker),
 * para que Coolify pueda resolver el host interno de Postgres.
 */
const { execSync } = require("node:child_process");

function run(cmd, env) {
  execSync(cmd, { stdio: "inherit", env });
}

let url = (process.env.DATABASE_URL || "").trim();
// Coolify a veces guarda el valor con comillas
if (
  (url.startsWith('"') && url.endsWith('"')) ||
  (url.startsWith("'") && url.endsWith("'"))
) {
  url = url.slice(1, -1).trim();
}

if (!url || url.startsWith("file:")) {
  console.warn(
    "[db-setup] Sin DATABASE_URL postgres válida. Login/historial no funcionarán."
  );
  process.exit(0);
}

if (!/^postgres(ql)?:\/\//i.test(url)) {
  console.error(
    "[db-setup] DATABASE_URL inválida. Debe empezar con postgresql:// o postgres://"
  );
  console.error("[db-setup] Valor recibido (inicio):", url.slice(0, 40));
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: url };

try {
  run("npx prisma db push --skip-generate", env);
  run("npx tsx prisma/seed.ts", env);
  console.log("[db-setup] Base de datos lista.");
} catch (err) {
  console.error("[db-setup] Error:", err?.message || err);
  console.error(
    "[db-setup] Revisa que styleflix-db esté running y DATABASE_URL sea la URL interna."
  );
  process.exit(1);
}
