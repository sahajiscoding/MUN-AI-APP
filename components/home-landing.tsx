import { ArrowRight, BookOpen, FileText, MessageSquareQuote } from "lucide-react";
import Link from "next/link";
import { PublicNav } from "@/components/public-nav";
import { SiteFooter } from "@/components/site-pages";
import { CloudShader } from "@/components/ui/cloud-shader";

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

/**
 * The landing page body. It lives outside `app/page.tsx` because a page
 * component may not accept props of its own, while the referral landing route
 * (`app/[referralCode]/page.tsx`) still needs to pass the partner's name in.
 */
export function HomeLanding({ referralName }: { referralName?: string }) {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <section className="relative flex min-h-screen w-full flex-col overflow-hidden">
        {/* Cloud shader background — full-bleed */}
        <div className="absolute inset-0 cloud-fade-in" aria-hidden="true">
          <CloudShader 
            speed={1} 
            count={6}
            skyTopColor="#1e3a5f"
            skyBottomColor="#2d6a9e"
            cloudColor="#f0f4f8"
            className="absolute inset-0 h-full w-full" 
          />
        </div>

        {/* Readability overlays: top shade for nav, center shade for hero, bottom fade for cards */}
        <div className="pointer-events-none absolute inset-0 z-[5]" aria-hidden="true">
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-slate-950/50 to-transparent" />
          <div className="absolute inset-x-0 top-1/4 bottom-1/4 bg-gradient-to-b from-transparent via-slate-950/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-slate-950/55 via-slate-950/20 to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-20 mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 pb-10 pt-7 sm:px-8 lg:px-12">
          {referralName ? (
            <div className="mb-5 rounded-panel border border-white/25 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur-md" role="status">
              <span aria-hidden="true">🎁 </span>Referred by {referralName}
            </div>
          ) : null}
          <PublicNav variant="onDark" />

          {/* Hero — vertically centered in the free space above the cards */}
          <div className="flex flex-1 flex-col items-center justify-center py-14 text-center sm:py-16 lg:py-20">
            <p className="label-text tracking-[0.14em] text-white/80">Delegate command center</p>
            <h1 className="display-type mx-auto mt-5 max-w-4xl text-balance text-5xl leading-[1.02] text-white drop-shadow-lg sm:text-6xl lg:text-7xl">
              Prepare like your committee starts tomorrow.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-8 text-white/85">
              A focused Model UN workspace for research briefs, country policy, speeches,
              POIs, and draft resolution strategy. Sign in to get started.
            </p>
            <div className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:gap-4">
              <Link
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#f7f3ea] px-7 py-3 text-base font-semibold text-[#171412] shadow-xl transition hover:-translate-y-0.5 hover:bg-white sm:w-auto"
                href="/dashboard"
              >
                Open dashboard
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-white/30 bg-white/10 px-7 py-3 text-base font-semibold text-white shadow-lg backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white/20 sm:w-auto"
                href="/pricing"
              >
                View access
              </Link>
            </div>
          </div>

          {/* Feature cards — pinned to the bottom with real padding, above the wing */}
          <div className="relative z-20 grid gap-4 pb-2 sm:grid-cols-3 lg:gap-5">
            {workspaces.map((item) => {
              const Icon = item.icon;

              return (
                <article
                  key={item.title}
                  className="rounded-2xl border border-white/15 bg-slate-950/30 p-6 text-left shadow-xl backdrop-blur-md"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-white">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="mt-4 text-lg font-bold text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-white/75">{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>

        {/* Window-seat wing view — kept low so it never collides with buttons/cards */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 z-[6] w-[70%] max-w-4xl select-none wing-bob md:w-[55%] lg:w-[48%]"
          aria-hidden="true"
        >
          <img
            src="https://assets.aceternity.com/components/plane-wing.png"
            alt=""
            className="h-auto w-full object-cover opacity-40 [mask-image:linear-gradient(to_top,black_55%,transparent_98%)]"
            loading="eager"
            draggable={false}
          />
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
