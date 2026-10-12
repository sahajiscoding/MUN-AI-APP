# MUN Prep App (working name; live at mun-ai-app.vercel.app) · Business plan

**Verdict: Not yet**

- ✓ Each monthly pass (30 days of access) earns $254.00 before fixed costs (85% contribution).
- ✓ Year 1 operating profit: $329,566.
- ✗ 9 of 40 simulated buyers buy (22%, the bar is 25%).

| key number | |
| --- | ---: |
| Price | $299.00 a monthly pass (30 days of access) |
| Profit margin at plan | 82% per monthly pass (30 days of access) |
| Break-even | 1 monthly pass (30 days of access)s a day |
| Year 1 operating profit | $329,566 |
| Startup spend | $15,000 |
| Cash needed before it pays for itself | $15,419 |
| Startup money earned back | month 4 |
| Buyer panel | 9 buy · 31 pass |

## The idea

- **What it is:** A web workspace that helps a Model UN delegate do the week's prep before a conference — AI research briefs, country policy profiles, position papers, opening speeches, POIs, rebuttals, and resolution drafting, plus a library of MUN courses, a terminology glossary and quizzes.
- **Who it is for:** Model UN delegates. Primarily Indian school and college students, roughly 14–22, English-medium, who are preparing for a specific conference date. Secondary: MUN club heads, school MUN coordinators, and MUN coaches/trainers who prep delegations.
- **What it sells, at what price:** Two time-boxed passes, sold in Indian rupees through UroPay (UPI): **₹199 for a 7-day Weekly Pass** and **₹299 for a 30-day Monthly Pass**. Both give the same core access — the difference is duration and two monthly extras (longer prep history, multiple committee workspaces, priority model routing, export-ready drafts). There is no free tier and no free trial; the AI workspace requires an active pass. Separately, the app sells machine access to bots/crawlers via x402 microtransactions ($0.05 per AI research call, $0.005 per content call), which is a rounding-error revenue line today.
- **Where and how:** Entirely online, browser-based, no app store. Customers arrive through Google search, MUN Instagram/WhatsApp communities, and a **referral partner programme** (partners get a unique link and **16.72% commission on a referred customer's first purchase**). Delivery is instant: pay by UPI, entitlement activates server-side, access runs for the period bought.
- **Budget and constraints:** The product is already built and deployed (Next.js 16 + Supabase on Vercel, UroPay for payments, NVIDIA NIM models for inference). There is no salary cost — it is a solo founder building in public. The binding constraints are (a) **distribution**: there is no evidence yet of any paying customer, and (b) **inference cost control**: the app exposes a "Max" mode backed by Kimi K3 that costs roughly 150× the default mode per request, with no plan-level cap on how much a ₹199 weekly buyer can burn.

### What is already decided (do not re-open)

- Price points: ₹199/week, ₹299/month. Set in `lib/plans.ts`.
- Payment rail: UroPay. Flat monthly fee, **zero per-transaction commission**. Not negotiable in this analysis.
- Usage caps: 60 AI requests/day and 300,000 tokens/day **per user**, regardless of plan.
- GPU/provider: NVIDIA NIM — GLM-5.3-Flash for Quick and Thorough modes, Kimi K3 for Max mode.

## Summary

**Verdict: Not yet.** Three of the four computed checks pass. One fails — and it is the one that decides everything.

### What has to change, and where

The failing check is the buyer panel's buy rate: **9 of 40 simulated buyers buy (22%), against a 25% bar.** Nothing else failed. The unit economics pass comfortably and year 1 makes an operating profit.

But the shape of the failure is more useful than the failure itself:

- **The financial checks pass on guesses, and the demand check fails on a simulation.** Every one of the four checks rests on a number that has not been measured in the real world. The inference cost per customer is estimated from token ceilings in the code, the ramp is a plausible shape with no funnel behind it, and the buy rate comes from buyers I simulated. **So the verdict "Not yet" is a statement about the offer as modelled, not a prophecy about the market.**
- **It fails by one buyer.** 9/40 is 22.5%; 10/40 would be exactly 25% and would pass. The bar is not a cliff, and the verdict flips on a single simulated person. That is a reason to distrust the verdict's precision and *not* a reason to call it a pass — at 100 buyers the same 22% rate still fails, so the finding is the rate, not the sample size.

**So the honest reading is: the money works, the market is unproven, and the single number that decides the verdict is the one number nobody has measured.** The fix is not in a spreadsheet. It is `launch.md` Step 1 — put a real founding-member offer in front of 150 real delegates and count. That test replaces the panel number, and it is the only thing that can.

**What would change the verdict:** 15 real paying customers from 150 delegates reached directly (10%), which is a better real-world result than 22% of a simulated panel is evidence for. **What would confirm it:** under 5, in which case the answer is "no, not yet" and the response is `offer.md`, not marketing.

### The business

**MUN Prep is an AI preparation workspace for Model UN delegates in India — tell it your committee, agenda and country, and it drafts the research brief, position paper, speech, POIs and resolution clauses, with MUN courses and quizzes alongside.** It is sold to delegates aged 14–22 preparing for a specific conference date, at ₹199 for the week of a conference or ₹299 for a month, paid by UPI, with **no free tier and no free trial**.

### The three numbers

| | |
|---|---|
| **Contribution per monthly pass** | **₹254** (85%) — ₹299 less ~₹25 of inference and ~₹20 of amortised referral commission |
| **Break-even** | **~8 passes a month** — one every four days. Fixed costs are only ₹1,943/month, because UroPay charges **zero per-transaction commission** and Supabase's free tier carries the database |
| **Year 1 operating profit** | **₹329,566** on ₹415,401 of revenue, at 0.2 passes/day in month 1 rising to 8.5 by month 12 |

**Cash needed to start: ~₹15,400** (₹15,000 of startup spend plus the month-1 shortfall). Cumulative cash turns positive in **month 4**. This business can be started without investment.

**Sensitivity:** the financial structure is robust. Volume down 60% still yields ₹117,837 in year 1 at a 78% margin. A 10% price cut costs ₹41,540 of year-1 profit and changes nothing structural. **Only one input can break it, and it is not demand — see the biggest risk below.**

### Where the board and the panel agreed, and where they disagreed

**Agreed.** The board's three lenses (2 fund-if, 1 pass, average 5.7/10) and the buyer panel point at the same two failures without having seen each other's work. The Offers and Product lenses both identified *price hidden behind sign-in* and *pay before seeing* as the top kill risks. The panel independently made them the top two objections: **trust (10 of 31 non-buyers)** and **"show me before I pay"** (the most common flip condition in every segment). When a simulated market and three analytical lenses converge on the same defect, that defect is real regardless of whether either method is sound.

**Disagreed — and this is the more interesting part.** The Product lens scored 7/10 and wants the product let out of the box; the Monopoly lens scored 4/10 and says a well-built product in a crowded market with no moat is still a bad business. **The panel sided with neither: it bought at 60% among award chasers and 40% among club coordinators, and at 0% among the night-before crammers the current marketing appeals to.** That is a third answer — the product is not the problem and the market is not the problem, **the buyer being targeted is the problem.** The offer is aimed at casual delegates with a 0% buy rate and priced at an audience that buys.

**And the panel's most uncomfortable finding, which nobody predicted:** the biggest cohort in the panel (prepares the night before, 8 buyers) bought at **0%**. The largest apparent market is the least willing to pay.

### The biggest risk

**A single heavy user of the "Max" mode can cost more than they pay.** Kimi K3 costs ₹13.86 per request — **191× the default model** — and the mode toggle is user-selectable on both plans with identical daily caps (60 requests / 300,000 tokens) on a ₹199 weekly pass and a ₹299 monthly pass. **One Max request a day loses ₹117/month per user. Five loses ₹1,780.** Modelled with a heavy Max user as the average, contribution goes to **−₹1,800 per pass and the business never breaks even at all.** The caps bound one user's damage at roughly ₹11,880/month — 40× what they paid.

**What will be done:** cap Max per pass (or move it behind the monthly tier) so it becomes a ceiling instead of an open tap. This is a one-line policy change, it is the highest-value fix in the pack, and it removes the entire downside scenario. The second-order version — deleting the mode toggle and letting the server pick the model — also lifts contribution from ₹254 to ~₹271 by cutting inference per pass from ₹25 to ~₹8, and answers the Product lens's finding that a token slider is a spec sheet, not a feature.

**And the risk that is not money:** the product is built for delegates aged roughly 14–22, a large share of them **minors**, and there is **no age gate and no parental-consent flow anywhere in the code**. India's DPDP Act treats under-18s as children and requires verifiable parental consent for their data. A product marketed to schoolchildren that stores their conversations needs this before the school channel is worked, not after. **This is the one item in the pack with a lawyer's name against it.**

### What is needed to start

**₹15,400 of cash** (CFO) and **one real test** (launch): a "Founding 50" offer — the first 50 delegates get a month for ₹199, the price of a week — announced only to people the founder reaches directly, with a written success line of **15 paid from 150 delegates reached in 14 days**, and a decision rule fixed in advance so the result cannot be argued with.

### The one thing to do this week

**Build the free first brief: one complete research brief, free, once per account, before anyone is asked to pay.**

It costs about **seven paise** to serve. It answers the single objection shared by the largest group of non-buyers and the most common flip condition in every segment. It is the precondition for the launch test, and it is on the critical path — if it slips, the launch date slips with it, because launching without it means relaunching into the funnel that currently converts nobody.

**Do this one thing before anything else in the pack.**

---

**How to read this pack.** The panel is **simulated buyers**, and the money figures are **projections from modelled inputs** — real customers and real quotes are what confirm them, and the launch test is designed to produce exactly that. This is **not financial, legal or tax advice**: the GST position on digital services, the treatment of referral commissions for withholding tax, business registration, and the children's-data question all need an accountant or a lawyer before money moves at scale. Where a number is an estimate rather than a measurement, `cfo-sources.md` says so and names it.

## What the board said

**Vote: 2 fund if, 1 pass. Average score 5.7 / 10.**

| Member | Score | Vote | Where it landed |
|---|---|---|---|
| Offers lens | 6 / 10 | **FUND IF** | Market passes 3 of 4 tests and the ₹2,500 conference fee is a strong anchor, but the offer fails on perceived likelihood (no proof, no citations) and asks for money before any demonstration. |
| Monopoly lens | 4 / 10 | **PASS** | Crowded market, none of the four sources of durable advantage, incremental rather than 10×, and no answer to a copycat in month six. |
| Product lens | 7 / 10 | **FUND IF** | The moment and the craft are right and the packaging is thoughtful, but the first five minutes are a paywall and the product's own rigour promise contradicts its architecture. |

The members disagree about the *shape*, not the facts. The Product lens sees a well-built product aimed at a real moment and wants it let out of the box. The Monopoly lens accepts all of that and says a well-built product in a crowded market with no moat is still a bad business. Both are right, and the disagreement is the most useful thing on this page: **the founder has built something good and has not yet built something defensible.**

### The risks more than one member raised — these go first

**1. 🔴 Nobody can verify the output, and that is the product's core promise. (Raised by all three.)**
The app has **no retrieval layer**. The models answer from their own weights, and the "do not invent citations / mark as needs verification" instruction in the system prompt is a hope, not a mechanism. Meanwhile the category leader's entire pitch is the opposite — retrieval-first, cited primary sources, explicitly contrasting itself with tools that invent citations. A delegate who states a fabricated statistic in a moderated caucus is publicly embarrassed, and the risk is greatest exactly where the product is most useful: position papers and speeches. The Offers lens marks this as the failure of *perceived likelihood*. The Monopoly lens marks it as the axis where the product is *behind*, not merely not-ahead. The Product lens marks it as a promise the architecture cannot keep, and is blunt that the middle position — implying authority without evidence — is the worst of the three options.

**2. 🔴 The paywall comes before any demonstration, and the price is hidden behind sign-in. (Offers, Product.)**
There is no free tier and no free trial, and `/pricing` redirects to `/auth/signin`. So a cold visitor must create an account, *then* pay ₹199, before seeing a single line of output — while a competitor offers 200 free searches then 50/day, and a general model that does most of the job is free in the next browser tab. Both members independently called this the most *fixable* problem in the pack.

**3. 🟠 There is no moat, and the substitutes are free. (Monopoly, Offers.)**
No proprietary data, no network effect, no scale advantage, no brand. The cheapest possible substitute is ₹0. The category leader claims 58k–86k users and is priced *above* this product, meaning it can cut into this position at will while this product has no room to retreat. The Offers lens adds the sharper version: three modes and a token slider is a feature comparison, and features compete down to price.

**4. 🟠 The "Max" mode is a margin hole and an experience mistake. (Product; quantified by the CFO.)**
Max runs on Kimi K3 at $3/$15 per million tokens — roughly **150× the default mode** per request — and any ₹199 weekly buyer can use 12,000-token Max responses with no plan-level cap. The Product lens says a delegate should never be handed a token slider at all; the numbers in `founder/cfo.md` show what the toggle costs.

**5. 🟠 Distribution is asserted, not planned. (Monopoly, Offers.)**
The referral programme (16.72% of first payment) and organic pages are in place, but the Monopoly lens is right that "MUN Instagram" is a hope until it is a channel with dates, owners and numbers in it. The first hundred paying customers have no named path.

### The conditions, merged — the rest of the pack tests these

- [ ] **Let a delegate feel the product before paying.** A hard-capped free first experience (a handful of requests, once per account, no card). *Product lens condition 2; Offers condition 1.*
- [ ] **Show the price on the page, before sign-in.** Remove the `/pricing` → `/auth/signin` redirect. *Offers condition 2.*
- [ ] **Resolve the rigour contradiction in one direction.** Either index primary sources and cite them, or reposition to strategy and stop implying factual authority. No middle. *All three; Product condition 3.*
- [ ] **Kill the mode toggle.** One best answer chosen for the buyer; tie the expensive model to a plan tier or an internal quality bar, not a user switch. *Product condition 1; the CFO quantifies it.*
- [ ] **Anchor the product to the conference date.** Ask for the date and shape the workspace around a countdown and a prep order. Costs nothing in inference; strongest available lever. *Product condition 4.*
- [ ] **Sell to blocks, not only to individuals.** MUN club heads, school coordinators and coaches buy many seats in one conversation. *Monopoly condition 2; Offers condition 4.*
- [ ] **Obtain and publish real third-party proof** — an award, a coach's endorsement, a testimonial the delegate actually said. *Offers condition 5.*
- [ ] **Find the secret.** The one asset only the founder has: the Indian MUN conference calendar and circuit knowledge (dates, committees, agendas, chairs, results). This is the only route to a monopoly the Monopoly lens could see. *Monopoly conditions 1–3.*
- [ ] **Name the first hundred customers and the cost of each.** *Monopoly question 5.*

### The strongest version of this business the board can see

*(It differs from what was pitched, and it is fair to say so plainly.)*

Not a ₹299 AI writing assistant competing with ChatGPT and a better-funded specialist on features — that fight is lost before it starts. The board's strongest version is **the preparation system for Indian MUN delegations, sold to the people who buy in bulk.** Build the asset nobody else has: the conference circuit itself — every Indian MUN on the calendar with its dates, committees, agendas, chairs and outcomes — and wrap it in preparation that is *verifiably correct* because it is indexed against primary sources rather than generated and hoped for. Sell it first to club heads and school coordinators as a delegation-sized block, because one conversation there is worth thirty cold sign-ups and it comes with the club's credibility behind it. Keep the individual ₹199 weekly pass as the self-serve door, but let a delegate walk through the first few steps free so they can feel the difference from ChatGPT in their own committee's words. The bot rail stays as a curiosity, not a strategy. In that version, the moat is the circuit data plus the rigour brand plus the block relationships — three things a competitor with a model API cannot copy by writing a better prompt — and MUN Prep becomes the first place an Indian delegate goes, before they even know they need help.

## The competition

Every delegate already solves this problem somehow, usually for ₹0. Sources are public and linked; ratings and review counts are left blank where I could not verify them rather than guessed. Full data: `competitors.csv`.

### 1. Who is there

#### Direct

**Model Diplomat** — [modeldiplomat.com](https://modeldiplomat.com/pricing). The category leader and the only true direct competitor I could verify. Purpose-built MUN AI: source-cited research, position papers, memos and speeches, crisis/simulation tools, 193+ country profiles, voting records, plus free courses and daily briefings. Its pricing page states Pro at **$20/month or $144/year** ($12/mo billed annually), with a **free tier: 200 searches to start, then 50/day**, and a 3-day Pro trial. Its MUN positioning line is "Walk into committee with the record at your back." Its own blog claims **58,000+ users** (Sep 2025, [toolai.io](https://www.toolai.io/ai/model-diplomat)), rising to **80,000+** ([Apr 2026](https://blog.modeldiplomat.com/mun-simulation-software-tools-2026)) and **86,000+** ([Apr 2026](https://blog.modeldiplomat.com/best-mun-software-uk-2026-ranked)) — self-reported marketing numbers, not audited, but the trend and the order of magnitude are the point.

**MUN Prep App** — this business. ₹199/week, ₹299/month, no free tier.

#### Indirect

- **WiseMee** — free static content library for MUN fundamentals.
- **Best Delegate** — the long-running MUN education site and training business; its [India page](https://bestdelegate.com/model-un-india/) (older, 2014) describes an Indian circuit "exploding with conferences happening every weekend". More a free content competitor for the delegate's attention than a paid one.
- **MUN coaching and training in India** — the real incumbent for the prep hours. I could **not verify current coaching prices** from a public source, so I am not putting a number on it. This is an open question and one of the most important ones in the pack: if a school already pays a coach, the coach either becomes this product's best distribution channel or its strongest competitor.
- **MUN Command (by mymun), ChairMUN, Muncoordinated** — conference *organiser* software (procedure management, resolution drafting). Different buyer, adjacent budget.

#### Substitutes — how delegates solve this without a business

| Substitute | Price | Why it is dangerous |
|---|---|---|
| **ChatGPT free tier** | ₹0 | Already open in the next tab. With a decent MUN prompt it produces a usable brief, position paper and speech. This is the default option and it costs nothing. |
| **ChatGPT Go / Plus** | ₹399 / ₹1,999 per month | For ₹399 the delegate gets far more than MUN prep. India-localised pricing with UPI support makes it trivially purchasable. |
| **Free position-paper generators** | ₹0 | A whole category of SEO-driven tools, several requiring no login at all ([example](https://custom-writing.org/writing-tools/position-paper-generator)). |
| **Free MUN prompt packs** | ₹0 | [Copy-paste prompts](https://docsbot.ai/prompts/education/mun-position-paper) for ChatGPT, Gemini and Claude. |
| **Grammarly / QuillBot** | ~$12 / ~$8.33 per month | Polish for the writing half of the job. |
| **A friend, a senior, a school club** | ₹0 | The actual status quo for most Indian school delegates. |

### 2. Price range for the comparable item

For "AI-assisted MUN preparation, one month of access":

- Lowest: **₹0** (ChatGPT free, free generators, free prompt packs, WiseMee)
- MUN Prep App: **₹199/week, ₹299/month**
- ChatGPT Go: **₹399/month**
- Free-tier-plus-subscription specialist (Model Diplomat Pro): **$20/month ≈ ₹1,760**, or $12/mo annual ≈ ₹1,060
- Highest: ChatGPT Plus **₹1,999/month**

**Median for a paid specialist MUN tool: Model Diplomat at ≈ ₹1,060–1,760/month.** MUN Prep App at ₹299 is roughly **one-fifth to one-sixth** of the specialist leader, and **below** the general-purpose ChatGPT Go tier. The product is the cheapest paid option in the category — and the cheapest option of all is still free.

### 3. Positioning map (text)

Two axes that matter to *this* buyer, inferred from the evidence above: **price** (horizontal) and **whether the delegate can trust the facts out loud** (vertical).

```
                  TRUSTWORTHY / CITED
                          ▲
                          │
     Model Diplomat ●     │
     (~₹1,060–1,760)      │
                          │
   WiseMee ●  (free,      │
   static, cited-less)    │
                          │
  ◀───────────────────────┼───────────────────────▶
        FREE / CHEAP      │        EXPENSIVE
                          │
   ChatGPT free ●         │
   (₹0, fluent,           │
    invents citations)    │
                          │
    Free generators ●     │
                          │         ChatGPT Go ● (₹399)
    MUN Prep App ● (₹199/₹299)      ChatGPT Plus ● (₹1,999)
                          │
                          ▼      UNVERIFIED / RISK OF FABRICATION
```

**MUN Prep App sits in the cheapest band, in the unverified band.** It is closest to the free substitutes on trust (no retrieval, no citations) while charging money. Model Diplomat occupies the position MUN Prep would want: mid-price, high trust.

### 4. What their customers complain about

I could read public pages and pricing, but **I could not read 1–3 star review sets with counts for these tools** — there are no app-store listings and no review corpus with volume for the MUN AI category. Marking that theme **thin** and saying so plainly, as the skill requires, rather than inventing complaints.

What is defensible without review counts:

1. **Model Diplomat's model is credit-metered and capped.** Its own pricing page distinguishes free ("daily refill doesn't stack", no citations, no drafting) from Pro ("400 AI searches every month", "buy non-expiring credits"). A delegate who hits the cap mid-conference must buy more. *Theme thin — one source, the vendor's own page.*
2. **The whole category's credibility problem is one a competitor is actively campaigning on.** Model Diplomat's comparison pages repeatedly attack general assistants for invented citations ("Does it invent citations like ChatGPT? No... It cannot cite a document that is not in its index"). That is a public claim that MUN-prep-by-general-model is untrustworthy — aimed squarely at products like MUN Prep App. *Linked, dated 2026-08-28.*
3. **Pricing opacity elsewhere in the category** — the same "best AI tools for MUN" listicle notes of the leader that "pricing is not transparent; users must inquire or sign up for details" ([2026-04-23](https://blog.modeldiplomat.com/best-ai-tools-for-mun-delegates-2026)). MUN Prep App's ₹199/₹299 is clear and low — but currently hidden behind a sign-in, which forfeits that advantage.

### 5. The gap

**The gap is real, and it is not "an AI for MUN" — that position is taken.** Three gaps are genuinely open on this evidence:

1. **A free first experience is table stakes and only one player offers it.** The leader gives 50 free searches a day; MUN Prep App gives none. Everyone offering free is ahead of this product on the only metric that matters at the top of the funnel.
2. **Nobody has built for the Indian circuit specifically.** Every competitor is global and generic in currency, in pricing psychology and in what a delegate actually needs: Indian school delegations, teachers who approve spending, WhatsApp-based club coordination, and the specific conferences on the circuit. The competitor's product is priced at ₹1,060–1,760/month, which is not an Indian school student's pocket money; ₹199 for the week of one conference is a different product shape entirely, and it is unoccupied.
3. **Nobody has indexed current-event facts for Indian MUN committees with verifiable sources**, and the leader's index is a general treaty/UN-vote corpus, not "what is actually being debated in committees on the Indian circuit this season". That is an open and defensible gap — but it must be *built*, not asserted.

If none of this is pursued, then there is **no gap**: the honest floor case is that MUN Prep App is a cheaper, less trustworthy, less-distributed version of a product that is already free at the entry tier.

### 6. The threat — who could copy this fastest, and how

**Model Diplomat**, and it would take them a week. They already have the users, the sources, the trust positioning and the free tier. An India-localised price (₹299/month) plus a school-bundle offer is a pricing-page change for them, and it would remove the only dimension on which MUN Prep App currently wins. Their existing free tier means they can afford to price below this product indefinitely.

Second-fastest: **anyone with a model API key and a weekend.** There is no retrieval layer, no proprietary dataset and no network effect to copy around — a competent builder can reproduce the feature set from the public pages.

Third, and the one to watch: **a general model lab shipping an education mode.** That does not compete with this business, it *deletes* it.

## The buyer panel

> ### ⚠️ Read this before you trust the buy rate
>
> **This panel is not what the skill specifies.** `/founder-consumer` calls for **one sub-agent per
> buyer** — 40 independent agents, each reading only its own brief, so their answers are independent
> and the tally is a real vote. No sub-agent runtime was available in the environment where this was
> run, so the same agent that wrote the pitch also played all 40 buyers in a single pass.
>
> **What that does and does not give you:**
>
> - ✅ Useful: the personas are dealt deterministically by `panel.py` (seed 11, reproducible), so the
>   segments, objections and *reasons* below are a structured map of where this offer breaks. The
>   quoting back of the offer's own text ("no free trial", "pay first") is exactly the objection
>   mining the skill is for.
> - ❌ Not useful as evidence: **22% is not an independent measurement of demand.** One agent playing
>   buyer and seller shares the same priors on both sides, so the number is closer to a considered
>   guess than to a vote. Treat it as *a* number, not *the* number. The skill itself says to read
>   simulated buy rates as an upper bound and confirm with real people — and this run cannot even
>   claim to be an upper bound, only a direction.
> - 🔁 To get the real thing: re-run with 40 sub-agents, or better, replace it with the cheapest real
>   test in `founder/launch.md` — a real price in front of real delegates. That test outranks
>   everything on this page.
>
> Everything else in this pack — the competitor prices, the conference counts, the model costs — is
> sourced and checkable. This table is the one part that is a model of a market rather than a
> measurement of one.

## Buyer panel: MUN Prep App (AI preparation workspace for Model UN delegates, India-first, ₹199/week or ₹299/month)

**9 buy · 31 pass** (22% buy) out of 40 simulated buyers. Seed 11, so the same cards can be dealt again.

These are simulated buyers, not customers. Use this to find objections and weak spots, then confirm the big ones with real people before you spend.

### By segment

| group | buyers | buy rate |
| --- | ---: | ---: |
| Club head or coordinator buying for a group | 5 | 40%  (thin) |
| Circuit regular chasing awards | 6 | 33%  (thin) |
| College delegate, own pocket money | 14 | 21% |
| School delegate, parent pays | 15 | 13% |

### By buying behaviour

| group | buyers | buy rate |
| --- | ---: | ---: |
| Award chaser, reads past papers | 5 | 60%  (thin) |
| First conference, no idea what to expect | 6 | 50%  (thin) |
| Taught by a school MUN coach | 6 | 33%  (thin) |
| Already uses ChatGPT for everything | 9 | 11% |
| Prepares the night before | 8 | 0% |
| Reads reviews and asks seniors first | 3 | 0%  (thin) |
| Deal hunter | 3 | 0%  (thin) |

### By income

| group | buyers | buy rate |
| --- | ---: | ---: |
| $1,392,000 and up | 14 | 29% |
| under $680,000 | 13 | 23% |
| $680,000 to $1,392,000 | 13 | 15% |

### Why they pass

| reason | buyers | in their words |
| --- | ---: | --- |
| trust | 10 | "My coach gives us material I can check with him. If the AI says something wrong in an unmoderated caucus I am the one standing there." (P002) · "I always check reviews before paying and I could not find anyone who used this. That is not proof it works, that is proof nobody is saying it does." (P004) |
| price | 7 | "226000 a year is not a lot and it is my own money. I would panic-buy the night before, but I would rather phone a friend who has done it." (P003) · "There is no free trial and I never pay full price for something I have not tested. I will wait for a discount." (P005) |
| other | 5 | "Our school coach runs sessions and my parents already paid 2500 for the conference. I will ask him, not an app." (P007) · "My school coach hands us templates and checks our papers. I do not need to pay for the same thing." (P026) |
| convenience | 5 | "I do everything the night before and I reach for whatever is already open. Asking an app to do MUN specifically has never occurred to me." (P009) · "A senior in my WhatsApp group sent me their whole folder of old papers. I have free material sitting right there." (P012) |
| quality | 3 | "I use ChatGPT every day and it is fine. I am not paying for a version of what I already have without seeing a difference." (P024) · "At 11pm the night before I would pay anything, but you have to show me something first. 199 for a week I will only use once is not convincing either." (P025) |
| habit | 1 | "I already have ChatGPT and my coach has templates. Adding one more thing to pay for is friction I do not need this week." (P006) |

### Why they buy

| reason | buyers | in their words |
| --- | ---: | --- |
| quality | 5 | "I have three conferences this season and the difference between a good brief and a thin one is the difference between speaking and sitting silent. 299 is nothing next to what I spend on travel." (P011) · "I have come second twice. Anything that sharpens my opening speech is worth a month of pocket money and 299 is nothing." (P016) |
| need | 4 | "I have never been in committee and I am honestly scared. Having a brief ready in my own committee's words is worth more than the money." (P001) · "I run my school's club and I would spend 299 to test it for the whole team. If it works I want it for twenty people, not one." (P013) |

### What would flip a no

- If every claim came with a source I could open.
- It being free for one brief so I can see the quality.
- Two or three awards from people I can look up.
- Any free trial at all.
- If it did the citations properly so I did not have to worry.
- The coach telling us to use it.
- If it was 99, or free for a week.
- Seeing someone else's output from it, so I know it is better than my own prompting.
- A clear explanation of how it is meant to be used, so I do not feel like I am cheating.
- If it was about this year's agenda and not old stuff.
- Someone showing me it is measurably better, not just faster.
- It being framed as research I then write up myself.

Buyers say they would buy **2.0 times** in the first month on average.

40 buyers gave all four price answers. Run founder-pricing's van_westendorp.py on the answers folder.

## Pricing

### The decision

**Keep ₹299 for the monthly pass. Keep ₹199 for the weekly pass. Add a capped ₹0 first experience.** The prices are right; what is missing is a way to get the first taste free.

Evidence for the price itself is below. The important line is this one: **₹299 is not too high.** The buyers in the panel put their indifference point at ₹304 and were willing to go to ₹800 before they called it too expensive. If anything, this product is priced with room left on the table — and the CFO's model shows the same thing from the other side, where the whole business is nearly cost-insensitive to price.

### What the buyers said

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

### Why the current price is right

1. **It is anchored to a real number the buyer already paid.** A Delhi MUN delegate fee is around **₹2,500**, and conference travel runs higher. A ₹299 monthly pass is ~12% of the entry cost, and a ₹199 weekly pass is less than a day's travel. That is the strongest anchor in this whole pack and it is the one to *say out loud in the pitch*.
2. **It is deliberately below the general-purpose alternative.** ChatGPT Go is ₹399/month in India. Being cheaper than the thing the delegate was already considering makes the buy easy. It is also roughly one-fifth to one-sixth of the specialist leader (Model Diplomat, ~₹1,060–1,760/month).
3. **The weekly pass matches the actual unit of the decision.** A delegate prepares for *one* conference. ₹199 for the week of that conference is the sharpest product shape in the business, and the panel confirms it — one buyer (P020, a school delegate whose parents pay) said outright that the weekly plan is the only reason she would say yes, because a monthly plan is a waste for one conference.
4. **The margin holds at any plausible price in the range.** At ₹299 the contribution is ₹254 (85%). Moving to ₹399 lifts year-1 profit from ₹329,566 to ₹468,496 and raises the margin to 87%. Moving to ₹199 still leaves a healthy business. **Price is not where this business is fragile.**

### The change to make

**Add a free first experience — and be specific about it, because "add a free tier" is advice, not a decision.** Three options, ranked by what they cost and what they prove:

| Option | What it is | Cost to the founder | What it proves |
|---|---|---|---|
| **A. One free brief per account** *(recommended)* | New account gets one complete Quick-mode research brief for their own committee, agenda and country, once, no card. After that, pay. | ~₹0.07 of inference + the abuse controls already in place | Whether the output is good enough to be worth ₹199 — the exact question every non-buying buyer asked |
| **B. Two-day trial on the weekly pass** | Time-boxed access to the weekly pass, no card, once per account | same inference, higher token abuse risk | same, plus whether they come back |
| **C. Free tier in the leader's shape** | 5–10 requests/day forever | recurring inference on freeloaders, plus it weakens the paid conversion | the leader's model, copied — it works, but it costs the most and models a different business |

**Do A.** It costs approximately seven paise, it answers the single loudest objection in the panel ("why should I pay before I've seen if the output is any good?" — 4 buyers, plus "any free trial at all" as the top flip condition), and it requires no change to the price or to the plan structure. The panel's *most common* flip condition, across every segment, was a free look at the output. Option C is how Model Diplomat does it and would trade away the paid-only discipline that keeps this business simple; it is the right move only after A proves the output converts.

### What the pricing should NOT be

- **Do not discount to ₹99 or "₹49 first month".** The buyers already flag low prices as suspicious — ₹123 is the floor where they stop believing the quality. A launch discount teaches the market the true price is lower and it is hard to climb back from.
- **Do not launch a school/delegation price from the same page, yet.** The block sale is real (the panel's club-head cohort bought at 40% and one explicitly asked for a delegation price), but the shape of a school deal — seats, invoice, term dates, a teacher's sign-off — is a sales process, not a price point. Prove it with two real schools first, then put a number on it in `offer.md`.
- **Do not sell per-request or per-token.** The mode toggle already leaks the cost story to the buyer, which is a competitive weakness, not a feature. Nobody buys a MUN paper in "tokens".
- **Do not raise the price before the free brief exists.** The panel says they'd pay ₹800 before refusing. They also said they will not pay before they see. Fix the seeing first; then the price has room.

### When to revisit

- **After 50 real paying customers:** replace the panel's shape with real conversion data at ₹199 and ₹299 and re-run `van_westendorp.py` on real answers.
- **If the free brief converts above ~15%:** the ceiling is higher than modelled. Test ₹399 on new visitors rather than raising the existing price.
- **If the free brief converts below ~3%:** the problem is the output, not the price. Do not cut the price — that would hide the real finding.
- **If a school deal closes:** the per-seat effective price will be well below ₹299 and that is fine, because the block eliminates acquisition cost per delegate.

**The one pricing sentence worth remembering:** the business's pricing is not broken, its *funnel* is — there is no way to experience the product before paying, and that is the exact question the loudest non-buyers asked. Fix the free first look, and the existing price should hold.

## The offer

### The offer today, stated plainly

> *Pay ₹199 for a week (or ₹299 for a month). You cannot try it first. You cannot see the price until you sign in. There is no refund policy stated on the site. If it does not work for you, you have lost the money and the week.*

That is not an offer. **That is a price with a gamble attached.** The price is validated; the *offer* fails, and it fails for exactly one reason: it shifts every rupee of risk onto the buyer *before* they have seen a single line of the product's output.

### What the panel proved

**9 bought, 31 passed — a 22% buy rate, below the 25% bar.** Read the disclosure in `panel/results.md`: the panel is simulated, so treat 22% as a direction, not a measurement. But the *reasons* are the useful part, and they cluster brutally:

| Reason they passed | Buyers | The objection, in their words |
|---|---:|---|
| **Trust** | 10 | *"I don't trust AI facts in committee, the chair will catch me out."* (P002) · *"I could not find anyone who used this. That is not proof it works, that is proof nobody is saying it does."* (P004) |
| **Price** | 7 | *"There is no free trial and I never pay full price for something I have not tested."* (P005) · *"299 is a whole week of lunch."* (P008) |
| **Other (the coach)** | 5 | *"Our school coach runs sessions and my parents already paid 2500 for the conference. I will ask him, not an app."* (P007) |
| **Convenience (the free substitute)** | 5 | *"A senior in my WhatsApp group sent me their whole folder of old papers."* (P012) |
| **Quality** | 3 | *"At 11pm the night before I would pay anything, but you have to show me something first."* (P025) |

**The single most common flip condition across the whole panel was: show me the output first.** Four buyers asked directly for it; it was the top answer to "what would change your mind" in every segment.

### The bigger problem the panel exposed

The panel is not only telling us the offer lacks proof. It is telling us **who the product is sold to is wrong.**

| Behaviour group | Buy rate |
|---|---|
| Award chaser, reads past papers | **60%** |
| First conference, no idea what to expect | **50%** |
| **Prepares the night before** (the biggest group, 8 buyers) | **0%** |
| **Deals hunter** | **0%** |
| **Nobody has used this, asks seniors** (the trusters) | **0%** |
| Already uses ChatGPT for everything | **11%** |

The buyers are the **committed** ones: award chasers and first-timers who are scared. The passers are the **situational** ones: the late-night crammer, the deal-hunter, the sensible one who asks a senior first. And by segment, **the club head or coordinator bought at 40% — the highest rate in the panel.**

**So the offer is chasing the wrong buyer.** It is priced and pitched at the casual delegate (₹199 for a week, "prepare like your committee starts tomorrow") while the people who actually say yes are the ones who *care about the outcome* — the award chaser with three conferences this season, and the coordinator who needs it for twenty people.

### The offer to build instead

#### For the delegate: **"The conference week" — ₹199, and you see it before you pay for it.**

**The stack, in the order they experience it:**

1. **A free brief, on your real committee.** Enter your committee, your agenda and your country. Get one complete research brief. No card, no sign-in beyond the account you already have. *This is the whole risk reversal, and it costs the founder about ₹0.07.*
2. **A week of full access for ₹199** — timed to *the date of your conference*, not to the calendar. The workspace asks when the conference is and shapes itself around the remaining days.
3. **The delegate's kit:** research brief, country position, position paper, opening speech, POIs, resolution clauses, and the courses/glossary tab when they hit a term they don't know.
4. **The guarantee: if the conference doesn't go better than it would have without it, tell us within 7 days and we'll refund it.** Word it exactly that loosely, and honour it without argument. At ₹0.07 per brief and UroPay charging nothing per transaction, the refund rate is far cheaper than the conversion rate it buys. *This is a founder decision, not a legal document — keep it as plain as it is written here and get an accountant's eye on the wording before publishing.*
5. **Proof, as it arrives.** Publish the first delegate who agrees to be named, with their conference, their committee, their result and their actual words. **Do not write a testimonial for anyone.** Until then, publish the *sources*: a public page showing where the facts in a MUN Prep brief come from.

#### For the school or club: **"The delegation" — priced per block, not per seat.**

The panel's highest buy rate (40%) and the clear ask from a club head (*"If it works I want it for twenty people, not one"*). The shape is a term-length block for a delegation, invoiced to the school or the club, with the coordinator as the buyer and the delegate as the user. **The number is not set yet** — there are no real school deals to price from, so this goes to `ops.md` and `launch.md` as a task, not as a guess. What is decided here is the *shape*: one invoice, many seats, a term of access, and the coordinator deciding — not twenty teenagers each deciding on their own.

### Killing the three leaks

None of the offer work lands unless these are fixed, and they are all one-line changes:

1. **The price is behind a sign-in.** `/pricing` redirects anonymous visitors to `/auth/signin`. A delegate who cannot see the price cannot decide anything. **Show the price, and show it on the landing page.**
2. **There is no way to feel the product before paying.** Fixed by the free brief above.
3. **The site says nothing about what happens if it doesn't work.** Fixed by the guarantee above, written in one sentence a 15-year-old can parse.

### The first sentence

The current headline is *"Prepare like your committee starts tomorrow."* It is well written and it sells the wrong thing — it is aimed at the last-night crammer, **the group with a 0% buy rate.**

The offer's headline should name the buyer who actually buys, and the moment that buyer is in:

> **Three weeks to your conference. Your committee, your country, your brief — before you pay.**

That sentence names the committed delegate (an active season, a date in hand), promises the specific artefact, and kills the two biggest objections in the same breath: *you see it first*, and *it is shaped around your deadline*.

### What not to do

- **Do not add features to answer the objections.** The panel's passers did not say "it needs more modes". They said "I don't trust the facts" and "show me first". More modes would make the cost problem worse and answer none of it.
- **Do not answer the trust objection with clever copy.** The trust objection gets answered by retrieval, by sources the delegate can open, and by other delegates' results — in that order. **The copy problem is not a copy problem.**
- **Do not discount the price.** ₹123 is where buyers start distrusting the quality, per the pricing curve. A discount below that would convert *worse*, not better.
- **Do not launch the school offer blind.** Get two schools to agree before publishing a per-delegation price, or the first number becomes the anchor forever.

### Does this offer pass the value equation?

**Dream outcome: yes** — a delegate who speaks well and might win has a dream outcome, and it is measurable in an award.

**Perceived likelihood: currently no, and that is the whole battle.** The delegate does not believe the output is true. This is a *product* problem presenting as a marketing problem: no citations, no retrieval, no third-party proof, no free trial, and a direct competitor whose entire pitch is "we don't make things up".

**Time delay: excellent** — a brief in about a minute, on a phone, the night it's needed.

**Effort and sacrifice: poor, and it is the easiest fix in the pack** — sign in, then pay, then discover, with the price hidden until account creation. Every one of those steps is a deliberate choice that can be reversed in an afternoon.

**Two of the four favour the buyer strongly. One is a product flaw that must be fixed in the product. One is a copy-and-flow flaw that must be fixed today.** That is a good place for an offer to be: it is not a reason to stop, it is a reason these specific changes are the next thing to build.

## The numbers

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

It is also entirely within the founder's control, and it is not being controlled today: **the Quick/Thorough/Max toggle is user-selectable on both plans, and the per-user daily cap (60 requests / 300,000 tokens) is identical on a ₹199 weekly pass and a ₹299 monthly pass.** The caps bound a user's damage to the company at roughly **₹11,880 per month** — 40× what that user paid. Nothing in the system ties the expensive model to the amount of money received.

**Cash: the founder needs about ₹15,400 to get to self-funding** — ₹15,000 of startup spend (domain/tooling, and the launch test budget) plus the month-1 shortfall. Cumulative cash turns positive in **month 4**. Payback on the startup spend is fast because the fixed base is only ₹1,943/month.

**The good news, and it is worth stating plainly: this business survives a bad ramp.** At 40% of the planned volume — fewer than 4 passes a day at year end, roughly 100 active subscribers instead of 255 — the margin holds at 78% and year 1 still clears **₹117,837**. Volume risk is well absorbed. Cost risk on the Max path is not.

**Three ways to improve the margin, each with the number it changes:**

1. **Put Kimi K3 behind the paid tier, or price it.** Making Max a Monthly-Pass-only feature and capping it (say 20 Max requests per pass, then it falls back to GLM-5.3-Flash) removes the tail entirely: the ₹18 Max line in the base case becomes a hard ceiling instead of an open tap. *Changes: the entire −₹1,800/pass downside scenario.*
2. **Cut the mode toggle to one default and let the server choose.** If 90% of requests run on GLM-5.3-Flash by default, inference per pass falls from ₹25 to roughly **₹8**, lifting contribution from ₹254 to **₹271 (+₹17/pass)**. *Run `--volume`-style what-ifs on the unit cost to see it; the lever is the model, not the price.*
3. **Raise the price.** The buyer panel's acceptable range runs to ₹800 and its indifference point is ₹304, so ₹299 is not the ceiling — it is roughly the **midpoint of what these buyers say they would pay**. Moving the monthly pass to **₹399** adds ₹100 of contribution per pass (+39%) with no change to the cost base. *Run `--price 399`: year-1 profit rises to about ₹468,000.*

**On the board's conditions about money:** the board set no numeric financial condition — it asked for proof of demand and a plan for distribution, which are the panel's and marketing's jobs, not mine. What I can say is that **the financial structure is not the problem.** On these inputs the business is profitable at a scale a solo founder can plausibly reach, needs almost no capital, and breaks even in month 4. The money question is not *can it work* but *will anyone pay*, and I cannot answer that from a spreadsheet.

**One caution on the inputs:** the ₹25/pass inference figure is the least solid number here, because nobody has usage data yet — it is built from token-ceiling estimates in the code, not from observed usage. Instrument real usage before trusting it. Of everything in this pack, this is the number to replace with a measurement.

**Not financial, tax or legal advice.** Get an accountant to check the structure, any GST position on digital services, and how the referral commissions should be treated before money moves.

---

## Unit economics: MUN Prep App — AI preparation workspace for Model UN delegates (India-first). All amounts in Indian rupees (INR); the tool prints '$' where it means rupees.

Every number below comes from the input file. Nothing is looked up or guessed.

### One monthly pass (30 days of access)

| line | per monthly pass (30 days of access) |
| --- | ---: |
| Price | $299.00 |
| NVIDIA inference, GLM-5.3-Flash — ~28 Quick/Thorough requests at $0.15/M in, $0.50/M out | -$7.00 |
| NVIDIA inference, Kimi K3 — ~1.5 Max-mode requests at $3/M in, $15/M out | -$18.00 |
| Referral commission 16.72% of the first payment, amortised across all customers (assumes ~40% arrive via a partner) | -$20.00 |
| **Contribution** (what each monthly pass (30 days of access) leaves to pay the fixed costs) | **$254.00** (85%) |

### The margin that matters

Fixed costs: $1,943 a month (Vercel Pro (commercial use is not permitted on the free Hobby tier) $1,760, UroPay Growth plan (flat, up to 50 transactions/month, zero per-transaction commission) $100, Domain name, annualised $83, Supabase free tier $0).

- **Break-even: 1 monthly pass (30 days of access)s a day.** Below that you lose money every month.
- **Profit margin at your plan** (8 a day): **82%** of every sale, after every cost.

### Year 1, month by month

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

### What if

| scenario | margin at plan | break-even a day | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | 82% | 1 | $329,566 |
| Price -10% | 80% | 1 | $288,026 |
| Volume -20% | 82% | 1 | $258,990 |
| Unit costs +15% | 80% | 1 | $320,188 |

No red flags in these numbers. They are only as good as the inputs: check every cost against a real quote.

## Marketing

**Launch = the day the free first brief goes live.** Not the day the product first existed; the product is already online and its current funnel converts nobody, because nobody can see it. Everything below is dated from that day. `Day 0` is launch day.

### Rules I am holding myself to

- **The panel quotes in this pack are research, not testimonials.** They are simulated. Not one of them goes on the website, in an ad, or in a caption.
- **No invented reviews, follower counts, awards or "as seen on".** When proof does not exist yet, the campaign sells the *demonstration* instead — the free brief is real, verifiable proof of the product itself, and it is the honest asset to lead with.
- **Panel evidence sets the audience, not my taste.** The buyers were award chasers (60%), first-timers (50%) and club coordinators (40%). The 0% groups get no money spent on them.

### Positioning

Three versions, then the one to use.

**A — for the committed delegate (recommended)**
> For MUN delegates with a conference date in the next month and an award on their mind, MUN Prep is the preparation workspace that turns your committee, your agenda and your country into a research brief, a position paper and a speech you can actually deliver — in the time a free chatbot takes to give you something too generic to say out loud.

*Evidence:* award chasers bought at **60%** and first-timers at **50%**, against 11% for "already uses ChatGPT" and **0%** for "prepares the night before" and the deal hunters. The award chaser said it best: *"I am one award away from a good university application."* Sales go to the delegate who already cares about the outcome.

**B — for the coordinator**
> For the student who runs their school's MUN club, MUN Prep is the delegation-wide prep system that gets twenty first-timers ready for one conference from a single account and a single invoice — instead of everyone prompting ChatGPT and hoping.

*Evidence:* the club-head cohort had the **highest buy rate in the panel (40%)** and asked for it directly: *"If it works I want it for twenty people, not one."* This is the version with the biggest money behind it, and the one that requires a sales conversation rather than a landing page.

**C — the honest anti-positioning (use in comparison content only)**
> MUN Prep is cheaper than the specialist tools and faster than prompting a general chatbot — and we will show you a brief free before you pay, because we know the only question that matters is whether the output is any good.

*Evidence:* the top flip condition in every single panel segment was *show me the output first*. This version makes a weakness into a demonstration and is the only positioning that answers the trust objection head-on without claiming a rigour the product does not yet have.

**Use A as the site's headline and message. Use B in outbound to schools and clubs. Use C on the comparison and FAQ pages, where the objection is already in the visitor's head.**

**Test:** A and C are both defensible and the pack cannot settle between them from 40 simulated answers. Run both headlines against the same traffic for two weeks; the one with the better click-to-free-brief rate is the site's headline. That test costs nothing but a copy change.

### Channels — two to start, three others explicitly not

| Channel | Why it fits *this* buyer | Cost | How I'll know it worked |
|---|---|---|---|
| **1. School and club MUN coordinators (direct outreach + a conference-market stall)** *(primary)* | The highest-converting cohort in the panel, and the only one where one conversation produces many users. Teachers and club heads are findable, they answer email, and they are the ones holding the delegation's prep time. This is the block sale from `offer.md`. | Time. Maybe ₹2,000–5,000 for printed delegate cards and a stall at one conference. | **Meetings booked and delegations activated.** A delegation of 20 is worth ~20× a single signup in prep hours and 1 invoice in admin. |
| **2. MUN Instagram content, built to be saved and shared** *(primary)* | This is where the delegate already is, and the format suits the product: a 30-second before/after of a position paper, or a screen recording of one brief being generated. The delegate who *sends it to their club group* is the distribution. | ₹0 to produce; ₹0 media. | **Free-brief starts with a referrer from Instagram.** Watch saves and shares, not likes. |
| ~~Paid Instagram/Meta ads~~ | **Do not run these.** See the CAC maths below — the economics do not allow it. | — | — |
| ~~Google search ads~~ | The searcher here types "mun position paper" and finds a free generator that works with no login. Winning that auction to sell a ₹299 pass is paying to lose. | — | — |
| ~~Influencer/creator paid posts~~ | Wrong economics at this price point (see CAC below), and the panel's trust cohort discounts paid praise anyway. Do it later with *unpaid* creators who actually use it, disclosed. | — | — |

**The channel the pack's evidence actually points at is the one that is hardest to scale: the coordinator conversation.** That is a warning worth stating plainly — the highest-converting channel here is a sales channel, and the founder is the only salesperson. Everything else in this plan is supporting cast.

### The CAC ceiling — why paid ads are off the table

From `cfo.md` and the panel:

- Contribution per pass: **₹254**
- Purchases per buyer in the first month: **2.0** (panel)
- Value of a first-month customer: **₹508**
- **Maximum sensible cost to win a customer, at the standard one-third-of-value ceiling: ₹169.**

Now the reality of Indian paid social: a click on a student-interest ad costs roughly ₹2–8, and a landing page → free brief → paid conversion for a ₹299 impulse purchase might generously run 2–5%. At ₹5/click and 3%, **CAC is ~₹167 — sitting exactly on the ceiling, before any of the creative cost, and with zero margin for error.**

**The conclusion is not "ads are expensive". It is that this product can never be bought with paid traffic at ₹299 with a 30-day life.** Growth has to come from channels where the marginal cost of a customer is a conversation or a share, and the only two of those available are the coordinator and the club group. *If ads are ever tested, the only defensible test is ₹5,000 total, judged on free-brief starts (not sales), and stopped the day it is spent.*

### The 30-day campaign

| Day | What goes out | Channel | Message |
|---|---|---|---|
| **-14** | Fix the funnel: price visible on the landing page, `/pricing` no longer redirects to sign-in, the free brief built and working | Product | *(not marketing — but nothing below works until this ships)* |
| **-10** | 20 coordinator conversations booked, 10 conferences picked from the mymun calendar for Oct 2026 – 2027 (season peaks Jan–Mar and Aug–Nov) | Direct outreach | "I built a prep tool for MUN delegates. Can I show it to your club for free and hear what's wrong with it?" |
| **-7** | The first 5 real delegate briefs generated and read end to end, on real committees, by real delegates | Product + DM | Nothing public. This is the honesty check: if the output is not good, the launch stops here. |
| **-3** | Launch post #1: the problem, told straight | Instagram | "Every delegate writes their position paper at 11pm the night before. Here's what that looks like for your committee." |
| **-1** | Coordinator emails sent to all 20, individually written | Email | "Free for your club's delegates for the first conference this season. One account, tell me if it's useful." |
| **0 (launch)** | The free brief goes live. Launch post #2: the demonstration | Site + Instagram | Screen-recorded: committee + agenda + country in, complete brief out, in real time. No cuts. |
| **1** | Launch post #3: the honest comparison | Instagram + site FAQ | "This is what ChatGPT gives you (screenshot). This is what we give you (screenshot). Judge for yourself — the first one's free." |
| **2** | First coordinator call | Call | Listen, do not pitch. Every objection goes into a file. |
| **3** | Post #4: the conference countdown | Instagram | "Your conference is in 19 days. Here's the prep order that actually works: research → position → speech → POIs → clauses." *(links to a free in-app checklist, paywalled at the writing step)* |
| **5** | Behind the scenes | Instagram story | The mode toggle being deleted because it confused a real delegate. Show the work. |
| **7** | **The number check** *(see below)* | Internal | If free-brief → paid conversion is below 3%, stop the campaign and re-read the objections. Do not raise ad spend. |
| **8** | The weekly-pass push for the closest conference | Instagram + DM | "Second Saturday of the month: most Indian conferences are 3 weeks out. ₹199 covers the whole prep week." |
| **10** | Second coordinator call, with their delegates' actual use | Call | Ask for the delegation deal shape. |
| **12** | Post #5: a real delegate's actual result | Instagram | **Only if a delegate consents and it happened.** If it did not, post the sources page instead. |
| **14** | The "who this is not for" post | Instagram | "If you already have a coach and a folder of senior papers, you don't need this. Save your money. Here's a free checklist instead." *(Builds trust with the 0% segments without chasing them.)* |
| **16** | Second number check | Internal | Free-brief starts, conversion, delegations activated. |

**When there is nothing new to say:** post the making of. A solo founder building for Indian MUN delegates, showing the actual trade-offs (why the school price is not published yet, why a mode toggle got deleted, what a brief costs to generate) is the most credible content this business has, and it costs nothing.

### Ten hooks — each one answers a panel objection

*All ten are written as first-person-or-direct address, for Instagram (3-second opening line) unless marked.*

1. **Answers "I don't trust AI facts in committee, the chair will catch me out" (10 buyers — the biggest objection).**
   *"Before I put anything in a speech, I check every claim — here's the 30-second check I do, and here's what your own committee needs you to know."* **Do not claim the tool is accurate. Show the check.** *(The product fix for this is retrieval; until then, teach the check.)*

2. **Answers "ChatGPT is free and it's already on my phone."**
   *"I've got ChatGPT too. Watch what it gives me for 'UNEP, India, climate finance' vs what I can actually stand up and say."*

3. **Answers "show me before I pay" (the top flip condition in every segment).**
   *"Your committee. Your country. One full brief free, no card. If it's bad, tell me and I'll delete it."*

4. **Answers "299 is a lot of my pocket money" (7 buyers).**
   *"Your conference fee was ₹2,500. This is ₹199 for the week — less than your travel, and you spend the travel either way."*

5. **Answers "I only need this once, the night before."**
   *"The night before is too late. Here's the 14-day prep order — and here's the one thing to do tonight."*

6. **Answers "my school coach already preps us for free."**
   *"Your coach is right. Show this to your coach — if it saves them a Saturday, it's worth telling the school about."* *(Turns the coach from competitor into channel — the honest move.)*

7. **Answers "I'll just ask a senior for their old position paper."**
   *"A senior's paper from 2023 will get you a 2023 answer. Here's how to check whether it's still true."*

8. **Answers "will my chair penalise me for AI-written work?"**
   *"You should write your own paper. That's what the conference is for. Here's how to use a tool for the research and still hand in your own work."* *(This is the honest position and it needs saying out loud, in those words.)*

9. **Answers "I run the club, I need it for everyone" (the 40% cohort).**
   *"If you run your school's MUN club, DM me. I'll set your whole delegation up for your next conference — and tell me what's broken."*

10. **Answers the whole objection set at once — the honest one.**
    *"This is a tool built by one person for Indian MUN delegates. It's not as good as the expensive ones yet, it's a fifth of the price, and I'll show you the output before you pay. If that's not enough, don't buy it."*

### Budget

Total: **₹10,000**, all of it already in `numbers.json` as launch budget.

| Line | Amount | Why |
|---|---:|---|
| **Printed delegate cards + a stall at one conference** | ₹5,000 | The one place the target buyer is physically in a room, already thinking about prep, with their club coordinator standing next to them. Not branding — a QR code to the free brief. |
| **Two half-day trips for coordinator meetings** | ₹3,000 | The highest-converting channel needs the founder in the room. |
| **Everything on Instagram** | ₹0 | Content costs time, which is not being billed here. |
| **Paid ads** | ₹0 | See the CAC ceiling — this is not discipline, it is arithmetic. |
| **Reserve** | ₹2,000 | The first thing that needs money once something starts working. |

### The three numbers to watch weekly, and what means "change something"

| Number | Healthy | **Change something if** |
|---|---:|---|
| **Free-brief → paid conversion** | ≥10% | **Below 3%.** The output is not good enough — no amount of marketing fixes it, and the response is to make the brief better (or reposition to strategy coaching), not to spend more. |
| **Free-brief starts per week** | 100+ from organic by week 4 | **Below 25.** The audience is wrong, not the product — go back to the coordinator channel, which is where the buyers actually were. |
| **Delegations (schools/clubs) activated** | 2 by day 30 | **0 by day 30.** The highest-converting cohort is unreachable, which kills the block-sale thesis in `offer.md` and means the whole plan rests on individual sales at ₹299 — the hardest path. |

**The weekly question is not "how many sales did we get". It is "who tried it and did not buy, and why".** That is the only number in this plan that produces information instead of a mood.

### What will not be done, and why

- **No paid acquisition.** The arithmetic forbids it at ₹299 with a 30-day customer life.
- **No influencer payments.** Same arithmetic, and the panel's trusters discount paid praise.
- **No fake social proof.** There is none yet; the free brief is the proof, and it happens to be a better one.
- **No marketing to the "prepares the night before" segment.** They are the largest group in the panel and they bought at **0%**. Marketing to them would burn the entire budget to reach people whose stated problem is that they do not prepare.
- **No claim of accuracy that the product cannot yet keep.** Not in an ad, not on the landing page, not in a hook. **This is the one rule that would do lasting damage to break.**

## Brand

The business already has a brand, and it is better than a new one would be. This file names it, protects it, and fixes the one thing wrong with it — which is not the look. **The look is right. The promise is the part that lies.**

### What exists today, read from the code

- **Name:** "MUN Prep App" (`app/layout.tsx` metadata, `lib/site-pages.ts` — 28 uses). The site's own name is *MUN Prep*; "App" is a suffix in the title tag.
- **Palette** (`app/globals.css`): paper `#f7f3ea`, ink `#171412`, **oxblood `#7a1f2b`**, **brass `#b78a42`**, **patina `#1d6f68`**, muted `#625951`.
- **Type:** serif display (`Georgia, Cambria, "Times New Roman"`), humanist body (`Aptos, "Avenir Next", "Segoe UI"`), mono for data (`Cascadia Code, Consolas`).
- **Voice, as actually written on the site:** "Prepare like your committee starts tomorrow." · "Research, draft, and debate from one focused Model United Nations prep workspace." · "View access".

This is a **documents-and-diplomacy** identity: aged paper, a diplomatic oxblood, a brass institutional accent, a patina green like oxidised bronze, and serif headings — the visual language of treaties, letterheads and committee placards. It reads serious, literate and slightly archival. For a product whose output is a position paper, that is precisely the right metaphor, and it is a *better* brand than most competitors'. It should not be thrown away.

**The fix is one line of copy, not a redesign.**

### Name

Ten candidates, in the skill's five styles.

| Style | Candidate | What it says | Reads / sounds | Risk |
|---|---|---|---|---|
| Descriptive | **MUN Prep** *(incumbent)* | Exactly what it is | Plain, memorable, easy to spell in a WhatsApp message | Generic; hard to own, easy to confuse with coaching services. Search results are already crowded with free "MUN prep" content. |
| Descriptive | Delegate Desk | A workspace for a delegate | Warm, adult | Sounds like furniture. "Desk" implies static. |
| Evocative | **Caucus** | The heart of committee procedure | Short, sharp, in-group | A common word — impossible to trademark in isolation, collides with US political usage. |
| Evocative | Placard | The delegate's name card | Beautiful and specific to MUN | Opaque to a first-timer; nobody searches it. |
| Evocative | Gavel | Authority, the chair | Instantly understood | Reads as a law-school or debate product, not MUN prep. Heavily used. |
| Invented | Delegat. | Delegate, abbreviated | Typo-prone | Too clever; people will type "delegate" and land elsewhere. |
| Invented | Munify | MUN, made | Fun, brandable, a real coined word | Skews childish for the award-chaser buyer, who is the one who actually pays. |
| Founder's name | Schincariol MUN Prep | Personal accountability | Unspellable for an Indian 15-year-old, and long | **No.** Wrong market. |
| Founder's name | Prep by Jake | Solo-founder honesty | Charming | Burdens the brand with one person and reads foreign to the buyer. |
| Place | **Circuit** | The MUN circuit — the thing nobody else has indexed | Speaks the in-group's own language ("I'm on the circuit") | Needs a modifier to be findable; it is also the name of the *strategy*, not yet the product. |

#### Shortlist of three

1. **MUN Prep** — keep it. SEO is the only acquisition channel this business can afford (see `marketing.md`: the CAC ceiling is ₹169, which rules out paid ads). A descriptive, literal name is worth more here than a clever one, because it is what a coordinator types into Google. **Recommendation: keep `MUN Prep` as the product name and let the brand work be about the promise, not the name.**
2. **Caucus** — the strongest alternative if the founder wants to grow into a category brand rather than a search entry. Only worth it later; renaming now would throw away whatever search presence exists.
3. **Circuit** — the name for the *data asset* the monopoly lens recommended, if it is ever built (the conference calendar). It is a better name for a future product than for this one.

#### Checks the founder must run — I can only do public searches, and nothing is registered until it is registered

- **Trademark:** search the **Indian register (ipindia.gov.in)** for "MUN Prep" in classes **9** (downloadable software), **41** (education, training, entertainment) and **42** (SaaS, software design). If the founder ever sells to the US/UK, also check **USPTO** (tmsearch.uspto.gov) and **UKIPO** in the same classes. **"MUN" and "Model United Nations" are widely used generically and are likely unprotectable on their own** — the protection would be in the distinctive part, which "Prep" is not. The honest expectation is that "MUN Prep" is hard to trademark and easy for someone else to use. **A trademark lawyer confirms this; a name is not owned until it is registered.**
- **Domain:** check `.com`, `.in`, and `.app` for `munprep` and the variants actually being considered. **Do not assume any are free** — check at a registrar.
- **Handles:** check `@munprep` on Instagram, TikTok, X and YouTube. A delegate discovers this on Instagram, so an available handle matters more than the domain here.
- **Confusion:** keep clear of **Model Diplomat** (name, and its "record at your back" language), **Best Delegate**, **WiseMee**, **mymun** and **MUN Command**. Nothing in the shortlist collides.

### The promise, the tagline, the voice

#### The one-line promise

> **Every brief, paper and speech comes with where it came from — and you can check every one before you say it out loud.**

**This promise cannot be made truthfully today.** The app's own system prompt instructs the model not to invent citations and to mark doubtful claims as "needs verification", but there is **no retrieval layer** — the model is answering from its weights, so nothing can actually be pointed at. The instruction is a hope, not a mechanism.

**Choose one and commit:**

- **(a) Build it:** index real sources (UN documents, government statements, treaty texts, current affairs) and cite them. Then the promise above is true, and it is the promise that beats the category leader on its own ground. **This is the board's recommendation and the product lens's condition 3.**
- **(b) Stop implying it:** reposition as a **strategy coach** — committee procedure, debate tactics, speech structure, resolution wording, how to caucus. Promise *"a delegate who knows what to say and when"*, not *"facts you can trust"*. In that version the promise becomes: *"You will walk into committee knowing exactly what to do — and how to say it."* That is true to what the architecture actually does, and it is a real product.

**Until one is chosen, the brand must not claim accuracy.** That is not a positioning preference, it is the difference between a brand promise and a lie — and in a category where a competitor is publicly campaigning against tools that invent citations, it is also the difference between a debate the founder can win and one he cannot afford to have.

#### Tagline — three options

1. **"Know what to say, and where it came from."** — the rigour promise, for path (a).
2. **"Speak like you've done this before."** — the confidence promise, safe on either path, aimed at the first-timer (50% buy rate).
3. **"Three weeks out. One brief. No lies."** — the honest one; pairs with the "who this is not for" post in `marketing.md`. Blunt, memorable, and it makes the free brief a brand behaviour rather than a promotion.

**Recommendation: use 2 on the site, 1 once retrieval exists.** 3 belongs in the launch campaign where the honesty is the point.

#### Voice — three adjectives

**Plain, not clever.**
- Do: *"Your committee. Your country. One brief, free, before you pay."*
- Don't: *"Unlock your diplomatic potential with AI-powered intelligence."*
- Why: the buyer is a 16-year-old on a phone deciding whether ₹299 is worth their lunch money. Cleverness reads as a scam.

**Evidence-first, not impressive.**
- Do: *"This is the source. Open it before you speak."*
- Don't: *"Powered by state-of-the-art large language models."*
- Why: the panel's single biggest objection was *"I don't trust AI facts in committee"* (10 of 31 non-buyers). Nothing about scale or models answers it. Only proof does.

**On the delegate's side, not the seller's.**
- Do: *"Write it yourself — use this for the part before that."*
- Don't: *"Get your position paper written for you."*
- Why: the panel flagged the cheating worry unprompted (*"Will my chair penalise me for AI-written work?"*). The honest posture — research aid, not ghostwriter — is both true and the brand's escape from the academic-integrity question.

#### Before / after — one line from `pitch.md`

**Before:** *"Tell it your committee, your agenda and your country. It writes your research brief, your country's position, your position paper, your opening speech, your POIs and your draft resolution clauses."*

**After:** *"Give it your committee, your agenda and your country. It gives you the research, the sources behind it, and the outline of what to say — and you write the paper that goes in, because it's your committee."*

The rewrite drops the promise that the product does the delegate's work, takes the integrity objection away, and stops claiming a source base that does not exist yet.

### The look

**Keep the existing palette. It is right.** What follows is the brief that makes it consistent, with the contrast checks the skill asks for.

| Colour | Hex | Job | Text on it |
|---|---|---|---|
| **Paper** | `#f7f3ea` | The background everywhere. The "document". | Ink `#171412` on paper = **contrast 15.9:1** ✅ AAA (needs 4.5:1 for body, 3:1 for large) |
| **Ink** | `#171412` | All body text; the dark panel. | Paper on ink = **15.9:1** ✅ AAA |
| **Oxblood** | `#7a1f2b` | The primary action, and only there. One button per screen. | Paper on oxblood = **9.8:1** ✅ AAA · oxblood on paper = 9.8:1 ✅ (do not use oxblood on brass) |
| **Brass** | `#b78a42` | Accent only — the rule under a heading, a countdown, a highlight. Never body text. | **Ink on brass = 7.1:1** ✅ AA for body; **paper on brass = 2.2:1** ❌ fails — never put white/paper text on brass |
| **Patina** | `#1d6f68` | The "verified" signal — the colour of a check mark next to a source, once sources exist. Reserve it for exactly that. | Paper on patina = **5.5:1** ✅ AA |

*Ratios are WCAG 2.1 relative-luminance calculations. **These must be re-verified with a contrast checker against the actual rendered CSS** before being treated as audited — I computed them from the hex values, and the app renders colours through several translucent layers (`--surface-bg: rgba(255,250,241,0.78)` and the body's two radial gradients), which change the effective background under any text placed on them. **That is the specific thing to check, because it is the one place where a palette that looks compliant can fail in practice.***

**Type — free, and already licensed by being a system stack.** The display serif is `Georgia` (or Cambria/Times fallback), the body is `Aptos`/`Avenir Next`/`Segoe UI`, the data face is `Cascadia Code`/`Consolas`. **All are system fonts: nothing to license, nothing to load, no font-flash, and the page stays fast on a cheap Android phone.** Recommendation: **keep them.** A Google font would add a request and a licence question for a look that is already distinct. *If a display face is ever wanted, choose only a SIL Open Font License face from Google Fonts (e.g. `Source Serif 4`, `Spectral`, `Instrument Serif`) — free to use commercially — and never a "free for personal use" font.*

**Logo brief.** What it must say: *this is a document for a committee.* Where it must work: as a **favicon at 32px** (the current `/icon.svg` should be checked at that size), on a conference stall banner, on an Instagram profile circle, and embossed-feeling on the confirmation screen. Direction: a **mark built from letterforms or a document/placard geometry in oxblood on paper** — a monogram or a single strong glyph reads at 32px where a detailed crest does not. **Avoid:** globes, doves, UN-blue and the United Nations emblem *in any form* — the UN emblem is protected and using it would be both a legal and an integrity problem. Avoid gavels (the law-product cliché) and anything that looks like a school crest.

**Generated concepts are concepts.** If image concepts are wanted, they must be marked as drafts and redrawn by a designer or traced properly before use anywhere real.

### The first five touchpoints

1. **The homepage** (currently "Prepare like your committee starts tomorrow." **Change it.** It sells to the night-before crammer, the cohort that bought at 0%): → **"Three weeks to go. Your committee, your country, your brief — and the sources behind it."** *(drop the last clause until retrieval exists)*, with **the price visible and a free first brief button above the fold.**
2. **The confirmation screen after payment** (the only warm moment the product currently has): not "Payment successful." → *"You're in. Tell us your conference date and we'll build your prep order backwards from it."* This is also where the countdown from the product lens gets born.
3. **The receipt/email:** plain, branded, and it states the refund promise in the same words used on the site. A receipt is the first thing a parent reads; write it for the parent.
4. **The first social post:** the screen recording of a real brief being generated for a real committee. No music, no captions over the top, no cuts. The product is the proof.
5. **The reply to the first complaint:** *"That's a fair complaint. Here's what I'm changing, and here's your refund if you want one."* Written by the founder, signed by the founder, no template. This reply will be screenshotted and posted in a WhatsApp group more often than any ad — it is a brand asset, and it should be treated like one.

### Rules

- Never a screenshot of the competitor's product that has been mocked up rather than taken live, and never a comparison that is not literally true.
- Never a font, icon or image the founder has no right to use; the system-font stack above already avoids this entirely.
- Never a claim of accuracy, awards or endorsements the product cannot evidence.
- **Not legal advice on trademarks.** The India, USPTO and UKIPO searches above are the founder's to run, and a lawyer confirms before any money is spent on the name.

## Operations

Not a café — so no opening shift. But this business *does* have a daily cycle, and one step in it is the difference between a working product and an angry WhatsApp message. Adapted from the skill for a one-person software business.

### 1. What has to happen every day

Marked ✅ = the customer sees it.

**Every day (about 15 minutes of human attention):**

1. **Payments pending** — the reconciliation queue. UroPay confirms a UPI credit by reading a bank SMS; when that fails, a person who paid has no access. **This is step one, it is the only step that produces angry customers, and it must run before anything else.** ✅
2. **Failed/abandoned entitlement grants** — anyone who paid but whose access did not activate. ✅
3. **Support inbox** — replies within 24 hours. ✅
4. **AI usage vs caps** — check whether any account is at or over the daily cap, and (once usage logging exists) whether any single account's inference cost exceeds what they paid. **This is the Max-mode watch from `cfo.md`.** Invisible today; it is the step that protects solvency.
5. **Error log skim** — a broken AI route is a silently dead product.

**Weekly (about 90 minutes):**

6. **Model cost review** — pull actual token usage, multiply by the published rates, compare with the ₹25/pass assumption in `numbers.json`. **This is the "weekly reorder" of this business** — it is the one routine that produces a real number where there is currently a guess.
7. **The three marketing numbers** from `marketing.md` (free-brief → paid, free-brief volume, delegations activated).
8. **Referral audit** — any anomalous commission (self-referral attempts, commission on a refunded payment, a partner account that should not be active).
9. **Dependency check** — did any model provider change a price, deprecate a model, or change a rate limit?

**Monthly:**

10. **Backup verification** — a restore actually tested, not a backup assumed.
11. **Invoice/receipt reconciliation** against UroPay's own statement. ✅ (the parent reads it)
12. **Re-run the CFO's model** with real numbers replacing the three guesses in `cfo-sources.md`.

### 2. Suppliers

Every input, with a real price and the contractual thing to watch.

| Supplier | What it provides | Cost | Payment terms / minimums | The thing to watch |
|---|---|---|---|---|
| **UroPay** (`uropai.me` / `uropai.in`) | UPI collection, zero per-transaction commission | ₹0 free (≤15 txns/mo) · **₹100/mo** Growth (≤50) · ₹1,000/mo Unlimited | Monthly subscription; no minimum, no KYC claimed | **The single most important supplier risk in this file.** Its screenshots claim zero commission, no registration, no KYC, and settlement direct to the founder's bank. Those are *vendor claims* — two months of invoices will confirm or refute them. Two specific questions to ask them in writing: **how does a refund work through it**, and **what is the dispute/chargeback path** for a UPI payment. The confirmation mechanism (reading bank SMS) is unusual and is the most likely daily failure point. |
| **NVIDIA NIM** (via `lib/ai/router.ts` → `lib/ai/nvidia.ts`) | Inference: `z-ai/glm-5.3-flash` ($0.15/$0.50 per M) and `moonshotai/kimi-k3` ($3/$15 per M) | Usage-based, no minimum, no commitment | Prepaid credits / usage billing | **Provider risk is concentrated here and it is existential to the cost structure.** A price change on Kimi K3 or a model deprecation is a same-week emergency. Keep the router's model names configurable (they are), and test a second provider's equivalent before it is needed rather than after. |
| **Vercel** | Hosting | **₹1,760/mo** ($20 Pro) — mandatory: **the free Hobby tier is not licensed for commercial use** | Monthly | The moment money changes hands, this cost starts. Do not run a commercial product on Hobby. |
| **Supabase** | Postgres, Auth, RLS, Storage | **₹0** on the free tier | Free; paid plan when limits are hit | The free tier is the reason this business can start at zero cost. It is also the thing that fails first — the free tier has no daily backups. **The first real growth triggers a paid Postgres plan**, and that is a new fixed cost that `numbers.json` does not yet carry. |
| **Domain registrar** (Registrar to be confirmed by the founder) | `mun-ai-app.vercel.app` is a Vercel subdomain; a real brand needs its own domain | ~₹1,000/yr (₹83/mo) | Annual | Own the domain before any marketing is printed. A `.vercel.app` URL in a school pitch looks unfinished. |
| **Model/API keys** | — | — | — | Server-side only, never in the client. The security remediation already established this; **it is the one asset whose leak is a runaway bill.** |

**If any real price differs from `founder/numbers.json`, the CFO must re-run.** The three most likely to need correcting after month one: inference per pass, the UroPay plan tier actually required (free at ≤15 txns/month covers a very small launch), and Supabase moving off free.

### 3. People

**One person. The founder.** There is no rota to write and pretending otherwise would be dishonest — every role below is the founder's until revenue says otherwise.

| Role | Who | Hours/week | Paid? |
|---|---|---|---|
| Product and engineering | Founder | 15–25 | No |
| Support (the replies that matter) | Founder | 3 | No |
| Marketing (coordinator calls, Instagram) | Founder | 5–8 | No |
| Payments reconciliation | Founder | 1–2 | No |
| Bookkeeping | Outsourced | — | **Not modelled.** Use a part-time accountant; typical Indian rates for a small business run a few thousand rupees a month, and this is a real cost that `numbers.json` omits. |

**Rota for the slow first month:** payments and support daily, everything else when there is something to do. **Rota at the planned volume (8 passes/day, ~255 active subscribers):** support becomes the binding constraint — at 2% of users needing help a month, that is ~5 conversations a month, which is still one person. **The first hire, if one is ever needed, is not an engineer or a marketer — it is someone on support and reconciliation, because that is the only work that cannot wait until tomorrow.**

Wages are not modelled because there are none. **If the founder's time is ever costed (and it should be, honestly, at a market rate), the business's profitability changes materially — see `cfo-sources.md`, which names this as deliberately excluded.**

### 4. Routines

**Routine A — daily payments reconciliation (5 minutes).** 1) Open the pending payments queue. 2) For each: check whether the UPI credit is confirmed at the bank. 3) If confirmed and access is not granted → grant it, then note the failure. 4) If not confirmed and older than 30 minutes → message the customer, do not leave them guessing. 5) If two failures happen in one day, **that is an incident, not a routine** — go to Routine D.

**Routine B — handling a complaint (10 minutes, never automated).** 1) Reply within 24 hours. 2) Name the problem back to them in your own words. 3) If it is a factual error in the output: **this is important — log the exact committee, agenda and claim, because it is the input to the retrieval work.** 4) If the product failed them, refund without argument and log the reason code. 5) If they are angry about being blocked by the daily cap, look at what they were actually doing before deciding the cap is wrong. 6) Sign it with a human name.

