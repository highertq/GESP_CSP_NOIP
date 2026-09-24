import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { jsonOk, jsonFail } from "@/lib/api";
import { z } from "zod";

// 开考：创建一条 STARTED 的 PaperAttempt，返回 attemptId + 服务端截止时间 + 时钟基准。
// 前端凭 attemptId 交卷，凭 deadlineAt/serverNow 做倒计时与时钟偏移校正。

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ paperId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonFail("请先登录后再开考", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonFail("请求体不是合法 JSON");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonFail("参数不合法：" + parsed.error.issues[0].message);
  const { paperId } = parsed.data;

  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
    select: { id: true, published: true, timeLimit: true, title: true, slug: true },
  });
  if (!paper || !paper.published) return jsonFail("试卷不存在或已下线", 404);

  // 防刷：仅当存在「仍在作答」的 STARTED 记录时，30s 内重复开考才拒绝。
  // 已提交/已超时的记录不影响重新开考，否则用户刚超时就要干等 30s 才能重试。
  const recent = await prisma.paperAttempt.findFirst({
    where: { userId: user.id, paperId, status: "STARTED", startedAt: { gt: new Date(Date.now() - 30_000) } },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  if (recent) return jsonFail("开考过于频繁，请稍候再试", 429);

  const now = new Date();
  const attemptNo = (await prisma.paperAttempt.count({ where: { userId: user.id, paperId } })) + 1;
  const deadlineAt = new Date(now.getTime() + paper.timeLimit * 60_000 + 30_000);
  const attempt = await prisma.paperAttempt.create({
    data: {
      userId: user.id,
      paperId,
      status: "STARTED",
      startedAt: now,
      deadlineAt,
      submitToken: randomUUID(),
      attemptNo,
    },
    select: { id: true, deadlineAt: true, submitToken: true },
  });

  return jsonOk({
    attemptId: attempt.id,
    deadlineAt: attempt.deadlineAt,
    serverNow: now,
    submitToken: attempt.submitToken,
  });
}
