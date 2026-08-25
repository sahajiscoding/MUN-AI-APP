import { ProtectedAppShell } from "@/components/protected-app-shell";
import { ToolWorkspace } from "@/components/tool-workspace";

export const metadata = {
  title: "Country Profile"
};

export default function CountryProfilePage() {
  return (
    <ProtectedAppShell>
      <ToolWorkspace
        eyebrow="Policy desk"
        title="Country profile"
        description="Turn a country assignment into policy lines, likely allies, red lines, speeches, and negotiation posture."
        mode="country-profile"
      />
    </ProtectedAppShell>
  );
}
