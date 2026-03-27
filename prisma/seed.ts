import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 12);

  await prisma.admin.upsert({
    where: { email: "admin@visli.io" },
    update: {},
    create: {
      email: "admin@visli.io",
      password: hashedPassword,
      name: "VISLI Admin",
    },
  });

  console.log("✅ Seed complete: admin@visli.io / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
