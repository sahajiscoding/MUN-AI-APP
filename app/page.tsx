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
        // Text child, not HTML: React inserts script content as raw text, and
        // `<` is unicode-escaped so no JSON value can break out of the tag.
        // This keeps the client-boundary HTML gate green.
        suppressHydrationWarning
      >
        {JSON.stringify(organizationJsonLd()).replace(/</g, "\\u003c")}
      </script>
      <HomeLanding />
    </>
  );
}
