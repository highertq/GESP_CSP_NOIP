import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { categoryLabel } from "@/lib/constants";
import { prepareExam } from "@/lib/prepare-exam";

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

  const bundle = await prepareExam(paper, paper.questions);
  const { items } = bundle;

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
            ["客观题", `${bundle.objectiveCount} 题`],
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
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href={`/paper/${paper.slug}/do`}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            开始整卷模拟
          </Link>
          <span className="text-xs text-gray-400">计时作答 · 交卷即时判分 · 错题自动进错题本（需登录）</span>
          {bundle.programCount > 0 && (
            <span className="w-full text-xs text-gray-400">
              含 {bundle.programCount} 道编程大题：在线只判客观题，编程题请自行前往洛谷等 OJ 提交验证
            </span>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">题目预览</h2>
        {items.map((item, idx) => {
          const isSectionStart = idx === 0 || items[idx - 1].section !== item.section;
          return (
            <div key={item.id} id={`q-${item.seq}`} className="bg-white border border-gray-200 rounded-xl p-5">
              {isSectionStart && item.section && (
                <div className="-mt-2 mb-3 text-xs font-semibold text-blue-600 border-b border-blue-100 pb-2">
                  {item.section}
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-sm font-semibold text-gray-600">
                  {item.seq}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <TypeBadge type={item.type} />
                    <span className="text-xs text-gray-300">{item.score} 分</span>
                  </div>

                  {item.codeHtml && (
                    <details open className="mb-3 rounded-lg border border-gray-200 bg-gray-50">
                      <summary className="cursor-pointer select-none px-3 py-1.5 text-xs font-medium text-gray-500">
                        阅读程序代码（共 {item.seq}-{groupLastSeq(items, idx)} 题共用）
                      </summary>
                      <div
                        className="px-3 pb-3 text-[13px] leading-relaxed overflow-x-auto"
                        dangerouslySetInnerHTML={{ __html: item.codeHtml }}
                      />
                    </details>
                  )}

                  <div className="md-body" dangerouslySetInnerHTML={{ __html: item.html }} />

                  {item.options && (
                    <div className="mt-3 space-y-2">
                      {item.options.map((o) => (
                        <div
                          key={o.key}
                          className="flex items-start gap-2.5 rounded-lg border border-gray-100 px-3 py-2"
                        >
                          <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                            {o.key}
                          </span>
                          <div className="flex-1 min-w-0 md-body" dangerouslySetInnerHTML={{ __html: o.html }} />
                        </div>
                      ))}
                    </div>
                  )}

                  {item.type === "PROGRAM" && (
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

/** 同一段共享代码覆盖到的最后一题 seq（用于折叠提示文案） */
function groupLastSeq(items: { seq: number; codeHtml?: string }[], idx: number): number {
  for (let i = idx + 1; i < items.length; i++) {
    if (items[i].codeHtml) return items[i - 1].seq;
  }
  return items[items.length - 1].seq;
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