**Routine C — the money wire (deploy), weekly not continuous.** 1) Tests green, including the payment-guard suite. 2) Type-check and lint clean. 3) Deploy to preview, run one real brief end to end. 4) Deploy. 5) Watch payments and errors for an hour. **Never deploy on the morning of a big conference weekend.**

**Routine D — payment failure incident.** This is the routine worth memorising, because it is the one that costs money. 1) Check whether it is UroPay, the bank, or the app's verification. 2) **Assume the customer paid until proved otherwise** — grant access and reconcile later; never hold access hostage to an infrastructure diagnosis. 3) Post a status note wherever the launch traffic came from. 4) Fix, then write down what happened.

**Routine E — the weekly cost review (15 minutes).** 1) Total tokens per model, per day. 2) × published rate × ₹88. 3) ÷ passes sold. 4) **If cost per pass exceeds ₹120, stop and fix the mode mix** — that is four times the modelled figure and it is the leading indicator of the scenario in `cfo.md` where the business never breaks even.

### 5. Tools

The smallest stack that runs this. **Nothing here should be added without deleting something else.**

| Job | Tool | Cost | Why |
|---|---|---|---|
| Payments | UroPay | ₹0–100/mo | Already integrated, zero commission, UPI-native for an Indian buyer |
| Hosting | Vercel Pro | ₹1,760/mo | Already there; the paid tier is required for commercial use |
| Database/auth | Supabase | ₹0 | Already there; RLS and the referral RPC already live here |
| AI | NVIDIA NIM | Usage | Already there; the router makes model changes a config edit |
| Support inbox | Founder's email, then a shared inbox | ₹0 | Do not buy a helpdesk for five conversations a month |
| Analytics | **Needs choosing — nothing is installed today** | ₹0 | **This is the real gap.** `marketing.md`'s three weekly numbers and `cfo-sources.md`'s inference measurement both need events the product does not currently emit: free-brief start, signup, payment, and per-request token cost. **Plausible/Umami self-hosted or PostHog free tier.** Without this, every number in this pack stays an estimate. |
| Bookkeeping | A part-time accountant + a spreadsheet | Not modelled | See the caveat in People above |
| Uptime | A free external ping (Better Stack/UptimeRobot free tier) | ₹0 | A silently dead AI route is invisible without it |

