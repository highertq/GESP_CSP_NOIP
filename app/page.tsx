import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CATEGORY_META } from "@/lib/constants";
import PaperCard from "@/components/paper-card";

export const revalidate = 300; // 首页 5 分钟 ISR

export default async function HomePage() {
  const [cats, latest, announcement] = await Promise.all([
    prisma.paper.groupBy({
      by: ["category"],
      where: { published: true },
      _count: { _all: true },
    }),
    prisma.paper.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { _count: { select: { questions: true } } },
    }),
    prisma.adminSetting.findUnique({ where: { key: "announcement" } }),
  ]);

  const countBy = new Map(cats.map((c) => [c.category, c._count._all]));
  const totalPapers = [...countBy.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-10 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold">信奥初赛真题，免费开刷</h1>
        <p className="mt-2 text-blue-100 text-sm sm:text-base">
          覆盖 GESP / CSP-J / CSP-S / NCT 共 {totalPapers} 套真题 · 客观题即时判分 · 错题自动沉淀
        </p>
        <Link
          href="/papers"
          className="inline-block mt-5 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
        >
          开始刷题
        </Link>
      </section>

      {announcement?.value ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          📢 {announcement.value}
        </div>
      ) : null}

      <section>
        <h2 className="text-lg font-bold mb-3">按考试分类</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CATEGORY_META.map((c) => {
            const n = countBy.get(c.value) ?? 0;
            if (n === 0 && c.value !== "GESP" && c.value !== "CSP-J") return null;
            return (
              <Link
                key={c.value}
                href={`/papers?cat=${c.value}`}
                className="bg-white border border-gray-200 rounded-xl px-4 py-4 hover:border-blue-300 transition-colors"
              >
                <div className="font-medium text-gray-900">{c.label}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {c.value === "GESP" ? "1-8 级真题" : c.value.startsWith("CSP") ? "历年初赛真题" : "模拟与真题"}
                  {" · "}
                  {n} 套
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">最新收录</h2>
          <Link href="/papers" className="text-sm text-blue-600">
            查看全部 →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {latest.map((p) => (
            <PaperCard key={p.slug} paper={p} />
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-white border border-gray-200 px-5 py-6 text-sm text-gray-600 space-y-2 leading-relaxed">
        <h2 className="text-base font-bold text-gray-900">常见问题</h2>
        <p>
          <b>这里能刷什么题？</b>
          信奥初赛的客观题（单选 / 多选 / 判断 / 填空），覆盖 GESP 1-8 级历年真题、CSP-J/S
          初赛试题等。提交后即时判分，答错的题会自动进你的错题本。
        </p>
        <p>
          <b>编程大题怎么练？</b>
          客观题适合网站在线判分；编程大题（GESP 编程题、CSP 上机）请前往洛谷、GESP
          官方 OJ 等在线评测平台提交，本站提供题面与说明。
        </p>
        <p>
          <b>需要登录吗？</b>
          游客可以直接刷题体验；注册登录后，答题记录、错题本、收藏才会保存并同步。
        </p>
      </section>
    </div>
  );
}
