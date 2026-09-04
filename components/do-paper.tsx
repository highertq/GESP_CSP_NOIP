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
    if (item.type === "PROGRAM") return { cls: "bg-gray-50 text-gray-300 border-gray-100", label: "P" };
    let cls = answered
      ? "bg-blue-600 text-white border-blue-600"
      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300";
    if (flag) cls = answered ? "bg-amber-400 text-white border-amber-400" : "bg-amber-50 text-amber-600 border-amber-300";
    return { cls, label: String(item.seq) };
  };

  return (
    <div className="flex gap-6">
      {/* 题目主区 */}
      <div className="flex-1 min-w-0 space-y-4 pb-10">
        {/* 顶栏 */}
        <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-white/95 backdrop-blur border-b border-gray-100">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-bold text-gray-900 truncate">{bundle.title}</h1>
              <p className="text-xs text-gray-400">
                已答 {answeredCount}/{objectiveItems.length} · 未答 {objectiveItems.length - answeredCount}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`font-mono text-lg font-bold tabular-nums ${
                  remainingMs < 5 * 60_000 ? "text-red-500 animate-pulse" : "text-gray-800"
                }`}
              >
                {timeText}
              </span>
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={submitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? "判分中…" : "交卷"}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {/* 题流 */}
        {items.map((item, idx) => {
          const isSectionStart = idx === 0 || items[idx - 1].section !== item.section;
          return (
            <div key={item.id} ref={(el) => { itemRefs.current[idx] = el; }}>
              {isSectionStart && item.section && (
                <div className="pt-2 pb-1 text-sm font-bold text-blue-700">{item.section}</div>
              )}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-sm font-semibold text-gray-600">
                    {item.seq}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <TypeBadge type={item.type} />
                      <span className="text-xs text-gray-300">{item.score} 分</span>
                      {item.answersMissing && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">
                          此题官方暂无答案，交卷不计分
                        </span>
                      )}
                      {item.type !== "PROGRAM" && (
                        <button
                          onClick={() => setFlagged((f) => ({ ...f, [item.id]: !f[item.id] }))}
                          className={`ml-auto text-xs px-2 py-1 rounded-md border ${
                            flagged[item.id]
                              ? "border-amber-300 bg-amber-50 text-amber-600"
                              : "border-gray-200 text-gray-400 hover:text-amber-500"
                          }`}
                        >
                          {flagged[item.id] ? "已标记" : "标记"}
                        </button>
                      )}
                    </div>

                    {item.codeHtml && (
                      <details open className="mb-3 rounded-lg border border-gray-200 bg-gray-50">
                        <summary className="cursor-pointer select-none px-3 py-1.5 text-xs font-medium text-gray-500">
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
                        className="mt-3 w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    )}
                    {item.type === "PROGRAM" && (
                      <div className="mt-3 rounded-lg bg-rose-50 border border-rose-100 px-4 py-2.5 text-xs text-rose-600">
                        编程大题不参与判分：请复制题面到洛谷 / GESP OJ 等平台提交验证
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
            className="rounded-lg bg-blue-600 px-10 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? "判分中…" : "提交试卷"}
          </button>
        </div>
      </div>

      {/* 答题卡 */}
      <aside className="hidden lg:block w-44 shrink-0">
        <div className="sticky top-24 space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
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
            <div className="mt-3 flex items-center gap-3 text-[11px] text-gray-400">
              <span className="flex items-center gap-1">
                <i className="inline-block w-3 h-3 rounded bg-blue-600" /> 已答
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block w-3 h-3 rounded border border-gray-300 bg-white" /> 未答
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block w-3 h-3 rounded bg-amber-400" /> 标记
              </span>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            答题进度自动保存在本机，意外关闭页面后可继续作答；提交后清除。
          </div>
        </div>
      </aside>

      {/* 交卷确认 */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !submitting && setConfirmOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">确认交卷？</h3>
            <p className="mt-2 text-sm text-gray-500">
              已答 <b className="text-gray-900">{answeredCount}</b> / {objectiveItems.length} 题，
              {objectiveItems.length - answeredCount > 0 && (
                <>还有 <b className="text-red-500">{objectiveItems.length - answeredCount}</b> 题未作答。</>
              )}
              交卷后立即判分，成绩将保存到你的账号。
            </p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60"
              >
                继续答题
              </button>
              <button
                onClick={() => submit(false)}
                disabled={submitting}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
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
  const map: Record<ExamItem["type"], [string, string]> = {
    CHOICE: ["单选题", "bg-blue-50 text-blue-700 border-blue-100"],
    MULTI_CHOICE: ["多选题", "bg-violet-50 text-violet-700 border-violet-100"],
    JUDGE: ["判断题", "bg-amber-50 text-amber-700 border-amber-100"],
    FILL: ["填空题", "bg-emerald-50 text-emerald-700 border-emerald-100"],
    PROGRAM: ["编程题", "bg-rose-50 text-rose-700 border-rose-100"],
  };
  const [label, cls] = map[type];
  return <span className={`text-[11px] px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>;
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
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-blue-300"
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
              sel ? "border-blue-400 bg-blue-50" : "border-gray-100 hover:border-blue-200"
            }`}
          >
            <span
              className={`shrink-0 w-5 h-5 flex items-center justify-center rounded-full border text-[11px] font-bold ${
                sel ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 text-gray-400"
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
