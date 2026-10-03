import Link from "next/link";
import { PolicyPage, PublicPage } from "@/components/site-pages";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { legalPages } from "@/lib/site-pages";
import { publicMetadata } from "@/lib/seo";

export const metadata = publicMetadata({
  title: "Legal & policies",
  description:
    "Review how MUN Prep handles accounts, payments, privacy, security, and responsible use.",
  path: "/legal",
});

/** Legal index page listing every policy document. */
export default function LegalIndexPage() {
  return <PublicPage><section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-12"><Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Legal", path: "/legal" }]} /><p className="label-text mt-6 text-[var(--oxblood)]">Legal & policies</p><h1 className="display-type mt-4 text-4xl sm:text-5xl">Clarity by design.</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">Review how MUN Prep handles accounts, payments, privacy, security, and responsible use.</p><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(legalPages).map(([slug, page]) => <Link key={slug} href={`/legal/${slug}`} className="surface rounded-xl p-5 transition hover:-translate-y-0.5 hover:border-[var(--patina)]"><p className="label-text text-[var(--patina)]">{page.eyebrow}</p><h2 className="display-type mt-2 text-xl">{page.title}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{page.description}</p></Link>)}</div></section></PublicPage>;
}
