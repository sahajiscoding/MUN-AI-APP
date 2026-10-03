import { redirect } from "next/navigation";
import { AnalyticsAdminPanel } from "@/components/analytics-admin-panel";
import { requireAdmin } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

/** Admin analytics page guarding access before rendering metrics. */
export default async function AdminAnalyticsPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/c8f2x9");
  }

  return <AnalyticsAdminPanel />;
}
