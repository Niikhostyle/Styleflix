#!/usr/bin/env node
/**
 * Importa data/drive-overrides.json → StreamOverride.
 * Pensado para correr DENTRO del contenedor Coolify (app), donde
 * DATABASE_URL ya apunta al Postgres interno.
 *
 *   node scripts/import-drive-overrides.cjs data/drive-overrides.json
 */
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { PrismaClient } = require("@prisma/client");

const AUTO_NOTE = "auto:drive-register";
const file = resolve(process.argv[2] || "data/drive-overrides.json");

async function main() {
  const payload = JSON.parse(readFileSync(file, "utf8"));
  const items = payload.items || [];
  if (!items.length) {
    console.error("Sin items en", file);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const stats = { create: 0, update: 0, errors: 0 };

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log(`[import] ${items.length} items desde ${file}`);

    for (const item of items) {
      try {
        const embedUrl =
          item.embedUrl ||
          `https://drive.google.com/file/d/${item.fileId}/preview`;
        const existing = await prisma.streamOverride.findFirst({
          where: {
            mediaType: item.mediaType,
            tmdbId: item.tmdbId,
            season: item.season ?? null,
            episode: item.episode ?? null,
            notes: { startsWith: "auto:drive" },
          },
        });

        const data = {
          title: String(item.title || "").slice(0, 200),
          embedUrl,
          label: "Drive",
          enabled: true,
          priority: 100,
          notes: `${AUTO_NOTE} ${item.drivePath || item.fileId}`.slice(0, 500),
        };

        if (existing) {
          await prisma.streamOverride.update({
            where: { id: existing.id },
            data,
          });
          stats.update++;
        } else {
          await prisma.streamOverride.create({
            data: {
              mediaType: item.mediaType,
              tmdbId: item.tmdbId,
              season: item.season ?? null,
              episode: item.episode ?? null,
              ...data,
            },
          });
          stats.create++;
        }
        console.log(
          `[import] ok tmdb-${item.tmdbId}`,
          item.title,
          existing ? "UPDATE" : "CREATE"
        );
      } catch (e) {
        stats.errors++;
        console.error("[import] ERROR", item.tmdbId, e.message || e);
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("[import] listo", stats);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
