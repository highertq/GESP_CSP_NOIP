import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { categoryLabel } from "@/lib/constants";
import { prepareExam } from "@/lib/prepare-exam";
import DoPaper from "@/components/do-paper";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const paper = await prisma.paper.findUnique({
    where: { slug },
    select: { title: true, category: true, level: true },
  });
  if (!paper) return { title: "试卷不存在" };
  const cat = categoryLabel(paper.category);
  return {
    title: `整卷模拟：${paper.title} - ${cat}${paper.level ? ` ${paper.level}级` : ""}`,
    description: `计时整卷模拟作答「${paper.title}」，交卷即时判分并自动沉淀错题本。`,
    robots: { index: false, follow: true },
  };
}

export default async function PaperDoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?next=/paper/${encodeURIComponent(slug)}/do`);
  }

  const paper = await prisma.paper.findUnique({
    where: { slug },
    include: { questions: { orderBy: { seq: "asc" } } },
  });
  if (!paper || !paper.published) redirect("/papers");

  const bundle = await prepareExam(paper, paper.questions);

  return (
    <div>
      <DoPaper bundle={bundle} />
    </div>
  );
}
