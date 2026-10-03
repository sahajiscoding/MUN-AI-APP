import { HomeLanding } from "@/components/home-landing";
import { organizationJsonLd, publicMetadata } from "@/lib/seo";

export const metadata = publicMetadata({
  title: "MUN Prep App",
  description:
    "A paid delegate preparation workspace for Model United Nations research, position papers, speeches, POIs, and resolutions.",
  path: "/",
});

/** Public homepage rendering the marketing landing experience. */
export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
      />
      <HomeLanding />
    </>
  );
}
