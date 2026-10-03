import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { publicMetadata } from "@/lib/seo";

export const metadata = publicMetadata({
  title: "Sign In",
  description: "Sign in to your MUN Prep account to continue delegate preparation.",
  path: "/login",
});

/** Login page rendering the sign-in form. */
export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
