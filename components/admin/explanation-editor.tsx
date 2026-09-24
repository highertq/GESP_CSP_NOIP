"use client";

import { useState } from "react";

type QRow = {
  id: string;
  seq: number;
  type: string;
  score: number;
  answersMissing: boolean;
  explanation: string;
  preview: string;
};

const TYPE_LABEL: Record<string, string> = {
  CHOICE: "单选",
  MULTI_CHOICE: "多选",
  JUDGE: "判断",
  FILL: "填空",
  PROGRAM: "编程",
};

export default function ExplanationEditor() {
  const [slug, setSlug] = useState("");
  const [paperTitle, setPaperTitle] = useState("");
  const [rows, setRows] = useState<QRow[]>([]);
  const [curId, setCurId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(e?: React.FormEvent) {
    e?.preventDefault();
    if (!slug.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", paperSlug: slug.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "加载失败");
        setRows([]);
        setPaperTitle("");
        return;
      }
      setPaperTitle(data.data.paperTitle);
      setRows(data.data.questions);
      setCurId(null);
      setText("");
    } finally {
      setBusy(false);
    }
  }

  function pick(r: QRow) {
    if (dirty && !confirm("当前题目解析未保存，确定切换？")) return;
    setCurId(r.id);
    setText(r.explanation);
    setDirty(false);
    setMsg("");
  }

  async function save() {
    if (!curId || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", questionId: curId, explanation: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "保存失败");
        return;
      }
      setRows((rs) => rs.map((r) => (r.id === curId ? { ...r, explanation: text } : r)));
      setDirty(false);
      setMsg("已保存");
    } finally {
      setBusy(false);
    }
  }

  const cur = rows.find((r) => r.id === curId) ?? null;
  const filled = rows.filter((r) => r.explanation.trim()).length;

  return (
    <section className="space-y-3">
      <p className="text-xs text-ink-3">
        按试卷 slug 维护题目解析（Markdown）。解析会展示在成绩单逐题回看与错题本卡片。
      </p>

      <form onSubmit={load} className="flex gap-2 max-w-md">
        <input
          className="input flex-1"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="试卷 slug，如 gesp-2024-06-1"
        />
        <button type="submit" disabled={busy} className="btn btn-outline shrink-0">
          加载题目
        </button>
      </form>

      {paperTitle && (
        <p className="text-xs text-ink-3">
          {paperTitle} · 共 {rows.length} 题 · 已有解析 {filled} 题
        </p>
      )}

      {rows.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="card divide-y divide-line max-h-[420px] overflow-y-auto">
            {rows.map((r) => (
              <button
                key={r.id}
                onClick={() => pick(r)}
                className={`w-full text-left px-3.5 py-2.5 text-sm hover:bg-surface-2 ${
                  curId === r.id ? "bg-surface-2" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">第 {r.seq} 题</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-2 border border-line text-ink-3">
                    {TYPE_LABEL[r.type] ?? r.type}
                  </span>
                  {r.explanation.trim() && (
                    <span className="text-[11px] text-ok">已有解析</span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-ink-3 truncate">{r.preview}</div>
              </button>
            ))}
          </div>

          <div className="card p-4 space-y-3">
            {cur ? (
              <>
                <div className="text-sm text-ink-2">
                  正在编辑：第 <b>{cur.seq}</b> 题（{TYPE_LABEL[cur.type] ?? cur.type} · {cur.score} 分）
                </div>
                <textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setDirty(true);
                  }}
                  rows={10}
                  placeholder="输入解析（Markdown）。清空并保存 = 删除解析。"
                  className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm font-mono outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
                />
                <div className="flex items-center gap-3">
                  <button onClick={save} disabled={busy || !dirty} className="btn btn-primary">
                    {busy ? "保存中…" : "保存解析"}
                  </button>
                  {msg && <span className="text-xs text-ink-3">{msg}</span>}
                  {dirty && !msg && <span className="text-xs text-err">未保存</span>}
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-3 py-8 text-center">左侧选择一道题开始编辑</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
