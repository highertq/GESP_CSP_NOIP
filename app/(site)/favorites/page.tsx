import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { renderMarkdown } from "@/lib/md";
import FavoriteButton from "@/components/favorite-button";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "我的收藏",
    description: "收藏的经典题与错题，随时回顾。",
    robots: { index: false, follow: false },
  };
}

const PAGE_SIZE = 20;

export default async function FavoritesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/favorites");

  const cur = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const where = { userId: user.id };
  const [total, rows] = await Promise.all([
    prisma.favorite.count({ where }),
    prisma.favorite.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (cur - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { question: { include: { paper: true } } },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const items: { id: string; seq: number; type: string; score: number; html: string; options?: { key: string; html: string }[]; paperTitle: string; paperSlug: string }[] = [];
  for (const f of rows) {
    const q = f.question;
    const optArr = Array.isArray(q.options) ? (q.options as { key: string; text: string }[]) : [];
    let options;
    if (optArr.length > 0) {
      options = [];
      for (const o of optArr) options.push({ key: o.key, html: await renderMarkdown(o.text) });
    }
    items.push({
      id: q.id,
      seq: q.seq,
      type: q.type,
      score: q.score,
      html: await renderMarkdown(q.content),
      options,
      paperTitle: q.paper.title,
      paperSlug: q.paper.slug,
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">我的收藏</h1>
        <p className="mt-1 text-xs text-ink-3">共 {total} 题 · 收藏经典题与易错题，随时回看</p>
      </div>

      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong py-16 text-center">
          <div className="text-3xl mb-2">🔖</div>
          <p className="text-ink-2">还没有收藏。做题/看成绩单时点「☆ 收藏」就能收进来。</p>
          <Link href="/papers" className="btn btn-primary mt-4">
            去试卷库
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {items.map((it) => (
              <div key={it.id} className="card p-5">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-surface-2 text-sm font-semibold text-ink-2">
                    {it.seq}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <TypeBadge type={it.type} />
                      <span className="text-xs text-ink-4">{it.score} 分</span>
                      <Link href={`/paper/${it.paperSlug}`} className="text-xs text-ink hover:underline">
                        {it.paperTitle} · 第 {it.seq} 题
                      </Link>
                      <div className="ml-auto">
                        <FavoriteButton questionId={it.id} initial />
                      </div>
                    </div>
                    <div className="md-body" dangerouslySetInnerHTML={{ __html: it.html }} />
                    {it.options && (
                      <div className="mt-3 space-y-2">
                        {it.options.map((o) => (
                          <div key={o.key} className="flex items-start gap-2.5 rounded-lg border border-line px-3 py-2">
                            <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-ink-2">
                              {o.key}
                            </span>
                            <div className="flex-1 min-w-0 md-body" dangerouslySetInnerHTML={{ __html: o.html }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {pages > 1 && (
            <div className="flex justify-center gap-2 pt-2 text-sm">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/favorites?page=${p}`}
                  className={`px-3 py-1.5 rounded-md border ${
                    p === cur ? "bg-ink border-ink text-white font-medium" : "border-line text-ink-2 hover:bg-surface-2"
                  }`}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, [string, string]> = {
    CHOICE: ["单选题", "bg-surface-2 text-ink-2 border-line"],
    MULTI_CHOICE: ["多选题", "bg-surface-2 text-ink-2 border-line"],
    JUDGE: ["判断题", "bg-surface-2 text-ink-2 border-line"],
    FILL: ["填空题", "bg-surface-2 text-ink-2 border-line"],
    PROGRAM: ["编程题", "bg-surface-2 text-ink-2 border-line"],
  };
  const [label, cls] = map[type] ?? ["未知", "bg-surface-2 text-ink-2 border-line"];
  return <span className={`text-[11px] px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>;
}
