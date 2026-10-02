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
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
