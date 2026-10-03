import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
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
  authors: [{ name: "MUN Prep" }],
  creator: "MUN Prep",
  publisher: "MUN Prep",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "MUN Prep App",
    description:
      "Research, draft, and debate from one focused Model United Nations prep workspace.",
    url: "/",
    siteName: "MUN Prep",
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "MUN Prep App",
    description:
      "Research, draft, and debate from one focused Model United Nations prep workspace.",
  },
};

/** Root layout wrapping every route with the authentication provider. */
export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
