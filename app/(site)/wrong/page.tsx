import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { renderMarkdown } from "@/lib/md";
import WrongCard from "@/components/wrong-card";
import type { WrongCardData } from "@/components/wrong-card";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "错题本",
    description: "整卷模拟与刷题中答错的题目自动收录，支持单题重练与掌握管理。",
    robots: { index: false, follow: false },
  };
}

const PAGE_SIZE = 10;

export default async function WrongPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { tab, page } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/wrong");

  const mastered = tab === "mastered";
  const cur = Math.max(1, parseInt(page ?? "1", 10) || 1);

  const where = {
    userId: user.id,
    ...(mastered ? { masteredAt: { not: null } } : { masteredAt: null }),
  };

  const [total, rows] = await Promise.all([
    prisma.wrongQuestion.count({ where }),
    prisma.wrongQuestion.findMany({
      where,
      orderBy: mastered ? { masteredAt: "desc" } : { updatedAt: "desc" },
      skip: (cur - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        question: { include: { paper: true } },
      },
    }),
  ]);

  const favQids = await prisma.favorite.findMany({
    where: { userId: user.id, questionId: { in: rows.map((r) => r.questionId) } },
    select: { questionId: true },
  });
  const favSet = new Set(favQids.map((f) => f.questionId));

  const openCount = await prisma.wrongQuestion.count({ where: { userId: user.id, masteredAt: null } });

  const cards: WrongCardData[] = [];
  for (const row of rows) {
    const q = row.question;
    const optArr = Array.isArray(q.options) ? (q.options as { key: string; text: string }[]) : [];
    let options: { key: string; html: string }[] | undefined;
    if (optArr.length > 0) {
      options = [];
      for (const o of optArr) {
        options.push({ key: o.key, html: await renderMarkdown(o.text) });
      }
    }
    cards.push({
      questionId: q.id,
      seq: q.seq,
      type: q.type as WrongCardData["type"],
      score: q.score,
      answersMissing: q.answersMissing,
      html: await renderMarkdown(q.content),
      options,
      paperTitle: q.paper.title,
      paperSlug: q.paper.slug,
      wrongCount: row.wrongCount,
      favored: favSet.has(q.id),
      mastered: !!row.masteredAt,
    });
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">错题本</h1>
          <p className="mt-1 text-xs text-ink-3">
            {mastered
              ? "已掌握的错题（可恢复练习）"
              : `整卷模拟答错的题自动收录，共 ${openCount} 题待攻克`}
          </p>
        </div>
        <div className="flex rounded-lg border border-line overflow-hidden text-sm">
          <Link
            href="/wrong"
            className={`px-4 py-1.5 ${!mastered ? "bg-ink text-white font-medium" : "text-ink-2 hover:bg-surface-2"}`}
          >
            未掌握 {openCount > 0 && <span className="opacity-70">({openCount})</span>}
          </Link>
          <Link
            href="/wrong?tab=mastered"
            className={`px-4 py-1.5 ${mastered ? "bg-ink text-white font-medium" : "text-ink-2 hover:bg-surface-2"}`}
          >
            已掌握
          </Link>
        </div>
      </div>

      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong py-16 text-center">
          <div className="text-3xl mb-2">{mastered ? "🌱" : "🎉"}</div>
          <p className="text-ink-2">
            {mastered ? "还没有已掌握的错题" : "太干净了，还没有错题 —— 去整卷模拟检验一下？"}
          </p>
          {!mastered && (
            <Link href="/papers" className="btn btn-primary mt-4">
              去刷一套
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {cards.map((c) => (
              <WrongCard key={c.questionId} card={c} />
            ))}
          </div>
          {pages > 1 && (
            <Pager cur={cur} pages={pages} href={`/wrong${mastered ? "?tab=mastered&" : "?"}page=`} />
          )}
        </>
      )}
    </div>
  );
}

function Pager({ cur, pages, href }: { cur: number; pages: number; href: string }) {
  return (
    <div className="flex justify-center gap-2 pt-2 text-sm">
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <Link
          key={p}
          href={href + p}
          className={`px-3 py-1.5 rounded-md border ${
            p === cur ? "bg-ink border-ink text-white font-medium" : "border-line text-ink-2 hover:bg-surface-2"
          }`}
        >
          {p}
        </Link>
      ))}
    </div>
  );
}
