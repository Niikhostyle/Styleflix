import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@styleflix.com";
  const passwordHash = await hash("Admin123!", 10);

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

  console.log("Seed listo:");
  console.log("  email:    admin@styleflix.com");
  console.log("  password: Admin123!");
  console.log("  role:     SUPER_ADMIN");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
