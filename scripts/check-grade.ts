import { gradeQuestion } from "../lib/grade";
import { prepareExam } from "../lib/prepare-exam";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // --- 判分器 ---
  const cases: [string, Parameters<typeof gradeQuestion>[0], string | null, boolean | null][] = [
    ["CHOICE 对", { type: "CHOICE", answer: "C", answersMissing: false }, "C", true],
    ["CHOICE 错", { type: "CHOICE", answer: "C", answersMissing: false }, "D", false],
    ["MULTI 乱序", { type: "MULTI_CHOICE", answer: "ABD", answersMissing: false }, "DBA", true],
    ["MULTI 缺项", { type: "MULTI_CHOICE", answer: "ABD", answersMissing: false }, "AB", false],
    ["JUDGE 中文对", { type: "JUDGE", answer: "True", answersMissing: false }, "对", true],
    ["JUDGE 符号错", { type: "JUDGE", answer: "False", answersMissing: false }, "√", false],
    ["FILL 大小写/空白", { type: "FILL", answer: "Apple", answersMissing: false }, " apple ", true],
    ["空答算错", { type: "CHOICE", answer: "A", answersMissing: false }, "", false],
    ["缺答案不计", { type: "JUDGE", answer: null, answersMissing: true }, "True", null],
    ["PROGRAM 不计", { type: "PROGRAM", answer: null, answersMissing: false }, "x", null],
  ];
  let pass = 0;
  for (const [name, q, given, exp] of cases) {
    const r = gradeQuestion(q, given);
    const ok = r.correct === exp;
    if (ok) pass++;
    console.log((ok ? "PASS " : "FAIL ") + name + ": " + r.correct + " (" + r.reason + ")");
  }
  console.log("判分 " + pass + "/" + cases.length + "\n");

  // --- 代码分组 ---
  const paper = await prisma.paper.findUnique({
    where: { slug: "csp-j-2024" },
    include: { questions: { orderBy: { seq: "asc" } } },
  });
  if (!paper) throw new Error("no paper");
  const bundle = await prepareExam(paper, paper.questions);
  console.log(
    "items=" + bundle.items.length +
    " objective=" + bundle.objectiveCount +
    " program=" + bundle.programCount +
    " maxObjScore=" + bundle.maxObjectiveScore,
  );
  const codeSeqs = bundle.items.filter((i) => i.codeHtml).map((i) => i.seq);
  console.log("codeHtml 所在 seq: " + codeSeqs.join(",") + " (期望 16,21,27,33,38)");
  const codeDup = bundle.items.filter((i) => i.type !== "PROGRAM" && i.html.includes("<pre>")).map((i) => i.seq);
  console.log("html 残留 <pre> 的题: " + (codeDup.length ? codeDup.join(",") : "无(去重成功)"));
}
main().finally(() => prisma.$disconnect());
