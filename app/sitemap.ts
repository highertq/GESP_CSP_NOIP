import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const papers = await prisma.paper.findMany({
    where: { published: true },
    select: { slug: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

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
    ...papers.map((p) => ({
      url: `${base}/paper/${p.slug}`,
      lastModified: p.createdAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
