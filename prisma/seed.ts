import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

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
    },
    create: {
      name: "Super Admin",
      email,
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });

  // Quita el admin demo anterior si existía
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
