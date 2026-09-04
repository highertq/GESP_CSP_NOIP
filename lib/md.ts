import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import type { Schema } from "hast-util-sanitize";

// KaTeX 输出依赖 class；放行 className 不会引入 XSS（无 style/事件注入）
const schema: Schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": ["className", "aria-hidden"],
    code: [["className", /^language-/], "className"],
    a: ["href", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    input: ["type", "checked", "disabled"],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ["http", "https", "/"],
    href: ["http", "https", "/", "#"],
  },
};

export async function renderMarkdown(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeKatex)
    .use(rehypeSanitize, schema)
    .use(rehypeStringify)
    .process(md);
  return String(file);
}

/** 提取题干最前部的代码块原文（用于"阅读程序"连续子题去重折叠） */
export function extractLeadingCodeFence(content: string): string | null {
  const m = content.match(/^```[\s\S]*?```\n?/);
  return m ? m[0].trim() : null;
}
