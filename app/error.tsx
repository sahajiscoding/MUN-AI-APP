"use client";

import { useEffect } from "react";
import Link from "next/link";
import { StatePage } from "@/components/site-pages";

/** Global error boundary page with retry and support actions. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <StatePage code="500" title="The server hit a problem" description="Please try again in a moment. If it continues, contact support." action={<div className="flex flex-wrap justify-center gap-3"><button type="button" onClick={() => { reset(); }} className="button-primary px-5 font-semibold">Try again</button><Link href="/support" className="button-secondary inline-flex px-5 font-semibold">Contact support</Link></div>} />;
}
