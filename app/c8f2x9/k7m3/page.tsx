import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { privateMetadata } from "@/lib/seo";
import { requireAdmin } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";
export const metadata = privateMetadata("Administrator dashboard");

/**
 * Private administrator dashboard.
 *
 * Access is decided on the server before any client code is sent: without a
 * valid, signed admin session cookie this redirects to the admin login gate.
 * The dashboard UI (including the MiroFish-inspired Swarm Lab) is rendered by
 * the client component, but it is never reachable without passing this check.
 */
export default async function AdminDashboardPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/c8f2x9");
  }

  return <AdminDashboard />;
}
