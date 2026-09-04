import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORY_META } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "我的统计",
    robots: { index: false, follow: false },
  };
}

export default async function MePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/me");

  const [answered, correct, wrongOpen, favCount, attemptCount] = await Promise.all([
    prisma.answerLog.count({ where: { userId: user.id } }),
    prisma.answerLog.count({ where: { userId: user.id, correct: true } }),
    prisma.wrongQuestion.count({ where: { userId: user.id, masteredAt: null } }),
    prisma.favorite.count({ where: { userId: user.id } }),
    prisma.paperAttempt.count({ where: { userId: user.id, status: "SUBMITTED" } }),
  ]);

  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;

  // 分类分布（答题数 + 正确率）
  const catRaw = await prisma.$queryRaw<{ category: string; total: bigint; correct: bigint }[]>`
    SELECT p.category AS category, COUNT(*)::bigint AS total, COUNT(*) FILTER (WHERE l.correct)::bigint AS correct
    FROM "AnswerLog" l
    JOIN "Question" q ON q.id = l."questionId"
    JOIN "Paper" p ON p.id = q."paperId"
    WHERE l."userId" = ${user.id}
    GROUP BY p.category ORDER BY total DESC`;

  // 近 30 天活跃
  const actRaw = await prisma.$queryRaw<{ day: Date; cnt: bigint }[]>`
    SELECT date(l."answeredAt") AS day, COUNT(*)::bigint AS cnt
    FROM "AnswerLog" l
    WHERE l."userId" = ${user.id} AND l."answeredAt" >= now() - interval '30 days'
    GROUP BY date(l."answeredAt") ORDER BY day`;

  // 最近成绩
  const recent = await prisma.paperAttempt.findMany({
    where: { userId: user.id, status: "SUBMITTED" },
    orderBy: { submittedAt: "desc" },
    take: 8,
    include: { paper: { select: { title: true, slug: true } } },
  });

  const actMap = new Map(actRaw.map((a) => [a.day.toISOString().slice(0, 10), Number(a.cnt)]));
  const days: { key: string; label: string; cnt: number }[] = [];
  const today = new Date();
  const maxCnt = Math.max(1, ...actRaw.map((a) => Number(a.cnt)));
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, label: `${d.getMonth() + 1}/${d.getDate()}`, cnt: actMap.get(key) ?? 0 });
  }

  const stats: [string, string | number][] = [
    ["累计作答", `${answered} 题`],
    ["正确率", `${accuracy}%`],
    ["整卷已交", `${attemptCount} 次`],
    ["待攻克错题", wrongOpen],
    ["收藏题目", favCount],
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold">
          {(user.nickname || user.username).slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 className="text-lg font-bold">{user.nickname || user.username}</h1>
          <p className="text-xs text-gray-400">@{user.username}</p>
        </div>
        <div className="ml-auto flex gap-2 text-sm">
          <Link href="/wrong" className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-600 hover:bg-gray-50">
            错题本{wrongOpen > 0 && <span className="ml-1 text-amber-500 font-semibold">({wrongOpen})</span>}
          </Link>
          <Link href="/favorites" className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-600 hover:bg-gray-50">
            收藏
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{v}</div>
            <div className="mt-1 text-xs text-gray-400">{k}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 分类分布 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-bold mb-4">分类分布</h2>
          {catRaw.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">还没有作答记录</p>
          ) : (
            <div className="space-y-3">
              {catRaw.map((c) => {
                const meta = CATEGORY_META.find((m) => m.value === c.category);
                const total = Number(c.total);
                const corr = Number(c.correct);
                const rate = total > 0 ? Math.round((corr / total) * 100) : 0;
                const label = meta?.short ?? c.category;
                return (
                  <div key={c.category}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">{label}</span>
                      <span className="text-gray-400">
                        {corr}/{total} · {rate}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${rate}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 近 30 天活跃 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-bold mb-4">近 30 天作答量</h2>
          {days.every((d) => d.cnt === 0) ? (
            <p className="text-sm text-gray-400 py-6 text-center">最近 30 天没有作答，去刷一套题吧</p>
          ) : (
            <div className="flex items-end gap-[3px] h-28">
              {days.map((d) => (
                <div key={d.key} className="flex-1 flex flex-col items-center gap-1" title={`${d.key}：${d.cnt} 题`}>
                  <div
                    className={`w-full rounded-sm ${d.cnt > 0 ? "bg-blue-500" : "bg-gray-100"}`}
                    style={{ height: `${Math.max(3, (d.cnt / maxCnt) * 80)}px` }}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex justify-between text-[10px] text-gray-300">
            <span>{days[0]?.label}</span>
            <span>{days[14]?.label}</span>
            <span>{days[29]?.label}</span>
          </div>
        </section>
      </div>

      {/* 最近成绩 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-bold mb-3">最近整卷成绩</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            还没有交过整卷 —— <Link href="/papers" className="text-blue-600">去整卷模拟</Link>
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {recent.map((a) => (
              <Link key={a.id} href={`/attempt/${a.id}`} className="flex items-center gap-4 py-2.5 hover:bg-gray-50 rounded-lg px-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-800 truncate">{a.paper.title}</div>
                  <div className="text-xs text-gray-400">
                    {a.submittedAt?.toLocaleString("zh-CN", { hour12: false })}
                    {a.durationSec != null && ` · ${Math.floor(a.durationSec / 60)}分${a.durationSec % 60}秒`}
                  </div>
                </div>
                {a.earnedScore != null && (
                  <div className="text-lg font-bold text-blue-600">{a.earnedScore}<span className="text-xs text-gray-400"> 分</span></div>
                )}
                <span className="text-gray-300">→</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
