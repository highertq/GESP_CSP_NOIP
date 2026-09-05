import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { guideSlugs, getGuide, listGuideMetas } from "@/lib/guides";

export const dynamicParams = false;

export function generateStaticParams() {
  return guideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) return { title: "文章不存在" };
  return {
    title: guide.title,
    description: guide.description,
    keywords: guide.keywords,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      title: guide.title,
      description: guide.description,
      type: "article",
      publishedTime: guide.date,
      modifiedTime: guide.updated ?? guide.date,
    },
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) notFound();

  const others = listGuideMetas().filter((g) => g.slug !== guide.slug).slice(0, 4);

  return (
    <div className="max-w-3xl space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "Article",
              headline: guide.title,
              description: guide.description,
              datePublished: guide.date,
              dateModified: guide.updated ?? guide.date,
              inLanguage: "zh-CN",
              mainEntityOfPage: `/guides/${guide.slug}`,
            },
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "首页", item: "/" },
                { "@type": "ListItem", position: 2, name: "备考指南", item: "/guides" },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: guide.title,
                  item: `/guides/${guide.slug}`,
                },
              ],
            },
            ...(guide.faqs.length
              ? [
                  {
                    "@context": "https://schema.org",
                    "@type": "FAQPage",
                    mainEntity: guide.faqs.map((f) => ({
                      "@type": "Question",
                      name: f.q,
                      acceptedAnswer: { "@type": "Answer", text: f.a },
                    })),
                  },
                ]
              : []),
          ]),
        }}
      />

      <nav className="text-xs text-ink-3">
        <Link href="/guides" className="hover:text-ink">
          备考指南
        </Link>
        <span className="mx-1.5">/</span>
        <span className="line-clamp-1">{guide.title}</span>
      </nav>

      <article>
        <header className="mb-6 space-y-2">
          <h1 className="text-2xl sm:text-[28px] font-extrabold leading-snug tracking-tight text-ink">
            {guide.title}
          </h1>
          <p className="code text-[11px] text-ink-4">
            updated {guide.updated ?? guide.date} · qu7.top
          </p>
        </header>
        <div className="md-body" dangerouslySetInnerHTML={{ __html: guide.html }} />
      </article>

      {guide.faqs.length > 0 && (
        <section className="border-t border-line pt-6">
          <h2 className="text-lg font-bold text-ink mb-3">常见问题</h2>
          <div className="divide-y divide-line">
            {guide.faqs.map((f) => (
              <div key={f.q} className="py-3.5">
                <p className="text-[15px] font-semibold text-ink">{f.q}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface-2/60 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-ink">刷题巩固</p>
          <p className="mt-0.5 text-xs text-ink-3">
            看完攻略，去 GESP 真题专区开一套历年真题，检验学习成果
          </p>
        </div>
        <Link href="/gesp" className="btn btn-primary px-7 py-2.5 text-[14px] shrink-0">
          进入真题专区
        </Link>
      </section>

      {others.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-ink mb-3">继续阅读</h2>
          <ul className="space-y-2 text-[14px]">
            {others.map((g) => (
              <li key={g.slug}>
                <Link
                  href={`/guides/${g.slug}`}
                  className="text-ink-2 hover:text-ink transition-colors"
                >
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
