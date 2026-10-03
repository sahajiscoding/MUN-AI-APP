import { ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";

// Append-only audit trail for privileged admin actions. Table is service-role
// only (no RLS policies grant access to browser roles). Logging must never
// fail the action it accompanies, so failures are warnings only.
/** Append a privileged admin action to the audit log, failing closed on write errors. */
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
      throw new ApiError(503, "audit_log_unavailable", "Administrative action could not be recorded.");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "audit_log_unavailable", "Administrative action could not be recorded.");
  }
}
