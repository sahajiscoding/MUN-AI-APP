import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL("https://mun-ai-app.vercel.app"),
  title: {
    default: "MUN Prep App",
    template: "%s | MUN Prep App"
  },
  description:
    "A paid delegate preparation workspace for Model United Nations research, position papers, speeches, POIs, and resolutions.",
  openGraph: {
    title: "MUN Prep App",
    description:
      "Research, draft, and debate from one focused Model United Nations prep workspace.",
    type: "website"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /* suppressHydrationWarning: the theme provider applies data-theme before
       hydration so the persisted theme wins with no flash of the wrong mode;
       the server cannot know that choice, so suppress the attribute diff. */
    <html lang="en" suppressHydrationWarning>
      <body>
        <AuthProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
