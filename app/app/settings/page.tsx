import { ProtectedAppShell } from "@/components/protected-app-shell";
import { SettingsPanel } from "@/components/settings-panel";

export const metadata = {
  title: "Settings",
};

/** Account settings page. */
export default function SettingsPage() {
  return (
    <ProtectedAppShell>
      <div className="space-y-5">
        <header>
          <p className="label-text text-[var(--oxblood)]">Configuration</p>
          <h1 className="display-type mt-3 text-4xl">Settings</h1>
          <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
            Manage your account and preferences.
          </p>
        </header>
        <SettingsPanel />
      </div>
    </ProtectedAppShell>
  );
}
