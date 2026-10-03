import { redirect } from "next/navigation";
import { ReferralAdminPanel } from "@/components/referral-admin-panel";
import { requireAdmin } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

/** Admin referrals page guarding access before rendering partner data. */
export default async function AdminReferralsPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/c8f2x9");
  }

  return <ReferralAdminPanel />;
}
