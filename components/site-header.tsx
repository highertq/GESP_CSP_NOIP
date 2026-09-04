"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Me = { username: string; nickname: string; role: string } | null;

const NAV = [
  { href: "/", label: "首页" },
  { href: "/papers", label: "试卷库" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setMe(d?.data?.user ?? null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-lg text-blue-600 whitespace-nowrap">
            信奥刷题站
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {NAV.map((n) => {
              const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    active ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
            {me && me.role === "ADMIN" && (
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-md text-gray-600 hover:bg-gray-100"
              >
                管理
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {!loaded ? (
            <span className="text-gray-400">…</span>
          ) : me ? (
            <>
              <Link
                href="/me"
                className="px-3 py-1.5 rounded-md text-gray-700 hover:bg-gray-100"
              >
                {me.nickname}
              </Link>
              <button
                onClick={logout}
                className="px-3 py-1.5 rounded-md text-gray-500 hover:bg-gray-100"
              >
                退出
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="px-3 py-1.5 rounded-md text-gray-700 hover:bg-gray-100"
              >
                登录
              </Link>
              <Link
                href="/auth/register"
                className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                注册
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
