import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { prepareExam } from "@/lib/prepare-exam";
import type { ExamItem } from "@/lib/prepare-exam";
import FavoriteButton from "@/components/favorite-button";
import LuoguBlock from "@/components/luogu-block";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const attempt = await prisma.paperAttempt.findUnique({
    where: { id },
    select: { paper: { select: { title: true } } },
  });
  return {
    title: attempt ? `模拟成绩 · ${attempt.paper.title}` : "成绩不存在",
    robots: { index: false, follow: false },
  };
}

const fmtDur = (s?: number | null) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}分${sec}秒` : `${sec}秒`;
};

export default async function AttemptResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();

  const attempt = await prisma.paperAttempt.findUnique({
    where: { id },
    include: {
      paper: true,
      answers: true,
    },
  });
  if (!attempt || (attempt.userId !== user.id && user.role !== "ADMIN")) notFound();

  const questions = await prisma.question.findMany({
    where: { paperId: attempt.paperId },
    orderBy: { seq: "asc" },
  });
  const bundle = await prepareExam(attempt.paper, questions);
  const ansMap = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const qMap = new Map(questions.map((q) => [q.id, q]));

  // 统计口径与提交一致：分母 = 可判分客观题总分
  const objective = bundle.items.filter((i) => i.type !== "PROGRAM" && !i.answersMissing);
  const maxScore = objective.reduce((s, i) => s + i.score, 0);
  const correctScore = objective.reduce((s, i) => {
    const a = ansMap.get(i.id);
    return s + (a?.correct ? a.earned : 0);
  }, 0);
  const answered = objective.filter((i) => (ansMap.get(i.id)?.given ?? "").trim() !== "").length;
  const correctQ = objective.filter((i) => ansMap.get(i.id)?.correct).length;
  const percent = maxScore > 0 ? Math.round((correctScore / maxScore) * 100) : 0;

  const sectionRows = bundle.items.filter(
    (i, idx) => idx === 0 || bundle.items[idx - 1].section !== i.section,
  );

  // 收藏态（客观题）
  const objectiveQids = bundle.items.filter((i) => i.type !== "PROGRAM").map((i) => i.id);
  const favRows = await prisma.favorite.findMany({
    where: { userId: user.id, questionId: { in: objectiveQids } },
    select: { questionId: true },
  });
  const favSet = new Set(favRows.map((f) => f.questionId));

  return (
    <div className="space-y-5">
      <nav className="text-xs text-ink-3">
        <Link href={`/paper/${attempt.paper.slug}`} className="hover:text-ink">
          {attempt.paper.title}
        </Link>
        <span className="mx-1.5">/</span>
        <span>成绩单</span>
      </nav>

      {/* 成绩头卡 */}
      <section className="card p-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-center">
            <div className={`text-4xl font-black ${percent >= 60 ? "text-ink" : "text-err"}`}>
              {percent}
              <span className="text-xl">分</span>
            </div>
            <div className="mt-1 text-xs text-ink-3">得分率（{correctScore}/{maxScore} 分）</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
            {[
              ["客观题答对", `${correctQ} / ${objective.length} 题`],
              ["作答进度", `${answered} / ${objective.length} 题`],
              ["用时", fmtDur(attempt.durationSec)],
              ["提交时间", attempt.submittedAt ? attempt.submittedAt.toLocaleString("zh-CN", { hour12: false }) : "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-xs text-ink-3">{k}</div>
                <div className="mt-0.5 text-base font-semibold text-ink">{v}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <Link
              href={`/paper/${attempt.paper.slug}/do`}
              className="btn btn-primary"
            >
              再练一遍
            </Link>
            <Link href="/me" className="btn btn-outline">
              我的统计
            </Link>
          </div>
        </div>
        {attempt.answers.some((a) => a.correct === false) && (
          <p className="mt-4 rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-xs text-ink-2">
            答错的题目已自动收入你的错题本，可在「错题本」中针对性重练。
          </p>
        )}
      </section>

      {/* 逐题回看 */}
      <section className="space-y-4">
        {bundle.items.map((item, idx) => {
          const a = ansMap.get(item.id);
          const q = qMap.get(item.id);
          const isSectionStart = sectionRows.some((r) => r === item) || bundle.items[idx - 1]?.section !== item.section;
          const given = (a?.given ?? "").trim();
          const answeredNow = a ? given !== "" : false;
          const state =
            a?.correct === null || a?.correct === undefined
              ? "skip"
              : a.correct
                ? "right"
                : answeredNow
                  ? "wrong"
                  : "empty";
          return (
            <div key={item.id} className={isSectionStart ? "mt-2" : ""}>
              {isSectionStart && item.section && (
                <div className="pt-2 pb-1 text-sm font-bold text-ink">{item.section}</div>
              )}
              <div className="card p-5">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-surface-2 text-sm font-semibold text-ink-2">
                    {item.seq}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <TypeBadge type={item.type} />
                      <span className="text-xs text-ink-4">{item.score} 分</span>
                      <StateBadge state={state} />
                      {q?.answersMissing && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded border border-line bg-surface-2 text-ink-3">
                          官方暂无答案，未计分
                        </span>
                      )}
                      {item.type !== "PROGRAM" && (
                        <span className="ml-auto">
                          <FavoriteButton questionId={item.id} initial={favSet.has(item.id)} size="sm" />
                        </span>
                      )}
                    </div>

                    {item.codeHtml && (
                      <details open={state !== "right"} className="mb-3 rounded-lg border border-line bg-surface-2">
                        <summary className="cursor-pointer select-none px-3 py-1.5 text-xs font-medium text-ink-2">
                          阅读程序代码
                        </summary>
                        <div
                          className="px-3 pb-3 text-[13px] leading-relaxed overflow-x-auto"
                          dangerouslySetInnerHTML={{ __html: item.codeHtml }}
                        />
                      </details>
                    )}

                    <div className="md-body" dangerouslySetInnerHTML={{ __html: item.html }} />

                    {item.type === "PROGRAM" ? (
                      <LuoguBlock externalUrl={item.externalUrl} />
                    ) : (
                      <>
                        {item.options && (
                          <div className="mt-3 space-y-2">
                            {item.options.map((o) => {
                              const answerKey = q?.answer ?? "";
                              const isAnswer = answerKey.includes(o.key);
                              const iChose = given.includes(o.key);
                              return (
                                <div
                                  key={o.key}
                                  className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 ${
                                    isAnswer
                                      ? "border-ok/35 bg-ok-bg"
                                      : iChose && state === "wrong"
                                        ? "border-err/30 bg-err-bg"
                                        : "border-line"
                                  }`}
                                >
                                  <span
                                    className={`shrink-0 w-5 h-5 flex items-center justify-center rounded-full border text-[11px] font-bold ${
                                      isAnswer
                                        ? "border-ok bg-ok text-white"
                                        : iChose && state === "wrong"
                                          ? "border-err bg-err text-white"
                                          : "border-line-strong text-ink-3"
                                    }`}
                                  >
                                    {o.key}
                                  </span>
                                  <div className="flex-1 min-w-0 md-body" dangerouslySetInnerHTML={{ __html: o.html }} />
                                  {isAnswer && (
                                    <span className="shrink-0 self-center text-[11px] font-bold text-ok">正确答案</span>
                                  )}
                                  {iChose && !isAnswer && state === "wrong" && (
                                    <span className="shrink-0 self-center text-[11px] font-bold text-err">你的选择</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div
                          className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-3 py-2 text-sm ${
                            state === "right"
                              ? "bg-ok-bg text-ok"
                              : state === "wrong"
                                ? "bg-err-bg text-err"
                                : state === "empty"
                                  ? "bg-surface-2 text-ink-3"
                                  : "bg-surface-2 text-ink-3"
                          }`}
                        >
                          <span>
                            我的答案：
                            {state === "empty" ? (
                              <b>未作答</b>
                            ) : (
                              <b>{formatGiven(item.type, given)}</b>
                            )}
                          </span>
                          {q?.answer && (
                            <span>
                              正确答案：<b>{formatGiven(item.type, q.answer)}</b>
                            </span>
                          )}
                          <span className="ml-auto text-xs opacity-70">
                            {state === "right" ? `+${a?.earned ?? item.score} 分` : state === "wrong" ? "0 分" : ""}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function formatGiven(type: ExamItem["type"], v: string): string {
  if (type === "JUDGE") return v === "True" ? "对" : v === "False" ? "错" : v;
  return v;
}

function TypeBadge({ type }: { type: ExamItem["type"] }) {
  const map: Record<ExamItem["type"], [string, string]> = {
    CHOICE: ["单选题", "bg-surface-2 text-ink-2 border-line"],
    MULTI_CHOICE: ["多选题", "bg-surface-2 text-ink-2 border-line"],
    JUDGE: ["判断题", "bg-surface-2 text-ink-2 border-line"],
    FILL: ["填空题", "bg-surface-2 text-ink-2 border-line"],
    PROGRAM: ["编程题", "bg-surface-2 text-ink-2 border-line"],
  };
  const [label, cls] = map[type];
  return <span className={`text-[11px] px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>;
}

function StateBadge({ state }: { state: string }) {
  const map: Record<string, [string, string]> = {
    right: ["答对", "bg-ok-bg text-ok border-ok/25"],
    wrong: ["答错", "bg-err-bg text-err border-err/25"],
    empty: ["未作答", "bg-surface-2 text-ink-2 border-line"],
    skip: ["未计分", "bg-surface-2 text-ink-3 border-line"],
  };
  const [label, cls] = map[state] ?? map.skip;
  return <span className={`text-[11px] px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>;
}
