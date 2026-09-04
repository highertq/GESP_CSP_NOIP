"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const isLogin = mode === "login";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState<string | null>(null);

  // 支持 /auth/login?next=/paper/xxx/do 回跳
  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get("next");
    if (n && n.startsWith("/")) setNext(n);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${isLogin ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isLogin ? { username, password } : { username, password, nickname }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "操作失败，请重试");
        return;
      }
      router.replace(next ?? "/");
      router.refresh();
    } catch {
      setError("网络异常，请重试");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="max-w-sm mx-auto mt-10">
      <h1 className="text-xl font-bold text-center mb-1">
        {isLogin ? "登录" : "注册"}
      </h1>
      <p className="text-center text-sm text-gray-500 mb-6">
        {isLogin ? "登录后保存你的刷题记录与错题本" : "注册即送错题本 + 整卷模拟"}
      </p>
      <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">用户名</label>
          <input
            className={input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="字母/数字/下划线，3-20 位"
            autoComplete="username"
            required
          />
        </div>
        {!isLogin && (
          <div>
            <label className="block text-sm font-medium mb-1.5">昵称（可选）</label>
            <input
              className={input}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="展示用昵称，默认同用户名"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1.5">密码</label>
          <input
            className={input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isLogin ? "请输入密码" : "至少 6 位"}
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? "请稍候…" : isLogin ? "登 录" : "注 册"}
        </button>
      </form>
      <p className="text-center text-sm text-gray-500 mt-4">
        {isLogin ? (
          <>
            还没有账号？{" "}
            <Link
              href={next ? `/auth/register?next=${encodeURIComponent(next)}` : "/auth/register"}
              className="text-blue-600"
            >
              去注册
            </Link>
          </>
        ) : (
          <>
            已有账号？{" "}
            <Link
              href={next ? `/auth/login?next=${encodeURIComponent(next)}` : "/auth/login"}
              className="text-blue-600"
            >
              去登录
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
