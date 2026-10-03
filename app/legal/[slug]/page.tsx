import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CookiePreferences } from "@/components/cookie-preferences";
import { PolicyPage, PublicPage } from "@/components/site-pages";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { legalPages } from "@/lib/site-pages";
import { publicMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** Per-policy metadata with a self-referencing canonical URL. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = legalPages[slug];
  if (!page) return {};
  return publicMetadata({
    title: page.title,
    description: page.description,
    path: `/legal/${slug}`,
  });
}

/** Legal policy page rendering the document for the given slug. */
export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = legalPages[slug];
  if (!page) notFound();
  if (slug === "cookie-preferences") {
    return <PublicPage><article className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-12"><Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Legal", path: "/legal" }, { name: page.title, path: `/legal/${slug}` }]} /><p className="label-text mt-6 text-[var(--oxblood)]">{page.eyebrow}</p><h1 className="display-type mt-4 text-4xl leading-none sm:text-5xl">{page.title}</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--muted)]">{page.description}</p><div className="mt-6 grid gap-8">{page.sections.map((section) => <section key={section.heading} className="border-t border-[var(--line)] pt-6"><h2 className="display-type text-2xl sm:text-3xl">{section.heading}</h2><p className="mt-2 max-w-3xl whitespace-pre-line text-base leading-8 text-[var(--muted)]">{section.body}</p></section>)}</div><CookiePreferences /></article></PublicPage>;
  }
  return <PolicyPage page={page} trail={[{ name: "Home", path: "/" }, { name: "Legal", path: "/legal" }, { name: page.title, path: `/legal/${slug}` }]} />;
}