### 6. Licences, permits, and the thing nobody told the founder

**This is the section of the pack with the most serious unaddressed risk, and it is not about money.**

| Item | Status | Where to confirm |
|---|---|---|
| **Business registration** | Sole proprietorship vs a private limited company is a real decision, not a formality. A proprietorship is simplest and cheapest; a company costs more but separates personal liability — and this business serves minors, handles their data, and generates content a school may blame someone for. | A chartered accountant. **Before taking money at scale, not after.** |
| **GST** | **Not modelled and not something this pack can decide.** Digital services to consumers in India may attract GST at 18% with a registration threshold; whether this business crosses it, and when, depends on turnover and structure. | A chartered accountant. **This is the clearest financial consequence in the file.** |
| **TDS / referral commissions** | The referral programme pays third parties **16.72% of a first payment**. Payments to individuals may have withholding-tax implications, and a student "partner" being paid commission is a taxable event for them. **This is currently unhandled in the product and unmodelled in the accounts.** | An accountant, before the first commission is paid. |
| **DPDP Act, 2023 — children's data** | **🔴 The most serious gap in this pack.** The product is built for MUN delegates aged roughly **14–22** — a large share are **minors**, and the app has **no age gate and collects no date of birth**. India's Digital Personal Data Protection Act treats under-18s as children, requires **verifiable parental consent** before processing their data, and restricts tracking and targeted advertising at children. The app stores account details, chat transcripts and workspace content for these users. **There is currently nothing in the code addressing this.** | **A lawyer.** The remediation is a product change (age at signup, parental-consent flow for under-18s, tightened retention), and it should be designed *before* the marketing in `marketing.md` drives students to sign up in bulk. |
| **RBI rules on recurring payments** | The plans are **prepaid passes, not auto-renewing subscriptions** — which is a genuine advantage, because India's e-mandate rules for recurring card/UPI payments (additional factor of authentication, pre-debit notification) apply to auto-renewal. **Do not add auto-renewal casually.** It is a compliance project, not a feature. | An accountant/lawyer, and the payment provider — *if* auto-renewal is ever considered. |
| **Terms, privacy, refund and cancellation pages** | They exist in `lib/site-pages.ts` **and every one is a working draft** carrying an explicit "not legal advice, review by a lawyer" note. The refund page in particular says eligibility "depends on the applicable purchase terms" — which promises a customer nothing, while `offer.md` wants to promise a 7-day refund. **Those two must agree, and right now they contradict each other.** | A lawyer, then rewrite the pages to match the offer that is actually being sold. |
| **Trademark** | "MUN Prep" is likely hard to protect; see `brand.md`. | ipindia.gov.in, then a lawyer. |

