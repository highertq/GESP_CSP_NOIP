import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { jsonOk, jsonFail } from "@/lib/api";

// 续答：返回当前用户该卷尚未提交且未超时的 STARTED 记录，供刷新/换设备恢复。

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonFail("请先登录", 401);

  const paperId = new URL(req.url).searchParams.get("paperId");
  if (!paperId) return jsonFail("缺少 paperId");

  const active = await prisma.paperAttempt.findFirst({
    where: {
      userId: user.id,
      paperId,
      status: "STARTED",
      deadlineAt: { gt: new Date() },
    },
    orderBy: { startedAt: "desc" },
    select: { id: true, deadlineAt: true },
  });
  if (!active) return jsonOk(null);
  return jsonOk({
    attemptId: active.id,
    deadlineAt: active.deadlineAt,
    serverNow: new Date(),
  });
}
