"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import FavoriteButton from "@/components/favorite-button";

export type WrongCardData = {
  questionId: string;
  seq: number;
  type: "CHOICE" | "MULTI_CHOICE" | "JUDGE" | "FILL" | "PROGRAM";
  score: number;
  answersMissing: boolean;
  html: string;
  options?: { key: string; html: string }[];
  paperTitle: string;
  paperSlug: string;
  wrongCount: number;
  favored: boolean;
  mastered: boolean;
};

type Result = {
  correct: boolean;
  answer: string;
  reason: string;
  streak: number;
  threshold: number;
  mastered: boolean;
};

export default function WrongCard({ card }: { card: WrongCardData }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  async function submit() {
    if (busy || (card.type !== "FILL" && !value)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: card.questionId, given: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "提交失败");
        return;
      }
      setResult(data.data as Result);
      if (data.data.mastered) {
        setTimeout(() => router.refresh(), 1400);
      }
    } finally {
      setBusy(false);
    }
  }

  async function stateAction(action: "master" | "unmaster" | "remove") {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      const res = await fetch("/api/wrong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: card.questionId, action }),
      });
      if (res.ok) router.refresh();
    } finally {
      setActionBusy(false);
    }
  }

  const optionDisabled = card.answersMissing;

  return (
    <div className="card p-5">
      <div className="flex items-start gap-2">
        <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-surface-2 text-sm font-semibold text-ink-2">
          {card.seq}
        </span>
        <div className="flex-1 min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <TypeBadge type={card.type} />
            <span className="text-xs text-ink-4">{card.score} 分</span>
            <span className="text-xs text-ink-3">
              出自
              <Link href={`/paper/${card.paperSlug}`} className="ml-1 text-ink hover:underline">
                {card.paperTitle}
              </Link>
            </span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-2 text-ink-2">
              累计答错 {card.wrongCount} 次
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <FavoriteButton questionId={card.questionId} initial={card.favored} size="sm" />
              {card.mastered ? (
                <>
                  <button
                    onClick={() => stateAction("unmaster")}
                    disabled={actionBusy}
                    className="px-2 py-1 text-xs rounded-md border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-60"
                  >
                    恢复未掌握
                  </button>
                  <button
                    onClick={() => stateAction("remove")}
                    disabled={actionBusy}
                    className="px-2 py-1 text-xs rounded-md border border-err/30 text-err hover:bg-err-bg disabled:opacity-60"
                  >
                    删除记录
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => stateAction("master")}
                    disabled={actionBusy}
                    className="px-2 py-1 text-xs rounded-md border border-ok/30 text-ok hover:bg-ok-bg disabled:opacity-60"
                  >
                    标为已掌握
                  </button>
                  <button
                    onClick={() => stateAction("remove")}
                    disabled={actionBusy}
                    className="px-2 py-1 text-xs rounded-md border border-line text-ink-3 hover:text-err hover:border-err/25 disabled:opacity-60"
                  >
                    移除
                  </button>
                </>
              )}
            </div>
          </div>

          {card.answersMissing && (
            <div className="mb-2 rounded border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink-2">
              官方暂无此题答案，只能收藏复习，无法判分。
            </div>
          )}

          <div className="md-body" dangerouslySetInnerHTML={{ __html: card.html }} />

          {card.options && (
            <div className="mt-3 space-y-2">
              {card.options.map((o) => (
                <OptionRow
                  key={o.key}
                  type={card.type}
                  optionKey={o.key}
                  html={o.html}
                  selected={value.includes(o.key)}
                  disabled={card.answersMissing}
                  onToggle={() => {
                    if (card.answersMissing) return;
                    setValue((v) => {
                      if (card.type === "MULTI_CHOICE") {
                        const s = new Set(v.split(""));
                        if (s.has(o.key)) s.delete(o.key);
                        else s.add(o.key);
                        return [...s].sort().join("");
                      }
                      return v === o.key ? "" : o.key;
                    });
                  }}
                />
              ))}
            </div>
          )}

          {card.type === "FILL" && (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={card.answersMissing}
              placeholder="输入你的答案…"
              className="mt-3 w-full max-w-sm rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
            />
          )}
          {card.type === "JUDGE" && (
            <div className="mt-3 flex gap-2">
              {["True", "False"].map((v) => (
                <button
                  key={v}
                  onClick={() => setValue(value === v ? "" : v)}
                  disabled={card.answersMissing}
                  className={`px-5 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
                    value === v
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-surface text-ink-2 hover:border-line-strong"
                  }`}
                >
                  {v === "True" ? "对" : "错"}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={submit}
              disabled={busy || card.answersMissing || (card.type !== "FILL" && !value)}
              className="btn btn-primary"
            >
              {busy ? "判分中…" : card.type === "FILL" ? "提交答案" : "提交判分"}
            </button>
            {!result && (
              <span className="text-xs text-ink-3">答对累计达标自动转「已掌握」并移出列表</span>
            )}
          </div>

          {result && <ResultBanner result={result} questionType={card.type} />}
        </div>
      </div>
    </div>
  );
}

function ResultBanner({ result, questionType }: { result: Result; questionType: WrongCardData["type"] }) {
  const fmt = (v: string) =>
    questionType === "JUDGE" ? (v === "True" ? "对" : v === "False" ? "错" : v) : v;
  return (
    <div
      className={`mt-3 rounded-lg border px-4 py-3 text-sm ${
        result.correct
          ? result.mastered
            ? "border-ink bg-ink text-white"
            : "border-ok/30 bg-ok-bg text-ok"
          : "border-err/30 bg-err-bg text-err"
      }`}
    >
      <div className="font-semibold">
        {result.correct ? (result.mastered ? "🎉 连续答对达标，本题已掌握并移出错题本！" : "答对啦！") : "答错了，再接再厉"}
      </div>
      <div className="mt-1">
        正确答案：<b>{fmt(result.answer)}</b>
        {!result.correct && result.streak === 0 && <span className="ml-2 text-xs opacity-80">连对中断，从 0 开始</span>}
        {result.correct && !result.mastered && (
          <span className="ml-2 text-xs opacity-80">
            已连续答对 {result.streak}/{result.threshold} 次，保持住
          </span>
        )}
      </div>
    </div>
  );
}

function OptionRow({
  type,
  optionKey,
  html,
  selected,
  disabled,
  onToggle,
}: {
  type: WrongCardData["type"];
  optionKey: string;
  html: string;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const isMulti = type === "MULTI_CHOICE";
  return (
    <div
      onClick={disabled ? undefined : onToggle}
      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors ${
        selected ? "border-ink/30 bg-surface-2" : "border-line hover:border-line-strong"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <span
        className={`shrink-0 w-5 h-5 flex items-center justify-center rounded-full border text-[11px] font-bold ${
          selected ? "border-ink bg-ink text-white" : "border-line-strong text-ink-3"
        }`}
      >
        {isMulti && selected ? "✓" : optionKey}
      </span>
      <div className="flex-1 min-w-0 md-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function TypeBadge({ type }: { type: WrongCardData["type"] }) {
  const map: Record<string, [string, string]> = {
    CHOICE: ["单选题", "bg-surface-2 text-ink-2 border-line"],
    MULTI_CHOICE: ["多选题", "bg-surface-2 text-ink-2 border-line"],
    JUDGE: ["判断题", "bg-surface-2 text-ink-2 border-line"],
    FILL: ["填空题", "bg-surface-2 text-ink-2 border-line"],
    PROGRAM: ["编程题", "bg-surface-2 text-ink-2 border-line"],
  };
  const [label, cls] = map[type] ?? ["未知", "bg-surface-2 text-ink-2 border-line"];
  return <span className={`text-[11px] px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>;
}
