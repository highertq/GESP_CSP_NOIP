import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "katex/dist/katex.min.css";
import SiteHeader from "@/components/site-header";

export const metadata: Metadata = {
  title: {
    default: "信奥刷题站 - GESP/CSP 真题在线练习",
    template: "%s | 信奥刷题站",
  },
  description:
    "免费在线刷 GESP / CSP-J / CSP-S / NCT 信息学奥赛初赛真题：单选、多选、判断、填空即时判分，自动沉淀错题本，支持整卷模拟计时。信奥初赛备考首选。",
  keywords: ["GESP", "CSP-J", "CSP-S", "信奥", "信息学奥赛", "初赛真题", "NOIP", "刷题"],
  robots: { index: true, follow: true },
  openGraph: {
    title: "信奥刷题站 - GESP/CSP 真题在线练习",
    description: "GESP/CSP-J/CSP-S 初赛真题免费刷题，错题本 + 整卷模拟。",
    type: "website",
  },
};

function FooterLogo() {
  return (
    <span className="inline-grid place-items-center w-7 h-7 rounded-lg bg-ink text-white">
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {children}
        </main>
        <footer className="border-t border-line bg-surface mt-6">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
            <div className="grid gap-8 sm:grid-cols-[1.4fr_1fr_1fr]">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <FooterLogo />
                  <span className="font-bold text-[15px] tracking-tight text-ink">
                    信奥刷题站
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-ink-3 max-w-xs">
                  GESP / CSP-J / CSP-S / NCT 初赛客观题在线练习平台。即时判分、错题沉淀、整卷模拟，把初赛刷成肌肉记忆。
                </p>
              </div>
              <div>
                <p className="eyebrow mb-3">站点</p>
                <ul className="space-y-2 text-[13px] text-ink-2">
                  <li>
                    <Link href="/papers" className="hover:text-ink transition-colors">
                      试卷库
                    </Link>
                  </li>
                  <li>
                    <Link href="/auth/login" className="hover:text-ink transition-colors">
                      登录 / 注册
                    </Link>
                  </li>
                  <li>
                    <Link href="/me" className="hover:text-ink transition-colors">
                      个人统计
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="eyebrow mb-3">说明</p>
                <ul className="space-y-2 text-[13px] text-ink-3 leading-relaxed">
                  <li>编程大题请前往洛谷等在线评测平台提交</li>
                  <li>试题答案如与官方公布不一致，以官方为准</li>
                  <li>题库整理自公开真题，仅供学习交流使用</li>
                </ul>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-line flex flex-wrap items-center justify-between gap-2 text-xs text-ink-4">
              <span>© 2026 信奥刷题站 · GESP / CSP / NOIP 备考</span>
              <span className="code">oj-practice · MIT 思路启发自 olympiad-practice-system</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
