import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { prepareExam } from "@/lib/prepare-exam";
import { ensureWrongQuizPaper, pickWrongQuestions, hasQuizableWrong } from "@/lib/wrong-quiz";
import DoPaper from "@/components/do-paper";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "错题专项重练",
  description: "把错题本里未掌握的题自动组成一套限时小卷，交卷即时判分并更新掌握状态。",
  robots: { index: false, follow: false },
};

// 错题组卷：服务端决定「续答 or 新卷」，题目集合写进 attempt.questionIds。
// 判分/回看全程按该集合，宿主卷（wrong-quiz）只是承载作答记录的壳。
export default async function WrongQuizPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/wrong/quiz");

  const paper = await ensureWrongQuizPaper();

  // 续答：优先恢复未超时的 STARTED 错题卷（题目集合以该记录为准，避免刷新换题）
  let attempt = await prisma.paperAttempt.findFirst({
    where: { userId: user.id, paperId: paper.id, status: "STARTED", deadlineAt: { gt: new Date() } },
    orderBy: { startedAt: "desc" },
  });

  let questions: Awaited<ReturnType<typeof pickWrongQuestions>> = [];
  if (attempt) {
    const ids = Array.isArray(attempt.questionIds)
      ? (attempt.questionIds as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    if (ids.length > 0) {
      const rows = await prisma.question.findMany({ where: { id: { in: ids } } });
      const pos = new Map(ids.map((id, i) => [id, i]));
      questions = rows.sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0));
    }
  }

  // 新卷：从未掌握错题抽取（服务端创建作答记录，不经 /start 频控）
  if (!attempt || questions.length === 0) {
    if (!(await hasQuizableWrong(user.id))) {
      return (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-sm text-center">
            <p className="text-lg font-bold">错题本里没有可重练的题</p>
            <p className="mt-2 text-sm text-ink-3">
              未掌握的错题为空（或都缺官方答案/为编程大题）。去整卷模拟检验一下吧。
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link href="/wrong" className="btn btn-outline">返回错题本</Link>
              <Link href="/papers" className="btn btn-primary">去刷一套</Link>
            </div>
          </div>
        </div>
      );
    }

    questions = await pickWrongQuestions(user.id);
    const now = new Date();
    const attemptNo = (await prisma.paperAttempt.count({ where: { userId: user.id, paperId: paper.id } })) + 1;
    attempt = await prisma.paperAttempt.create({
      data: {
        userId: user.id,
        paperId: paper.id,
        status: "STARTED",
        startedAt: now,
        deadlineAt: new Date(now.getTime() + paper.timeLimit * 60_000 + 30_000),
        submitToken: crypto.randomUUID(),
        attemptNo,
        questionIds: questions.map((q) => q.id),
      },
    });
  }

  // 展示序号按本卷重排（原卷 seq 仅作来源提示，不参与判分）
  const renumbered = questions.map((q, i) => ({ ...q, seq: i + 1 }));
  const bundle = await prepareExam(paper, renumbered);

  return (
    <DoPaper
      bundle={bundle}
      session={{ attemptId: attempt.id, deadlineAt: attempt.deadlineAt!.toISOString(), serverNow: new Date().toISOString() }}
      exitHref="/wrong"
      loginNext="/wrong/quiz"
    />
  );
}
