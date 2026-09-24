import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { jsonOk, jsonFail } from "@/lib/api";
import { z } from "zod";

// 题库解析维护（管理端）：
//   action=list → 按试卷 slug 拉题目清单（含现有解析）
//   action=save → 保存单题解析（Markdown，空串 = 清空）

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const listSchema = z.object({ action: z.literal("list"), paperSlug: z.string().min(1) });
const saveSchema = z.object({
  action: z.literal("save"),
  questionId: z.string().min(1),
  explanation: z.string().max(8000),
});
const bodySchema = z.discriminatedUnion("action", [listSchema, saveSchema]);

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return jsonFail(auth.error.message, auth.error.status);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonFail("请求体不是合法 JSON");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonFail("参数不合法");

  if (parsed.data.action === "list") {
    const paper = await prisma.paper.findUnique({ where: { slug: parsed.data.paperSlug }, select: { id: true, title: true } });
    if (!paper) return jsonFail("试卷不存在", 404);
    const questions = await prisma.question.findMany({
      where: { paperId: paper.id },
      orderBy: { seq: "asc" },
      select: { id: true, seq: true, type: true, score: true, answersMissing: true, explanation: true, content: true },
    });
    return jsonOk({
      paperTitle: paper.title,
      questions: questions.map((q) => ({
        id: q.id,
        seq: q.seq,
        type: q.type,
        score: q.score,
        answersMissing: q.answersMissing,
        explanation: q.explanation ?? "",
        preview: q.content.slice(0, 160),
      })),
    });
  }

  // save
  const { questionId, explanation } = parsed.data;
  const q = await prisma.question.findUnique({ where: { id: questionId }, select: { id: true } });
  if (!q) return jsonFail("题目不存在", 404);
  await prisma.question.update({
    where: { id: questionId },
    data: { explanation: explanation.trim() || null },
  });
  return jsonOk({ questionId, saved: true });
}
