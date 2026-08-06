#!/usr/bin/env node
/**
 * Wrapper para Coolify/standalone: `node scripts/db-push.cjs`
 * (npx prisma no existe en la imagen runner liviana).
 */
const { execSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const root = path.join(__dirname, "..");
const candidates = [
  path.join(root, "node_modules/prisma/build/index.js"),
  path.join(root, "node_modules/.bin/prisma"),
];

const prisma = candidates.find((p) => fs.existsSync(p));
if (!prisma) {
  console.error(
    "[db-push] No está el CLI de Prisma en la imagen. Redeploy con el Dockerfile actual."
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const cmd =
  prisma.endsWith(".js")
    ? `node "${prisma}" ${args.length ? args.join(" ") : "db push --skip-generate"}`
    : `"${prisma}" ${args.length ? args.join(" ") : "db push --skip-generate"}`;

console.log("[db-push]", cmd);
execSync(cmd, {
  stdio: "inherit",
  cwd: root,
  env: process.env,
});
