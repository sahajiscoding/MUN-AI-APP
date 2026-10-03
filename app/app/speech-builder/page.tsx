import { ProtectedAppShell } from "@/components/protected-app-shell";
import { ToolWorkspace } from "@/components/tool-workspace";

export const metadata = {
  title: "Speech Builder"
};

/** Speech builder workspace page. */
export default function SpeechBuilderPage() {
  return (
    <ProtectedAppShell>
      <ToolWorkspace
        eyebrow="Speech desk"
        title="Speech builder"
        description="Draft opening speeches and moderated caucus interventions that sound diplomatic, specific, and committee-aware."
        mode="speech"
      />
    </ProtectedAppShell>
  );
}
