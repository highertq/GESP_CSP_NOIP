import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { jsonOk, jsonFail } from "@/lib/api";
import { gradeQuestion } from "@/lib/grade";
import { renderMarkdown } from "@/lib/md";
import { clientIp, isBlocked, hit, RULE_PRACTICE_IP } from "@/lib/ratelimit";
import {
  getThreshold,
  applyMasteryOnWrong,
  applyMasteryOnPracticeCorrect,
  MASTERY_SOURCE,
} from "@/lib/mastery";
import { z } from "zod";

// 错题单题重练：即时判分 + 错题掌握流转。
// 掌握规则：连续答对达到阈值 N（AdminSetting wrong_master_threshold，默认 2）→ WrongQuestion.masteredAt 置值。
// 判定只取最近 N 条 PRACTICE 来源日志（applyMasteryOnPracticeCorrect 内实现），整卷答对不污染。

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  questionId: z.string().min(1),
  given: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonFail("请先登录", 401);

  // P0-8 重练频控：每 IP 每分钟最多 30 次，防刷 AnswerLog 污染统计 / 接口滥用
  const ip = clientIp(req.headers);
  const ipKey = `practice:ip:${ip}`;
  if (isBlocked(ipKey, RULE_PRACTICE_IP)) {
    return jsonFail("操作过于频繁，请稍后再试", 429);
  }

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

  // 归属校验：只允许重练「自己错题本内」的题目（P0-1 防答案拖库）。
  const wq = await prisma.wrongQuestion.findUnique({
    where: { userId_questionId: { userId: user.id, questionId } },
  });
  if (!wq) return jsonFail("该题不在你的错题本中", 404);

  const threshold = await getThreshold();
  if (q.type === "PROGRAM") return jsonFail("编程大题不支持在线判分");
  if (q.answersMissing || !q.answer) {
    return jsonFail("此题官方暂无答案，暂无法判分");
  }

  const g = (given ?? "").trim();
  const r = gradeQuestion(q, g);
  const earned = r.correct ? q.score : 0;
  const now = new Date();

  hit(ipKey, RULE_PRACTICE_IP);

  const outcome = await prisma.$transaction(async (tx) => {
    await tx.answerLog.create({
      data: {
        userId: user.id,
        questionId: q.id,
        given: g || null,
        correct: !!r.correct,
        earned,
        source: MASTERY_SOURCE.PRACTICE,
      },
    });

    if (r.correct) {
      const res = await applyMasteryOnPracticeCorrect({
        userId: user.id,
        questionId: q.id,
        threshold,
        now,
        tx,
      });
      return { mastered: res.mastered, wrongCount: wq.wrongCount, streak: res.streak };
    }
    const res = await applyMasteryOnWrong({ userId: user.id, questionId: q.id, now, tx });
    return { mastered: false, wrongCount: res.wrongCount, streak: 0 };
  });

  return jsonOk({
    correct: r.correct,
    reason: r.reason,
    answer: q.answer,
    explanationHtml: q.explanation ? await renderMarkdown(q.explanation) : null,
    score: q.score,
    earned,
    threshold,
    streak: outcome.streak,
    mastered: outcome.mastered,
    wrongCount: outcome.wrongCount,
  });
}
