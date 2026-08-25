export type Plan = {
  id: string;
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

export function getPlan(planId: string) {
  return plans.find((plan) => plan.id === planId);
}

export function formatPlanPrice(plan: Plan) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: plan.currency,
    maximumFractionDigits: 0
  }).format(plan.amount / 100);
}
