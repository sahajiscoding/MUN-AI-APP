import { ProtectedAppShell } from "@/components/protected-app-shell";
import { ToolWorkspace } from "@/components/tool-workspace";

export const metadata = {
  title: "POI Trainer"
};

/** POI trainer workspace page. */
export default function POITrainerPage() {
  return (
    <ProtectedAppShell>
      <ToolWorkspace
        eyebrow="Debate desk"
        title="POI trainer"
        description="Prepare questions to ask, attacks to expect, tight rebuttals, and fallback lines when debate gets sharp."
        mode="poi"
      />
    </ProtectedAppShell>
  );
}
