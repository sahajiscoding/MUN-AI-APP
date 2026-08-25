import { ProtectedAppShell } from "@/components/protected-app-shell";
import { ToolWorkspace } from "@/components/tool-workspace";

export const metadata = {
  title: "Resolution Builder"
};

export default function ResolutionBuilderPage() {
  return (
    <ProtectedAppShell>
      <ToolWorkspace
        eyebrow="Clause desk"
        title="Resolution builder"
        description="Generate clause strategy, sponsor positioning, negotiation asks, and policy-safe operative language."
        mode="resolution"
      />
    </ProtectedAppShell>
  );
}
