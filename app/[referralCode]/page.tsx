import { notFound } from "next/navigation";

import HomePage from "@/app/page";
import { ReferralCookieCapture } from "@/components/referral-cookie-capture";
import { getReferralPartner } from "@/lib/referrals";

export const dynamic = "force-dynamic";

const REFERRAL_PATH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/;

export default async function ReferralLandingPage({
  params,
}: {
  params: Promise<{ referralCode: string }>;
}) {
  const { referralCode } = await params;
  const candidate = referralCode.trim();

  // This route is only for referral codes. Reject dot-prefixed names,
  // extensions, separators, and malformed values instead of serving the
  // homepage for requests such as /.env or /server.js.
  if (!REFERRAL_PATH_PATTERN.test(candidate) || candidate.includes(".")) {
    notFound();
  }

  let partner = null;
  try {
    partner = await getReferralPartner(candidate);
  } catch (error) {
    console.error("Referral landing lookup unavailable:", error instanceof Error ? error.message : "unknown error");
  }

  if (!partner) {
    notFound();
  }

  return (
    <>
      <ReferralCookieCapture code={partner.referral_code} />
      <HomePage referralName={partner.name} />
    </>
  );
}
