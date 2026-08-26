import HomePage from "@/app/page";
import { ReferralCookieCapture } from "@/components/referral-cookie-capture";
import { getReferralPartner } from "@/lib/referrals";

export const dynamic = "force-dynamic";

export default async function ReferralLandingPage({
  params,
}: {
  params: Promise<{ referralCode: string }>;
}) {
  const { referralCode } = await params;
  let partner = null;
  try {
    partner = await getReferralPartner(referralCode);
  } catch (error) {
    console.error("Referral landing lookup unavailable:", error instanceof Error ? error.message : "unknown error");
  }

  if (!partner) {
    return <HomePage />;
  }

  return (
    <>
      <ReferralCookieCapture code={partner.referral_code} />
      <HomePage referralName={partner.name} />
    </>
  );
}
