import { ProtectedAppShell } from "@/components/protected-app-shell";

export const metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <ProtectedAppShell>
      <div className="space-y-6">
        <header>
          <p className="label-text text-[var(--oxblood)]">Configuration</p>
          <h1 className="display-type mt-3 text-5xl">Settings</h1>
          <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
            Manage your account and preferences.
          </p>
        </header>
      </div>
    </ProtectedAppShell>
  );
}
