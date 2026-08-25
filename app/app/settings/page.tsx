import { Database, HardDrive, KeyRound, ShieldCheck } from "lucide-react";
import { ProtectedAppShell } from "@/components/protected-app-shell";

export const metadata = {
  title: "Settings",
};

const settings = [
  {
    title: "Supabase Authentication",
    body: "Email/password and Google sign-in are configured through Supabase Auth with redirect-based OAuth.",
    icon: ShieldCheck,
  },
  {
    title: "PostgreSQL Database",
    body: "Profile, entitlement, payment, AI generation, and note tables are stored in Supabase with row-level security.",
    icon: Database,
  },
  {
    title: "Storage",
    body: "Supabase Storage bucket is available for file uploads, PDFs, image assets, or user document storage.",
    icon: HardDrive,
  },
  {
    title: "Server secrets",
    body: "Supabase service role key, Razorpay, OpenRouter, and NVIDIA keys must remain server-side via environment variables.",
    icon: KeyRound,
  },
];

export default function SettingsPage() {
  return (
    <ProtectedAppShell>
      <div className="space-y-6">
        <header>
          <p className="label-text text-[var(--oxblood)]">Configuration</p>
          <h1 className="display-type mt-3 text-5xl">Settings</h1>
          <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
            Current app setup status and what needs external account configuration before production.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {settings.map((item) => {
            const Icon = item.icon;

            return (
              <article key={item.title} className="surface rounded-panel p-5">
                <Icon className="h-5 w-5 text-[var(--patina)]" aria-hidden="true" />
                <h2 className="display-type mt-5 text-3xl">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.body}</p>
              </article>
            );
          })}
        </section>
      </div>
    </ProtectedAppShell>
  );
}
