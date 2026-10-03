import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata = {
  title: "Sign In"
};

/** Sign-in page rendering the email and Google login form. */
export default function SignInPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
