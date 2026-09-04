import { ArrowRight, BookOpen, FileText, MessageSquareQuote } from "lucide-react";
import Link from "next/link";
import { PublicNav } from "@/components/public-nav";
import { SiteFooter } from "@/components/site-pages";

const workspaces = [
  {
    title: "Research brief",
    body: "Committee context, country position, blocs, opposition arguments, and verification checklist.",
    icon: BookOpen
  },
  {
    title: "Position paper",
    body: "A structured argument map that turns policy into clean paragraphs and proposals.",
    icon: FileText
  },
  {
    title: "Speech practice",
    body: "Opening speeches, moderated caucus angles, POIs, and rebuttal drills.",
    icon: MessageSquareQuote
  }
];

export default function HomePage({ referralName }: { referralName?: string } = {}) {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <section className="min-h-screen">
        <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-7 sm:px-8 lg:px-12">
          {referralName ? (
            <div className="mb-5 rounded-panel border border-[var(--patina)]/30 bg-[var(--patina)]/10 px-4 py-3 text-sm font-semibold text-[var(--ink)]" role="status">
              <span aria-hidden="true">🎁 </span>Referred by {referralName}
            </div>
          ) : null}
          <PublicNav />

          <div className="flex flex-1 flex-col justify-center py-16 text-center lg:py-20">
            <p className="label-text text-[var(--oxblood)]">Delegate command center</p>
            <h1 className="display-type mx-auto mt-5 max-w-4xl text-6xl leading-[0.94] sm:text-7xl lg:text-8xl">
              Prepare like your committee starts tomorrow.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              A focused Model UN workspace for research briefs, country policy, speeches,
              POIs, and draft resolution strategy. Sign in to get started.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link className="button-primary inline-flex items-center justify-center gap-2 px-5 font-semibold" href="/dashboard">
                Open dashboard
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link className="button-secondary inline-flex items-center justify-center px-5 font-semibold" href="/pricing">
                View access
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {workspaces.map((item) => {
              const Icon = item.icon;

              return (
                <article key={item.title} className="border-t border-[var(--line)] py-4">
                  <Icon className="h-5 w-5 text-[var(--patina)]" aria-hidden="true" />
                  <h2 className="mt-3 font-bold">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
