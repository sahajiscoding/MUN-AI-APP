import { redirect } from "next/navigation";
import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata("Dashboard");

/** Dashboard entry redirecting to the research workspace. */
export default function DashboardPage() {
  redirect("/app/research");
}
