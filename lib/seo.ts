import type { Metadata } from "next";

const FALLBACK_SITE_URL = "https://mun-ai-app.vercel.app";

/** Canonical https origin used for sitemaps, canonical tags, and schema URLs. */
export function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
      // Fall through to the production default below.
    }
  }
  return FALLBACK_SITE_URL;
}

/** Absolute URL for a site path (leading slash optional). */
export function absoluteUrl(path = "/") {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

type PublicPageMeta = {
  title: string;
  description: string;
  path: string;
};

/**
 * Metadata for a public indexable page: unique title/description, self-referencing
 * canonical, and complete Open Graph / Twitter cards.
 */
export function publicMetadata({ title, description, path }: PublicPageMeta): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "MUN Prep",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

/** Metadata for gated/private surfaces that must never appear in search results. */
export function privateMetadata(title: string): Metadata {
  return {
    title,
    robots: { index: false, follow: false },
  };
}

/** Organization + WebSite JSON-LD for the homepage. */
export function organizationJsonLd() {
  const url = siteUrl();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${url}/#organization`,
        name: "MUN Prep",
        url,
        description:
          "A paid delegate preparation workspace for Model United Nations research, position papers, speeches, POIs, and resolutions.",
      },
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        url,
        name: "MUN Prep",
        publisher: { "@id": `${url}/#organization` },
      },
    ],
  };
}

/** BreadcrumbList JSON-LD for a visible breadcrumb trail. */
export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
