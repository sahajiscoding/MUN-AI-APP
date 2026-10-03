import { HelpCenterPage } from "@/components/lifecycle-pages";
import { publicMetadata } from "@/lib/seo";

export const metadata = publicMetadata({
  title: "Help Center",
  description:
    "Start with the basics: account access, password resets, payments, certificates, and contacting support.",
  path: "/help",
});
/** Help center page with guidance links. */
export default function Page() { return <HelpCenterPage />; }
