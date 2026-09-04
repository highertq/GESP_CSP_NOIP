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
        <p className="mt-1 text-xs text-gray-400">共 {total} 题 · 收藏经典题与易错题，随时回看</p>
      </div>

      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center">
          <div className="text-3xl mb-2">🔖</div>
          <p className="text-gray-500">还没有收藏。做题/看成绩单时点「☆ 收藏」就能收进来。</p>
          <Link href="/papers" className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700">
            去试卷库
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {items.map((it) => (
              <div key={it.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-sm font-semibold text-blue-600">
                    {it.seq}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <TypeBadge type={it.type} />
                      <span className="text-xs text-gray-300">{it.score} 分</span>
                      <Link href={`/paper/${it.paperSlug}#q-${it.seq}`} className="text-xs text-blue-600 hover:underline">
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
                          <div key={o.key} className="flex items-start gap-2.5 rounded-lg border border-gray-100 px-3 py-2">
                            <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-gray-50 text-xs font-bold text-gray-500">
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
                    p === cur ? "bg-blue-600 border-blue-600 text-white font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50"
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
    CHOICE: ["单选题", "bg-blue-50 text-blue-700 border-blue-100"],
    MULTI_CHOICE: ["多选题", "bg-violet-50 text-violet-700 border-violet-100"],
    JUDGE: ["判断题", "bg-amber-50 text-amber-700 border-amber-100"],
    FILL: ["填空题", "bg-emerald-50 text-emerald-700 border-emerald-100"],
    PROGRAM: ["编程题", "bg-rose-50 text-rose-700 border-rose-100"],
  };
  const [label, cls] = map[type] ?? ["未知", "bg-gray-100 text-gray-600 border-gray-200"];
  return <span className={`text-[11px] px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>;
}
