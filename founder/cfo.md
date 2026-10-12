> **Currency:** every figure below is in **Indian rupees**. The tool prints `$` because it was written for a café, not for rupees. Read `$299.00` as ₹299.
>
> **Dates of the inputs:** model prices are the published Z.ai and Moonshot list rates (Sep–Oct 2026); the USD→INR conversion used is **₹88 = $1** (a soft assumption — check the live rate; every inference number moves with it).

## The CFO's note

**The margin: 85% contribution, ₹254 per monthly pass.** Price ₹299, less ₹7 of GLM-5.3-Flash inference on the default path, less ₹18 of Kimi K3 inference on the Max path, less ₹20 of amortised referral commission. Fixed costs are ₹1,943/month, so **break-even is about 8 passes a month** — one approximately every four days. This is a very forgiving cost structure. UroPay is a genuine gift here: **zero per-transaction commission** removes the 1.5–3% that would otherwise come off every single sale, and at this volume the flat plan is ₹100/month.

**The line to watch is not the ramp — it is the mode mix.** I assumed a typical pass-holder makes 30 requests a month, of which ~1.5 are Max. Under that assumption the business is comfortable. But:

| Kimi K3 ("Max") requests per day | Inference cost/month | Against ₹299 of revenue |
| ---: | ---: | --- |
| 1 | ₹416 | **already a loss of ₹117** |
| 5 | ₹2,079 | loss of ₹1,780 |
| 10 | ₹4,158 | loss of ₹3,859 |
| 25 (the caps allow ~25/day) | ₹10,395 | loss of ₹10,096 |

A single Kimi K3 request costs **₹13.86 — 191× a Quick request.** One Max user who uses the tool lightly-but-consistently, at one Max request a day, **costs more than they pay.** Modelled with a heavy Max user as the *average* customer, contribution goes to **−₹1,800 per pass (−602%) and the business never reaches break-even at all** — a year-1 loss of ₹25 lakh on ₹4.15 lakh of revenue. That is the only input in this model that can turn a good business into an insolvent one.

**Update / Implemented control:** `grantedResponseLimits()` now automatically downgrades Max mode to Thorough (GLM-5.3-Flash, 8,000 max tokens) on all Free Trial accounts and machine x402 callers. This ensures that non-paying triallists and $0.05 machine micro-payments can never consume ₹13.86 Kimi K3 inference. Paid subscribers remain bounded by the 300,000-token daily ledger.

**Cash: the founder needs about ₹15,400 to get to self-funding** — ₹15,000 of startup spend (domain/tooling, and the launch test budget) plus the month-1 shortfall. Cumulative cash turns positive in **month 4**. Payback on the startup spend is fast because the fixed base is only ₹1,943/month.

**The good news, and it is worth stating plainly: this business survives a bad ramp.** At 40% of the planned volume — fewer than 4 passes a day at year end, roughly 100 active subscribers instead of 255 — the margin holds at 78% and year 1 still clears **₹117,837**. Volume risk is well absorbed. Cost risk on the Max path is not.

**Three ways to improve the margin, each with the number it changes:**

1. **Put Kimi K3 behind the paid tier, or price it.** *(Partially implemented)* Max mode is already prohibited/downgraded for free trial and machine users. Making Max a Monthly-Pass-only feature and capping it for paid tiers (say 20 Max requests per pass, then falling back to GLM-5.3-Flash) permanently removes the tail on paid accounts too. *Changes: the entire −₹1,800/pass downside scenario.*
2. **Cut the mode toggle to one default and let the server choose.** If 90% of requests run on GLM-5.3-Flash by default, inference per pass falls from ₹25 to roughly **₹8**, lifting contribution from ₹254 to **₹271 (+₹17/pass)**. *Run `--volume`-style what-ifs on the unit cost to see it; the lever is the model, not the price.*
3. **Raise the price.** The buyer panel's acceptable range runs to ₹800 and its indifference point is ₹304, so ₹299 is not the ceiling — it is roughly the **midpoint of what these buyers say they would pay**. Moving the monthly pass to **₹399** adds ₹100 of contribution per pass (+39%) with no change to the cost base. *Run `--price 399`: year-1 profit rises to about ₹468,000.*

