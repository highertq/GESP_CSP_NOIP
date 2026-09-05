import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CATEGORY_META, categoryLabel } from "@/lib/constants";
import PaperCard from "@/components/paper-card";

export const metadata: Metadata = {
  title: "GESP真题试卷库 - 历年初赛真题免费在线刷",
  description:
    "GESP 1-8 级、CSP-J/S、NCT 历年初赛真题试卷库，共 160+ 套免费在线练习：选择/判断/填空即时判分，错题自动归档，支持整卷模拟计时。按考试类型与级别筛选。",
  alternates: { canonical: "/papers" },
};
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function PapersPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; level?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const cat = sp.cat && CATEGORY_META.some((c) => c.value === sp.cat) ? sp.cat : undefined;
  const level = sp.level && /^\d+$/.test(sp.level) ? sp.level : undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where = {
    published: true,
    ...(cat ? { category: cat } : {}),
    ...(level ? { level } : {}),
  };

  const [papers, total] = await Promise.all([
    prisma.paper.findMany({
      where,
      orderBy: [{ examDate: "desc" }, { title: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { questions: true } } },
    }),
    prisma.paper.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const levelMeta = cat === "GESP" ? ["1", "2", "3", "4", "5", "6", "7", "8"] : [];

  const qs = (patch: Record<string, string | undefined>) => {
    const next: Record<string, string> = {};
    const c = "cat" in patch ? patch.cat : cat;
    if (c) next.cat = c;
    const lv = "level" in patch ? patch.level : level;
    if (lv) next.level = lv;
    const pg = "page" in patch ? patch.page : undefined;
    if (pg && pg !== "1") next.page = pg;
    return `/papers?${new URLSearchParams(next)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-1">
            <span className="text-ink/30">// </span>exam-library
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-ink">试卷库</h1>
        </div>
        <span className="code text-xs text-ink-4">共 {total} 套真题</span>
      </div>

      {/* 分类 tab */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={qs({ cat: undefined, page: "1" })}
          className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors duration-150 ${
            !cat
              ? "bg-ink text-white"
              : "bg-surface border border-line text-ink-2 hover:border-line-strong hover:text-ink"
          }`}
        >
          全部
        </Link>
        {CATEGORY_META.map((c) => (
          <Link
            key={c.value}
            href={qs({ cat: c.value, level: undefined, page: "1" })}
            className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors duration-150 ${
              cat === c.value
                ? "bg-ink text-white"
                : "bg-surface border border-line text-ink-2 hover:border-line-strong hover:text-ink"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {/* 级别筛选（GESP） */}
      {levelMeta.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="code text-[11px] text-ink-4 mr-1">level:</span>
          <Link
            href={qs({ level: undefined, page: "1" })}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 ${
              !level ? "bg-ink text-white" : "bg-surface border border-line text-ink-2 hover:border-line-strong"
            }`}
          >
            全部
          </Link>
          {levelMeta.map((lv) => (
            <Link
              key={lv}
              href={qs({ level: lv, page: "1" })}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 ${
                level === lv
                  ? "bg-ink text-white"
                  : "bg-surface border border-line text-ink-2 hover:border-line-strong"
              }`}
            >
              {lv} 级
            </Link>
          ))}
        </div>
      )}

      {/* 列表 */}
      {papers.length === 0 ? (
        <div className="card py-20 text-center space-y-2">
          <p className="code text-sm text-ink-3">no_papers_found()</p>
          <p className="text-sm text-ink-3">该分类暂无试卷，换个筛选条件试试</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {papers.map((p) => (
            <PaperCard key={p.slug} paper={p} />
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
            .reduce<(number | "…")[]>((acc, n) => {
              if (acc.length && (acc[acc.length - 1] as number) + 1 < n) acc.push("…");
              acc.push(n);
              return acc;
            }, [])
            .map((n, i) =>
              n === "…" ? (
                <span key={`e${i}`} className="px-1 text-ink-4 text-sm">
                  …
                </span>
              ) : (
                <Link
                  key={n}
                  href={qs({ page: String(n) })}
                  className={`num w-9 h-9 flex items-center justify-center rounded-lg text-sm transition-colors duration-150 ${
                    n === page
                      ? "bg-ink text-white"
                      : "bg-surface border border-line text-ink-2 hover:border-line-strong hover:text-ink"
                  }`}
                >
                  {n}
                </Link>
              ),
            )}
        </div>
      )}

      <p className="code text-[11px] text-ink-4 pt-1">
        filter: {categoryLabel(cat ?? "all")}
        {level ? ` · level ${level}` : ""} · sorted by exam_date desc
      </p>
    </div>
  );
}
