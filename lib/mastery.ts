import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type MasteryTx = Prisma.TransactionClient;

/** AnswerLog 来源：整卷提交 / 错题重练 */
export const MASTERY_SOURCE = {
  EXAM: "EXAM",
  PRACTICE: "PRACTICE",
} as const;

/**
 * 掌握阈值 N：连续答对 N 次（仅重练来源）转掌握。
 * 统一从 AdminSetting("wrong_master_threshold") 读取，默认 2。
 */
export async function getThreshold(): Promise<number> {
  const setting = await prisma.adminSetting.findUnique({
    where: { key: "wrong_master_threshold" },
  });
  const n = Number(setting?.value ?? 2);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : 2;
}

/**
 * 答错：保证错题本有一行；wrongCount+1 且 masteredAt 清空。
 * 关键修复（P0-3/4）：已掌握题答错也必须退回未掌握——
 * 旧逻辑用 `!wrong.masteredAt` 守卫，导致「掌握→答错」不可逆、状态机双入口不一致。
 * 整卷答错与重练答错共用此函数，保证两条路径语义一致。
 */
export async function applyMasteryOnWrong(i: {
  userId: string;
  questionId: string;
  now: Date;
  tx?: MasteryTx;
}): Promise<{ wrongCount: number }> {
  const db = i.tx ?? prisma;
  const updated = await db.wrongQuestion.upsert({
    where: { userId_questionId: { userId: i.userId, questionId: i.questionId } },
    create: { userId: i.userId, questionId: i.questionId, wrongCount: 1, masteredAt: null },
    update: { wrongCount: { increment: 1 }, masteredAt: null },
    select: { wrongCount: true },
  });
  return { wrongCount: updated.wrongCount };
}

/**
 * 答对（仅重练路径调用）：统计最近 threshold 条 PRACTICE 日志是否连续全对 → 置 masteredAt。
 * 只数 PRACTICE 来源（P0-7）：整卷答对的日志（source=EXAM）不计入重练连对，
 * 避免「整卷蒙对」直接把错题推到已掌握，污染掌握判定。
 */
export async function applyMasteryOnPracticeCorrect(i: {
  userId: string;
  questionId: string;
  threshold: number;
  now: Date;
  tx?: MasteryTx;
}): Promise<{ mastered: boolean; streak: number }> {
  const db = i.tx ?? prisma;
  const recent = await db.answerLog.findMany({
    where: { userId: i.userId, questionId: i.questionId, source: MASTERY_SOURCE.PRACTICE },
    orderBy: { answeredAt: "desc" },
    take: i.threshold,
    select: { correct: true },
  });
  let streak = 0;
  for (const l of recent) {
    if (!l.correct) break;
    streak++;
  }
  let mastered = false;
  if (streak >= i.threshold) {
    const wrong = await db.wrongQuestion.findUnique({
      where: { userId_questionId: { userId: i.userId, questionId: i.questionId } },
      select: { id: true, masteredAt: true },
    });
    if (wrong && !wrong.masteredAt) {
      await db.wrongQuestion.update({
        where: { id: wrong.id },
        data: { masteredAt: i.now },
      });
      mastered = true;
    }
  }
  return { mastered, streak };
}
