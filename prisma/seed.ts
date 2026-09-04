import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "Admin@20260904";

  await prisma.user.upsert({
    where: { username },
    update: { role: "ADMIN" },
    create: {
      username,
      passwordHash: (await import("../lib/password")).hashPassword(password),
      nickname: "站长",
      role: "ADMIN",
    },
  });

  await prisma.adminSetting.upsert({
    where: { key: "wrong_mastery_threshold" },
    update: {},
    create: { key: "wrong_mastery_threshold", value: "2" },
  });
  await prisma.adminSetting.upsert({
    where: { key: "announcement" },
    update: {},
    create: { key: "announcement", value: "" },
  });

  console.log(`[seed] admin 账号就绪：${username}（密码来自 ADMIN_PASSWORD 环境变量，默认 Admin@20260904，生产必改）`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
