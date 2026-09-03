import Link from "next/link";
import { MailCheck } from "lucide-react";
import { PublicPage } from "@/components/site-pages";
export const metadata = { title: "Verify your email" };
export default function VerifyEmailPage() { return <PublicPage><section className="mx-auto max-w-xl px-5 py-16 text-center sm:px-8"><MailCheck className="mx-auto h-10 w-10 text-[var(--patina)]" aria-hidden="true" /><p className="label-text mt-6 text-[var(--oxblood)]">Email verification</p><h1 className="display-type mt-3 text-5xl">Check your inbox.</h1><p className="mt-5 text-base leading-7 text-[var(--muted)]">Confirm your email address using the link we sent you. After confirmation, return to MUN Prep and sign in.</p><Link href="/login" className="button-primary mt-8 inline-flex px-5 font-semibold">Back to sign in</Link></section></PublicPage>; }
