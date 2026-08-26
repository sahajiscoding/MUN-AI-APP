"use client";

import { useEffect } from "react";

export function ReferralCookieCapture({ code }: { code: string }) {
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/referrals/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      signal: controller.signal,
    }).catch(() => {
      // The landing page remains usable if cookie capture is temporarily unavailable.
    });
    return () => controller.abort();
  }, [code]);

  return null;
}
