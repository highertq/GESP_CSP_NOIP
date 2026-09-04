// 整卷/错题渲染预处理（服务端）
// 职责：把题目的 markdown 预渲染为已消毒 HTML；"阅读程序/完善程序"共享代码块按
// "同 section 内 leading fence 相同则去重，变化即新程序" 规则只展示一次。
// do 页与结果页共用，避免 client 端再引入一套 markdown 管线。

import { renderMarkdown, extractLeadingCodeFence } from "@/lib/md";

export type ExamItem = {
  id: string;
  seq: number;
  idx: number; // 卷内渲染下标（与题目预览顺序一致）
  type: "CHOICE" | "MULTI_CHOICE" | "JUDGE" | "FILL" | "PROGRAM";
  section: string | null;
  score: number;
  answersMissing: boolean;
  html: string; // 题干（程序首题已剥离共享代码）
  codeHtml?: string; // 共享代码（程序首题携带，client 折叠展示）
  options?: { key: string; html: string }[];
  externalUrl?: string | null; // PROGRAM 题洛谷原题链接（真题卷有值，模拟卷自编题无）
};

export type ExamBundle = {
  paperId: string;
  paperSlug: string;
  title: string;
  category: string;
  level: string | null;
  examDate: string | null;
  timeLimit: number;
  totalScore: number;
  objectiveCount: number;
  programCount: number;
  maxObjectiveScore: number; // 客观题总分（判分分母；缺答案题分不在此列）
  items: ExamItem[];
};

type QRow = {
  id: string;
  seq: number;
  type: string;
  section: string | null;
  score: number;
  content: string;
  options: unknown;
  answersMissing: boolean;
  externalUrl?: string | null;
};

export async function prepareExam(
  paper: {
    id: string;
    slug: string;
    title: string;
    category: string;
    level: string | null;
    examDate: string | null;
    timeLimit: number;
    totalScore: number;
  },
  questions: QRow[],
): Promise<ExamBundle> {
  const items: ExamItem[] = [];
  let lastSection: string | null = null;
  let lastCode: string | null = null; // 当前 section 内已展示过的共享代码

  for (const q of questions) {
    const type = q.type as ExamItem["type"];
    const sectionChanged = q.section !== lastSection;
    if (sectionChanged) {
      lastSection = q.section;
      lastCode = null; // 跨 section 不沿用代码
    }

    const optArr = Array.isArray(q.options)
      ? (q.options as { key: string; text: string }[])
      : [];

    const item: ExamItem = {
      id: q.id,
      seq: q.seq,
      idx: items.length,
      type,
      section: q.section,
      score: q.score,
      answersMissing: q.answersMissing,
      html: "",
      options: undefined,
      externalUrl: q.externalUrl ?? null,
    };

    if (type === "PROGRAM") {
      // 编程大题：题面完整展示（可能带说明性代码），不做去重/作答
      item.html = await renderMarkdown(q.content);
      items.push(item);
      continue;
    }

    const fence = extractLeadingCodeFence(q.content);
    if (fence) {
      const rest = q.content.slice(q.content.indexOf(fence) + fence.length);
      if (fence !== lastCode) {
        item.codeHtml = await renderMarkdown(fence);
        lastCode = fence;
      }
      item.html = await renderMarkdown(rest.trim());
    } else {
      item.html = await renderMarkdown(q.content);
    }

    if (optArr.length > 0) {
      const rendered: { key: string; html: string }[] = [];
      for (const o of optArr) {
        rendered.push({ key: o.key, html: await renderMarkdown(o.text) });
      }
      item.options = rendered;
    }
    items.push(item);
  }

  const objectiveItems = items.filter((i) => i.type !== "PROGRAM");
  const maxObjectiveScore = objectiveItems
    .filter((i) => !i.answersMissing)
    .reduce((s, i) => s + i.score, 0);

  return {
    paperId: paper.id,
    paperSlug: paper.slug,
    title: paper.title,
    category: paper.category,
    level: paper.level,
    examDate: paper.examDate,
    timeLimit: paper.timeLimit,
    totalScore: paper.totalScore,
    objectiveCount: objectiveItems.length,
    programCount: items.length - objectiveItems.length,
    maxObjectiveScore,
    items,
  };
}
