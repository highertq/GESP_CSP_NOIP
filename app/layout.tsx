import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";

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
      <body className="min-h-screen flex flex-col bg-canvas text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
