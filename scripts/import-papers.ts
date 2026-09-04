/**
 * 从参考项目 github.com/sirwym/olympiad-practice-system 导入试卷数据
 *
 * 用法：
 *   npm run import                 # 全量（自动克隆/复用参考仓库）
 *   npm run import -- --paper 2024-06-gesp-1   # 只导一份
 *   npm run import -- --dry-run                 # 只做源数据体检，不写库
 *
 * 幂等：按 paper.slug 整卷替换，重复执行不会产生脏数据。
 * 质量：结束输出对账报告（数量/题型/空答案清单/图片缺失清单）。
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const DEFAULT_REF = path.join("/tmp", "olympiad-practice-system");
const LOCAL_REF = path.join(ROOT, ".data", "ref");
const REPO_URL = "https://github.com/sirwym/olympiad-practice-system.git";

type RawQ = {
  id: number;
  type: string;
  score: number;
  content: string;
  options?: { key: string; text: string }[];
  answer?: unknown;
  section?: string;
};

const CAT_MAP: Record<string, string> = {
  GESP: "GESP",
  "CSP-J": "CSP-J",
  "CSP-S": "CSP-S",
  "NCT-C++": "NCT-C++",
  "NCT-C++语言": "NCT-C++",
  NCTCPP: "NCT-C++",
  "NCT-KITTEN": "NCT-KITTEN",
  NCTKitten: "NCT-KITTEN",
  "其他赛事": "OTHER",
  NOC: "OTHER",
  河南科学素质: "OTHER",
};

const TYPE_MAP: Record<string, string> = {
  choice: "CHOICE",
  multi_choice: "MULTI_CHOICE",
  judge: "JUDGE",
  fill: "FILL",
  program: "PROGRAM",
};

function normJudge(v: string): string {
  const s = v.trim().toLowerCase();
  if (["true", "对", "正确", "t", "✓", "√", "yes", "y"].includes(s)) return "True";
  if (["false", "错", "错误", "f", "✗", "×", "x", "no", "n"].includes(s)) return "False";
  return v.trim();
}

function normAnswer(type: string, raw: unknown): { answer: string; missing: boolean } {
  const v = raw == null ? "" : String(raw).trim();
  if (type === "PROGRAM") return { answer: "", missing: true };
  if (!v) return { answer: "", missing: true };
  switch (type) {
    case "CHOICE":
      return { answer: v.toUpperCase(), missing: false };
    case "MULTI_CHOICE": {
      const letters = [...new Set(v.toUpperCase().replace(/[^A-Z]/g, "").split(""))].sort().join("");
      return { answer: letters, missing: letters.length === 0 };
    }
    case "JUDGE": {
      const a = normJudge(v);
      return { answer: a, missing: !["True", "False"].includes(a) };
    }
    default:
      return { answer: v, missing: false };
  }
}

function resolveRef(): string {
  const env = process.env.REF_DIR;
  if (env && fs.existsSync(env)) return env;
  if (fs.existsSync(DEFAULT_REF)) return DEFAULT_REF;
  if (fs.existsSync(LOCAL_REF)) return LOCAL_REF;
  console.log(`[import] 克隆参考仓库到 ${LOCAL_REF} ...`);
  fs.mkdirSync(path.dirname(LOCAL_REF), { recursive: true });
  execSync(`git clone --depth 1 ${REPO_URL} ${LOCAL_REF}`, { stdio: "inherit", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  return LOCAL_REF;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (k: string) => {
    const i = args.indexOf(`--${k}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return { paper: get("paper"), dry: args.includes("--dry-run") };
}

const CN_NUM: Record<string, string> = { 一: "1", 二: "2", 三: "3", 四: "4", 五: "5", 六: "6", 七: "7", 八: "8", 九: "9" };

/**
 * 源目录名 → ASCII slug。
 * 背景：Next.js 页面级动态路由无法匹配含中文的路径段（API 可以），
 * 且 ASCII slug 对 URL/SEO 更友好。中文一律落在 title/source 字段。
 */
