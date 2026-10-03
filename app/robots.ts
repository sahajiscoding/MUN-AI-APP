import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/** Crawl rules: Googlebot is welcome on marketing pages, barred from gated surfaces. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: ["/api/", "/app/", "/admin/", "/c8f2x9/", "/partner/", "/checkout/", "/dashboard", "/profile"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
