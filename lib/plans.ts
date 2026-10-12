export type Plan = {
  id: "weekly-pass" | "monthly-pass" | "free-trial";
  name: string;
  description: string;
  amount: number;
  currency: "INR";
  accessDays: number;
  features: string[];
};

export const plans: Plan[] = [
  {
    id: "weekly-pass",
    name: "Weekly Pass",
    description: "One week of full access for quick conference prep.",
    amount: 19900,
    currency: "INR",
    accessDays: 7,
    features: [
      "AI research workspace",
      "Country policy profiler",
      "Position paper builder",
      "Speech and POI practice",
      "Resolution clause drafting"
    ]
  },
  {
    id: "monthly-pass",
    name: "Monthly Pass",
    description: "A full month of unlimited delegate prep.",
    amount: 29900,
    currency: "INR",
    accessDays: 30,
    features: [
      "Everything in Weekly Pass",
      "Longer prep history",
      "Multiple committee workspaces",
      "Priority model routing",
      "Export-ready draft organization"
    ]
  }
];

const legacyPlanIds: Record<string, Plan["id"]> = {
  weekly: "weekly-pass",
  "weekly-pass": "weekly-pass",
  monthly: "monthly-pass",
  "monthly-pass": "monthly-pass",
  // NOTE: `trial` is deliberately absent. `create-order` resolves the amount it
  // charges through getPlan(), so aliasing an extra id into the plan table is a
  // way to let a caller buy something the catalogue does not sell. The trial is
  // granted only by start_free_trial(), never by the purchase path.
  "free-trial": "free-trial",
};

/**
 * The free trial, deliberately NOT a member of `plans`.
 *
 * `plans` is the catalogue a visitor can buy, and it is rendered directly by
 * the paywall modal and the pricing page — putting a ₹0 entry there would
 * advertise a plan with a "Buy now" button that must not exist. It is still a
 * *plan* for labelling purposes, so `getPlanForDisplay()` resolves it while
 * `getPlan()` — the resolver the checkout path trusts — does not.
 */
export const FREE_TRIAL_PLAN_ID = "free-trial";

/** Days of free access granted once, automatically, to a new account. */
export const FREE_TRIAL_DAYS = 3;

export const freeTrialPlan: Plan = {
  id: FREE_TRIAL_PLAN_ID,
  name: "Free Trial",
  description: "Three days of full access, granted once to every new account.",
  amount: 0,
  currency: "INR",
  accessDays: FREE_TRIAL_DAYS,
  features: [
    "AI research workspace",
    "Country policy profiler",
    "Position paper builder",
    "Speech and POI practice",
    "Resolution clause drafting"
  ]
};

/** True when a plan id (or alias) refers to the one-time free trial. */
export function isTrialPlanId(planId: string | null | undefined) {
  return canonicalPlanId(planId) === FREE_TRIAL_PLAN_ID;
}

/** Normalize a plan id alias to its canonical plan id, or null if unknown. */
export function canonicalPlanId(planId: string | null | undefined) {
  if (!planId) return null;
  return legacyPlanIds[planId.trim().toLowerCase()] ?? null;
}

/**
 * Look up a **purchasable** plan by id or alias.
 *
 * This is the resolver the checkout path uses to decide what to charge, so it
 * must never return the free trial. Keep it that way.
 */
export function getPlan(planId: string | null | undefined) {
  const canonicalId = canonicalPlanId(planId);
  return plans.find((plan) => plan.id === canonicalId);
}

/**
 * Look up any plan an account can be *on*, including the free trial.
 *
 * Display only — never use this to decide a price.
 */
export function getPlanForDisplay(planId: string | null | undefined) {
  const canonicalId = canonicalPlanId(planId);
  if (canonicalId === FREE_TRIAL_PLAN_ID) return freeTrialPlan;
  return plans.find((plan) => plan.id === canonicalId);
}

/** Format a plan amount stored in paise as an INR currency string. */
export function formatPlanPrice(plan: Plan) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: plan.currency,
    maximumFractionDigits: 0
  }).format(plan.amount / 100);
}
