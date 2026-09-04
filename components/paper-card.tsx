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

const CAT_BADGE: Record<string, string> = {
  GESP: "bg-emerald-100 text-emerald-700",
  "CSP-J": "bg-blue-100 text-blue-700",
  "CSP-S": "bg-indigo-100 text-indigo-700",
  "NCT-C++": "bg-amber-100 text-amber-700",
  "NCT-KITTEN": "bg-pink-100 text-pink-700",
  OTHER: "bg-gray-100 text-gray-600",
};

export default function PaperCard({ paper }: { paper: PaperCardData }) {
  const qCount = paper._count?.questions ?? 0;
  return (
    <Link
      href={`/paper/${paper.slug}`}
      className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-shadow"
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${CAT_BADGE[paper.category] ?? CAT_BADGE.OTHER}`}
        >
          {categoryLabel(paper.category)}
          {paper.level ? ` ${paper.level}级` : ""}
        </span>
        {paper.examDate && (
          <span className="text-xs text-gray-400">{paper.examDate}</span>
        )}
      </div>
      <h3 className="font-medium text-gray-900 text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
        {paper.title}
      </h3>
      <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
        <span>{qCount} 题</span>
        <span>{paper.timeLimit} 分钟</span>
        <span>{paper.totalScore} 分</span>
      </div>
    </Link>
  );
}
