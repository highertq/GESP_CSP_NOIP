import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node node_modules/tsx/dist/cli.mjs prisma/seed.ts",
  },
  // Prisma 7：连接串从 schema 移到此处，仅供 CLI（migrate/studio）使用；
  // 运行时连接走 lib/prisma.ts 的 driver adapter。
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