function slugify(src: string): string {
  let m = src.match(/^gesp([一二三四五六七八九])级_卷(\d+)$/);
  if (m) return `gesp-${CN_NUM[m[1]]}-paper-${m[2]}`;
  m = src.match(/^nct-(cpp|kitten)-(\d+)-(C|K)(\d+)模拟卷(\d+)$/);
  if (m) return `nct-${m[1]}-${m[2]}-${(m[3] + m[4]).toLowerCase()}-mock-${m[5]}`;
  m = src.match(/^noc-kitten-([AB])卷-(中学|小学)$/);
  if (m) return `noc-kitten-${m[1].toLowerCase()}-${m[2] === "中学" ? "zhongxue" : "xiaoxue"}`;
  m = src.match(/^noc-kitten-练习卷([一二三])$/);
  if (m) return `noc-kitten-lianxi-${CN_NUM[m[1]]}`;
  const stripped = src
    .replace(/[^\x00-\x7f]+/g, "")
    .replace(/_+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return stripped || "paper";
}


async function main() {
  const { paper: onlyPaper, dry } = parseArgs();
  const refDir = resolveRef();
  const papersDir = path.join(refDir, "papers");
  const assetsDir = path.join(refDir, "assets", "images");
  const dirs = fs.readdirSync(papersDir).sort();

  const srcStats = new Map<string, number>();
  const emptyAnswer: { paper: string; seq: number; type: string }[] = [];
  const missingImages = new Map<string, number>();
  const errors: string[] = [];
  const usedSlugs = new Set<string>();
  let totalQ = 0;
  let copiedImages = 0;

  const targetPapers = onlyPaper ? dirs.filter((d) => d === onlyPaper) : dirs;
  if (onlyPaper && targetPapers.length === 0) {
    console.error(`[import] 未找到试卷目录: ${onlyPaper}`);
    process.exit(1);
  }

  for (const dir of targetPapers) {
    const file = path.join(papersDir, dir, "index.json");
    if (!fs.existsSync(file)) {
      errors.push(`缺 index.json: ${dir}`);
      continue;
    }
    let j: any;
    try {
      j = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
      errors.push(`JSON 解析失败: ${dir} ${(e as Error).message}`);
      continue;
    }

    const rawCat = String(j.category ?? "OTHER");
    const category = CAT_MAP[rawCat] ?? "OTHER";
    const level = /^\d+$/.test(String(j.level ?? "")) ? String(j.level) : null;

    const questions: {
      seq: number; type: string; section: string | null; score: number;
      content: string; options: unknown[]; answer: string; answersMissing: boolean;
    }[] = [];

    const list: RawQ[] = Array.isArray(j.questions) ? j.questions : [];
    const sorted = [...list].sort((a, b) => Number(a.id) - Number(b.id));
    for (let i = 0; i < sorted.length; i++) {
      const q = sorted[i];
      const type = TYPE_MAP[q.type] ?? "CHOICE";
      const { answer, missing } = normAnswer(type, q.answer);

      // 图片路径重写 + 拷贝
      let content = q.content ?? "";
      const imgRe = /!\[[^\]]*\]\(\.\.\/assets\/images\/([^)]+)\)/g;
      let m: RegExpExecArray | null;
      while ((m = imgRe.exec(content)) !== null) {
        const rel = m[1];
        const srcFile = path.join(assetsDir, rel);
        const destFile = path.join(PUBLIC_DIR, "assets", "images", rel);
        if (!fs.existsSync(srcFile)) {
          missingImages.set(rel, (missingImages.get(rel) ?? 0) + 1);
        } else if (!fs.existsSync(destFile)) {
          if (!dry) {
            fs.mkdirSync(path.dirname(destFile), { recursive: true });
            fs.copyFileSync(srcFile, destFile);
          }
          copiedImages += 1;
        }
      }
      content = content.replace(/\]\(\.\.\/assets\/images\//g, "](/assets/images/");

      questions.push({
        seq: i + 1,
        type,
        section: q.section ?? null,
        score: Number(q.score) || 0,
        content,
        options: q.options ?? [],
        answer,
        answersMissing: missing,
      });
      totalQ += 1;
      if (missing && type !== "PROGRAM") {
        emptyAnswer.push({ paper: dir, seq: i + 1, type });
      }
    }

    srcStats.set(category, (srcStats.get(category) ?? 0) + 1);

    if (dry) continue;

    // ASCII slug（唯一性保护，冲突时追加序号）
    let slug = slugify(dir);
    let n = 1;
    while (usedSlugs.has(slug)) slug = `${slugify(dir)}-${++n}`;
    usedSlugs.add(slug);

    const paperData = {
      slug,
      title: String(j.title ?? dir),
      category,
      level,
      examDate: j.date ? String(j.date) : null,
      timeLimit: Number(j.time_limit) || 120,
      totalScore: Number(j.total_score) || 100,
      desc: j.description ? String(j.description) : null,
      source: dir,
      published: true,
    };

    await prisma.$transaction(async (tx) => {
      const paper = await tx.paper.upsert({
        where: { slug },
        update: paperData,
        create: paperData,
      });
      await tx.question.deleteMany({ where: { paperId: paper.id } });
      const rows = questions.map((q, idx) => ({
        paperId: paper.id,
        seq: q.seq,
        type: q.type as Prisma.QuestionCreateManyInput["type"],
        section: q.section,
        score: q.score,
        content: q.content,
        options: q.options.length ? (q.options as Prisma.InputJsonValue) : Prisma.JsonNull,
        answer: q.answer,
        externalUrl: null,
        answersMissing: q.answersMissing,
        createdAt: new Date(Date.now() + idx), // 保序
      }));
      await tx.question.createMany({ data: rows });
    });
  }

  // ===== 对账报告 =====
  console.log("\n========== 导入报告 ==========");
  if (dry) {
    console.log("DRY-RUN：未写库。");
  }
  const dbPapers = await prisma.paper.count();
  const dbQs = await prisma.question.count();
  console.log(`源试卷目录: ${targetPapers.length}（本次）| 库内试卷总数: ${dbPapers}`);
  console.log(`源题目数: ${totalQ} | 库内题目总数: ${dbQs}`);
  console.log("分类分布(本次):", [...srcStats.entries()].map(([k, v]) => `${k}=${v}`).join(" "));

  const byType = await prisma.question.groupBy({ by: ["type"], _count: true });
  console.log("库内题型:", byType.map((t) => `${t.type}=${t._count}`).join(" "));

  if (emptyAnswer.length) {
    console.log(`\n⚠️ 空答案客观题 ${emptyAnswer.length} 条（不参与判分，仅展示）:`);
    emptyAnswer.slice(0, 20).forEach((e) => console.log(`   ${e.paper} #${e.seq} (${e.type})`));
    if (emptyAnswer.length > 20) console.log(`   ... 其余 ${emptyAnswer.length - 20} 条略`);
  } else {
    console.log("✅ 无空答案客观题");
  }

  if (missingImages.size) {
    console.log(`\n⚠️ 引用缺失的图片 ${missingImages.size} 类:`);
    [...missingImages.entries()].slice(0, 10).forEach(([k, v]) => console.log(`   ${k} x${v}`));
  } else {
    console.log(`✅ 图片引用完整，本次拷贝 ${copiedImages} 张`);
  }
  if (errors.length) {
    console.log(`\n❌ 处理失败 ${errors.length} 项:`);
    errors.slice(0, 10).forEach((e) => console.log(`   ${e}`));
  }
  console.log("============================");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
