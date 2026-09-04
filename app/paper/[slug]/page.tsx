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
      <nav className="text-xs text-ink-3">
        <Link href="/papers" className="hover:text-ink">
          试卷库
        </Link>
        <span className="mx-1.5">/</span>
        <span>{categoryLabel(paper.category)}</span>
      </nav>

      <section className="card p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="pill-code">
            {categoryLabel(paper.category)}
            {paper.level ? ` ${paper.level}级` : ""}
          </span>
          {paper.examDate && <span className="text-ink-3">{paper.examDate}</span>}
        </div>
        <h1 className="mt-3 text-2xl font-bold text-ink">{paper.title}</h1>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          {[
            ["题量", `${paper.questions.length} 题`],
            ["客观题", `${bundle.objectiveCount} 题`],
            ["建议时长", `${paper.timeLimit} 分钟`],
            ["卷面总分", `${paper.totalScore} 分`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-surface-2 py-3">
              <div className="text-xs text-ink-3">{k}</div>
              <div className="text-lg font-semibold text-ink mt-0.5">{v}</div>
            </div>
          ))}
        </div>
        {paper.desc && <p className="mt-4 text-sm text-ink-2">{paper.desc}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href={`/paper/${paper.slug}/do`}
            className="btn btn-primary"
          >
            开始整卷模拟
          </Link>
          <span className="text-xs text-ink-3">计时作答 · 交卷即时判分 · 错题自动进错题本（需登录）</span>
          {bundle.programCount > 0 && (
            <span className="w-full text-xs text-ink-3">
              含 {bundle.programCount} 道编程大题：在线只判客观题，编程题请自行前往洛谷等 OJ 提交验证
            </span>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="eyebrow mb-1.5">
            <span className="text-ink/30">// </span>questions
          </p>
          <h2 className="text-xl sm:text-[22px] font-bold tracking-tight text-ink">题目预览</h2>
        </div>
        {items.map((item, idx) => {
          const isSectionStart = idx === 0 || items[idx - 1].section !== item.section;
          return (
            <div key={item.id} id={`q-${item.seq}`} className="card p-5">
              {isSectionStart && item.section && (
                <div className="-mt-2 mb-3 text-xs font-semibold text-ink-2 border-b border-line pb-2">
                  {item.section}
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-surface-2 text-sm font-semibold text-ink-2">
                  {item.seq}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <TypeBadge type={item.type} />
                    <span className="text-xs text-ink-4">{item.score} 分</span>
                  </div>

                  {item.codeHtml && (
                    <details open className="mb-3 rounded-lg border border-line bg-surface-2">
                      <summary className="cursor-pointer select-none px-3 py-1.5 text-xs font-medium text-ink-2">
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
                          className="flex items-start gap-2.5 rounded-lg border border-line px-3 py-2"
                        >
                          <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-ink-2">
                            {o.key}
                          </span>
                          <div className="flex-1 min-w-0 md-body" dangerouslySetInnerHTML={{ __html: o.html }} />
                        </div>
                      ))}
                    </div>
                  )}

                  {item.type === "PROGRAM" && (
                    <div className="mt-3 rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-xs text-ink-2">
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
    CHOICE: ["单选题", "bg-surface-2 text-ink-2 border-line"],
    MULTI_CHOICE: ["多选题", "bg-surface-2 text-ink-2 border-line"],
    JUDGE: ["判断题", "bg-surface-2 text-ink-2 border-line"],
    FILL: ["填空题", "bg-surface-2 text-ink-2 border-line"],
    PROGRAM: ["编程题", "bg-surface-2 text-ink-2 border-line"],
  };
  const [label, cls] = map[type] ?? ["未知", "bg-surface-2 text-ink-2 border-line"];
  return <span className={`text-[11px] px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>;
}
