import { ProtectedAppShell } from "@/components/protected-app-shell";
import { ToolWorkspace } from "@/components/tool-workspace";

export const metadata = {
  title: "Position Paper"
};

/** Position paper builder workspace page. */
export default function PositionPaperPage() {
  return (
    <ProtectedAppShell>
      <ToolWorkspace
        eyebrow="Paper desk"
        title="Position paper builder"
        description="Shape research into a polished position paper outline with arguments, policy basis, solutions, and verification notes."
        mode="position-paper"
      />
    </ProtectedAppShell>
  );
}
