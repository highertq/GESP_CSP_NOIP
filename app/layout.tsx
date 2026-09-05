import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://qu7.top"),
  title: {
    default: "GESP真题在线练习 - 曲奇编程 | GESP/CSP/NCT少儿编程考级免费刷题",
    template: "%s | 曲奇编程",
  },
  description:
    "曲奇编程免费在线刷 GESP 1-8 级真题：历年初赛真题即时判分、错题本自动沉淀、整卷模拟计时，附 GESP 考试时间、报名流程、考级含金量等备考指南。GESP / CSP-J / CSP-S / NCT 少儿编程考级刷题一站式平台。",
  keywords: [
    "gesp",
    "GESP真题",
    "GESP是什么考试",
    "GESP考试时间",
    "GESP报名",
    "GESP考级",
    "GESP一级真题",
    "GESP编程考级的含金量",
    "CSP-J",
    "CSP-S",
    "NCT",
    "少儿编程考级",
    "信息学奥赛",
    "曲奇编程",
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "GESP真题在线练习 - 曲奇编程",
    description:
      "免费在线刷 GESP 1-8 级 / CSP-J / CSP-S / NCT 历年真题：即时判分 + 错题本 + 整卷模拟，附考级备考指南。",
    type: "website",
    siteName: "曲奇编程",
    locale: "zh_CN",
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
