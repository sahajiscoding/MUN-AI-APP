import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileText, Landmark, LifeBuoy } from "lucide-react";
import type { ReactNode } from "react";
import type { SitePage } from "@/lib/site-pages";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-b border-[var(--line)] px-5 py-5 sm:px-8">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3" aria-label="MUN Prep home">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--ink)] text-[var(--paper)]"><Landmark className="h-5 w-5" aria-hidden="true" /></span>
          <span className="display-type text-2xl">MUN Prep</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/" className="button-secondary inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4" /> Home</Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return <footer className="border-t border-[var(--line)] px-5 py-8 sm:px-8"><div className="mx-auto max-w-5xl"><div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-xs font-semibold text-[var(--muted)]"><span>© MUN Prep</span><nav className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Footer navigation"><Link href="/help">Help Center</Link><Link href="/support">Support</Link><Link href="/legal">Legal</Link><Link href="/become-a-partner">Become a partner</Link><Link href="/login">Sign in</Link><Link href="/signup">Register</Link><Link href="/legal/cookie-preferences">Cookie Preferences</Link></nav></div></div></footer>;
}

export function PublicPage({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]"><SiteHeader />{children}<SiteFooter /></main>;
}

export function PolicyPage({ page }: { page: SitePage }) {
  return <PublicPage><article className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-12"><p className="label-text text-[var(--oxblood)]">{page.eyebrow}</p><h1 className="display-type mt-4 text-4xl leading-none sm:text-5xl">{page.title}</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--muted)]">{page.description}</p><div className="mt-7 rounded-xl border border-[var(--brass)]/35 bg-[var(--brass)]/10 p-4 text-sm leading-6 text-[var(--ink)]"><strong>Important:</strong> This is a working website draft. Have qualified legal counsel review policy text, jurisdiction, business identity, contact details, retention periods, and payment terms before relying on or publishing it.</div><div className="mt-6 grid gap-8">{page.sections.map((section) => <section key={section.heading} className="border-t border-[var(--line)] pt-6"><h2 className="display-type text-2xl sm:text-3xl">{section.heading}</h2><p className="mt-2 max-w-3xl whitespace-pre-line text-base leading-8 text-[var(--muted)]">{section.body}</p></section>)}</div></article></PublicPage>;
}

export function StatePage({ code, title, description, action }: { code: string; title: string; description: string; action?: ReactNode }) {
  return <PublicPage><section className="mx-auto grid min-h-[calc(100vh-82px)] max-w-3xl place-items-center px-5 py-16 text-center sm:px-8"><div><p className="display-type text-7xl text-[var(--brass)]">{code}</p><h1 className="display-type mt-4 text-4xl sm:text-5xl">{title}</h1><p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[var(--muted)]">{description}</p>{action ? <div className="mt-8">{action}</div> : null}</div></section></PublicPage>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="surface rounded-xl p-8 text-center"><FileText className="mx-auto h-8 w-8 text-[var(--patina)]" aria-hidden="true" /><h2 className="display-type mt-4 text-2xl">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{description}</p>{action ? <div className="mt-5">{action}</div> : null}</div>;
}

export function SuccessState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="surface rounded-xl border border-[var(--patina)]/30 bg-[var(--patina)]/5 p-8 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-[var(--patina)]" aria-hidden="true" /><h2 className="display-type mt-4 text-2xl">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{description}</p>{action ? <div className="mt-5">{action}</div> : null}</div>;
}

export function SupportCard() {
  return <div className="surface rounded-xl p-6"><LifeBuoy className="h-6 w-6 text-[var(--patina)]" aria-hidden="true" /><h2 className="display-type mt-4 text-2xl">Need help?</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Contact the MUN Prep team through your account support channel. Include the page, order reference, and a short description. Never send passwords or full payment credentials.</p></div>;
}
