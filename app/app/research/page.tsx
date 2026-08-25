import { ProtectedAppShell } from "@/components/protected-app-shell";
import { ToolWorkspace } from "@/components/tool-workspace";

export const metadata = {
  title: "Research"
};

export default function ResearchPage() {
  return (
    <ProtectedAppShell>
      <ToolWorkspace
        eyebrow="Research desk"
        title="Committee research"
        description="Build a full debate-ready brief with country policy, blocs, opposition arguments, POIs, speech angles, and clause ideas."
        mode="research"
      />
    </ProtectedAppShell>
  );
}
