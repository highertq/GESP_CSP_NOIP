"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function UserOps({
  userId,
  username,
  disabled,
  role,
  isSelf,
}: {
  userId: string;
  username: string;
  disabled: boolean;
  role: string;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(payload: { userId: string; disabled?: boolean; role?: string }) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) router.refresh();
      else alert(data.error || "操作失败");
    } finally {
      setBusy(false);
    }
  }

  if (isSelf) return <span className="text-xs text-ink-4">（自己）</span>;

  return (
    <div className="flex gap-1.5">
      <button
        onClick={() => act({ userId, role: role === "ADMIN" ? "USER" : "ADMIN" })}
        disabled={busy}
        className={`px-2 py-1 rounded-md text-[11px] border disabled:opacity-60 ${
          role === "ADMIN"
            ? "border-line bg-surface-2 text-ink hover:bg-surface-2"
            : "border-line text-ink-2 hover:bg-surface-2"
        }`}
      >
        {role === "ADMIN" ? "管理员(降为普通)" : "设为管理员"}
      </button>
      <button
        onClick={() => act({ userId, disabled: !disabled })}
        disabled={busy}
        className={`px-2 py-1 rounded-md text-[11px] border disabled:opacity-60 ${
          disabled
            ? "border-ok/30 text-ok hover:bg-ok-bg"
            : "border-err/30 text-err hover:bg-err-bg"
        }`}
      >
        {disabled ? "解禁" : "禁用"}
      </button>
    </div>
  );
}
