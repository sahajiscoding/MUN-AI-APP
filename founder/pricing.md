# Pricing

## The decision

**Keep ₹299 for the monthly pass. Keep ₹199 for the weekly pass. Live: 3-day free trial on signup.** The prices are validated; the missing trial experience has now been built into the product.

Evidence for the price itself is below. The important line is this one: **₹299 is not too high.** The buyers in the panel put their indifference point at ₹304 and were willing to go to ₹800 before they called it too expensive. If anything, this product is priced with room left on the table — and the CFO's model shows the same thing from the other side, where the whole business is nearly cost-insensitive to price.

## What the buyers said

From `founder/pricing-curve.md` (40 buyer answers, simulated — read the disclosure in `panel/results.md` first). Median answers:

| Question | Median answer |
|---|---|
| So cheap I'd doubt it works | ₹80 |
| A bargain | ₹200 |
| Getting expensive | ₹600 |
| Too expensive, won't buy | ₹1,200 |

| Point | Price | Reading |
|---|---:|---|
| Point of marginal cheapness (PMC) | **₹123** | Below this, buyers start doubting the quality. |
| Optimal price point (OPP) | **₹152** | The least-resistance price. Equal numbers call it cheap and expensive. |
| Indifference price point (IPP) | **₹304** | Equal numbers call it a bargain and expensive. |
| Point of marginal expensiveness (PME) | **₹800** | Above this, resistance overwhelms willingness. |

**Acceptable range ₹123–₹800. The current ₹299 sits essentially on the indifference price point (₹304)** — inside the range, at the price where the market is genuinely undecided about value. ₹199 is also inside the range and closer to the "bargain" side.

**Read these with the caveats loud, not quiet.** The sample is 40, it is simulated, and simulated buyers are agreeable. The *shape* of the answer is more reliable than its level: buyers see cheapness and expensiveness as equally likely at ~₹300, and only start refusing around ₹800. That shape says the ceiling is not the problem.

## Why the current price is right

1. **It is anchored to a real number the buyer already paid.** A Delhi MUN delegate fee is around **₹2,500**, and conference travel runs higher. A ₹299 monthly pass is ~12% of the entry cost, and a ₹199 weekly pass is less than a day's travel. That is the strongest anchor in this whole pack and it is the one to *say out loud in the pitch*.
2. **It is deliberately below the general-purpose alternative.** ChatGPT Go is ₹399/month in India. Being cheaper than the thing the delegate was already considering makes the buy easy. It is also roughly one-fifth to one-sixth of the specialist leader (Model Diplomat, ~₹1,060–1,760/month).
3. **The weekly pass matches the actual unit of the decision.** A delegate prepares for *one* conference. ₹199 for the week of that conference is the sharpest product shape in the business, and the panel confirms it — one buyer (P020, a school delegate whose parents pay) said outright that the weekly plan is the only reason she would say yes, because a monthly plan is a waste for one conference.
4. **The margin holds at any plausible price in the range.** At ₹299 the contribution is ₹254 (85%). Moving to ₹399 lifts year-1 profit from ₹329,566 to ₹468,496 and raises the margin to 87%. Moving to ₹199 still leaves a healthy business. **Price is not where this business is fragile.**

## The change made: 3-Day Free Trial

**Implemented: Option B, expanded to a 3-Day Free Trial.** Rather than a single brief, new signups receive 3 full days of access (`FREE_TRIAL_DAYS = 3`).

| Plan / Trial | Access | Cost Controls & Limits |
|---|---|---|
| **3-Day Free Trial** | Full access to research briefs, position papers, speeches, clauses | 1,000,000 token/day cap, unlimited requests; Max mode safely downgraded to Thorough (GLM-5.3-Flash); device fingerprinting anti-abuse limits |
| **Weekly Pass (₹199)** | 7 days full access | 60 requests/day, 300,000 tokens/day |
| **Monthly Pass (₹299)** | 30 days full access | 60 requests/day, 300,000 tokens/day, multi-workspace history, priority routing |

This directly answered the single loudest objection in the panel ("why should I pay before I've seen if the output is any good?" and "any free trial at all"). By automatically downgrading the expensive Kimi K3 (Max mode) to GLM-5.3-Flash (Thorough mode) on the trial, the business's unit economics are protected from runaway inference abuse.

## What the pricing should NOT be

- **Do not discount to ₹99 or "₹49 first month".** The buyers already flag low prices as suspicious — ₹123 is the floor where they stop believing the quality. A launch discount teaches the market the true price is lower and it is hard to climb back from.
- **Do not launch a school/delegation price from the same page, yet.** The block sale is real (the panel's club-head cohort bought at 40% and one explicitly asked for a delegation price), but the shape of a school deal — seats, invoice, term dates, a teacher's sign-off — is a sales process, not a price point. Prove it with two real schools first, then put a number on it in `offer.md`.
- **Do not sell per-request or per-token.** The mode toggle already leaks the cost story to the buyer, which is a competitive weakness, not a feature. Nobody buys a MUN paper in "tokens".
- **Do not raise the price before conversion data is gathered.** The panel says they'd pay ₹800 before refusing. Gather real trial-to-paid conversion data at ₹199/₹299 first.

## When to revisit

- **After 50 real paying customers:** replace the panel's shape with real conversion data at ₹199 and ₹299 and re-run `van_westendorp.py` on real answers.
- **If the trial converts above ~15%:** the ceiling is higher than modelled. Test ₹399 on new visitors rather than raising the existing price.
- **If the trial converts below ~3%:** the problem is the output, not the price. Do not cut the price — that would hide the real finding.
- **If a school deal closes:** the per-seat effective price will be well below ₹299 and that is fine, because the block eliminates acquisition cost per delegate.

**The one pricing sentence worth remembering:** the business's pricing is not broken; the previous funnel was — it gave visitors no way to experience the product before paying. With the 3-day free trial live and public pricing on `/pricing`, the barrier is removed.
