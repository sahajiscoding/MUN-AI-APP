"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Crown,
  Sparkles,
  CheckCircle2,
  X,
  ArrowRight,
  BookOpen,
  MessageSquare,
  Shield,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { readJsonResponse } from "@/lib/http";
import { isTrialPlanId } from "@/lib/plans";

type EntitlementData = {
  status: "inactive" | "active" | "expired";
  planId?: string;
  expiresAt?: string;
  source?: string;
  trialStartedAt?: string;
};

type EntitlementApiResponse = {
  entitlement?: EntitlementData;
  trialGranted?: boolean;
  trialDays?: number;
  error?: string;
};

/**
 * Modal popup that celebrates and announces when a new account is granted
 * the complimentary 3-day free trial.
 *
 * Scoped strictly to accounts that actually received the free trial grant.
 * Never displays for accounts with expired trials, paid subscriptions, or
 * accounts that have already acknowledged the popup.
 */
export function TrialGrantedModal() {
  const { user, getIdToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [trialDays, setTrialDays] = useState(3);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const storageKey = `mun_trial_popup_shown_${user.id}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(storageKey) === "true") {
      return;
    }

    let cancelled = false;

    async function checkTrialGrant() {
      try {
        const token = await getIdToken();
        const response = await fetch("/api/me/entitlement", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) return;

        const data = (await readJsonResponse<EntitlementApiResponse>(response)) ?? {};
        if (cancelled) return;

        const entitlement = data.entitlement;
        const isActive = entitlement?.status === "active";
        const isTrialPlan = isTrialPlanId(entitlement?.planId);
        const wasJustGranted = Boolean(data.trialGranted);

        // Only show if the user actually has an active trial grant AND hasn't seen it yet
        if ((wasJustGranted || isTrialPlan) && isActive) {
          setTrialDays(data.trialDays ?? 3);
          setExpiresAt(entitlement?.expiresAt ?? null);
          setOpen(true);
        }
      } catch {
        // Silently ignore network failures — non-blocking presentation component
      }
    }

    void checkTrialGrant();

    // Also listen for any synthetic event triggered within the app
    function handleCustomTrialGrant(event: Event) {
      const customEvent = event as CustomEvent<{ trialDays?: number; expiresAt?: string }>;
      if (typeof window !== "undefined" && window.localStorage.getItem(storageKey) === "true") {
        return;
      }
      if (customEvent.detail?.trialDays) {
        setTrialDays(customEvent.detail.trialDays);
      }
      if (customEvent.detail?.expiresAt) {
        setExpiresAt(customEvent.detail.expiresAt);
      }
      setOpen(true);
    }

    window.addEventListener("mun:trial-granted", handleCustomTrialGrant);

    return () => {
      cancelled = true;
      window.removeEventListener("mun:trial-granted", handleCustomTrialGrant);
    };
  }, [getIdToken, user]);

  const handleDismiss = useCallback(() => {
    if (user && typeof window !== "undefined") {
      window.localStorage.setItem(`mun_trial_popup_shown_${user.id}`, "true");
    }
    setOpen(false);
  }, [user]);

  // Handle Escape key
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleDismiss();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleDismiss]);

  if (!open) return null;

  const formattedExpiry = expiresAt
    ? new Date(expiresAt).toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-granted-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={handleDismiss}
      />

      {/* Modal Dialog Card */}
      <div className="relative surface rounded-panel border border-[var(--line)] shadow-2xl w-full max-w-lg mx-auto overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Soft decorative background spotlight */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full pointer-events-none opacity-20"
          style={{
            background: "radial-gradient(circle, var(--patina), transparent 70%)",
          }}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-black/5 transition"
          aria-label="Close trial notice"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 sm:p-8 relative">
          {/* Header & Icon */}
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--patina)]/15 text-[var(--patina)] mb-4">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Complimentary Access</span>
            </div>

            <div className="grid h-16 w-16 mx-auto place-items-center rounded-2xl bg-[var(--ink)] text-[var(--paper)] shadow-lg mb-4">
              <Crown className="h-8 w-8 text-[var(--paper)]" aria-hidden="true" />
            </div>

            <h2 id="trial-granted-title" className="display-type text-3xl font-semibold tracking-tight">
              {trialDays}-Day Free Trial Granted!
            </h2>

            <p className="mt-2.5 text-sm sm:text-base text-[var(--muted)] leading-relaxed">
              Your delegate desk is now unlocked with full access. Prepare for your committee with comprehensive diplomatic AI research, speech generation, and debate training.
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="my-6 grid gap-2.5 bg-[var(--panel)]/50 rounded-xl p-4 border border-[var(--line)]">
            <div className="flex items-start gap-3">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--ink)] text-[var(--paper)]">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Committee Briefs & Policy</p>
                <p className="text-xs text-[var(--muted)]">
                  Country stance analysis, UN resolutions, and bloc strategies.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--ink)] text-[var(--paper)]">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Speeches & Position Papers</p>
                <p className="text-xs text-[var(--muted)]">
                  Draft formal delegate opening speeches and working papers.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--ink)] text-[var(--paper)]">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">POIs & Motion Training</p>
                <p className="text-xs text-[var(--muted)]">
                  Practice questions and cross-examination points in real time.
                </p>
              </div>
            </div>
          </div>

          {/* Expiry Pill */}
          <div className="flex items-center justify-center gap-2 text-xs text-[var(--muted)] font-medium mb-6">
            <CheckCircle2 className="h-4 w-4 text-[var(--patina)] shrink-0" />
            <span>
              {formattedExpiry
                ? `Active through ${formattedExpiry} (${trialDays} days total)`
                : `Active for ${trialDays} full days • No payment required`}
            </span>
          </div>

          {/* Primary CTA Button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="button-primary w-full flex items-center justify-center gap-2 py-3 px-4 font-semibold text-base rounded-xl shadow-md transition hover:scale-[1.01] active:scale-[0.99]"
          >
            <span>Start Prepping Now</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
