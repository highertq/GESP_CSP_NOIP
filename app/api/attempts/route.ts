import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { jsonOk, jsonFail } from "@/lib/api";
import { gradeQuestion } from "@/lib/grade";
import { z } from "zod";

// 整卷提交判分（需登录）
// 语义：
//  - PROGRAM 与答案缺失题：不判分、不计入得分/错题（correct=null 不落 AttemptAnswer）
//  - 客观题：逐题判分，全部落 AttemptAnswer（含未作答 correct=false）
//  - 答错（含未答？不含）→ WrongQuestion upsert：仅"作答且错"进错题本，未作答不污染
//  - 每题答对/答错均写 AnswerLog（供统计/掌握判定）

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  paperId: z.string().min(1),
  durationSec: z.number().int().min(0).max(6 * 3600).optional(),
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
  const { paperId, durationSec, answers } = parsed.data;

  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
    select: { id: true, title: true, slug: true, published: true },
  });
  if (!paper || !paper.published) return jsonFail("试卷不存在或已下线", 404);

  const questions = await prisma.question.findMany({
    where: { paperId },
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
  const logRows: { userId: string; questionId: string; given: string | null; correct: boolean; earned: number }[] = [];
  const wrongUpserts: { userId: string; questionId: string; wrongCount: number }[] = [];

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
      });
    }
    // 作答且答错 → 错题本 +1（未作答 / 缺失答案 / 大题不进）
    if (r.reason === "wrong") {
      wrongUpserts.push({ userId: user.id, questionId: q.id, wrongCount: 1 });
    }
  }

  if (answerRows.length === 0) return jsonFail("本卷没有可判分的客观题");

  const result = await prisma.$transaction(async (tx) => {
    const attempt = await tx.paperAttempt.create({
      data: {
        userId: user.id,
        paperId,
        status: "SUBMITTED",
        submittedAt: new Date(),
        durationSec: durationSec ?? null,
        earnedScore,
      },
      select: { id: true },
    });
    if (answerRows.length > 0) {
      await tx.attemptAnswer.createMany({
        data: answerRows.map((a) => ({ ...a, attemptId: attempt.id })),
      });
    }
    if (logRows.length > 0) {
      await tx.answerLog.createMany({ data: logRows });
    }
    for (const w of wrongUpserts) {
      await tx.wrongQuestion.upsert({
        where: { userId_questionId: { userId: w.userId, questionId: w.questionId } },
        create: { userId: w.userId, questionId: w.questionId, wrongCount: 1 },
        update: { wrongCount: { increment: 1 } },
      });
    }
    return attempt.id;
  });

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