**On the board's conditions about money:** the board set no numeric financial condition — it asked for proof of demand and a plan for distribution, which are the panel's and marketing's jobs, not mine. What I can say is that **the financial structure is not the problem.** On these inputs the business is profitable at a scale a solo founder can plausibly reach, needs almost no capital, and breaks even in month 4. The money question is not *can it work* but *will anyone pay*, and I cannot answer that from a spreadsheet.

**One caution on the inputs:** the ₹25/pass inference figure is the least solid number here, because nobody has usage data yet — it is built from token-ceiling estimates in the code, not from observed usage. Instrument real usage before trusting it. Of everything in this pack, this is the number to replace with a measurement.

**Not financial, tax or legal advice.** Get an accountant to check the structure, any GST position on digital services, and how the referral commissions should be treated before money moves.

---

# Unit economics: MUN Prep App — AI preparation workspace for Model UN delegates (India-first). All amounts in Indian rupees (INR); the tool prints '$' where it means rupees.

Every number below comes from the input file. Nothing is looked up or guessed.

## One monthly pass (30 days of access)

| line | per monthly pass (30 days of access) |
| --- | ---: |
| Price | $299.00 |
| NVIDIA inference, GLM-5.3-Flash — ~28 Quick/Thorough requests at $0.15/M in, $0.50/M out | -$7.00 |
| NVIDIA inference, Kimi K3 — ~1.5 Max-mode requests at $3/M in, $15/M out | -$18.00 |
| Referral commission 16.72% of the first payment, amortised across all customers (assumes ~40% arrive via a partner) | -$20.00 |
| **Contribution** (what each monthly pass (30 days of access) leaves to pay the fixed costs) | **$254.00** (85%) |

## The margin that matters

Fixed costs: $1,943 a month (Vercel Pro (commercial use is not permitted on the free Hobby tier) $1,760, UroPay Growth plan (flat, up to 50 transactions/month, zero per-transaction commission) $100, Domain name, annualised $83, Supabase free tier $0).

- **Break-even: 1 monthly pass (30 days of access)s a day.** Below that you lose money every month.
- **Profit margin at your plan** (8 a day): **82%** of every sale, after every cost.

## Year 1, month by month

| month | monthly pass (30 days of access)s a day | revenue | profit | cumulative (after $15,000 startup) |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | $1,794 | -$419 | -$15,419 |
| 2 | 0 | $4,216 | $1,638 | -$13,781 |
| 3 | 1 | $7,804 | $4,686 | -$9,094 |
| 4 | 2 | $13,455 | $9,487 | $393 |
| 5 | 2 | $20,362 | $15,354 | $15,747 |
| 6 | 3 | $27,538 | $21,450 | $37,198 |
| 7 | 4 | $35,880 | $28,537 | $65,735 |
| 8 | 5 | $44,850 | $36,157 | $101,892 |
| 9 | 6 | $53,192 | $43,244 | $145,135 |
| 10 | 7 | $61,265 | $50,102 | $195,237 |
| 11 | 8 | $68,800 | $56,502 | $251,739 |
| 12 | 8 | $76,245 | $62,827 | $314,566 |

- **Year 1 operating profit: $329,566** on $415,401 of revenue.
- After the $15,000 startup spend: $314,566.
- Startup money earned back: month 4.
- Cash you need before it pays for itself: **$15,419**.

## What if

| scenario | margin at plan | break-even a day | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | 82% | 1 | $329,566 |
| Price -10% | 80% | 1 | $288,026 |
| Volume -20% | 82% | 1 | $258,990 |
| Unit costs +15% | 80% | 1 | $320,188 |

No red flags in these numbers. They are only as good as the inputs: check every cost against a real quote.
