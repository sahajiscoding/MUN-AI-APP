import { redirect } from "next/navigation";
import { ReferralAdminPanel } from "@/components/referral-admin-panel";
import { requireAdmin } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminReferralsPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/c8f2x9");
  }

  return <ReferralAdminPanel />;
}
