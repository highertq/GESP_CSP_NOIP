import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { jsonOk, jsonFail } from "@/lib/api";
import { z } from "zod";

// 错题状态操作（需登录）：
//   action=master   → masteredAt=now（移入"已掌握"）
//   action=unmaster → masteredAt=null（恢复未掌握）
//   action=remove   → 删除错题记录

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  questionId: z.string().min(1),
  action: z.enum(["master", "unmaster", "remove"]),
});

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

  const { questionId, action } = parsed.data;
  const wrong = await prisma.wrongQuestion.findUnique({
    where: { userId_questionId: { userId: user.id, questionId } },
  });
  if (!wrong) return jsonFail("错题记录不存在", 404);

  if (action === "master") {
    await prisma.wrongQuestion.update({
      where: { id: wrong.id },
      data: { masteredAt: new Date() },
    });
  } else if (action === "unmaster") {
    await prisma.wrongQuestion.update({
      where: { id: wrong.id },
      data: { masteredAt: null },
    });
  } else {
    await prisma.wrongQuestion.delete({ where: { id: wrong.id } });
  }
  return jsonOk({ action });
}
