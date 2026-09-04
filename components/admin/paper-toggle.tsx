"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PaperToggle({ paperId, published }: { paperId: string; published: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId, published: !published }),
      });
      if (res.ok) router.refresh();
      else alert("操作失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`px-2.5 py-1 rounded-md text-xs font-medium border disabled:opacity-60 ${
        published
          ? "border-green-200 text-green-600 hover:bg-green-50"
          : "border-gray-300 text-gray-500 hover:bg-gray-100"
      }`}
    >
      {published ? "已上线 · 下线" : "已下线 · 上线"}
    </button>
  );
}
