import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CATEGORY_META } from "@/lib/constants";
import PaperCard from "@/components/paper-card";

export const revalidate = 60; // 首页 ISR：公告等设置变更 60s 内生效

const CAT_DESC: Record<string, string> = {
  GESP: "1-8 级历年真题全覆盖",
  "CSP-J": "入门组初赛历年真题",
  "CSP-S": "提高组初赛历年真题",
  "NCT-C++": "C++ 编程等级考试真题",
  "NCT-KITTEN": "Kitten 图形化编程真题",
  OTHER: "其他赛事真题精选",
};

const HOME_FAQS = [
  {
    q: "GESP 是什么考试？",
    a: "GESP（编程能力等级认证）是由中国计算机学会 CCF 主办的编程等级考试，覆盖图形化 Scratch 和 C++ 两个方向，共 1-8 级，每年 3/6/9/12 月左右各举办一次。证书可作为青少年编程能力的权威证明，高等级（8 级）通过后还可衔接 CSP-J/S 初赛。",
  },
  {
    q: "GESP 一共几级？考什么内容？",
    a: "GESP C++ 方向共 8 级：1-4 级侧重基础语法、循环、数组、函数和简单算法；5-8 级递进考察数据结构（链表、树、图）与算法（排序、搜索、动态规划）。本站收录 GESP 1-8 级历年初赛真题，可在线整卷模拟。",
  },
  {
    q: "GESP 编程考级有用吗？含金量如何？",
    a: "GESP 是 CCF 官方认证，与 CSP-J/S、NOI 同属一个体系，是目前国内认可度最高的青少年编程等级考试之一。等级证书可用于综合素质评价、科技特长生材料，8 级证书可直通 CSP-J/S 初赛，对升学和竞赛路径都有实际价值。",
  },
  {
    q: "这里能刷什么题？",
    a: "信奥初赛的客观题（单选 / 多选 / 判断 / 填空），覆盖 GESP 1-8 级历年真题、CSP-J/S 初赛试题等。提交后即时判分，答错的题会自动进你的错题本。",
  },
  {
    q: "编程大题怎么练？",
    a: "客观题适合网站在线判分。GESP 真题的编程大题提供「洛谷原题」直达链接，可跳转官方真题在线提交验证；模拟卷自编编程题本站只展示题面。",
  },
  {
    q: "需要登录吗？",
    a: "游客可以直接刷题体验；注册登录后，答题记录、错题本、收藏才会保存并同步。",
  },
];

function SectionHead({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div>
        <p className="eyebrow mb-1.5">
          <span className="text-ink/30">// </span>
          {eyebrow}
        </p>
        <h2 className="text-xl sm:text-[22px] font-bold tracking-tight text-ink">{title}</h2>
      </div>
      {right}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <div className="num text-[26px] sm:text-3xl font-semibold text-ink leading-none">{value}</div>
      <div className="mt-1.5 text-xs text-ink-3 truncate">{label}</div>
    </div>
  );
}

