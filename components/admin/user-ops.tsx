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

  if (isSelf) return <span className="text-xs text-gray-300">（自己）</span>;

  return (
    <div className="flex gap-1.5">
      <button
        onClick={() => act({ userId, role: role === "ADMIN" ? "USER" : "ADMIN" })}
        disabled={busy}
        className={`px-2 py-1 rounded-md text-[11px] border disabled:opacity-60 ${
          role === "ADMIN"
            ? "border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
            : "border-gray-200 text-gray-500 hover:bg-gray-50"
        }`}
      >
        {role === "ADMIN" ? "管理员(降为普通)" : "设为管理员"}
      </button>
      <button
        onClick={() => act({ userId, disabled: !disabled })}
        disabled={busy}
        className={`px-2 py-1 rounded-md text-[11px] border disabled:opacity-60 ${
          disabled
            ? "border-green-200 text-green-600 hover:bg-green-50"
            : "border-red-200 text-red-500 hover:bg-red-50"
        }`}
      >
        {disabled ? "解禁" : "禁用"}
      </button>
    </div>
  );
}
