"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ExamBundle, ExamItem } from "@/lib/prepare-exam";
import LuoguBlock from "@/components/luogu-block";

const STORE_KEY = (paperId: string) => `oj-do:${paperId}`;

type SavedState = {
  answers: Record<string, string>;
  flagged: Record<string, boolean>;
  deadline: number;
  cur?: number; // 上次聚焦题
};

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

  const [cur, setCur] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [deadline, setDeadline] = useState<number>(() => Date.now() + timeLimit * 60_000);
  const [now, setNow] = useState<number>(Date.now());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const doneRef = useRef(false);
  const answersRef = useRef(answers);
  const deadlineRef = useRef(deadline);
  const mainRef = useRef<HTMLDivElement | null>(null);
  answersRef.current = answers;
  deadlineRef.current = deadline;

  // 进入加载态：短暂骨架后进入，避免本地续答恢复前闪烁
  useEffect(() => {
    const saved = loadSaved(bundle.paperId);
    if (saved) {
      if (saved.deadline > Date.now()) {
        setAnswers(saved.answers);
        setFlagged(saved.flagged);
        setDeadline(saved.deadline);
        if (typeof saved.cur === "number" && saved.cur >= 0 && saved.cur < items.length) {
          setCur(saved.cur);
        }
      }
    }
    const t = setTimeout(() => setMounted(true), 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 状态持久化（断线续答）
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          STORE_KEY(bundle.paperId),
          JSON.stringify({ answers, flagged, deadline, cur } satisfies SavedState),
        );
      } catch {
        /* 隐私模式等场景忽略 */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [answers, flagged, deadline, cur, bundle.paperId]);

  // 倒计时
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // 切题时回滚到顶
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [cur]);

  // 键盘快捷键（做题页全屏聚焦体验）
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (confirmOpen || leaveOpen || submitting) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft" && cur > 0) {
        e.preventDefault();
        setCur((c) => c - 1);
      } else if (e.key === "ArrowRight" && cur < items.length - 1) {
        e.preventDefault();
        setCur((c) => c + 1);
      } else if (e.key === "m" || e.key === "M") {
        const it = items[cur];
        if (it && it.type !== "PROGRAM") {
          setFlagged((f) => ({ ...f, [it.id]: !f[it.id] }));
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cur, items, confirmOpen, leaveOpen, submitting]);

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

  const goPrev = () => setCur((c) => Math.max(0, c - 1));
  const goNext = () => setCur((c) => Math.min(items.length - 1, c + 1));

  // 加载骨架
  if (!mounted) {
    return (
      <div className="flex-1 min-h-0 flex flex-col animate-pulse">
        <div className="h-14 border-b border-line bg-surface/80" />
        <div className="flex-1 min-h-0 flex">
          <aside className="hidden lg:flex w-56 border-r border-line" />
          <div className="flex-1 p-6 space-y-4">
            <div className="h-5 w-40 rounded bg-surface-2" />
            <div className="rounded-2xl border border-line bg-surface p-6 space-y-3">
              <div className="h-4 w-3/4 rounded bg-surface-2" />
              <div className="h-4 w-1/2 rounded bg-surface-2" />
              <div className="h-24 w-full rounded bg-surface-2/70" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const item = items[cur];
  const totalObjective = objectiveItems.length;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* 顶部计时条 */}
      <header className="h-14 shrink-0 border-b border-line bg-surface/95 backdrop-blur flex items-center gap-2 sm:gap-3 px-3 sm:px-4">
        <button
          onClick={() => setLeaveOpen(true)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
          title="返回试卷详情（进度自动保存）"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          <span className="hidden sm:inline">退出</span>
        </button>
        <div className="min-w-0 flex-1 flex items-center gap-2 sm:gap-3">
          <h1 className="font-semibold text-[13.5px] sm:text-sm text-ink truncate">{bundle.title}</h1>
          <span className="hidden md:inline text-xs text-ink-4">
            第 {item.seq} 题 / 共 {items.length} 题
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span className="hidden sm:inline text-xs text-ink-3 tabular-nums">
            已答 <b className="text-ink">{answeredCount}</b>/{totalObjective}
          </span>
          <span
            className={`font-mono text-base sm:text-lg font-bold tabular-nums ${
              remainingMs < 5 * 60_000 ? "text-err animate-pulse" : "text-ink"
            }`}
          >
            {timeText}
          </span>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={submitting}
            className="btn btn-primary !py-1.5 text-[13px]"
          >
            {submitting ? "判分中…" : "交卷"}
          </button>
        </div>
      </header>

      {/* 主体：左答题卡 + 右单题 */}
      <div className="flex-1 min-h-0 flex">
        {/* 答题卡（桌面侧栏） */}
        <aside className="hidden lg:flex w-56 shrink-0 border-r border-line bg-surface/60 flex-col">
          <div className="px-3 pt-3 pb-1.5 text-[11px] font-semibold text-ink-3 tracking-wide">答题卡</div>
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <div className="grid grid-cols-5 gap-1.5">
              {items.map((it, idx) => {
                const answered = (answers[it.id] ?? "").trim() !== "";
                const flag = flagged[it.id];
                let cls = "bg-surface text-ink-4 border-line";
                let label = String(it.seq);
                if (it.type === "PROGRAM") {
                  cls = "bg-surface-2 text-ink-3 border-line";
                  label = "编";
                } else if (answered) {
                  cls = flag
                    ? "bg-ink text-white border-ink shadow-[inset_0_0_0_1.5px_#fff]"
                    : "bg-ink text-white border-ink";
                } else if (flag) {
                  cls = "bg-surface text-ink border-ink";
                }
                const isCur = idx === cur;
                return (
                  <button
                    key={it.id}
                    onClick={() => setCur(idx)}
                    title={`第 ${it.seq} 题${flag ? "（已标记）" : ""}${answered ? "（已答）" : ""}`}
                    className={`h-8 rounded-md text-[11px] font-semibold border transition-all ${cls} ${
                      isCur ? "ring-2 ring-ink/40" : ""
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 space-y-2 text-[11px] text-ink-3">
              <div className="flex items-center gap-1.5">
                <i className="inline-block w-3 h-3 rounded bg-ink" /> 已答
              </div>
              <div className="flex items-center gap-1.5">
                <i className="inline-block w-3 h-3 rounded border border-line-strong bg-surface" /> 未答
              </div>
              <div className="flex items-center gap-1.5">
                <i className="inline-block w-3 h-3 rounded border border-ink bg-surface" /> 标记
              </div>
              <div className="flex items-center gap-1.5">
                <i className="inline-block w-3 h-3 rounded bg-surface-2 border border-line text-[9px] leading-none grid place-items-center">编</i>
                编程题（不判分）
              </div>
            </div>
          </div>
          <div className="border-t border-line px-3 py-2.5 text-[11px] text-ink-4 leading-relaxed">
            自动保存到本机 · ←/→ 切题 · M 标记
          </div>
        </aside>

        {/* 单题聚焦主区 */}
        <div ref={mainRef} className="flex-1 min-w-0 overflow-y-auto">
          {/* 窄屏答题卡条 */}
          <div className="lg:hidden sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-line px-3 py-2">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {items.map((it, idx) => {
                const answered = (answers[it.id] ?? "").trim() !== "";
                const flag = flagged[it.id];
                let cls = "bg-surface text-ink-4 border-line";
                if (it.type === "PROGRAM") cls = "bg-surface-2 text-ink-3 border-line";
                else if (answered) cls = flag ? "bg-ink text-white border-ink shadow-[inset_0_0_0_1px_#fff]" : "bg-ink text-white border-ink";
                else if (flag) cls = "bg-surface text-ink border-ink";
                return (
                  <button
                    key={it.id}
                    onClick={() => setCur(idx)}
                    className={`w-7 h-7 shrink-0 rounded-md text-[10px] font-semibold border transition-all ${cls} ${
                      idx === cur ? "ring-2 ring-ink/40" : ""
                    }`}
                  >
                    {it.type === "PROGRAM" ? "编" : it.seq}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
            {/* section 头 */}
            {item.section && (items[cur - 1]?.section !== item.section) && (
              <div className="mb-3 flex items-baseline gap-3">
                <span className="text-sm font-bold text-ink">{item.section}</span>
                <span className="text-xs text-ink-4">
                  本组第 {sectionPos(items, cur)} 题
                </span>
              </div>
            )}

            {/* 题目卡 */}
            <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="num w-8 h-8 flex items-center justify-center rounded-lg bg-ink text-white text-sm font-bold">
                  {item.seq}
                </span>
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
                    className={`ml-auto text-xs px-2.5 py-1 rounded-md border transition-colors ${
                      flagged[item.id]
                        ? "border-ink bg-ink text-white"
                        : "border-line text-ink-3 hover:border-ink/60 hover:text-ink"
                    }`}
                  >
                    {flagged[item.id] ? "已标记 ★" : "标记"}
                  </button>
                )}
              </div>

              {item.codeHtml && (
                <details open className="mb-4 rounded-xl border border-line bg-surface-2 overflow-hidden">
                  <summary className="cursor-pointer select-none px-3.5 py-2 text-xs font-medium text-ink-2 bg-surface-2/80">
                    阅读程序代码（点击折叠）
                  </summary>
                  <div
                    className="px-4 pb-3.5 pt-2 text-[13px] leading-relaxed overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: item.codeHtml }}
                  />
                </details>
              )}

              <div className="md-body" dangerouslySetInnerHTML={{ __html: item.html }} />

              {(item.options || item.type === "JUDGE") && (
                <QuestionOptions item={item} answers={answers} setAnswers={setAnswers} />
              )}
              {item.type === "FILL" && (
                <input
                  value={answers[item.id] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [item.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && cur < items.length - 1) {
                      e.preventDefault();
                      goNext();
                    }
                  }}
                  placeholder="输入答案，回车跳下一题"
                  className="input mt-4 max-w-sm"
                  autoFocus={false}
                />
              )}
              {item.type === "PROGRAM" && (
                <LuoguBlock externalUrl={item.externalUrl} />
              )}
            </div>

            {/* 底部切题 */}
            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                onClick={goPrev}
                disabled={cur === 0}
                className="btn btn-outline !py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← 上一题
              </button>
              <span className="text-xs text-ink-3 tabular-nums">
                {cur + 1} / {items.length}
              </span>
              {cur < items.length - 1 ? (
                <button onClick={goNext} className="btn btn-outline !py-2">
                  下一题 →
                </button>
              ) : (
                <button onClick={() => setConfirmOpen(true)} disabled={submitting} className="btn btn-primary !py-2">
                  完成交卷
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 交卷确认 */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !submitting && setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold tracking-tight">确认交卷？</h3>
            <p className="mt-2 text-sm text-ink-2">
              已答 <b className="num text-ink">{answeredCount}</b> / {totalObjective} 题，
              {totalObjective - answeredCount > 0 && (
                <>还有 <b className="text-err">{totalObjective - answeredCount}</b> 题未作答。</>
              )}
              交卷后立即判分，成绩将保存到你的账号。
            </p>
            {error && <p className="mt-2 text-sm text-err">{error}</p>}
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmOpen(false)} disabled={submitting} className="btn btn-outline flex-1">
                继续答题
              </button>
              <button onClick={() => submit(false)} disabled={submitting} className="btn btn-primary flex-1">
                {submitting ? "判分中…" : "确认交卷"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 退出确认 */}
      {leaveOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setLeaveOpen(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.3)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold tracking-tight">退出本次作答？</h3>
            <p className="mt-2 text-sm text-ink-2">进度已自动保存在本机，下次进入可继续；未交卷不会产生成绩。</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setLeaveOpen(false)} className="btn btn-outline flex-1">
                继续答题
              </button>
              <button
                onClick={() => router.push(`/paper/${bundle.paperSlug}`)}
                className="btn btn-primary flex-1"
              >
                保存并退出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 当前题在本 section 内的第几题 */
function sectionPos(items: ExamItem[], idx: number): number {
  let n = 0;
  for (let i = idx; i >= 0 && items[i].section === items[idx].section; i--) n++;
  return n;
}

function TypeBadge({ type }: { type: ExamItem["type"] }) {
  const map: Record<ExamItem["type"], string> = {
    CHOICE: "单选题",
    MULTI_CHOICE: "多选题",
    JUDGE: "判断题",
    FILL: "填空题",
    PROGRAM: "编程题",
  };
  return <span className="pill-code">{map[type] ?? "未知"}</span>;
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

  // 判断题直接渲染对/错两键（GESP 判断题 options 为 null，必须走这里）
  if (isJudge) {
    const value = cur === "True" ? "True" : cur === "False" ? "False" : "";
    return (
      <div className="mt-4 flex gap-2">
        {(["True", "False"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setAnswers((a) => ({ ...a, [item.id]: value === v ? "" : v }))}
            className={`px-6 py-2 rounded-lg border text-sm font-semibold transition-colors ${
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
    <div className="mt-4 space-y-2">
      {opts.map((o) => {
        const sel = selectedSet.has(o.key);
        return (
          <div
            key={o.key}
            onClick={() => toggle(o.key)}
            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3.5 py-2.5 transition-colors ${
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
