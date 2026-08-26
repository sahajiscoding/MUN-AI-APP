import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata = {
  title: "Sign In"
};

export default function SignInPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
