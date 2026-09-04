import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CATEGORY_META, categoryLabel } from "@/lib/constants";
import PaperCard from "@/components/paper-card";

export const metadata: Metadata = { title: "试卷库" };
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
    const next: Record<string, string> = { ...(cat ? { cat } : {}) };
    const lv = "level" in patch ? patch.level : level;
    if (lv) next.level = lv;
    const pg = "page" in patch ? patch.page : undefined;
    if (pg && pg !== "1") next.page = pg;
    return `/papers?${new URLSearchParams(next)}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">试卷库</h1>
        <span className="text-sm text-gray-400">共 {total} 套真题</span>
      </div>

      {/* 分类 tab */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={qs({ cat: undefined, page: "1" })}
          className={`px-3.5 py-1.5 rounded-full text-sm ${
            !cat ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300"
          }`}
        >
          全部
        </Link>
        {CATEGORY_META.map((c) => (
          <Link
            key={c.value}
            href={qs({ cat: c.value, level: undefined, page: "1" })}
            className={`px-3.5 py-1.5 rounded-full text-sm ${
              cat === c.value ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {/* 级别筛选（GESP） */}
      {levelMeta.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400">级别：</span>
          <Link
            href={qs({ level: undefined, page: "1" })}
            className={`px-2.5 py-1 rounded text-xs ${
              !level ? "bg-gray-800 text-white" : "bg-white border border-gray-200 text-gray-600"
            }`}
          >
            全部
          </Link>
          {levelMeta.map((lv) => (
            <Link
              key={lv}
              href={qs({ level: lv, page: "1" })}
              className={`px-2.5 py-1 rounded text-xs ${
                level === lv ? "bg-gray-800 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"
              }`}
            >
              {lv} 级
            </Link>
          ))}
        </div>
      )}

      {/* 列表 */}
      {papers.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">该分类暂无试卷</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                <span key={`e${i}`} className="px-1 text-gray-400">
                  …
                </span>
              ) : (
                <Link
                  key={n}
                  href={qs({ page: String(n) })}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm ${
                    n === page ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300"
                  }`}
                >
                  {n}
                </Link>
              ),
            )}
        </div>
      )}

      <p className="text-xs text-gray-300 pt-2">
        当前筛选：{categoryLabel(cat ?? "全部")}
        {level ? ` · ${level} 级` : ""}
      </p>
    </div>
  );
}
