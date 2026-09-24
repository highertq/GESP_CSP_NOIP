import { prisma } from "@/lib/prisma";

// P1-4 错题专项组卷重练：
// 复用整卷作答链路（PaperAttempt + /api/attempts 判分），但不复制题目 ——
// 用一张隐藏宿主卷（slug=wrong-quiz，published=false），作答记录上以
// questionIds JSON 记录本次命中的题目集合；判分/回看均按该集合取题。

export const WRONG_QUIZ_SLUG = "wrong-quiz";
export const WRONG_QUIZ_MAX = 20;

/** 隐藏宿主卷（懒创建，upsert 幂等）；published=false 不会出现在试卷列表 */
export async function ensureWrongQuizPaper() {
  return prisma.paper.upsert({
    where: { slug: WRONG_QUIZ_SLUG },
    update: {},
    create: {
      slug: WRONG_QUIZ_SLUG,
      title: "错题专项重练",
      category: "OTHER",
      timeLimit: 45,
      totalScore: 100,
      published: false,
    },
  });
}

/** 从未掌握错题里抽取可判分题目（最近答错的优先），最多 WRONG_QUIZ_MAX 题 */
export async function pickWrongQuestions(userId: string) {
  const rows = await prisma.wrongQuestion.findMany({
    where: {
      userId,
      masteredAt: null,
      question: { type: { not: "PROGRAM" }, answersMissing: false },
    },
    orderBy: { updatedAt: "desc" },
    take: WRONG_QUIZ_MAX,
    include: { question: true },
  });
  return rows.map((r) => r.question);
}

/** 该用户是否还有可组卷的未掌握错题 */
export async function hasQuizableWrong(userId: string) {
  return (
    (await prisma.wrongQuestion.count({
      where: {
        userId,
        masteredAt: null,
        question: { type: { not: "PROGRAM" }, answersMissing: false },
      },
    })) > 0
  );
}
