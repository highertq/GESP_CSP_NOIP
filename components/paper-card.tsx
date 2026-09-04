import Link from "next/link";
import { categoryLabel } from "@/lib/constants";

export type PaperCardData = {
  slug: string;
  title: string;
  category: string;
  level: string | null;
  examDate: string | null;
  timeLimit: number;
  totalScore: number;
  _count?: { questions?: number };
};

export default function PaperCard({ paper }: { paper: PaperCardData }) {
  const qCount = paper._count?.questions ?? 0;
  return (
    <Link
      href={`/paper/${paper.slug}`}
      className="card card-hover p-4 sm:p-5 flex flex-col gap-3 group"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="pill-code">
          {categoryLabel(paper.category)}
          {paper.level ? ` · L${paper.level}` : ""}
        </span>
        {paper.examDate && (
          <span className="code text-[10.5px] text-ink-4 tracking-tight">{paper.examDate}</span>
        )}
      </div>
      <h3 className="text-[14.5px] font-semibold text-ink leading-snug line-clamp-2 flex-1">
        {paper.title}
      </h3>
      <div className="flex items-center justify-between gap-2">
        <p className="code text-[11.5px] text-ink-3 truncate">
          <span className="num text-ink-2">{qCount}</span> 题 ·{" "}
          <span className="num text-ink-2">{paper.timeLimit}</span> 分钟 ·{" "}
          <span className="num text-ink-2">{paper.totalScore}</span> 分
        </p>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-ink-3 shrink-0 -translate-x-1 opacity-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0 group-hover:opacity-100"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
