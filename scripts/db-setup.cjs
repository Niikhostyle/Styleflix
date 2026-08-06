#!/usr/bin/env node
/**
 * Crea tablas + seed admin al arrancar el contenedor.
 * Si la DB no está disponible, avisa y deja arrancar Next
 * (así Coolify no entra en crash-loop).
 */
const { execSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

function run(cmd, env) {
  execSync(cmd, { stdio: "inherit", env });
}

function bin(name, fallbacks) {
  for (const rel of fallbacks) {
    const abs = path.join(__dirname, "..", rel);
    if (fs.existsSync(abs)) return abs;
  }
  return name;
}

function stripQuotes(value) {
  let v = (value || "").trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

// Diagnóstico Auth — no imprime el secret, solo si llega al contenedor
const authKeys = Object.keys(process.env)
  .filter((k) => /AUTH|NEXTAUTH|SECRET/i.test(k))
  .sort();
const authSecret = stripQuotes(
  process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || ""
);
console.log(
  `[auth-check] AUTH_SECRET: ${authSecret ? `OK (len=${authSecret.length})` : "MISSING"}`
);
console.log(
  `[auth-check] env keys relacionadas: ${authKeys.length ? authKeys.join(", ") : "(ninguna)"}`
);
if (!authSecret) {
  console.error(
    "[auth-check] En Coolify crea la variable exacta AUTH_SECRET (Runtime), sin espacios en el nombre, y Redeploy."
  );
}

let url = stripQuotes(process.env.DATABASE_URL || "");

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
if (authSecret) {
  env.AUTH_SECRET = authSecret;
  env.NEXTAUTH_SECRET = authSecret;
}

try {
  const prismaCli = bin("prisma", [
    "node_modules/prisma/build/index.js",
    "node_modules/.bin/prisma",
  ]);
  const tsxCli = bin("tsx", [
    "node_modules/tsx/dist/cli.mjs",
    "node_modules/.bin/tsx",
  ]);
  const prismaCmd = prismaCli.endsWith(".js")
    ? `node "${prismaCli}"`
    : `"${prismaCli}"`;
  const tsxCmd = tsxCli.endsWith(".mjs")
    ? `node "${tsxCli}"`
    : `"${tsxCli}"`;

  run(`${prismaCmd} db push --skip-generate`, env);
  run(`${tsxCmd} prisma/seed.ts`, env);
  console.log("[db-setup] Base de datos lista.");
} catch (err) {
  console.error("[db-setup] Error:", err?.message || err);
  console.error(
    "[db-setup] Comprueba que styleflix-db esté Running y que DATABASE_URL sea la URL interna."
  );
  // No tumbar el proceso: el catálogo TMDB puede seguir sirviendo
  process.exit(0);
}
