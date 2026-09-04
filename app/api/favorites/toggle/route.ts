import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { jsonOk, jsonFail } from "@/lib/api";
import { z } from "zod";

// 收藏 / 取消收藏（切换）。需登录。

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ questionId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonFail("请先登录", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonFail("请求体不是合法 JSON");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonFail("参数不合法");

  const { questionId } = parsed.data;
  const q = await prisma.question.findUnique({ where: { id: questionId }, select: { id: true } });
  if (!q) return jsonFail("题目不存在", 404);

  const existing = await prisma.favorite.findUnique({
    where: { userId_questionId: { userId: user.id, questionId } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return jsonOk({ favored: false });
  }
  await prisma.favorite.create({ data: { userId: user.id, questionId } });
  return jsonOk({ favored: true });
}
