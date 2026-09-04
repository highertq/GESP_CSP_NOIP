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

  return (
    <div className="max-w-sm mx-auto pt-6 sm:pt-10">
      <div className="text-center mb-7">
        <p className="eyebrow mb-2">
          <span className="text-ink/30">// </span>
          {isLogin ? "welcome back" : "create account"}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {isLogin ? "登录" : "注册"}
        </h1>
        <p className="mt-1.5 text-sm text-ink-3">
          {isLogin ? "登录后保存你的刷题记录与错题本" : "注册即送错题本 + 整卷模拟"}
        </p>
      </div>

      <form onSubmit={submit} className="card p-6 sm:p-7 space-y-4">
        <div>
          <label className="block text-[13px] font-medium text-ink-2 mb-1.5">用户名</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="字母/数字/下划线，3-20 位"
            autoComplete="username"
            required
          />
        </div>
        {!isLogin && (
          <div>
            <label className="block text-[13px] font-medium text-ink-2 mb-1.5">
              昵称 <span className="text-ink-4">（可选）</span>
            </label>
            <input
              className="input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="展示用昵称，默认同用户名"
            />
          </div>
        )}
        <div>
          <label className="block text-[13px] font-medium text-ink-2 mb-1.5">密码</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isLogin ? "请输入密码" : "至少 6 位"}
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
          />
        </div>
        {error && <p className="text-[13px] text-err">{error}</p>}
        <button type="submit" disabled={busy} className="btn btn-primary w-full">
          {busy ? "处理中…" : isLogin ? "登 录" : "注 册"}
        </button>
      </form>

      <p className="text-center text-[13px] text-ink-3 mt-5">
        {isLogin ? (
          <>
            还没有账号？{" "}
            <Link
              href={next ? `/auth/register?next=${encodeURIComponent(next)}` : "/auth/register"}
              className="font-medium text-ink underline underline-offset-4 decoration-line-strong hover:decoration-ink transition-colors"
            >
              去注册
            </Link>
          </>
        ) : (
          <>
            已有账号？{" "}
            <Link
              href={next ? `/auth/login?next=${encodeURIComponent(next)}` : "/auth/login"}
              className="font-medium text-ink underline underline-offset-4 decoration-line-strong hover:decoration-ink transition-colors"
            >
              去登录
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
