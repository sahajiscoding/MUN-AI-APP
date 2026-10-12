# What the board said

**Vote: 2 fund if, 1 pass. Average score 5.7 / 10.**

| Member | Score | Vote | Where it landed |
|---|---|---|---|
| Offers lens | 6 / 10 | **FUND IF** | Market passes 3 of 4 tests and the ₹2,500 conference fee is a strong anchor, but the offer fails on perceived likelihood (no proof, no citations) and asks for money before any demonstration. |
| Monopoly lens | 4 / 10 | **PASS** | Crowded market, none of the four sources of durable advantage, incremental rather than 10×, and no answer to a copycat in month six. |
| Product lens | 7 / 10 | **FUND IF** | The moment and the craft are right and the packaging is thoughtful, but the first five minutes are a paywall and the product's own rigour promise contradicts its architecture. |

The members disagree about the *shape*, not the facts. The Product lens sees a well-built product aimed at a real moment and wants it let out of the box. The Monopoly lens accepts all of that and says a well-built product in a crowded market with no moat is still a bad business. Both are right, and the disagreement is the most useful thing on this page: **the founder has built something good and has not yet built something defensible.**

## The risks more than one member raised — these go first

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

## The conditions, merged — the rest of the pack tests these

- [ ] **Let a delegate feel the product before paying.** A hard-capped free first experience (a handful of requests, once per account, no card). *Product lens condition 2; Offers condition 1.*
- [ ] **Show the price on the page, before sign-in.** Remove the `/pricing` → `/auth/signin` redirect. *Offers condition 2.*
- [ ] **Resolve the rigour contradiction in one direction.** Either index primary sources and cite them, or reposition to strategy and stop implying factual authority. No middle. *All three; Product condition 3.*
- [ ] **Kill the mode toggle.** One best answer chosen for the buyer; tie the expensive model to a plan tier or an internal quality bar, not a user switch. *Product condition 1; the CFO quantifies it.*
- [ ] **Anchor the product to the conference date.** Ask for the date and shape the workspace around a countdown and a prep order. Costs nothing in inference; strongest available lever. *Product condition 4.*
- [ ] **Sell to blocks, not only to individuals.** MUN club heads, school coordinators and coaches buy many seats in one conversation. *Monopoly condition 2; Offers condition 4.*
- [ ] **Obtain and publish real third-party proof** — an award, a coach's endorsement, a testimonial the delegate actually said. *Offers condition 5.*
- [ ] **Find the secret.** The one asset only the founder has: the Indian MUN conference calendar and circuit knowledge (dates, committees, agendas, chairs, results). This is the only route to a monopoly the Monopoly lens could see. *Monopoly conditions 1–3.*
- [ ] **Name the first hundred customers and the cost of each.** *Monopoly question 5.*

## The strongest version of this business the board can see

*(It differs from what was pitched, and it is fair to say so plainly.)*

Not a ₹299 AI writing assistant competing with ChatGPT and a better-funded specialist on features — that fight is lost before it starts. The board's strongest version is **the preparation system for Indian MUN delegations, sold to the people who buy in bulk.** Build the asset nobody else has: the conference circuit itself — every Indian MUN on the calendar with its dates, committees, agendas, chairs and outcomes — and wrap it in preparation that is *verifiably correct* because it is indexed against primary sources rather than generated and hoped for. Sell it first to club heads and school coordinators as a delegation-sized block, because one conversation there is worth thirty cold sign-ups and it comes with the club's credibility behind it. Keep the individual ₹199 weekly pass as the self-serve door, but let a delegate walk through the first few steps free so they can feel the difference from ChatGPT in their own committee's words. The bot rail stays as a curiosity, not a strategy. In that version, the moat is the circuit data plus the rigour brand plus the block relationships — three things a competitor with a model API cannot copy by writing a better prompt — and MUN Prep becomes the first place an Indian delegate goes, before they even know they need help.
