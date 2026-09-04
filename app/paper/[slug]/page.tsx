import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { categoryLabel, QTYPE_LABEL } from "@/lib/constants";
import Markdown from "@/components/markdown";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const paper = await prisma.paper.findUnique({
    where: { slug },
    select: { title: true, category: true, level: true, examDate: true, published: true },
  });
  if (!paper || !paper.published) return { title: "试卷不存在" };
  const cat = categoryLabel(paper.category);
  return {
    title: `${paper.title} - ${cat}${paper.level ? ` ${paper.level}级` : ""}信奥真题在线练习`,
    description: `${paper.title}（${paper.examDate ?? ""}）真题在线刷题：选择/判断/填空即时判分，附答案与错题本，信奥初赛备考练习。`,
  };
}

type QTypeKey = "CHOICE" | "MULTI_CHOICE" | "JUDGE" | "FILL" | "PROGRAM";
const TYPE_BADGE: Record<QTypeKey, string> = {
  CHOICE: "bg-blue-50 text-blue-700 border-blue-100",
  MULTI_CHOICE: "bg-violet-50 text-violet-700 border-violet-100",
  JUDGE: "bg-amber-50 text-amber-700 border-amber-100",
  FILL: "bg-emerald-50 text-emerald-700 border-emerald-100",
  PROGRAM: "bg-rose-50 text-rose-700 border-rose-100",
};

export default async function PaperDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const paper = await prisma.paper.findUnique({
    where: { slug },
    include: { questions: { orderBy: { seq: "asc" } } },
  });
  if (!paper || !paper.published) notFound();

  const objectiveCount = paper.questions.filter((q) => q.type !== "PROGRAM").length;
  const programCount = paper.questions.length - objectiveCount;
  const bySection: { section: string | null; start: number }[] = [];
  paper.questions.forEach((q, i) => {
    if (i === 0 || q.section !== paper.questions[i - 1].section) {
      bySection.push({ section: q.section, start: i });
    }
  });

  return (
    <div className="space-y-5">
      <nav className="text-xs text-gray-400">
        <Link href="/papers" className="hover:text-blue-600">
          试卷库
        </Link>
        <span className="mx-1.5">/</span>
        <span>{categoryLabel(paper.category)}</span>
      </nav>

      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium">
            {categoryLabel(paper.category)}
            {paper.level ? ` ${paper.level}级` : ""}
          </span>
          {paper.examDate && <span className="text-gray-400">{paper.examDate}</span>}
        </div>
        <h1 className="mt-3 text-2xl font-bold text-gray-900">{paper.title}</h1>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          {[
            ["题量", `${paper.questions.length} 题`],
            ["客观题", `${objectiveCount} 题`],
            ["建议时长", `${paper.timeLimit} 分钟`],
            ["卷面总分", `${paper.totalScore} 分`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-gray-50 py-3">
              <div className="text-xs text-gray-400">{k}</div>
              <div className="text-lg font-semibold text-gray-900 mt-0.5">{v}</div>
            </div>
          ))}
        </div>
        {paper.desc && <p className="mt-4 text-sm text-gray-500">{paper.desc}</p>}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            disabled
            title="整卷计时模拟功能即将上线"
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white opacity-60 cursor-not-allowed"
          >
            开始整卷模拟（开发中）
          </button>
          {programCount > 0 && (
            <span className="self-center text-xs text-gray-400">
              含 {programCount} 道编程大题：在线只判客观题，编程题请自行前往洛谷等 OJ 提交验证
            </span>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">题目预览</h2>
        {paper.questions.map((q, i) => {
          const isSectionStart = bySection.some((s) => s.start === i);
          const section = bySection.find((s) => s.start === i);
          const options = Array.isArray(q.options) ? (q.options as { key: string; text: string }[]) : [];
          return (
            <div key={q.id} id={`q-${q.seq}`} className="bg-white border border-gray-200 rounded-xl p-5">
              {isSectionStart && section?.section && (
                <div className="-mt-2 mb-3 text-xs font-semibold text-blue-600 border-b border-blue-100 pb-2">
                  {section.section}
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-sm font-semibold text-gray-600">
                  {q.seq}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[11px] px-1.5 py-0.5 rounded border ${TYPE_BADGE[q.type as QTypeKey] ?? ""}`}>
                      {QTYPE_LABEL[q.type] ?? q.type}
                    </span>
                    <span className="text-xs text-gray-300">{q.score} 分</span>
                  </div>
                  <Markdown source={q.content} />

                  {options.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {options.map((o) => (
                        <div
                          key={o.key}
                          className="flex items-start gap-2.5 rounded-lg border border-gray-100 px-3 py-2"
                        >
                          <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                            {o.key}
                          </span>
                          <div className="flex-1 min-w-0">
                            <Markdown source={o.text} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type === "PROGRAM" && (
                    <div className="mt-3 rounded-lg bg-rose-50 border border-rose-100 px-4 py-2.5 text-xs text-rose-600">
                      本题为编程大题：请复制题面到洛谷 / GESP OJ 等平台编写并提交代码（本站不判分）
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