export default async function HomePage() {
  const [cats, latest, announcement, objectiveCount] = await Promise.all([
    prisma.paper.groupBy({
      by: ["category"],
      where: { published: true },
      _count: { _all: true },
    }),
    prisma.paper.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { _count: { select: { questions: true } } },
    }),
    prisma.adminSetting.findUnique({ where: { key: "announcement" } }),
    prisma.question.count({ where: { paper: { published: true } } }),
  ]);

  const countBy = new Map(cats.map((c) => [c.category, c._count._all]));
  const totalPapers = [...countBy.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "曲奇编程",
            alternateName: "GESP真题在线练习",
            url: process.env.NEXT_PUBLIC_SITE_URL || "https://qu7.top",
            description:
              "免费在线刷 GESP 1-8 级 / CSP-J / CSP-S / NCT 历年真题：即时判分、错题本、整卷模拟，附 GESP 考级备考指南。",
            inLanguage: "zh-CN",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: HOME_FAQS.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />

      {/* ============ Hero ============ */}
      <section className="relative overflow-hidden -mx-4 sm:-mx-6 px-4 sm:px-6">
        <div className="hero-grid absolute inset-0 pointer-events-none" aria-hidden="true" />
        <div className="relative pt-10 sm:pt-14 pb-12 sm:pb-16 grid lg:grid-cols-[1.12fr_0.88fr] gap-10 lg:gap-14 items-center">
          <div className="fade-up">
            <h1 className="text-ink">
              <span className="block text-[3.4rem] sm:text-[5.2rem] leading-[1] font-extrabold tracking-[-0.045em]">
                曲径通优
              </span>
              <span className="block mt-3 text-lg sm:text-2xl font-bold tracking-tight text-ink-2">
                GESP 真题在线练习 · 免费刷题平台
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-[15.5px] sm:text-base leading-relaxed text-ink-2">
              GESP 1-8 级 / CSP-J / CSP-S / NCT 历年初赛真题在线练习，即时判分 + 错题沉淀 + 整卷模拟计时。
            </p>
            <div className="mt-8">
              <Link href="/papers" className="btn btn-primary btn-lg">
                立即刷题
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>

          {/* 数据面板 */}
          <div
            className="fade-up hidden sm:block"
            style={{ animationDelay: "0.12s" }}
          >
            <div className="card p-6 sm:p-7 shadow-[0_1px_2px_rgba(24,24,21,0.03),0_20px_50px_-24px_rgba(24,24,21,0.18)]">
              <div className="flex items-center justify-between mb-6">
                <p className="eyebrow">数据一览</p>
                <span className="code text-[11px] text-ink-4">db.stats()</span>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <Stat value={String(totalPapers)} label="套真题" />
                <Stat value={objectiveCount.toLocaleString("en-US")} label="道客观题" />
                <Stat value="100%" label="免费在线" />
              </div>
              <div className="mt-6 pt-5 border-t border-line space-y-2.5">
                {[
                  "gesp · 1–8 级 全收录",
                  "csp-j / csp-s · 历年真题",
                  "nct · 少儿编程考级",
                ].map((t) => (
                  <div key={t} className="flex items-center gap-2.5 text-[12.5px] text-ink-2">
                    <span className="code text-ink-4">✓</span>
                    <span className="code tracking-tight">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 公告 */}
      {announcement?.value ? (
        <div className="card px-4 sm:px-5 py-3.5 flex items-start gap-3 -mt-6">
          <span className="pill-code shrink-0 mt-0.5">公告</span>
          <p className="text-sm leading-relaxed text-ink-2">{announcement.value}</p>
        </div>
      ) : null}

      {/* ============ 考试分类 ============ */}
      <section>
        <SectionHead
          eyebrow="exams"
          title="按考试分类"
          right={
            <Link
              href="/papers"
              className="text-[13px] font-medium text-ink-2 hover:text-ink transition-colors shrink-0"
            >
              查看全部 →
            </Link>
          }
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CATEGORY_META.map((c) => {
            const n = countBy.get(c.value) ?? 0;
            if (n === 0 && c.value !== "GESP" && c.value !== "CSP-J") return null;
            return (
              <Link
                key={c.value}
                href={`/papers?cat=${c.value}`}
                className="card card-hover group p-4.5 sm:p-5 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="code text-[11px] font-medium text-ink-3 group-hover:text-ink transition-colors">
                    {c.value}
                  </span>
                  <span className="num text-[13px] text-ink-3">{n} 套</span>
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-ink">{c.label}</div>
                  <div className="mt-0.5 text-xs text-ink-3 truncate">{CAT_DESC[c.value]}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ============ 最新收录 ============ */}
      <section>
        <SectionHead
          eyebrow="latest"
          title="最新收录"
          right={
            <Link
              href="/papers"
              className="text-[13px] font-medium text-ink-2 hover:text-ink transition-colors shrink-0"
            >
              全部试卷 →
            </Link>
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {latest.map((p) => (
            <PaperCard key={p.slug} paper={p} />
          ))}
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="max-w-3xl">
        <SectionHead eyebrow="faq" title="常见问题" />
        <div className="divide-y divide-line">
          {HOME_FAQS.map((f, i) => (
            <div key={f.q} className="py-4 grid grid-cols-[2.5rem_1fr] gap-3">
              <span className="code text-xs text-ink-4 pt-1">Q{i + 1}</span>
              <div>
                <p className="text-[15px] font-semibold text-ink">{f.q}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{f.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ 备考导航（内链区） ============ */}
      <section className="max-w-3xl">
        <SectionHead eyebrow="sitemap" title="GESP 备考导航" />
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-[13.5px]">
          {[
            { href: "/gesp", text: "GESP 真题专区（1-8 级全收录）" },
            { href: "/papers?cat=GESP", text: "GESP 历年真题试卷库" },
            { href: "/gesp/level-1", text: "GESP 一级真题在线练习" },
            { href: "/gesp/level-4", text: "GESP 四级真题在线练习" },
            { href: "/guides/gesp-shi-shenme-kaoshi", text: "GESP 是什么考试？全面解读" },
            { href: "/guides/gesp-baoming-guanwang", text: "GESP 报名官网入口与流程" },
            { href: "/guides/gesp-kaoshi-shijian", text: "GESP 考试时间安排（全年）" },
            { href: "/guides/gesp-yigong-ji-ji", text: "GESP 一共几级？级别怎么选" },
            { href: "/guides/gesp-hanjinliang", text: "GESP 编程考级的含金量" },
            { href: "/guides/gesp-kuaisu-paixu", text: "GESP 快速排序考点精讲" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="py-1 text-ink-2 hover:text-ink transition-colors">
              · {l.text}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
