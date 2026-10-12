# Where the money numbers came from

Nothing in `numbers.json` is a belief dressed up as a fact. Here is what is measured, what is quoted, and what is a guess — and how much each one is allowed to move the answer.

## Quoted prices (checkable, and dated)

| Item | Figure used | Source | Confidence |
|---|---|---|---|
| Model: default path | `z-ai/glm-5.3-flash` — $0.15 per M input tokens, $0.50 per M output | NVIDIA NIM / Z.ai published list rate, Sep–Oct 2026 | **High** — published list price. Changes without notice, so re-check before pricing decisions. |
| Model: Max mode | `moonshotai/kimi-k3` — $3 per M input, $15 per M output | NVIDIA NIM / Moonshot published list rate, Sep–Oct 2026 | **High** — same caveat. |
| FX | **₹88 = $1** | Assumption, not a quote | **Medium** — every rupee inference figure scales exactly with this. |
| Payments | UroPay flat plan: ₹0 free (≤15 txns/mo), **₹100/mo** Growth (≤50), ₹1,000 Unlimited. **Zero per-transaction commission, zero MDR.** | UroPay's own pricing pages (`uropai.me` / `uropai.in`) | **Medium** — vendor marketing, and the only source available. It is the vendor's claim about its own fees; confirm on the invoice after the first month. It is also the most favourable input in the whole model, which is exactly why it deserves checking. |
| Hosting | **₹1,760/month** ($20 Vercel Pro) | Vercel's own terms: the free Hobby tier is **not licensed for commercial use**. So the first paying customer triggers this cost. | **High on the requirement, medium on the figure** — confirm the current Pro price in the account. |
| Database | ₹0 | Supabase free tier is sufficient at this scale (500MB database, Auth, RLS). It stops being free somewhere around tens of thousands of rows or when the project needs daily backups. | **Medium** — it is free *until it isn't*; the first real growth implies a paid Postgres plan. |
| Domain | ₹83/month (₹1,000/year amortised) | Typical `.app`/`.com` registration | **Medium** — check the actual registrar receipt. |
| Referral commission | **16.72%** of the referred customer's first payment | The product's own schema: `referral_partners.commission_rate numeric(5,2) default 16.72`, applied in the `create_first_referral_commission` RPC. | **High that the rate exists; low that 16.72% is the right rate to model.** See the assumptions below. |

## The three numbers that are guesses, and what they do

### 1. Inference per pass: ₹25 (₹7 default path + ₹18 Max) — *the weakest number in the model*

**Where it comes from:** token ceilings read from the code, not from observed usage. The Quick mode budget is 1,800 output tokens; Max is a 12,000-token class. Using ~2,500 in / 1,200 out for Quick, ~2,500 in / 5,000 out for Thorough, and ~2,500 in / 10,000 out for Max at ₹88/$:

- one **Quick** request ≈ **₹0.07**
- one **Thorough** request ≈ **₹0.25**
- one **Max** request ≈ **₹13.86 — 191× a Quick request**

**What the average customer actually does is unknown.** I modelled 30 requests/month at 95% default / 5% Max. If real users skew to Max, this number is wrong by an order of magnitude in the direction that hurts. **The fix is measurement, not modelling:** the app already routes every request through `lib/ai/router.ts`, so per-request token counts and cost can be logged from day one. Until that data exists, treat ₹25 as a placeholder.

**Worst case the current caps permit:** 300,000 tokens/day at the Max rate ≈ **₹396/day ≈ ₹11,880/month from one ₹299 customer.** 40× the revenue. The caps limit the damage; they do not prevent it.

### 2. Referral share of sales: 40% of customers arrive via a partner — *affects ₹20 of ₹299*

The 16.72% rate is real and in the database. What is unmeasurable today is **what fraction of customers come through a partner** — the referral programme exists but has no trading history. At 40% of sales, the amortised cost is ₹20/pass; at 10% it is ₹5; at 100% it is ₹50. The line is ₹20 either way in `numbers.json`, and the swing is ±₹15 of contribution per pass — small against a ₹254 contribution, so **this assumption cannot change the verdict by itself.** Replace it as soon as the first referral commission lands.

### 3. Ramp: 0.2 passes/day in month 1 rising to 8.5 by month 12 — *this one decides the answer*

**Where it comes from:** 0 → ~260 active monthly-equivalent subscribers in twelve months. That is not from the panel, not from a funnel, and not from a comparison with any competitor's growth — it is a shape chosen to be *plausible*, and the pack is explicit that assumptions are not facts.

**What it is grounded in, weakly:**
- India has **71 upcoming MUN conferences** on the mymun calendar for Oct 2026 – 2027, with the season peaking Jan–Mar and Aug–Nov. A conference is the natural purchase trigger, and the pass is week-shaped, which matches how often conferences happen.
- IIMUN alone claims 220+ cities and 7,500–10,000 schools — the addressable population is large.
- The pricing panel (simulated, and disclosed as such) puts an acceptable range at ₹122–₹800 with an indifference point at ₹304, so ₹299 is not obviously mispriced.

**What it is not grounded in:** any observed conversion rate, any traffic number, any funnel. `/pricing` currently redirects anonymous visitors to sign-in, so there is *no way to measure intent today even if traffic existed.*

**How much it moves the answer:** the volume swing is well absorbed. Cutting the whole ramp by 60% (to ~3 passes/day by month 12, ~100 subscribers) still gives **₹117,837 year-1 profit at a 78% margin.** The verdict is therefore *not* sensitive to the ramp — which is why this assumption, though it is the biggest guess, is not the biggest risk. **The Max-mode cost path is a far bigger threat to solvency than a slow ramp is.**

## Deliberately not in the model

- **Founder's time.** Priced at ₹0. It is not free — it is the real cost of this business, and it does not show up in any table here.
- **Marketing spend.** ₹0 beyond the ₹10,000 launch-test budget. Every rupee of paid acquisition would come out of the ₹254 contribution, and at Indian MUN CPMs a ₹299 price with a 30-day life is a hard place to run paid ads from. Organic and referral only, for now.
- **Refunds, chargebacks, abuse.** Not modelled. UPI disputes are rare but not zero, and a tool that writes position papers will attract some abuse.
- **GST.** Not modelled and **not a call this pack can make.** Digital services to consumers in India may carry a GST obligation with a registration threshold that a bootstrapped solo founder could cross quickly. **Get an accountant before invoicing anyone.** This is the single legal question with the clearest financial consequence.
- **Tax on the profit.** The ₹329,566 year-1 figure is pre-tax operating profit.
- **The x402 bot rail.** $0.05/research and $0.005/content are at or below the inference cost of serving them, and there is no traffic evidence. It is currently a cost centre with a built-in upside; it is not in revenue.

## Also not in the model: the competitor's ability to undercut

Model Diplomat is priced at roughly **₹1,060–1,760/month** and already has a free tier of 50 searches/day. It can move to this product's price band at any time without changing its cost structure, and it would arrive with the trust positioning this product does not have. Nothing in `numbers.json` models a price war. **If one starts, the ₹254 contribution is the first casualty, and no sensitivity table above captures that.**
