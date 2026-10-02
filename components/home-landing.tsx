import { ArrowRight, BookOpen, FileText, MessageSquareQuote } from "lucide-react";
import Link from "next/link";
import { PublicNav } from "@/components/public-nav";
import { SiteFooter } from "@/components/site-pages";
import { CloudShader } from "@/components/ui/cloud-shader";
import { motion } from "motion/react";

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
      <section className="relative min-h-screen w-full overflow-hidden">
        {/* Cloud shader background */}
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        >
          <div className="absolute h-1/2 w-1/2 origin-top-left scale-200">
            <CloudShader 
              speed={1} 
              count={6}
              skyTopColor="#1e3a5f"
              skyBottomColor="#2d6a9e"
              cloudColor="#f0f4f8"
              className="absolute inset-0" 
            />
          </div>
        </motion.div>

        {/* Content */}
        <div className="relative z-20 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-7 sm:px-8 lg:px-12">
          {referralName ? (
            <div className="mb-5 rounded-panel border border-[var(--patina)]/30 bg-[var(--patina)]/10 px-4 py-3 text-sm font-semibold text-white" role="status">
              <span aria-hidden="true">🎁 </span>Referred by {referralName}
            </div>
          ) : null}
          <PublicNav />

          <div className="flex flex-1 flex-col justify-center py-12 text-center lg:py-16">
            <p className="label-text text-white/90">Delegate command center</p>
            <h1 className="display-type mx-auto mt-5 max-w-4xl text-5xl leading-[0.96] text-white drop-shadow-md sm:text-6xl lg:text-7xl">
              Prepare like your committee starts tomorrow.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/85">
              A focused Model UN workspace for research briefs, country policy, speeches,
              POIs, and draft resolution strategy. Sign in to get started.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link className="button-primary inline-flex items-center justify-center gap-2 px-5 font-semibold" href="/dashboard">
                Open dashboard
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link className="button-secondary inline-flex items-center justify-center px-5 font-semibold" href="/pricing">
                View access
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {workspaces.map((item) => {
              const Icon = item.icon;

              return (
                <article key={item.title} className="border-t border-white/20 py-5 bg-white/5 rounded-panel backdrop-blur-sm">
                  <Icon className="h-5 w-5 text-white/90" aria-hidden="true" />
                  <h2 className="mt-3 font-bold text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-white/70">{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>

        {/* Window-seat wing view with gentle in-flight bob */}
        <motion.div
          className="pointer-events-none absolute -bottom-6 left-0 z-10 w-[85%] md:w-[70%]"
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        >
          <img
            src="https://assets.aceternity.com/components/plane-wing.png"
            alt="Airplane wing above the clouds"
            className="h-auto w-full object-cover opacity-60"
          />
        </motion.div>
      </section>
      <SiteFooter />
    </main>
  );
}
