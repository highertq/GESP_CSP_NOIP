import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { GESP_LEVELS } from "@/lib/gesp-levels";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "GESP真题专区 - 1-8级历年真题免费在线刷",
  description:
    "GESP 真题专区：中国计算机学会 CCF 编程能力等级认证 1-8 级历年初赛真题免费在线练习，按级别筛选，即时判分、错题本、整卷模拟计时，附 GESP 考试时间、报名流程与各级考纲解读。",
  alternates: { canonical: "/gesp" },
  openGraph: {
    title: "GESP真题专区 - 1-8级历年真题免费在线刷",
    description: "GESP 1-8 级历年真题免费在线刷：即时判分 + 错题本 + 整卷模拟，附考级备考指南。",
    type: "website",
  },
};

export default async function GespHubPage() {
  const cats = await prisma.paper.groupBy({
    by: ["level"],
    where: { published: true, category: "GESP" },
    _count: { _all: true },
  });
  const countBy = new Map(cats.map((c) => [c.level ?? "", c._count._all]));
  const total = [...countBy.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "GESP真题专区",
            description:
              "GESP 编程能力等级认证 1-8 级历年真题免费在线练习，按级别聚合，即时判分与整卷模拟。",
            inLanguage: "zh-CN",
          }),
        }}
      />

      <header className="space-y-3">
        <p className="eyebrow">
          <span className="text-ink/30">// </span>gesp-zone
        </p>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
          GESP 真题专区 · 1-8 级历年真题
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-ink-2">
          GESP（编程能力等级认证）由中国计算机学会 CCF 主办，是目前国内认可度最高的青少年编程考级之一，
          分 C++ 与图形化两个方向，每年 3、6、9、12 月各考一次。本站收录 GESP C++ 方向 1-8 级历年真题{" "}
          <strong className="text-ink num">{total}</strong> 套，全部免费在线刷：即时判分、错题自动沉淀、整卷模拟计时。
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href="/papers?cat=GESP" className="btn btn-primary btn-sm">
            查看全部 GESP 试卷
          </Link>
          <Link href="/guides/gesp-shi-shenme-kaoshi" className="btn btn-ghost btn-sm">
            GESP 是什么考试？
          </Link>
          <Link href="/guides/gesp-baoming-guanwang" className="btn btn-ghost btn-sm">
            报名流程
          </Link>
        </div>
      </header>

      <section>
        <h2 className="text-xl font-bold tracking-tight text-ink mb-4">按级别刷真题</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {GESP_LEVELS.map((l) => (
            <Link
              key={l.level}
              href={`/gesp/level-${l.level}`}
              className="card card-hover p-4 sm:p-5 flex flex-col gap-2 group"
            >
              <div className="flex items-center justify-between">
                <span className="code text-[11px] font-medium text-ink-3">L{l.level}</span>
                <span className="num text-[12px] text-ink-3">{countBy.get(String(l.level)) ?? 0} 套</span>
              </div>
              <div>
                <div className="text-[15px] font-semibold text-ink">{l.title}真题</div>
                <div className="mt-1 text-xs text-ink-3 line-clamp-2 leading-relaxed">{l.points.slice(0, 2).join(" · ")}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="max-w-3xl">
        <h2 className="text-xl font-bold tracking-tight text-ink mb-4">备考 GESP 常见问题</h2>
        <div className="divide-y divide-line">
          {[
            {
              q: "GESP 考试每年有几次？什么时候报名？",
              a: "GESP 一般每年 3、6、9、12 月各举办一次认证考试，报名时间通常在考前 3-4 周开放，需登录 CCF GESP 官网报名。具体时间安排见本站《GESP 考试时间》指南。",
            },
            {
              q: "GESP 各级别都考什么？",
              a: "1-4 级考察 C++ 基础语法（变量、分支循环、数组、函数递归），5-8 级递进考察数论、排序、数据结构（栈队列树图）与算法（贪心、二分、动态规划）。每个级别页均附考纲要点与对应真题。",
            },
            {
              q: "零基础先考几级？",
              a: "大多数学生从一级或二级起步：有图形化编程基础的可直接考二级；已系统学完 C++ 语法与数组的学生通常从三级起步。建议先用本站对应级别真题做一套模拟，正确率 70% 以上即可报考。",
            },
          ].map((f) => (
            <div key={f.q} className="py-4">
              <p className="text-[15px] font-semibold text-ink">{f.q}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
