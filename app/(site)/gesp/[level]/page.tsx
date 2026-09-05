import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import PaperCard from "@/components/paper-card";
import { GESP_LEVELS, getGespLevel } from "@/lib/gesp-levels";

export const revalidate = 3600;
export const dynamicParams = false;

const CN_NUM = ["", "一", "二", "三", "四", "五", "六", "七", "八"];

export function generateStaticParams() {
  return GESP_LEVELS.map((l) => ({ level: `level-${l.level}` }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ level: string }>;
}): Promise<Metadata> {
  const { level } = await params;
  const n = Number(level.replace("level-", ""));
  const meta = getGespLevel(n);
  if (!meta) return { title: "页面不存在" };
  const cn = CN_NUM[n];
  return {
    title: `GESP${cn}级真题 - 历年GESP ${n}级认证真题在线刷`,
    description: `${meta.intro}免费在线刷 GESP ${n} 级历年真题：即时判分、错题本、整卷模拟计时，附 ${n} 级考纲要点与备考建议。`,
    alternates: { canonical: `/gesp/level-${n}` },
    openGraph: {
      title: `GESP${cn}级真题在线练习`,
      description: meta.intro,
      type: "website",
    },
  };
}

export default async function GespLevelPage({
  params,
}: {
  params: Promise<{ level: string }>;
}) {
  const { level } = await params;
  const n = Number(level.replace("level-", ""));
  const meta = getGespLevel(n);
  if (!meta) notFound();

  const papers = await prisma.paper.findMany({
    where: { published: true, category: "GESP", level: String(n) },
    orderBy: [{ examDate: "desc" }, { title: "asc" }],
    include: { _count: { select: { questions: true } } },
  });

  const prev = GESP_LEVELS.find((l) => l.level === n - 1);
  const next = GESP_LEVELS.find((l) => l.level === n + 1);
  const cn = CN_NUM[n];

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "首页", item: "/" },
              { "@type": "ListItem", position: 2, name: "GESP真题专区", item: "/gesp" },
              {
                "@type": "ListItem",
                position: 3,
                name: `GESP${cn}级真题`,
                item: `/gesp/level-${n}`,
              },
            ],
          }),
        }}
      />

      <nav className="text-xs text-ink-3">
        <Link href="/gesp" className="hover:text-ink">
          GESP 真题专区
        </Link>
        <span className="mx-1.5">/</span>
        <span>{meta.title}</span>
      </nav>

      <header className="space-y-3">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
          GESP{cn}级真题在线练习
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-ink-2">{meta.intro}</p>
        <div className="card p-5 space-y-3">
          <div>
            <p className="eyebrow mb-2">考纲要点</p>
            <div className="flex flex-wrap gap-1.5">
              {meta.points.map((p) => (
                <span key={p} className="rounded-md bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
                  {p}
                </span>
              ))}
            </div>
          </div>
          <p className="text-[13px] text-ink-3 leading-relaxed">
            <span className="text-ink-2 font-medium">适合人群：</span>
            {meta.audience}
          </p>
        </div>
      </header>

      <section>
        <div className="flex items-baseline justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold tracking-tight text-ink">
            GESP{cn}级历年真题（{papers.length} 套）
          </h2>
          <Link
            href={`/papers?cat=GESP&level=${n}`}
            className="text-[13px] font-medium text-ink-2 hover:text-ink transition-colors"
          >
            试卷库视图 →
          </Link>
        </div>
        {papers.length === 0 ? (
          <div className="card py-16 text-center space-y-2">
            <p className="code text-sm text-ink-3">no_papers_yet()</p>
            <p className="text-sm text-ink-3">
              {cn}级真题整理中，可先看{" "}
              <Link href="/papers?cat=GESP" className="text-ink underline underline-offset-2">
                全部 GESP 真题
              </Link>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {papers.map((p) => (
              <PaperCard key={p.slug} paper={p} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-wrap gap-2">
        {prev && (
          <Link href={`/gesp/level-${prev.level}`} className="btn btn-ghost btn-sm">
            ← GESP{CN_NUM[prev.level]}级真题
          </Link>
        )}
        {next && (
          <Link href={`/gesp/level-${next.level}`} className="btn btn-ghost btn-sm">
            GESP{CN_NUM[next.level]}级真题 →
          </Link>
        )}
        <Link href="/guides" className="btn btn-ghost btn-sm">
          备考指南
        </Link>
      </section>
    </div>
  );
}
