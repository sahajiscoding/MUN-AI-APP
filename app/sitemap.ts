import type { MetadataRoute } from "next";
import { legalPages } from "@/lib/site-pages";
import { absoluteUrl } from "@/lib/seo";

/**
 * Sitemap of the public indexable surface only. Gated app routes (/app/*,
 * /dashboard, /profile, /checkout/*), tokenized partner links (/partner/*),
 * referral entry links, and admin surfaces are intentionally excluded.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/become-a-partner", priority: 0.8, changeFrequency: "monthly" },
    { path: "/support", priority: 0.7, changeFrequency: "monthly" },
    { path: "/help", priority: 0.7, changeFrequency: "monthly" },
    { path: "/legal", priority: 0.5, changeFrequency: "monthly" },
    { path: "/login", priority: 0.5, changeFrequency: "yearly" },
    { path: "/signup", priority: 0.5, changeFrequency: "yearly" },
  ];

  const legalRoutes = Object.keys(legalPages).map((slug) => ({
    url: absoluteUrl(`/legal/${slug}`),
    lastModified: new Date(),
    changeFrequency: "yearly" as const,
    priority: 0.4,
  }));

  return [
    ...staticRoutes.map((route) => ({
      url: absoluteUrl(route.path),
      lastModified: new Date(),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...legalRoutes,
  ];
}
