import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { jsonOk, jsonFail } from "@/lib/api";
import { z } from "zod";

// 用户管理（管理端）：disabled 禁/解用，role 调角色。不允许操作自己。

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    userId: z.string().min(1),
    disabled: z.boolean().optional(),
    role: z.enum(["USER", "ADMIN"]).optional(),
  })
  .refine((v) => v.disabled !== undefined || v.role !== undefined, {
    message: "至少提供一个变更字段",
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

  const { userId, disabled, role } = parsed.data;
  if (userId === auth.user.id) return jsonFail("不能修改自己的账号");

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) return jsonFail("用户不存在", 404);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { ...(disabled !== undefined ? { disabled } : {}), ...(role !== undefined ? { role } : {}) },
    select: { id: true, username: true, disabled: true, role: true },
  });
  return jsonOk({ user: updated });
}
