import fs from "node:fs";
import path from "node:path";
import { renderMarkdown } from "@/lib/md";

export type GuideMeta = {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  date: string;
  updated?: string;
  /** frontmatter 中的 FAQ（faq-q1/faq-a1 ... faq-q4/faq-a4），用于 FAQPage 结构化数据 */
  faqs: { q: string; a: string }[];
};

export type Guide = GuideMeta & { html: string };

const GUIDES_DIR = path.join(process.cwd(), "content", "guides");

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z0-9-]+):\s*(.*)$/);
    if (kv) data[kv[1].trim()] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return { data, body: m[2] };
}

function toGuideMeta(slug: string, data: Record<string, string>): GuideMeta {
  const faqs: { q: string; a: string }[] = [];
  for (let i = 1; i <= 4; i++) {
    const q = data[`faq-q${i}`];
    const a = data[`faq-a${i}`];
    if (q && a) faqs.push({ q, a });
  }
  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    keywords: (data.keywords ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
    date: data.date ?? "2026-09-01",
    updated: data.updated,
    faqs,
  };
}

export function listGuideMetas(): GuideMeta[] {
  if (!fs.existsSync(GUIDES_DIR)) return [];
  return fs
    .readdirSync(GUIDES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const slug = f.replace(/\.md$/, "");
      const { data } = parseFrontmatter(fs.readFileSync(path.join(GUIDES_DIR, f), "utf-8"));
      return toGuideMeta(slug, data);
    })
    .sort((a, b) => (b.updated ?? b.date).localeCompare(a.updated ?? a.date));
}

export async function getGuide(slug: string): Promise<Guide | null> {
  const file = path.join(GUIDES_DIR, `${slug}.md`);
  if (!file.startsWith(GUIDES_DIR) || !fs.existsSync(file)) return null;
  const { data, body } = parseFrontmatter(fs.readFileSync(file, "utf-8"));
  return { ...toGuideMeta(slug, data), html: await renderMarkdown(body) };
}

export function guideSlugs(): string[] {
  if (!fs.existsSync(GUIDES_DIR)) return [];
  return fs
    .readdirSync(GUIDES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}
