#!/usr/bin/env node
/**
 * Seed de arranque (CJS) — sin tsx/esbuild (imagen Docker standalone).
 */
const { hash } = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = "niikhostyle@gmail.com";
  const passwordHash = await hash("shadownox123", 10);

  await prisma.user.upsert({
    where: { email },
    update: {
      name: "Super Admin",
      passwordHash,
      role: "SUPER_ADMIN",
      emailVerified: new Date(),
    },
    create: {
      name: "Super Admin",
      email,
      passwordHash,
      role: "SUPER_ADMIN",
      emailVerified: new Date(),
    },
  });

  await prisma.user.deleteMany({
    where: { email: "admin@styleflix.com" },
  });

  console.log("Seed listo: SUPER_ADMIN actualizado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
