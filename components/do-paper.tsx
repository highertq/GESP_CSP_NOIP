"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ExamBundle, ExamItem } from "@/lib/prepare-exam";

const STORE_KEY = (paperId: string) => `oj-do:${paperId}`;

type SavedState = { answers: Record<string, string>; flagged: Record<string, boolean>; deadline: number };

function loadSaved(paperId: string): SavedState | null {
  try {
    const raw = localStorage.getItem(STORE_KEY(paperId));
    if (!raw) return null;
    const s = JSON.parse(raw) as SavedState;
    if (!s.answers || typeof s.deadline !== "number") return null;
    return s;
  } catch {
    return null;
  }
}

export default function DoPaper({ bundle }: { bundle: ExamBundle }) {
  const router = useRouter();
  const { items, timeLimit } = bundle;
  const objectiveItems = useMemo(() => items.filter((i) => i.type !== "PROGRAM"), [items]);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [deadline, setDeadline] = useState<number>(() => Date.now() + timeLimit * 60_000);
  const [now, setNow] = useState<number>(Date.now());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const doneRef = useRef(false);
  const answersRef = useRef(answers);
  const deadlineRef = useRef(deadline);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  answersRef.current = answers;
  deadlineRef.current = deadline;

  // 断线续答：恢复上次状态（仅当未提交）
  useEffect(() => {
    const saved = loadSaved(bundle.paperId);
    if (!saved) return;
    if (saved.deadline > Date.now()) {
      setAnswers(saved.answers);
      setFlagged(saved.flagged);
      setDeadline(saved.deadline);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 状态持久化（断线续答）
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          STORE_KEY(bundle.paperId),
          JSON.stringify({ answers, flagged, deadline } satisfies SavedState),
        );
      } catch {
        /* 隐私模式等场景忽略 */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [answers, flagged, deadline, bundle.paperId]);

  // 倒计时
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, deadline - now);
  const mm = Math.floor(remainingMs / 60_000);
  const ss = Math.floor((remainingMs % 60_000) / 1000);
  const timeText = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

  const answeredCount = objectiveItems.filter((i) => (answers[i.id] ?? "").trim() !== "").length;

  const submit = useCallback(
    async (auto: boolean) => {
      if (doneRef.current) return;
      doneRef.current = true;
      setSubmitting(true);
      setError("");
      const payload = {
        paperId: bundle.paperId,
        durationSec: Math.max(0, Math.round((timeLimit * 60_000 - remainingMs) / 1000)),
        answers: answersRef.current,
      };
      try {
        const res = await fetch("/api/attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            localStorage.removeItem(STORE_KEY(bundle.paperId));
            router.replace(`/auth/login?next=/paper/${bundle.paperSlug}/do`);
            return;
          }
          doneRef.current = false;
          setSubmitting(false);
          setError(data.error || "交卷失败，请重试");
          return;
        }
        localStorage.removeItem(STORE_KEY(bundle.paperId));
        router.push(`/attempt/${data.data.attemptId}`);
      } catch {
        doneRef.current = false;
        setSubmitting(false);
        setError(auto ? "自动交卷失败，请检查网络后手动交卷" : "网络异常，交卷失败，请重试");
      }
    },
    [bundle.paperId, bundle.paperSlug, remainingMs, router, timeLimit],
  );

  // 到时自动交卷
  useEffect(() => {
    if (remainingMs <= 0 && !doneRef.current) {
      submit(true);
    }
  }, [remainingMs, submit]);

  function scrollTo(idx: number) {
    itemRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const btnState = (item: ExamItem): { cls: string; label: string } => {
    const answered = (answers[item.id] ?? "").trim() !== "";
    const flag = flagged[item.id];
    if (item.type === "PROGRAM")
      return { cls: "bg-surface-2 text-ink-4 border-line", label: "P" };
    let cls = answered
      ? "bg-ink text-white border-ink"
      : "bg-surface text-ink-4 border-line hover:border-ink/60 hover:text-ink";
    // 标记 = 黑边粗框：未答白底黑字；已答黑底 + 内侧白圈
    if (flag)
      cls = answered
        ? "bg-ink text-white border-ink shadow-[inset_0_0_0_1.5px_#fff]"
        : "bg-surface text-ink border-ink";
    return { cls, label: String(item.seq) };
  };

  return (
    <div className="flex gap-6">
      {/* 题目主区 */}
      <div className="flex-1 min-w-0 space-y-4 pb-10">
        {/* 顶栏 */}
        <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-surface/95 backdrop-blur border-b border-line">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-bold text-ink truncate">{bundle.title}</h1>
              <p className="text-xs text-ink-3">
                已答 {answeredCount}/{objectiveItems.length} · 未答 {objectiveItems.length - answeredCount}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`font-mono text-lg font-bold tabular-nums ${
                  remainingMs < 5 * 60_000 ? "text-err animate-pulse" : "text-ink"
                }`}
              >
                {timeText}
              </span>
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={submitting}
                className="btn btn-primary"
              >
                {submitting ? "判分中…" : "交卷"}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-err/25 bg-err-bg px-4 py-3 text-sm text-err">{error}</div>
        )}

        {/* 题流 */}
        {items.map((item, idx) => {
          const isSectionStart = idx === 0 || items[idx - 1].section !== item.section;
          return (
            <div key={item.id} ref={(el) => { itemRefs.current[idx] = el; }}>
              {isSectionStart && item.section && (
                <div className="pt-2 pb-1 text-sm font-bold text-ink">{item.section}</div>
              )}
              <div className="card p-5">
                <div className="flex items-start gap-2">
                  <span className="num shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-surface-2 text-sm font-semibold text-ink-2">
                    {item.seq}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <TypeBadge type={item.type} />
                      <span className="text-xs text-ink-4">{item.score} 分</span>
                      {item.answersMissing && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded border border-line bg-surface-2 text-ink-3">
                          此题官方暂无答案，交卷不计分
                        </span>
                      )}
                      {item.type !== "PROGRAM" && (
                        <button
                          onClick={() => setFlagged((f) => ({ ...f, [item.id]: !f[item.id] }))}
                          className={`ml-auto text-xs px-2 py-1 rounded-md border transition-colors ${
                            flagged[item.id]
                              ? "border-ink bg-surface-2 text-ink"
                              : "border-line text-ink-3 hover:border-ink/60 hover:text-ink"
                          }`}
                        >
                          {flagged[item.id] ? "已标记" : "标记"}
                        </button>
                      )}
                    </div>

                    {item.codeHtml && (
                      <details open className="mb-3 rounded-lg border border-line bg-surface-2">
                        <summary className="cursor-pointer select-none px-3 py-1.5 text-xs font-medium text-ink-2">
                          阅读程序代码（点击折叠）
                        </summary>
                        <div
                          className="px-3 pb-3 text-[13px] leading-relaxed overflow-x-auto"
                          dangerouslySetInnerHTML={{ __html: item.codeHtml }}
                        />
                      </details>
                    )}

                    <div className="md-body" dangerouslySetInnerHTML={{ __html: item.html }} />

                    {item.options && <QuestionOptions item={item} answers={answers} setAnswers={setAnswers} />}
                    {item.type === "FILL" && (
                      <input
                        value={answers[item.id] ?? ""}
                        onChange={(e) => setAnswers((a) => ({ ...a, [item.id]: e.target.value }))}
                        placeholder="输入答案后回车也可跳下一题…"
                        className="input mt-3 max-w-sm"
                      />
                    )}
                    {item.type === "PROGRAM" && (
                      <div className="mt-3 rounded-lg bg-surface-2 border border-line px-4 py-2.5 text-xs text-ink-2">
                        本题为编程题，请前往洛谷等在线评测平台提交（本站不做判分）。
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={submitting}
            className="btn btn-primary px-12 py-3"
          >
            {submitting ? "判分中…" : "提交试卷"}
          </button>
        </div>
      </div>

      {/* 答题卡 */}
      <aside className="hidden lg:block w-44 shrink-0">
        <div className="sticky top-24 space-y-4">
          <div className="card p-4">
            <div className="text-sm font-bold mb-3">答题卡</div>
            <div className="grid grid-cols-5 gap-1.5">
              {items.map((item, idx) => {
                const s = btnState(item);
                return (
                  <button
                    key={item.id}
                    onClick={() => item.type !== "PROGRAM" && scrollTo(idx)}
                    title={`第 ${item.seq} 题${flagged[item.id] ? "（已标记）" : ""}`}
                    className={`h-8 rounded-md text-xs font-semibold border transition-colors ${s.cls}`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-3 text-[11px] text-ink-3">
              <span className="flex items-center gap-1">
                <i className="inline-block w-3 h-3 rounded bg-ink" /> 已答
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block w-3 h-3 rounded border border-line-strong bg-surface" /> 未答
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block w-3 h-3 rounded border border-ink bg-surface" /> 标记
              </span>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-surface-2 p-3 text-xs text-ink-2">
            答题进度自动保存在本机，意外关闭页面后可继续作答；提交后清除。
          </div>
        </div>
      </aside>

      {/* 交卷确认 */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !submitting && setConfirmOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.3)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold tracking-tight">确认交卷？</h3>
            <p className="mt-2 text-sm text-ink-2">
              已答 <b className="num text-ink">{answeredCount}</b> / {objectiveItems.length} 题，
              {objectiveItems.length - answeredCount > 0 && (
                <>还有 <b className="text-err">{objectiveItems.length - answeredCount}</b> 题未作答。</>
              )}
              交卷后立即判分，成绩将保存到你的账号。
            </p>
            {error && <p className="mt-2 text-sm text-err">{error}</p>}
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
                className="btn btn-outline flex-1"
              >
                继续答题
              </button>
              <button
                onClick={() => submit(false)}
                disabled={submitting}
                className="btn btn-primary flex-1"
              >
                {submitting ? "判分中…" : "确认交卷"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TypeBadge({ type }: { type: ExamItem["type"] }) {
  const map: Record<ExamItem["type"], string> = {
    CHOICE: "单选题",
    MULTI_CHOICE: "多选题",
    JUDGE: "判断题",
    FILL: "填空题",
    PROGRAM: "编程题",
  };
  return (
    <span className="pill-code">{map[type] ?? "未知"}</span>
  );
}

function QuestionOptions({
  item,
  answers,
  setAnswers,
}: {
  item: ExamItem;
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const opts = item.options ?? [];
  const cur = answers[item.id] ?? "";
  const isMulti = item.type === "MULTI_CHOICE";
  const isJudge = item.type === "JUDGE";

  // 判断题直接渲染对/错两键
  if (isJudge) {
    const value = cur === "True" ? "True" : cur === "False" ? "False" : "";
    return (
      <div className="mt-3 flex gap-2">
        {(["True", "False"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setAnswers((a) => ({ ...a, [item.id]: value === v ? "" : v }))}
            className={`px-5 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              value === v
                ? "border-ink bg-ink text-white"
                : "border-line bg-surface text-ink-2 hover:border-line-strong"
            }`}
          >
            {v === "True" ? "对" : "错"}
          </button>
        ))}
      </div>
    );
  }

  function toggle(key: string) {
    setAnswers((a) => {
      const prev = a[item.id] ?? "";
      if (isMulti) {
        const set = new Set(prev.split("").filter((c) => c));
        if (set.has(key)) set.delete(key);
        else set.add(key);
        const sorted = [...set].sort().join("");
        return { ...a, [item.id]: sorted };
      }
      return { ...a, [item.id]: prev === key ? "" : key };
    });
  }

  const selectedSet = new Set(cur.split(""));
  return (
    <div className="mt-3 space-y-2">
      {opts.map((o) => {
        const sel = selectedSet.has(o.key);
        return (
          <div
            key={o.key}
            onClick={() => toggle(o.key)}
            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors ${
              sel ? "border-ink/30 bg-surface-2" : "border-line hover:border-line-strong"
            }`}
          >
            <span
              className={`num shrink-0 w-5 h-5 flex items-center justify-center rounded-full border text-[11px] font-bold ${
                sel ? "border-ink bg-ink text-white" : "border-line-strong text-ink-3"
              }`}
            >
              {isMulti && sel ? "✓" : o.key}
            </span>
            <div className="flex-1 min-w-0 md-body" dangerouslySetInnerHTML={{ __html: o.html }} />
          </div>
        );
      })}
    </div>
  );
}
