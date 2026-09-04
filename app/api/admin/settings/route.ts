import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { jsonOk, jsonFail } from "@/lib/api";
import { z } from "zod";

// 站点设置（管理端）：announcement / wrong_master_threshold

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  key: z.enum(["announcement", "wrong_master_threshold"]),
  value: z.string().max(500),
});

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return jsonFail(auth.error.message, auth.error.status);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonFail("请求体不是合法 JSON");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonFail("参数不合法");

  const { key, value } = parsed.data;
  if (key === "wrong_master_threshold") {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 10) return jsonFail("掌握阈值需为 1-10 的整数");
  }

  await prisma.adminSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  return jsonOk({ key, value });
}