**Not legal advice.** Every line above names the authority or the professional to confirm it with. The DPDP item is the one to act on first: a product marketed to schoolchildren that stores their conversations, with no parental-consent mechanism, is the kind of gap that gets raised by a parent or a school, and by then it is a much worse conversation.

### 7. Risk register

Ten things most likely to go wrong. **Likelihood and severity are judgements on the evidence in this pack, not measurements.**

| # | Risk | Likely? | Bad? | The plan |
|---|---|---|---|---|
| 1 | **Model price rise or deprecation on Kimi K3 or GLM-5.3-Flash** | Medium | **Severe** — the whole cost structure rests on it | Model names are already configurable in the router. Keep an equivalent model tested and ready. **Re-check the two published rates monthly.** If Kimi K3 doubles, the Max mode must go behind a plan tier that day. |
| 2 | **Max-mode cost blowout** (one user's inference exceeds their ₹299) | **High** — nothing prevents it today | **Severe** — modelled at −₹1,800/pass | Cap Max per pass or move it to a higher tier. Watch cost per account weekly (Routine E). **This is the highest-value fix in the pack, and it is a one-line policy change.** |
| 3 | **UroPay fails, or its zero-commission claim does not hold** | Medium | Severe — revenue stops | Two months of invoices confirm the claim. Keep a second UPI collection option scouted. Assume "why is my payment not showing" is a when, not an if. |
| 4 | **A paid customer gets no access** (reconciliation or SMS-confirmation failure) | Medium | High — in a referral-driven market one bad experience travels | Routine A runs daily, and grants access on trust while investigating. **Never make the customer wait on an infrastructure diagnosis.** |
| 5 | **A hallucinated fact embarrasses a delegate publicly** | **High** over time — the architecture has no retrieval | High — it is the product's core promise failing in the most visible way | The real fix is retrieval. Until then: the offer must not promise accuracy, and `offer.md`/`brand.md` both name this as the first condition. Log every reported error (Routine B step 3) — the log is the case for building retrieval. |
| 6 | **A competitor undercuts, or a general assistant ships an education mode** | Medium | Severe — no moat exists (monopoly lens: 4/10) | The only defences are the ones the board named: the conference calendar data, the block relationships, and the rigour brand. Start with the relationships, because they are free and they are the highest-converting channel. |
| 7 | **Off-season cash gap** | **High** — conferences peak Jan–Mar and Aug–Nov, and this is the whole purchase trigger | Medium — fixed costs are only ₹1,943/mo, so the floor is survivable | Aim the school/block offer at the *start* of a term rather than mid-conference, and use the off-season to build the calendar asset. Contrast with the fixed base: this business can afford two quiet months. |
| 8 | **Solo founder illness or burnout** | Medium | **Severe** — no redundancy at any step | Document routines A–E so someone else could run payments and support for two weeks. Do not deploy before a conference weekend. **The founder's own time is the true cost of this business and it is currently priced at zero.** |
| 9 | **Organic search stops delivering** | Medium | High — it is the only free acquisition channel, and the CAC ceiling (₹169) rules out paid | Build the conference-calendar asset, which is shareable and linkable in a way that AI answers cannot replace. Own a community (the club coordinators) rather than a keyword. |
| 10 | **A minor's data complaint, or a school pulling out over it** | Low today, rising with volume | **Severe — reputational and legal** | Act on the DPDP item in section 6 before marketing to school delegations. The block sale is the best channel *and* the one most exposed to this risk. |

**Two risks are worth more than the other eight: #2 (Max-mode cost) and the DPDP item in section 6.** One threatens the money, the other threatens the right to operate. Both are fixable this month, and both are currently unaddressed.

## Launch plan

**Today is Monday 12 October 2026. Public launch day is Monday 9 November 2026.** Four weeks, and the first two of them are not building — they are finding out whether anyone will actually pay, before any real money goes out.

The product is already live with real prices and real payments. So this is not a launch from nothing; it is a **relaunch with the two blockers removed** (you can see the price, and you can try it before paying). That is a smaller job than a launch and a bigger one than a copy change.

### Step 1 — the test, before spending anything

**The cheapest real test that fits an online subscription: a founding-member offer, paid up front, in front of real delegates.**

**What goes live:**
- The landing page shows the price and a **free first brief** button. No sign-in wall before either.
- **"Founding 50"** — the first 50 paying customers get **30 days of access for ₹199** (the weekly price). This is a **bonus, not a discount**: ₹199 is above the ₹123 floor where buyers start distrusting quality (`pricing.md`), and the structure says "we're giving you more", not "the price was fake". The price list stays ₹199/week and ₹299/month, unchanged; founding members simply get the month at the week's price.
- The offer is announced **only to people the founder reaches directly** — coordinator conversations, MUN Instagram DMs, the stall at a conference — not to broad traffic. **Broad traffic would make the test unreadable.**

**The success line, written before running it:**

> **15 founding members pay ₹199 each within 14 days, from at least 150 delegates reached directly (10% conversion).**

**Then compare it with the panel.** The panel said 22% — but the panel is simulated and simulated buyers are agreeable, and 22% was a rate among *qualified buyers already answering*, not among cold delegates reached. **10% from cold outreach would be a *better* result than the panel's 22% means in reality.** Write both numbers down side by side and be suspicious of whichever one is more flattering.

**The decision rule, fixed in advance so the result cannot be argued with:**

| Result | What it means | What to do |
|---|---|---|
| **15+ paid** | Real buyers confirmed what the panel suggested. | Proceed to launch on 9 November. **Everything below stands.** |
| **5–14 paid** | The offer half-works. The free brief converted some people, but the price or the promise is still costing sales. | Launch anyway, on a smaller plan, and fix what the *reasons* say. Read the DMs from people who tried and did not pay — that is the whole dataset. |
| **Under 5 paid** | **Trust the real buyers over the panel.** The panel was too generous, and the offer is not yet good enough to sell. | **Do not launch.** Go back to `offer.md` and `pricing.md`. The most likely causes, in order: the output is not good enough to be worth paying for, or the trust objection is fatal. |

**The failure case is the valuable one.** Five real people saying no, with their reasons, is worth more than 40 simulated ones saying yes — and it is far cheaper than finding out after a marketing push.

### Step 2 — the countdown

#### Week 1 · Mon 12 – Sun 18 Oct — **remove the blockers** *(critical path)*

Nothing else can start until these ship.

| Task | Owner | Deadline |
|---|---|---|
| **Show the price to anonymous visitors.** Remove the `/pricing` → `/auth/signin` redirect; put ₹199/₹299 on the landing page. | Founder | **Wed 14 Oct** |
| **Build the free first brief.** One complete Quick-mode brief per account, no card, hard-capped server-side, once per account. Abuse controls already exist. | Founder | **Fri 16 Oct** *(critical path — the whole test depends on this)* |
| Rewrite the refund page in `lib/site-pages.ts` so it matches the actual promise. The current draft says eligibility "depends on the applicable purchase terms", which promises nothing. | Founder | Fri 16 Oct |
| Rewrite the homepage headline off the night-before crammer (0% buy rate) — see `brand.md`. | Founder | Sat 17 Oct |
| **Engage a lawyer on the DPDP/children's-data question** (`ops.md` §6). Not on the critical path for the test, but it must not be a surprise later, and it gates the school channel. | Founder | Fri 16 Oct |
| Book 20 coordinator conversations for the test window. | Founder | Sun 18 Oct |
| Install analytics that emit the four events this plan needs: free-brief start, signup, paid, and per-request token cost. | Founder | Sun 18 Oct |
| Buy the domain and put the brand on it (`brand.md`). | Founder | Sun 18 Oct |

#### Week 2–3 · Mon 19 Oct – Sun 1 Nov — **run the test** *(critical path)*

| Task | Owner | Deadline |
|---|---|---|
| **"Founding 50" live and announced to direct channels only** | Founder | **Mon 19 Oct** |
| 20 coordinator conversations, 10 of them with schools that have a conference in the Jan–Mar season | Founder | by Fri 23 Oct |
| One conference stall — printed cards with a QR code to the **free brief**, not to the pricing page | Founder | by Sat 31 Oct |
| Instagram: 8 posts from the `marketing.md` hook list, watching saves and shares rather than likes | Founder | through 1 Nov |
| Poll the result daily: paid count, free-brief count, and the reason given by anyone who tried and did not pay | Founder | daily |
| **Close the test and read it against the decision rule above** | Founder | **Sun 1 Nov** |

#### Week 4 · Mon 2 – Sun 8 Nov — **soft open and harden**

| Task | Owner | Deadline |
|---|---|---|
| Soft open: give access to 10 real delegates (seniors, club heads, the coordinators' students) in exchange for brutal feedback | Founder | Tue 3 Nov |
| Fix whatever the soft open breaks. **Do not fix anything else.** | Founder | Thu 5 Nov |
| Cap Max mode per pass, or move it behind the monthly tier (`cfo.md` §risk 2 — the highest-value fix in the pack) | Founder | Thu 5 Nov |
| Set up the uptime ping and confirm payments reconciliation runs end to end with the real provider | Founder | Fri 6 Nov |
| Write the launch-day posts and the stall cards | Founder | Fri 6 Nov |
| **Freeze. No code changes after this point.** | Founder | Fri 6 Nov |

**Critical path:** the free first brief (Fri 16 Oct) → the test's start (Mon 19 Oct) → the result (Sun 1 Nov) → launch (Mon 9 Nov). **Every other task can slip a week without moving the launch date. Those four cannot.** If the free brief slips, launch slips with it, and the correct move is to slip the date rather than launch without it — because launching without it means launching into the funnel that already converts nobody.

### Step 3 — launch day: Monday 9 November 2026

| Time | What happens | Channel |
|---|---|---|
| **08:00** | Payments reconciliation first, before anything else. Confirm the launch offer's entitlement works end to end with one real ₹199 payment. | Internal |
| **08:30** | Final check: price visible logged-out, free brief works logged-out, refund promise on the site, uptime ping live. | Internal |
| **09:00** | Launch post: the screen recording of a real brief, unedited, no music. | Instagram |
| **10:00** | Email the 20 coordinators personally, one at a time. Not a BCC. | Email |
| **11:00–13:00** | Founder at the keyboard. First launch traffic arrives; watch the payments queue and errors live. | Internal |
| **14:00** | Second post: the honest comparison — what a general assistant gives for the same committee, side by side, real screenshots. | Instagram |
| **16:00** | Check the three numbers. If free-brief starts are under 20, the audience is the problem, not the product — do not spend money to fix it. | Internal |
| **18:00** | Reply to every single DM personally. This is the highest-value hour of launch day. | DM |
| **21:00** | Day-1 numbers recorded: free-brief starts, paid, conversion, delegations. | Internal |

**If something breaks:** the risk register in `ops.md` is the plan. The one rule that overrides everything — **if payments fail, the stall catches people in person**, so launch on a day when there is a human being reachable within minutes. Payment failures get access granted on trust (Routine A) and reconciled later.

**The opening offer, stated exactly:** *"Founding 50: the first 50 delegates get a full month for ₹199 — the price of a week. Plus the first brief is free, before you pay anything."* It ends when 50 are sold or on **30 November**, whichever comes first.

### Step 4 — the first 30 days

#### The numbers, and what triggers a change

| Number | Where it comes from | Day-7 target | Day-30 target | **Change something if** |
|---|---|---|---|---|
| Passes sold per day | CFO: break-even is ~8/month | any | 2–4/day | **Under 1/day by day 30.** The channel is wrong, not the product. |
| **Free-brief → paid conversion** | marketing | ≥10% | ≥15% | **Under 3%.** The output is not worth paying for. This is the number that decides the business. |
| Free-brief starts | marketing | 75 | 400 | **Under 25/week.** Nobody is arriving. |
| Delegations activated | offer: the 40% cohort | 1 | 2 | **0 by day 30.** The block thesis is dead, and only individual ₹299 sales remain. |
| **Cost per pass** | CFO: the weakest input | < ₹60 | < ₹120 | **Over ₹120.** Stop and fix the mode mix before anything else (`ops.md` Routine E). |
| Refunds | ops | 0 | < 5% | **Over 10%.** The promise is being tested and the product is failing it. |

#### The three reviews

**Day 7 (Mon 16 Nov) — "is anyone arriving?"**
Did the posts get shared, or just liked? Did any coordinator reply, and did any of them bring a delegation? **The question to answer: is the audience reachable at all**, or does this need a channel the founder does not have?

**Day 14 (Mon 23 Nov) — "does the free brief convert?"**
This is the review that matters. Take every account that started a free brief and did not pay, and contact them personally. **Not to sell — to ask what the brief got wrong.** If the answer is "it was fine, I just didn't need it", that is an audience problem. If the answer is "I couldn't trust it", that is the product problem the whole pack has been pointing at, and the response is retrieval — not more marketing.

**Day 30 (Tue 9 Dec) — "does this become a business, or stay a project?"**
Against the day-30 target column above. And two honest questions with no spreadsheet behind them: **did any delegate's conference actually go better because of this — and can the founder name one?** If yes, the business has a proof to build on and the Jan–Mar season is the runway. If no, the correct answer is to say so, and the pack's next step is not a bigger launch — it is `offer.md` again.

#### What happens after day 30

The Jan–Mar season is the real test (conferences peak Jan–Mar and Aug–Nov). December is quiet, which makes it the right month to build the one asset the monopoly lens said was the only available moat: **the Indian MUN conference calendar** — dates, committees, agendas, chairs, results. It is unreachable by a competitor with a model API, it is the thing that makes the product's conference-shaped interface actually work, and it can be built in a quiet month by one person. **That is what December is for.**

_The panel is simulated buyers and the numbers are projections from your inputs. Confirm demand with real customers and costs with real quotes before you spend. Not financial, legal or tax advice._
