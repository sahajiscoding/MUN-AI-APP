export type Plan = {
  id: "weekly-pass" | "monthly-pass";
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
};

/** Normalize a plan id alias to its canonical plan id, or null if unknown. */
export function canonicalPlanId(planId: string | null | undefined) {
  if (!planId) return null;
  return legacyPlanIds[planId.trim().toLowerCase()] ?? null;
}

/** Look up a plan by id or alias, returning undefined when not found. */
export function getPlan(planId: string | null | undefined) {
  const canonicalId = canonicalPlanId(planId);
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
