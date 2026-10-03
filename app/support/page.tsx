import { SupportPage } from "@/components/lifecycle-pages";
import { publicMetadata } from "@/lib/seo";

export const metadata = publicMetadata({
  title: "Support",
  description:
    "Get help with MUN Prep accounts, payments, AI workspace issues, referrals, and certificates.",
  path: "/support",
});
/** Support page with help and contact guidance. */
export default function Page() { return <SupportPage />; }
