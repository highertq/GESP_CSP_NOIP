import type { Metadata } from "next";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">{children}</main>
        <footer className="border-t border-gray-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 py-6 text-xs text-gray-400 space-y-1">
            <p>信奥刷题站 —— GESP / CSP-J / CSP-S / NCT 初赛客观题在线练习平台</p>
            <p>
              编程大题请前往洛谷等在线评测平台提交；试题答案如与官方公布不一致，以官方为准。
            </p>
            <p>题库数据整理自公开真题，仅供学习交流使用。</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
