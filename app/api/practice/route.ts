import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { jsonOk, jsonFail } from "@/lib/api";
import { gradeQuestion } from "@/lib/grade";
import { z } from "zod";

// 错题单题重练：即时判分 + 错题掌握流转。
// 掌握规则：连续答对达到阈值 N（AdminSetting wrong_master_threshold，默认 2）→ WrongQuestion.masteredAt 置值。
// 判定用最近 N 条 AnswerLog 是否全对（含本次），不新增字段。

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  questionId: z.string().min(1),
  given: z.string().nullable().optional(),
});

async function getThreshold(): Promise<number> {
  const setting = await prisma.adminSetting.findUnique({ where: { key: "wrong_master_threshold" } });
  const n = Number(setting?.value ?? 2);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : 2;
}

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

  const { questionId, given } = parsed.data;
  const q = await prisma.question.findUnique({ where: { id: questionId } });
  if (!q) return jsonFail("题目不存在", 404);

  const threshold = await getThreshold();
  if (q.type === "PROGRAM") return jsonFail("编程大题不支持在线判分");
  if (q.answersMissing || !q.answer) {
    return jsonFail("此题官方暂无答案，暂无法判分");
  }

  const g = (given ?? "").trim();
  const r = gradeQuestion(q, g);
  const earned = r.correct ? q.score : 0;
  const now = new Date();

  const outcome = await prisma.$transaction(async (tx) => {
    await tx.answerLog.create({
      data: { userId: user.id, questionId: q.id, given: g || null, correct: !!r.correct, earned },
    });

    let mastered = false;
    let wrongCount = 0;
    let streak = 0;

    if (r.correct) {
      // 统计最近 threshold 次的连续答对数
      const recent = await tx.answerLog.findMany({
        where: { userId: user.id, questionId: q.id },
        orderBy: { answeredAt: "desc" },
        take: threshold,
        select: { correct: true },
      });
      for (const l of recent) {
        if (!l.correct) break;
        streak++;
      }
      // 有未掌握错题记录且连续达标 → 转掌握
      const wrong = await tx.wrongQuestion.findUnique({
        where: { userId_questionId: { userId: user.id, questionId: q.id } },
      });
      if (wrong && !wrong.masteredAt && streak >= threshold) {
        await tx.wrongQuestion.update({
          where: { id: wrong.id },
          data: { masteredAt: now },
        });
        mastered = true;
      }
    } else {
      // 答错 → 仅当存在未掌握记录才 +1；无记录（越权调用）忽略
      const wrong = await tx.wrongQuestion.findUnique({
        where: { userId_questionId: { userId: user.id, questionId: q.id } },
      });
      if (wrong && !wrong.masteredAt) {
        const updated = await tx.wrongQuestion.update({
          where: { id: wrong.id },
          data: { wrongCount: { increment: 1 } },
          select: { wrongCount: true },
        });
        wrongCount = updated.wrongCount;
      }
    }
    return { mastered, wrongCount, streak };
  });

  return jsonOk({
    correct: r.correct,
    reason: r.reason,
    answer: q.answer,
    score: q.score,
    earned,
    threshold,
    streak: outcome.streak,
    mastered: outcome.mastered,
    wrongCount: outcome.wrongCount,
  });
}
