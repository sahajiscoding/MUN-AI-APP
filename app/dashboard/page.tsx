import { redirect } from "next/navigation";

export const metadata = {
  title: "Dashboard"
};

/** Dashboard entry redirecting to the research workspace. */
export default function DashboardPage() {
  redirect("/app/research");
}
