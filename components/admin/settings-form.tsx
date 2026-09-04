"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const FIELDS: { key: string; label: string; hint: string; type: "text" | "number" }[] = [
  {
    key: "announcement",
    label: "全站公告",
    hint: "显示在首页顶部（空 = 不显示）",
    type: "text",
  },
  {
    key: "wrong_master_threshold",
    label: "错题掌握阈值",
    hint: "错题重练连续答对 N 次自动标为已掌握（1-10）",
    type: "number",
  },
];

export default function SettingsForm({ values }: { values: Record<string, string> }) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>({ ...values });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save(key: string) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: form[key] ?? "" }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(`「${key}」已保存`);
        router.refresh();
      } else {
        setMsg(data.error || "保存失败");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label className="block text-sm font-medium mb-1.5">
            {f.label}
            <span className="ml-2 text-xs text-ink-3 font-normal">{f.hint}</span>
          </label>
          <div className="flex gap-2">
            <input
              type={f.type}
              value={form[f.key] ?? ""}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              className="flex-1 rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
            />
            <button
              onClick={() => save(f.key)}
              disabled={busy}
              className="btn btn-primary"
            >
              保存
            </button>
          </div>
        </div>
      ))}
      {msg && <p className="text-sm text-ok">{msg}</p>}
    </div>
  );
}
