# Pricing

## The decision

**Keep ₹299 for the monthly pass. Keep ₹199 for the weekly pass. Add a capped ₹0 first experience.** The prices are right; what is missing is a way to get the first taste free.

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

## The change to make

**Add a free first experience — and be specific about it, because "add a free tier" is advice, not a decision.** Three options, ranked by what they cost and what they prove:

| Option | What it is | Cost to the founder | What it proves |
|---|---|---|---|
| **A. One free brief per account** *(recommended)* | New account gets one complete Quick-mode research brief for their own committee, agenda and country, once, no card. After that, pay. | ~₹0.07 of inference + the abuse controls already in place | Whether the output is good enough to be worth ₹199 — the exact question every non-buying buyer asked |
| **B. Two-day trial on the weekly pass** | Time-boxed access to the weekly pass, no card, once per account | same inference, higher token abuse risk | same, plus whether they come back |
| **C. Free tier in the leader's shape** | 5–10 requests/day forever | recurring inference on freeloaders, plus it weakens the paid conversion | the leader's model, copied — it works, but it costs the most and models a different business |

**Do A.** It costs approximately seven paise, it answers the single loudest objection in the panel ("why should I pay before I've seen if the output is any good?" — 4 buyers, plus "any free trial at all" as the top flip condition), and it requires no change to the price or to the plan structure. The panel's *most common* flip condition, across every segment, was a free look at the output. Option C is how Model Diplomat does it and would trade away the paid-only discipline that keeps this business simple; it is the right move only after A proves the output converts.

## What the pricing should NOT be

- **Do not discount to ₹99 or "₹49 first month".** The buyers already flag low prices as suspicious — ₹123 is the floor where they stop believing the quality. A launch discount teaches the market the true price is lower and it is hard to climb back from.
- **Do not launch a school/delegation price from the same page, yet.** The block sale is real (the panel's club-head cohort bought at 40% and one explicitly asked for a delegation price), but the shape of a school deal — seats, invoice, term dates, a teacher's sign-off — is a sales process, not a price point. Prove it with two real schools first, then put a number on it in `offer.md`.
- **Do not sell per-request or per-token.** The mode toggle already leaks the cost story to the buyer, which is a competitive weakness, not a feature. Nobody buys a MUN paper in "tokens".
- **Do not raise the price before the free brief exists.** The panel says they'd pay ₹800 before refusing. They also said they will not pay before they see. Fix the seeing first; then the price has room.

## When to revisit

- **After 50 real paying customers:** replace the panel's shape with real conversion data at ₹199 and ₹299 and re-run `van_westendorp.py` on real answers.
- **If the free brief converts above ~15%:** the ceiling is higher than modelled. Test ₹399 on new visitors rather than raising the existing price.
- **If the free brief converts below ~3%:** the problem is the output, not the price. Do not cut the price — that would hide the real finding.
- **If a school deal closes:** the per-seat effective price will be well below ₹299 and that is fine, because the block eliminates acquisition cost per delegate.

**The one pricing sentence worth remembering:** the business's pricing is not broken, its *funnel* is — there is no way to experience the product before paying, and that is the exact question the loudest non-buyers asked. Fix the free first look, and the existing price should hold.
