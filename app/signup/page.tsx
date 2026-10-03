import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { publicMetadata } from "@/lib/seo";

export const metadata = publicMetadata({
  title: "Create Account",
  description: "Create your MUN Prep account and start preparing for Model United Nations.",
  path: "/signup",
});

/** Signup page rendering the account creation form. */
export default function SignupPage() {
  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
