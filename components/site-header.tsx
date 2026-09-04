"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Me = { username: string; nickname: string; role: string } | null;

function Logo() {
  return (
    <span className="inline-grid place-items-center w-8 h-8 rounded-[9px] bg-ink text-white shadow-[0_1px_2px_rgba(0,0,0,0.15)]">
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m8 6-6 6 6 6" />
        <path d="m16 6 6 6-6 6" />
      </svg>
    </span>
  );
}

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive) {
          setMe(d?.data?.user ?? null);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
    // 路由变化时重新校验登录态：登录/注册/退出后 header 立即刷新，无需手动刷新页面
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
    router.push("/");
    router.refresh();
  }

  const linkCls = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-[13.5px] font-medium whitespace-nowrap transition-colors duration-150 ${
      active
        ? "bg-surface-2 text-ink"
        : "text-ink-2 hover:bg-surface-2 hover:text-ink"
    }`;

  const navItems = [
    { href: "/", label: "首页", active: pathname === "/" },
    {
      href: "/papers",
      label: "试卷库",
      active: pathname.startsWith("/papers") || pathname.startsWith("/paper/"),
    },
  ];
  if (me) {
    navItems.push(
      {
        href: "/wrong",
        label: "错题本",
        active: pathname.startsWith("/wrong"),
      },
      {
        href: "/favorites",
        label: "收藏",
        active: pathname.startsWith("/favorites"),
      },
    );
    if (me.role === "ADMIN") {
      navItems.push({
        href: "/admin",
        label: "管理",
        active: pathname.startsWith("/admin"),
      });
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[#fcfcfb]/85 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Logo />
          <span className="font-bold text-[16.5px] tracking-tight text-ink whitespace-nowrap">
            曲奇编程
          </span>
        </Link>

        {/* 导航：窄屏可横向滚动，不破版 */}
        <nav className="flex-1 flex items-center gap-0.5 overflow-x-auto no-scrollbar -mx-1 px-1">
          {navItems.map((n) => (
            <Link key={n.href} href={n.href} className={linkCls(n.active)}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 shrink-0 text-[13.5px]">
          {!loaded ? (
            <span className="px-2 text-ink-4">…</span>
          ) : me ? (
            <>
              <Link
                href="/me"
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors duration-150 ${
                  pathname.startsWith("/me")
                    ? "bg-surface-2 text-ink"
                    : "text-ink hover:bg-surface-2"
                }`}
              >
                {me.nickname}
              </Link>
              <button onClick={logout} className="btn btn-ghost btn-sm px-2.5 text-ink-3">
                退出
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="btn btn-ghost btn-sm">
                登录
              </Link>
              <Link href="/auth/register" className="btn btn-primary btn-sm">
                注册
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
