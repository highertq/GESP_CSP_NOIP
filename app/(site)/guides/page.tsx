import Link from "next/link";
import type { Metadata } from "next";
import { listGuideMetas } from "@/lib/guides";

export const metadata: Metadata = {
  title: "GESP备考指南 - 考试时间、报名流程、考纲与真题攻略",
  description:
    "GESP 备考指南专栏：GESP 是什么考试、报名官网入口、考试时间安排、级别划分、考级含金量、快速排序等高频考点精讲，配合历年真题在线练习，一站式搞定 GESP 考级。",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  const guides = listGuideMetas();
  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Blog",
            name: "曲奇编程 · GESP 备考指南",
            description: "GESP 考级备考文章：考试时间、报名流程、考纲解读、考点精讲。",
            inLanguage: "zh-CN",
          }),
        }}
      />

      <header className="space-y-3">
        <p className="eyebrow">
          <span className="text-ink/30">// </span>guides
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">GESP 备考指南</h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-ink-2">
          从「GESP 是什么考试」到快速排序考点精讲：报名、时间、级别、含金量，备考路上你想问的都在这里。
          看完文章，直接去
          <Link href="/gesp" className="text-ink font-medium underline underline-offset-2 mx-1">
            GESP 真题专区
          </Link>
          开刷。
        </p>
      </header>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {guides.map((g) => (
          <Link
            key={g.slug}
            href={`/guides/${g.slug}`}
            className="card card-hover p-5 flex flex-col gap-2 group"
          >
            <h2 className="text-[16px] font-semibold text-ink leading-snug">{g.title}</h2>
            <p className="text-[13px] leading-relaxed text-ink-3 line-clamp-3 flex-1">{g.description}</p>
            <div className="flex items-center justify-between text-[11px] text-ink-4">
              <span className="code">{g.updated ?? g.date}</span>
              <span className="code">阅读全文 →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
