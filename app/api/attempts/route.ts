import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { jsonOk, jsonFail } from "@/lib/api";
import { gradeQuestion } from "@/lib/grade";
import { applyMasteryOnWrong, MASTERY_SOURCE } from "@/lib/mastery";
import { isBlocked, hit, RULE_SUBMIT_USER } from "@/lib/ratelimit";
import { z } from "zod";

// 整卷提交判分（需登录）。
// 语义（P0-5/6 改造后）：
//  - 必须携带 attemptId（开考时由 /api/attempts/start 生成），只改得动自己的 STARTED 记录 → 天然幂等 + 防重放
//  - durationSec 由服务端按 startedAt 计算，前端不可伪造（封顶 timeLimit*60+30s grace）
//  - now > deadlineAt → 置 ABANDONED 并返回 409「已超时，本次作废」
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  attemptId: z.string().min(1),
  answers: z.record(z.string(), z.string().nullable()),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonFail("请先登录后再交卷，成绩才能保存", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonFail("请求体不是合法 JSON");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonFail("参数不合法：" + parsed.error.issues[0].message);
  const { attemptId, answers } = parsed.data;

  const attempt = await prisma.paperAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, userId: true, paperId: true, status: true, startedAt: true, deadlineAt: true, questionIds: true },
  });
  if (!attempt || attempt.userId !== user.id) return jsonFail("作答记录不存在", 404);
  if (attempt.status !== "STARTED") return jsonFail("本次作答已结束", 409);

  // P1-4 错题组卷：questionIds 非空 = 错题重练会话，按该集合判分（宿主卷无题目行）
  const quizIds = Array.isArray(attempt.questionIds)
    ? (attempt.questionIds as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const isQuiz = quizIds.length > 0;

  const now = new Date();
  // 服务端截止时间：以 Date 归一化（兼顾 Date 与字符串两种返回形态），避免比较失效
  const dlMs = attempt.deadlineAt ? new Date(attempt.deadlineAt).getTime() : 0;
  if (dlMs > 0 && now.getTime() > dlMs) {
    await prisma.paperAttempt.update({
      where: { id: attempt.id },
      data: { status: "ABANDONED", submittedAt: now },
    });
    return jsonFail("已超时，本次作废", 409);
  }

  const paper = await prisma.paper.findUnique({
    where: { id: attempt.paperId },
    select: { id: true, title: true, slug: true, published: true, timeLimit: true },
  });
  // 宿主卷 published=false 属预期（错题组卷），仅普通整卷要求已上线
  if (!paper || (!paper.published && !isQuiz)) return jsonFail("试卷不存在或已下线", 404);

  const questions = isQuiz
    ? await prisma.question.findMany({
        where: { id: { in: quizIds } },
        select: { id: true, seq: true, type: true, score: true, answer: true, answersMissing: true },
      })
    : await prisma.question.findMany({
        where: { paperId: attempt.paperId },
        orderBy: { seq: "asc" },
        select: { id: true, seq: true, type: true, score: true, answer: true, answersMissing: true },
      });
  if (questions.length === 0) return jsonFail("该卷没有题目");

  // 仅接受本卷题目；未知 id 忽略
  const validIds = new Set(questions.map((q) => q.id));
  let earnedScore = 0;
  let maxScore = 0;
  let correctCount = 0;
  let answeredCount = 0;
  const answerRows: {
    questionId: string;
    given: string | null;
    correct: boolean | null;
    earned: number;
  }[] = [];
  const logRows: { userId: string; questionId: string; given: string | null; correct: boolean; earned: number; source: string }[] = [];
  const wrongQuestionIds: string[] = [];

  for (const q of questions) {
    const givenRaw = answers[q.id];
    if (q.type === "PROGRAM" || q.answersMissing) continue; // 不判分，不落行
    maxScore += q.score;
    const g = givenRaw?.trim() ?? "";
    if (g) answeredCount++;
    const r = gradeQuestion(q, g);
    const earned = r.correct ? q.score : 0;
    if (r.correct) correctCount++;
    earnedScore += earned;
    answerRows.push({
      questionId: q.id,
      given: g || null,
      correct: r.correct,
      earned,
    });
    if (r.reason === "ok" || r.reason === "wrong") {
      logRows.push({
        userId: user.id,
        questionId: q.id,
        given: g || null,
        correct: r.correct!,
        earned,
        source: MASTERY_SOURCE.EXAM,
      });
    }
    // 作答且答错 → 进错题本（未作答 / 缺失答案 / 大题不进）；事务内统一走 applyMasteryOnWrong
    if (r.reason === "wrong") {
      wrongQuestionIds.push(q.id);
    }
  }

  if (answerRows.length === 0) return jsonFail("本卷没有可判分的客观题");

  // 提交频控（同一用户 60s 内最多 5 次交卷）
  if (isBlocked(`submit:u:${user.id}`, RULE_SUBMIT_USER)) {
    return jsonFail("交卷过于频繁，请稍后再试", 429);
  }

  // durationSec：服务端按 startedAt 计算，封顶 timeLimit*60 + 30s grace（前端不可伪造）
  const grace = paper.timeLimit * 60 + 30;
  const elapsed = Math.floor((now.getTime() - attempt.startedAt.getTime()) / 1000);
  const durationSec = Math.min(elapsed, grace);

  const result = await prisma.$transaction(async (tx) => {
    // 幂等 + 防重放：只改得动自己的 STARTED 记录；已被提交/超时则 count=0
    const upd = await tx.paperAttempt.updateMany({
      where: { id: attempt.id, userId: user.id, status: "STARTED" },
      data: { status: "SUBMITTED", submittedAt: now, durationSec, earnedScore },
    });
    if (upd.count === 0) return null;
    if (answerRows.length > 0) {
      await tx.attemptAnswer.createMany({
        data: answerRows.map((a) => ({ ...a, attemptId: attempt.id })),
      });
    }
    if (logRows.length > 0) {
      await tx.answerLog.createMany({ data: logRows });
    }
    // 答错 → 错题本 +1 且清空 masteredAt（与重练路径一致）
    for (const qid of wrongQuestionIds) {
      await applyMasteryOnWrong({ userId: user.id, questionId: qid, now, tx });
    }
    return attempt.id;
  });

  if (!result) return jsonFail("本次作答已结束", 409);
  hit(`submit:u:${user.id}`, RULE_SUBMIT_USER);

  const percent = maxScore > 0 ? Math.round((earnedScore / maxScore) * 100) : 0;
  return jsonOk({
    attemptId: result,
    earnedScore,
    maxScore,
    percent,
    correctCount,
    answeredCount,
    objectiveCount: answerRows.length,
  });
}
