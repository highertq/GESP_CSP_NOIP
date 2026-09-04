import { renderMarkdown } from "@/lib/md";

/** 服务端渲染题干/选项 Markdown（含 KaTeX/代码/图片），输出为静态 HTML */
export default async function Markdown({ source, className = "" }: { source: string; className?: string }) {
  const html = await renderMarkdown(source);
  return <div className={`md-body ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
