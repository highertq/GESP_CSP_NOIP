import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { categoryLabel } from "@/lib/constants";
import { prepareExam } from "@/lib/prepare-exam";
import type { ExamItem } from "@/lib/prepare-exam";

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

const TYPE_LABEL: Record<ExamItem["type"], string> = {
  CHOICE: "单选题",
  MULTI_CHOICE: "多选题",
  JUDGE: "判断题",
  FILL: "填空题",
  PROGRAM: "编程题",
};

// 按 section（无 section 归为 null）聚合题型结构清单
type SectionRow = { section: string | null; byType: { type: ExamItem["type"]; count: number }[] };
function buildStructure(items: ExamItem[]): SectionRow[] {
  const rows: SectionRow[] = [];
  for (const it of items) {
    let row = rows.find((r) => r.section === it.section);
    if (!row) {
      row = { section: it.section, byType: [] };
      rows.push(row);
    }
    const t = row.byType.find((b) => b.type === it.type);
    if (t) t.count++;
    else row.byType.push({ type: it.type, count: 1 });
  }
  return rows;
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
  const structure = buildStructure(items);
  const programRows = items.filter((i) => i.type === "PROGRAM");
  const hasLuogu = programRows.some((i) => i.externalUrl);

  return (
    <div className="space-y-5">
      <nav className="text-xs text-ink-3">
        <Link href="/papers" className="hover:text-ink">
          试卷库
        </Link>
        <span className="mx-1.5">/</span>
        <span>{categoryLabel(paper.category)}</span>
      </nav>

      {/* 信息卡 */}
      <section className="card p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="pill-code">
            {categoryLabel(paper.category)}
            {paper.level ? ` ${paper.level}级` : ""}
          </span>
          {paper.examDate && <span className="text-ink-3">{paper.examDate}</span>}
        </div>
        <h1 className="mt-3 text-2xl font-bold text-ink">{paper.title}</h1>
        {paper.desc && <p className="mt-3 text-sm text-ink-2">{paper.desc}</p>}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
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
      </section>

      {/* 卷面结构 */}
      <section className="card p-6">
        <p className="eyebrow mb-3">
          <span className="text-ink/30">// </span>structure
        </p>
        <ul className="space-y-2.5">
          {structure.map((row, idx) => (
            <li key={idx} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
              {row.section ? (
                <span className="font-semibold text-ink">{row.section}</span>
              ) : (
                <span className="font-semibold text-ink">卷面题目</span>
              )}
              <span className="flex flex-wrap gap-1.5">
                {row.byType.map((t) => (
                  <span key={t.type} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-2">
                    {TYPE_LABEL[t.type]} {t.count} 题
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
        {bundle.programCount > 0 && (
          <p className="mt-3 rounded-lg bg-surface-2 border border-line px-3 py-2 text-xs text-ink-2">
            {hasLuogu
              ? "编程大题提供「洛谷原题」跳转链接（官方真题，可在线提交验证判分）。"
              : "编程大题为模拟卷自编题，暂无洛谷原题，请按题面自写代码验证。"}
          </p>
        )}
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-line bg-surface-2/60 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-ink">开始整卷模拟</p>
          <p className="mt-0.5 text-xs text-ink-3">计时作答 · 交卷即时判分 · 错题自动进错题本（需登录）</p>
        </div>
        <Link
          href={`/paper/${paper.slug}/do`}
          className="btn btn-primary px-8 py-3 text-[15px] shrink-0"
        >
          开始答题
        </Link>
      </section>
    </div>
  );
}
