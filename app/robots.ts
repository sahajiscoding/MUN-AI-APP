import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/** Crawl rules: Googlebot is welcome on marketing pages, barred from gated surfaces. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        // NOTE: the obscured admin sign-in path is intentionally NOT listed
        // here. robots.txt is public, and naming it would advertise the URL.
        // It stays hidden via auth gates (and it was never linked publicly).
        disallow: ["/api/", "/app/", "/admin/", "/partner/", "/checkout/", "/dashboard", "/profile"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
