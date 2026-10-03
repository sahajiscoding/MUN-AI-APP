import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getReferralPartner } from "@/lib/referrals";

export const dynamic = "force-dynamic";

/** Referral login page attributing the signup to the partner link. */
export default async function ReferralLoginPage({
  params,
}: {
  params: Promise<{ referralSlug: string }>;
}) {
  const { referralSlug } = await params;
  const prefix = "referral-";
  const referralCode = referralSlug.startsWith(prefix)
    ? referralSlug.slice(prefix.length)
    : "";
  const partner = referralCode ? await getReferralPartner(referralCode) : null;

  if (!partner) {
    redirect("/login");
  }

  return (
    <Suspense>
      <AuthForm mode="login" referralCode={partner.referral_code} />
    </Suspense>
  );
}
