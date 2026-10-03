import Link from "next/link";
import { breadcrumbJsonLd } from "@/lib/seo";

export type Crumb = { name: string; path: string };

/**
 * Visible breadcrumb trail that also emits matching BreadcrumbList JSON-LD,
 * so the visible navigation and the structured data never disagree.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-xs font-semibold text-[var(--muted)]">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {items.map((item, index) => {
            const last = index === items.length - 1;
            return (
              <li key={item.path} className="flex items-center gap-2">
                {index > 0 ? <span aria-hidden="true">/</span> : null}
                {last ? (
                  <span aria-current="page" className="text-[var(--ink)]">{item.name}</span>
                ) : (
                  <Link href={item.path} className="underline-offset-2 hover:text-[var(--ink)] hover:underline">
                    {item.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <script
        type="application/ld+json"
        // Text child, not HTML: React inserts script content as raw text, and
        // `<` is unicode-escaped so no crumb value can break out of the tag.
        // This keeps the client-boundary HTML gate green.
        suppressHydrationWarning
      >
        {JSON.stringify(breadcrumbJsonLd(items)).replace(/</g, "\\u003c")}
      </script>
    </>
  );
}
