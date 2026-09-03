import { notFound } from "next/navigation";
import { CookiePreferences } from "@/components/cookie-preferences";
import { PolicyPage, PublicPage } from "@/components/site-pages";
import { legalPages } from "@/lib/site-pages";

export const dynamic = "force-dynamic";

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = legalPages[slug];
  if (!page) notFound();
  if (slug === "cookie-preferences") {
    return <PublicPage><article className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16"><p className="label-text text-[var(--oxblood)]">{page.eyebrow}</p><h1 className="display-type mt-4 text-5xl leading-none sm:text-7xl">{page.title}</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--muted)]">{page.description}</p><div className="mt-10 grid gap-8">{page.sections.map((section) => <section key={section.heading} className="border-t border-[var(--line)] pt-6"><h2 className="display-type text-2xl sm:text-3xl">{section.heading}</h2><p className="mt-3 max-w-3xl whitespace-pre-line text-base leading-8 text-[var(--muted)]">{section.body}</p></section>)}</div><CookiePreferences /></article></PublicPage>;
  }
  return <PolicyPage page={page} />;
}
