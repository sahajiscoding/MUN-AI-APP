import { ForgotPasswordForm } from "@/components/account-recovery";
import { PublicPage } from "@/components/site-pages";
export const metadata = { title: "Forgot password" };
export default function ForgotPasswordPage() { return <PublicPage><section className="mx-auto max-w-md px-5 py-16 sm:px-8"><p className="label-text text-[var(--oxblood)]">Account recovery</p><h1 className="display-type mt-3 text-5xl">Forgot password?</h1><p className="mt-4 text-sm leading-6 text-[var(--muted)]">Enter your account email and we’ll send a secure reset link if an account exists.</p><div className="mt-8"><ForgotPasswordForm /></div></section></PublicPage>; }
