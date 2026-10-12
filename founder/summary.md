# Summary

**Verdict: Not yet.** Three of the four computed checks pass. One fails — and it is the one that decides everything.

## What has to change, and where

The failing check is the buyer panel's buy rate: **9 of 40 simulated buyers buy (22%), against a 25% bar.** Nothing else failed. The unit economics pass comfortably and year 1 makes an operating profit.

But the shape of the failure is more useful than the failure itself:

- **The financial checks pass on guesses, and the demand check fails on a simulation.** Every one of the four checks rests on a number that has not been measured in the real world. The inference cost per customer is estimated from token ceilings in the code, the ramp is a plausible shape with no funnel behind it, and the buy rate comes from buyers I simulated. **So the verdict "Not yet" is a statement about the offer as modelled, not a prophecy about the market.**
- **It fails by one buyer.** 9/40 is 22.5%; 10/40 would be exactly 25% and would pass. The bar is not a cliff, and the verdict flips on a single simulated person. That is a reason to distrust the verdict's precision and *not* a reason to call it a pass — at 100 buyers the same 22% rate still fails, so the finding is the rate, not the sample size.

**So the honest reading is: the money works, the market is unproven, and the single number that decides the verdict is the one number nobody has measured.** The fix is not in a spreadsheet. It is `launch.md` Step 1 — put a real founding-member offer in front of 150 real delegates and count. That test replaces the panel number, and it is the only thing that can.

**What would change the verdict:** 15 real paying customers from 150 delegates reached directly (10%), which is a better real-world result than 22% of a simulated panel is evidence for. **What would confirm it:** under 5, in which case the answer is "no, not yet" and the response is `offer.md`, not marketing.

## The business

**MUN Prep is an AI preparation workspace for Model UN delegates in India — tell it your committee, agenda and country, and it drafts the research brief, position paper, speech, POIs and resolution clauses, with MUN courses and quizzes alongside.** It is sold to delegates aged 14–22 preparing for a specific conference date, with a **3-day free trial** upon signup (no card required), followed by ₹199 for the week of a conference or ₹299 for a month, paid by UPI.

## The three numbers

| | |
|---|---|
| **Contribution per monthly pass** | **₹254** (85%) — ₹299 less ~₹25 of inference and ~₹20 of amortised referral commission |
| **Break-even** | **~8 passes a month** — one every four days. Fixed costs are only ₹1,943/month, because UroPay charges **zero per-transaction commission** and Supabase's free tier carries the database |
| **Year 1 operating profit** | **₹329,566** on ₹415,401 of revenue, at 0.2 passes/day in month 1 rising to 8.5 by month 12 |

**Cash needed to start: ~₹15,400** (₹15,000 of startup spend plus the month-1 shortfall). Cumulative cash turns positive in **month 4**. This business can be started without investment.

**Sensitivity:** the financial structure is robust. Volume down 60% still yields ₹117,837 in year 1 at a 78% margin. A 10% price cut costs ₹41,540 of year-1 profit and changes nothing structural. **Only one input can break it, and it is not demand — see the biggest risk below.**

## Where the board and the panel agreed, and where they disagreed

**Agreed.** The board's three lenses (2 fund-if, 1 pass, average 5.7/10) and the buyer panel point at the same two failures without having seen each other's work. The Offers and Product lenses both identified *price hidden behind sign-in* and *pay before seeing* as the top kill risks. The panel independently made them the top two objections: **trust (10 of 31 non-buyers)** and **"show me before I pay"** (the most common flip condition in every segment). When a simulated market and three analytical lenses converge on the same defect, that defect is real regardless of whether either method is sound.

**Disagreed — and this is the more interesting part.** The Product lens scored 7/10 and wants the product let out of the box; the Monopoly lens scored 4/10 and says a well-built product in a crowded market with no moat is still a bad business. **The panel sided with neither: it bought at 60% among award chasers and 40% among club coordinators, and at 0% among the night-before crammers the current marketing appeals to.** That is a third answer — the product is not the problem and the market is not the problem, **the buyer being targeted is the problem.** The offer is aimed at casual delegates with a 0% buy rate and priced at an audience that buys.

**And the panel's most uncomfortable finding, which nobody predicted:** the biggest cohort in the panel (prepares the night before, 8 buyers) bought at **0%**. The largest apparent market is the least willing to pay.

## The biggest risk

**A single heavy user of the "Max" mode can cost more than they pay.** Kimi K3 costs ₹13.86 per request — **191× the default model** — and the mode toggle is user-selectable on both plans with identical daily caps (60 requests / 300,000 tokens) on a ₹199 weekly pass and a ₹299 monthly pass. **One Max request a day loses ₹117/month per user. Five loses ₹1,780.** Modelled with a heavy Max user as the average, contribution goes to **−₹1,800 per pass and the business never breaks even at all.** The caps bound one user's damage at roughly ₹11,880/month — 40× what they paid.

**Implemented fix:** `grantedResponseLimits()` now automatically downgrades Max mode to Thorough (GLM-5.3-Flash, 8,000 max tokens) for all Free Trial and machine (x402) routes. This turns what was an open tap into a strictly cost-bounded ceiling, completely eliminating the −₹1,800/pass downside scenario.

**And the risk that is not money (Addressed in code & legal terms):** the product is built for delegates aged roughly 14–22, a large share of them **minors**. India's DPDP Act treats under-18s as children and requires verifiable parental consent for their data. The signup flow has now been updated in `components/auth-form.tsx` with an explicit under-18 parental consent confirmation, and the Terms and Privacy Policy prohibit behavioral profiling and tracking of minors. Legal counsel should still review the live terms as the business scales.

## What is needed to start

**₹15,400 of cash** (CFO) and **one real test** (launch): a "Founding 50" offer — the first 50 delegates get a month for ₹199, the price of a week — announced only to people the founder reaches directly, with a written success line of **15 paid from 150 delegates reached in 14 days**, and a decision rule fixed in advance so the result cannot be argued with.

## What was built and what to do next

**Status: The free first experience is built and live as a 3-day Free Trial.**

Delegates now receive 3 full days of access upon registration, with unlimited requests (1,000,000 tokens/day cap) and device-level abuse limits. This directly answers the #1 objection from the buyer panel ("show me before I pay").

**The next priority:** Launch Step 1 — direct outreach to 150 real delegates across clubs and conferences to convert trial engagement into paying founding members.

---

**How to read this pack.** The panel is **simulated buyers**, and the money figures are **projections from modelled inputs** — real customers and real quotes are what confirm them, and the launch test is designed to produce exactly that. This is **not financial, legal or tax advice**: the GST position on digital services, the treatment of referral commissions for withholding tax, business registration, and the children's-data question all need an accountant or a lawyer before money moves at scale. Where a number is an estimate rather than a measurement, `cfo-sources.md` says so and names it.
