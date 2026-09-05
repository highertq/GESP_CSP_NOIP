import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { GESP_LEVELS } from "@/lib/gesp-levels";
import { listGuideMetas } from "@/lib/guides";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://qu7.top").replace(/\/$/, "");
  const papers = await prisma.paper.findMany({
    where: { published: true },
    select: { slug: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const guides = listGuideMetas();

  return [
    {
      url: `${base}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/papers`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${base}/gesp`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${base}/guides`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...GESP_LEVELS.map((l) => ({
      url: `${base}/gesp/level-${l.level}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...guides.map((g) => ({
      url: `${base}/guides/${g.slug}`,
      lastModified: new Date(`${g.updated ?? g.date}T00:00:00+08:00`),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...papers.map((p) => ({
      url: `${base}/paper/${p.slug}`,
      lastModified: p.createdAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
