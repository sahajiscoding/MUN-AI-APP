import { BookOpen, CalendarClock, FileText, MessageSquareQuote, PenLine, Target } from "lucide-react";
import Link from "next/link";
import { EntitlementBanner } from "@/components/entitlement-banner";
import { ProtectedAppShell } from "@/components/protected-app-shell";

const tools = [
  { href: "/app/research", label: "Research", detail: "Agenda, committee, blocs, and debate map.", icon: BookOpen },
  { href: "/app/country-profile", label: "Country profile", detail: "Policy lines, allies, red lines, and framing.", icon: Target },
  { href: "/app/position-paper", label: "Position paper", detail: "Structure, arguments, solutions, and polish.", icon: FileText },
  { href: "/app/speech-builder", label: "Speech builder", detail: "Openings and moderated caucus interventions.", icon: MessageSquareQuote },
  { href: "/app/poi-trainer", label: "POI trainer", detail: "Questions to ask, attacks to expect, and replies.", icon: CalendarClock },
  { href: "/app/resolution-builder", label: "Resolution", detail: "Preambulatory and operative clause strategy.", icon: PenLine }
];

export const metadata = {
  title: "Dashboard"
};

export default function DashboardPage() {
  return (
    <ProtectedAppShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label-text text-[var(--oxblood)]">Mission control</p>
            <h1 className="display-type mt-3 text-5xl">Delegate dashboard</h1>
          </div>
          <Link className="button-secondary inline-flex items-center justify-center px-4 text-sm font-semibold" href="/profile">
            Complete profile
          </Link>
        </header>

        <EntitlementBanner />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => {
            const Icon = tool.icon;

            return (
              <Link key={tool.href} href={tool.href} className="surface group rounded-panel p-5 transition hover:-translate-y-1">
                <Icon className="h-5 w-5 text-[var(--patina)]" aria-hidden="true" />
                <h2 className="display-type mt-5 text-3xl">{tool.label}</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{tool.detail}</p>
                <span className="mt-5 inline-flex text-sm font-bold text-[var(--oxblood)]">
                  Open desk
                </span>
              </Link>
            );
          })}
        </section>
      </div>
    </ProtectedAppShell>
  );
}
