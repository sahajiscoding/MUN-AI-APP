# MUN Prep — one page

**Verdict (computed, not written): Not yet.** Three of four checks pass; the buyer check falls short at 22% against a 25% bar. The plan is one real test away from a different answer.

## The problem

A Model UN delegate in India has a conference in three weeks, a committee they have never sat in, and a country they know nothing about. They have to produce researched policy, a position paper, an opening speech, points of information and draft clauses — and they do it at 11pm on a phone, mostly by prompting a free general-purpose chatbot that returns something too generic to say out loud, or by borrowing a senior's paper from two years ago. The conference fee their parents already paid is around **₹2,500**. There is no prep tool built for the Indian circuit at a price an Indian student would pay.

## The customer

**Model UN delegates in India, aged 14–22**, preparing for a specific conference date. The ones who actually buy are the **committed** ones: delegates chasing an award (60% buy rate in the panel) and — the highest-value cohort — **club heads and school coordinators buying for a whole delegation** (40%). They are found on Instagram, in WhatsApp club groups, and through their teachers.

## The offer and the price

An AI preparation workspace: give it the committee, the agenda and the country, and it produces the research brief, country position, position paper, opening speech, POIs and resolution clauses, with MUN courses and a glossary alongside. On a phone, in about a minute.

- **₹199 for one week** — matched to the week of a conference
- **₹299 for one month**
- Paid by **UPI**, through **UroPay** — which charges **zero per-transaction commission** (a flat ₹0–1,000/month by volume), meaning no payment fee comes off any sale
- **Free experience:** **3-day free trial on signup** (unlimited requests, 1,000,000 tokens/day cap, no card required) — answers the panel's top objection ("show me before I pay") before asking for a rupee

## The numbers

| | |
|---|---|
| **Contribution per monthly pass** | **₹254** (85%) |
| **Fixed costs** | **₹1,943/month** |
| **Break-even** | **~8 passes a month** (one every four days) |
| **Year 1 operating profit** | **₹329,566** on ₹415,401 of revenue |
| **Cash needed to start** | **~₹15,400**; break-even on cash in **month 4** |
| **Price range buyers accept** | ₹123–₹800, indifference point ₹304 — ₹299 sits inside it |

*Volume sensitivity: a 60% shortfall on the ramp still yields ₹117,837 in year 1 at a 78% margin.*

## The evidence

**Panel:** 40 simulated buyers, 9 buy, 31 pass — **22%**, one buyer short of the 25% bar. The biggest objection is **trust** (10 of 31 non-buyers do not believe AI-generated facts will survive a committee), followed by **"show me before I pay"**, the top flip condition in every segment. The most uncomfortable finding: the largest cohort, delegates who prepare the night before, bought at **0%**.

**Competitor gap:** the category leader, Model Diplomat, is priced at **~₹1,060–1,760/month** with a free tier of 50 searches/day — **one-fifth to one-sixth of it, but with better trust**, because it cites primary sources and this product has no retrieval layer behind its "do not invent citations" instruction. **Below** it, ChatGPT Go is ₹399/month. MUN Prep is the cheapest paid option in the category, and the cheapest option of all is free.

**Real test: none yet.** That is what the money and the next two weeks are for.

## The board

Three lenses, two fund-if and one pass, average **5.7/10** — agreed on the product's craft and on the two funnel defects, disagreed on whether a well-built product with no moat is a business. The strength of the case: a genuinely small, ownable market (a delegation preparing for one conference, bought as a block) with a cost structure that breaks even at eight sales a month. The gap: no proprietary data, no network effect, no brand, and a copy time measured in a weekend.

**The biggest cost risk was the "Max" mode — now safely bounded.** Kimi K3 costs ₹13.86 per request (191× the default model); `grantedResponseLimits()` now automatically downgrades Max mode to Thorough (GLM-5.3-Flash) for all trial and machine callers, protecting unit economics from runaway inference.

## What the money is for

**₹15,000 startup, ₹10,000 of it earmarked for the launch test** (printed delegate cards and a conference stall, coordinator travel), plus a ₹1,760/month Vercel Pro requirement the moment the product is commercial. **No paid advertising** — the arithmetic forbids it: at ₹254 of contribution and 2.0 purchases per buyer, the most that can be spent to win a customer is **₹169**, which is roughly what one click-to-purchase costs already.

## The ask

None, in the sense of investment — **this starts on ₹15,400 of the founder's own money and reaches cash-positive in month four.** The ask is of the market:

> **Fifteen real delegates who pay ₹199 in the next two weeks.** Reach 150 directly, in person and by DM. Written down before running: if 15 pay, the model is confirmed; under 5, trust the real buyers over the simulation and go back to the offer.

## The one thing to do this week

**Run the Founding 50 launch test** — the 3-day free trial is already live. Put it in front of 150 real delegates, track trial activations, and close the first 15 paid conversions.

---

*The panel is simulated buyers and the money figures are projections from modelled inputs; real customers and real quotes are what confirm them. Not financial, legal or tax advice — the GST position, the treatment of referral commissions, business registration, and continuous compliance with the DPDP Act (under-18 parental consent and minor protections are now live in auth and policies) all need an accountant or a lawyer as the business scales. Estimates are labelled as estimates throughout, and `cfo-sources.md` names each one.*
