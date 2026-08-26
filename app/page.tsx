import { ArrowRight, BookOpen, FileText, Landmark, MessageSquareQuote } from "lucide-react";
import Link from "next/link";

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
    <main className="min-h-screen">
      <section className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-between px-5 py-7 sm:px-8 lg:px-12">
          {referralName ? (
            <div className="mb-5 rounded-panel border border-[var(--patina)]/30 bg-[var(--patina)]/10 px-4 py-3 text-sm font-semibold text-[var(--ink)]" role="status">
              <span aria-hidden="true">🎁 </span>Referred by {referralName}
            </div>
          ) : null}
          <nav className="flex items-center justify-between gap-4" aria-label="Public navigation">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-panel bg-[var(--ink)] text-[var(--paper)]">
                <Landmark className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="display-type text-2xl">MUN Prep</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link className="rounded-full border border-[var(--line)] px-5 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-black/5 transition" href="/login">
                Sign in
              </Link>
              <Link className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-[var(--paper)] hover:bg-[var(--ink)]/80 transition" href="/signup">
                Get started
              </Link>
            </div>
          </nav>

          <div className="py-16 lg:py-20">
            <p className="label-text text-[var(--oxblood)]">Delegate command center</p>
            <h1 className="display-type mt-5 max-w-4xl text-6xl leading-[0.94] sm:text-7xl lg:text-8xl">
              Prepare like your committee starts tomorrow.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              A focused Model UN workspace for research briefs, country policy, speeches,
              POIs, and draft resolution strategy. Sign in to get started.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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

        <div className="relative min-h-[36rem] overflow-hidden bg-[var(--ink)] text-[var(--paper)] lg:min-h-screen">
          <div className="diplomatic-grid absolute inset-0 opacity-20" />
          <div className="briefing-map absolute left-1/2 top-16 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full border border-white/10" />
          <div className="relative flex h-full items-end p-5 sm:p-8 lg:p-12">
            <div className="w-full rounded-panel border border-white/12 bg-white/[0.06] p-5 backdrop-blur-xl">
              <div className="flex items-start justify-between border-b border-white/12 pb-5">
                <div>
                  <p className="label-text text-[var(--brass)]">Live briefing preview</p>
                  <h2 className="display-type mt-3 text-4xl">UNHRC / India</h2>
                </div>
                <span className="rounded-full border border-white/18 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white/74">
                  Locked
                </span>
              </div>
              <div className="mt-5 grid gap-3">
                {["Stakeholder map", "Opening speech angles", "Draft clause bank"].map((item, index) => (
                  <div key={item} className="flex items-center justify-between rounded-panel border border-white/10 px-4 py-3">
                    <span>{item}</span>
                    <span className="mono-type text-sm text-white/45">0{index + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
