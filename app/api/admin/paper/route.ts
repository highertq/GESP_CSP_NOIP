import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { jsonOk, jsonFail } from "@/lib/api";
import { z } from "zod";

// 试卷上/下线（管理端）

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ paperId: z.string().min(1), published: z.boolean() });

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

  const { paperId, published } = parsed.data;
  const exists = await prisma.paper.findUnique({ where: { id: paperId }, select: { id: true } });
  if (!exists) return jsonFail("试卷不存在", 404);

  await prisma.paper.update({ where: { id: paperId }, data: { published } });
  return jsonOk({ paperId, published });
}
