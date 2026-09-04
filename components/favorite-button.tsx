"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// 收藏切换按钮（★）。未登录点击跳登录。
export default function FavoriteButton({
  questionId,
  initial,
  size = "md",
}: {
  questionId: string;
  initial: boolean;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [fav, setFav] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/favorites/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      if (res.status === 401) {
        router.push(`/auth/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const data = await res.json();
      if (res.ok) setFav(data.data.favored);
    } finally {
      setBusy(false);
    }
  }

  const base =
    size === "sm"
      ? "px-2 py-1 text-xs rounded-md border"
      : "px-2.5 py-1 text-sm rounded-lg border";
  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={fav ? "取消收藏" : "收藏本题"}
      className={`${base} transition-colors ${
        fav
          ? "border-line-strong bg-surface-2 text-ink"
          : "border-line text-ink-3 hover:text-ink hover:border-line-strong"
      }`}
    >
      {fav ? "★ 已收藏" : "☆ 收藏"}
    </button>
  );
}
