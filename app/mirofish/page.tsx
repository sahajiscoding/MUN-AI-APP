import { MirofishConsole } from "@/components/mirofish-console";
import { ProtectedAppShell } from "@/components/protected-app-shell";
import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata("Swarm Intelligence Lab");

/** Authenticated, five-stage MiroFish-inspired scenario console. */
export default function MirofishPage() {
  return (
    <ProtectedAppShell>
      <MirofishConsole />
    </ProtectedAppShell>
  );
}
