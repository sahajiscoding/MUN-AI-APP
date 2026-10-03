import { ProfileForm } from "@/components/profile-form";
import { ProtectedAppShell } from "@/components/protected-app-shell";
import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata("Delegate Profile");

/** Delegate profile page for editing conference context. */
export default function ProfilePage() {
  return (
    <ProtectedAppShell>
      <div className="space-y-5">
        <header>
          <p className="label-text text-[var(--oxblood)]">Delegate file</p>
          <h1 className="display-type mt-3 text-4xl">Profile</h1>
          <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
            Save your committee, country, agenda, experience level, and prep goals.
            Paid tools use this context to produce sharper work.
          </p>
        </header>
        <ProfileForm />
      </div>
    </ProtectedAppShell>
  );
}
