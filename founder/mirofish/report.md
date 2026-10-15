# MUN Prep App · synthetic swarm replay

> **Read this before interpreting the output.** The 40 profiles used here come from the existing *synthetic* founder panel. This deterministic local replay is not the MiroFish runtime, has no external LLM/OASIS/Zep calls, and creates no independent human evidence. Stance counts are not a conversion forecast. The original panel's pre-trial answers are memories, not fresh reactions from real delegates.

## Scenario

How might India-based Model UN delegates react to the current MUN Prep workspace, its 3-day no-card trial, and ₹199 weekly / ₹299 monthly passes?

The current snapshot includes a **3-day free trial without a payment card**, ₹199 for a weekly pass, ₹299 for a monthly pass, and the research, country-policy, position-paper, speech, POI, resolution, course, and glossary workspaces. The prior synthetic panel was written against an older pay-first offer. This replay deliberately preserves that time boundary.

## Signals in the replay

- **needs evidence — 8 profiles.** A modeled replay category, not a purchase-intent count.
- **needs social proof — 8 profiles.** A modeled replay category, not a purchase-intent count.
- **trial curious — 7 profiles.** A modeled replay category, not a purchase-intent count.
- **value check — 7 profiles.** A modeled replay category, not a purchase-intent count.
- **group adoption — 5 profiles.** A modeled replay category, not a purchase-intent count.
- **coach led — 3 profiles.** A modeled replay category, not a purchase-intent count.
- **price check — 2 profiles.** A modeled replay category, not a purchase-intent count.

### What the current trial appears to change

The trial is a concrete risk-reversal: trial-curious profiles can inspect the workflow before payment. It does **not** by itself answer whether facts are verifiable, whether a coach endorses the output, or whether the product is distinct from free general-purpose AI. Those remain product-proof questions, not copy problems.

### What not to infer

- Do not describe these modeled categories as 40 new votes, 40 independent agents, customers, or validated intent.
- The archived panel's original 9/40 (22.5%) buy result belongs to the prior synthetic offer and should not be re-labeled as the conversion rate for the current product.
- The source-evidence walkthrough, public sample brief, and club pilot are **what-if experiments** in the interactive console, not claims about features already shipped.
- No testimonial or named customer endorsement is created by this simulation.

## Experiments worth running with real delegates

1. Put a real committee brief in front of delegates during the trial and ask them to verify the underlying claims.
2. Ask a coach to review one output and record the criticism, not only the praise.
3. Test a consented, real sample brief before signup; do not manufacture a success story.
4. Ask club coordinators whether a guided pilot has value before setting a delegation price.
5. Measure actual trial activation and trial-to-paid conversion, segmented by conference timing and acquisition source.

## Method and provenance

- Seed: 11; profiles: 40; timeline: five rounds on two simulated platforms.
- Inputs: 'founder/customer.json', 'founder/panel/personas.json', the 40 answer files, 'founder/panel/results.json', and the current product plan in 'lib/plans.ts'.
- Engine: transparent, deterministic scenario templates and memory tags; no network access and no model inference.
- MiroFish reference: https://github.com/666ghj/MiroFish. The five-stage workflow vocabulary is used as a design reference; this artifact is not an upstream-engine run.
