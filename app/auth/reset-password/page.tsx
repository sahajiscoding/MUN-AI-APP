import { ResetPasswordForm } from "@/components/account-recovery";
import { PublicPage } from "@/components/site-pages";
export const metadata = { title: "Reset password" };
export default function ResetPasswordPage() { return <PublicPage><section className="mx-auto max-w-md px-5 py-16 sm:px-8"><p className="label-text text-[var(--oxblood)]">Account recovery</p><h1 className="display-type mt-3 text-5xl">Set a new password.</h1><p className="mt-4 text-sm leading-6 text-[var(--muted)]">Use the secure link from your email to update your password.</p><div className="mt-8"><ResetPasswordForm /></div></section></PublicPage>; }
