import { supabaseAdmin } from "@/lib/supabase/server";

// Append-only audit trail for privileged admin actions. Table is service-role
// only (no RLS policies grant access to browser roles). Logging must never
// fail the action it accompanies, so failures are warnings only.
export async function recordAdminAction(input: {
  actorUid?: string;
  actorEmail?: string;
  action: string;
  targetUid?: string;
  target?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { error } = await supabaseAdmin().from("admin_audit_log").insert({
      actor_uid: input.actorUid ?? null,
      actor_email: input.actorEmail ?? null,
      action: input.action,
      target_uid: input.targetUid ?? null,
      target: input.target ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) {
      console.warn("Admin audit log insert failed:", error.message);
    }
  } catch (error) {
    console.warn("Admin audit log insert failed:", error instanceof Error ? error.message : "unknown error");
  }
}
