# Launch

**Today is Monday 12 October 2026. Public launch day is Monday 9 November 2026.** Four weeks, and the first two of them are not building — they are finding out whether anyone will actually pay, before any real money goes out.

The product is already live with real prices and real payments. So this is not a launch from nothing; it is a **relaunch with the two blockers removed** (you can see the price, and you can try it before paying). That is a smaller job than a launch and a bigger one than a copy change.

## Step 1 — the test, before spending anything

**The cheapest real test that fits an online subscription: a founding-member offer, paid up front, in front of real delegates.**

**What goes live:**
- The landing page and `/pricing` show the price and a **"Start 3-Day Free Trial"** button. No sign-in wall before either.
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

## Step 2 — the countdown

### Week 1 · Mon 12 – Sun 18 Oct — **remove the blockers** *(critical path)*

Nothing else can start until these ship.

| Task | Owner | Deadline | Status |
|---|---|---|---|
| **Show the price to anonymous visitors.** Remove the `/pricing` → `/auth/signin` redirect; put ₹199/₹299 on the landing page. | Founder | **Wed 14 Oct** | **Completed** (live on `/pricing`) |
| **Build the free demonstration.** Implemented as a 3-day free trial (1M tokens/day, no card, device fingerprinting, capped to Thorough GLM-5.3-Flash). | Founder | **Fri 16 Oct** | **Completed** (live in code) |
| Rewrite the refund page in `lib/site-pages.ts` to 7-day satisfaction guarantee. | Founder | Fri 16 Oct | **Completed** (live in `lib/site-pages.ts`) |
| Rewrite the homepage headline off the night-before crammer (0% buy rate) — see `brand.md`. | Founder | Sat 17 Oct | **Completed** (live in `components/home-landing.tsx`) |
| **DPDP Act & Minors' Consent**: Terms, Privacy Policy, and signup disclosure for under-18 parental consent. | Founder | Fri 16 Oct | **Completed** (live in `lib/site-pages.ts` & `components/auth-form.tsx`) |
| Book 20 coordinator conversations for the test window. | Founder | Sun 18 Oct | Planned |
| Install analytics that emit the four events this plan needs: trial start, signup, paid, and per-request token cost. | Founder | Sun 18 Oct | Planned |
| Buy the domain and put the brand on it (`brand.md`). | Founder | Sun 18 Oct | Planned |

### Week 2–3 · Mon 19 Oct – Sun 1 Nov — **run the test** *(critical path)*

| Task | Owner | Deadline |
|---|---|---|
| **"Founding 50" live and announced to direct channels only** | Founder | **Mon 19 Oct** |
| 20 coordinator conversations, 10 of them with schools that have a conference in the Jan–Mar season | Founder | by Fri 23 Oct |
| One conference stall — printed cards with a QR code to the **3-day trial**, not to the pricing page | Founder | by Sat 31 Oct |
| Instagram: 8 posts from the `marketing.md` hook list, watching saves and shares rather than likes | Founder | through 1 Nov |
| Poll the result daily: paid count, trial count, and the reason given by anyone who tried and did not pay | Founder | daily |
| **Close the test and read it against the decision rule above** | Founder | **Sun 1 Nov** |

### Week 4 · Mon 2 – Sun 8 Nov — **soft open and harden**

| Task | Owner | Deadline | Status |
|---|---|---|---|
| Soft open: give access to 10 real delegates (seniors, club heads, the coordinators' students) in exchange for brutal feedback | Founder | Tue 3 Nov | Planned |
| Fix whatever the soft open breaks. **Do not fix anything else.** | Founder | Thu 5 Nov | Planned |
| Cap Max mode per pass, or move it behind the monthly tier (`cfo.md` §risk 2 — the highest-value fix in the pack) | Founder | Thu 5 Nov | **Completed** (enforced via `grantedResponseLimits()`) |
| Set up the uptime ping and confirm payments reconciliation runs end to end with the real provider | Founder | Fri 6 Nov | Planned |
| Write the launch-day posts and the stall cards | Founder | Fri 6 Nov | Planned |
| **Freeze. No code changes after this point.** | Founder | Fri 6 Nov | Planned |

**Critical path:** the free first brief (Fri 16 Oct) → the test's start (Mon 19 Oct) → the result (Sun 1 Nov) → launch (Mon 9 Nov). **Every other task can slip a week without moving the launch date. Those four cannot.** If the free brief slips, launch slips with it, and the correct move is to slip the date rather than launch without it — because launching without it means launching into the funnel that already converts nobody.

## Step 3 — launch day: Monday 9 November 2026

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

## Step 4 — the first 30 days

### The numbers, and what triggers a change

| Number | Where it comes from | Day-7 target | Day-30 target | **Change something if** |
|---|---|---|---|---|
| Passes sold per day | CFO: break-even is ~8/month | any | 2–4/day | **Under 1/day by day 30.** The channel is wrong, not the product. |
| **Free-brief → paid conversion** | marketing | ≥10% | ≥15% | **Under 3%.** The output is not worth paying for. This is the number that decides the business. |
| Free-brief starts | marketing | 75 | 400 | **Under 25/week.** Nobody is arriving. |
| Delegations activated | offer: the 40% cohort | 1 | 2 | **0 by day 30.** The block thesis is dead, and only individual ₹299 sales remain. |
| **Cost per pass** | CFO: the weakest input | < ₹60 | < ₹120 | **Over ₹120.** Stop and fix the mode mix before anything else (`ops.md` Routine E). |
| Refunds | ops | 0 | < 5% | **Over 10%.** The promise is being tested and the product is failing it. |

### The three reviews

**Day 7 (Mon 16 Nov) — "is anyone arriving?"**
Did the posts get shared, or just liked? Did any coordinator reply, and did any of them bring a delegation? **The question to answer: is the audience reachable at all**, or does this need a channel the founder does not have?

**Day 14 (Mon 23 Nov) — "does the free brief convert?"**
This is the review that matters. Take every account that started a free brief and did not pay, and contact them personally. **Not to sell — to ask what the brief got wrong.** If the answer is "it was fine, I just didn't need it", that is an audience problem. If the answer is "I couldn't trust it", that is the product problem the whole pack has been pointing at, and the response is retrieval — not more marketing.

**Day 30 (Tue 9 Dec) — "does this become a business, or stay a project?"**
Against the day-30 target column above. And two honest questions with no spreadsheet behind them: **did any delegate's conference actually go better because of this — and can the founder name one?** If yes, the business has a proof to build on and the Jan–Mar season is the runway. If no, the correct answer is to say so, and the pack's next step is not a bigger launch — it is `offer.md` again.

### What happens after day 30

The Jan–Mar season is the real test (conferences peak Jan–Mar and Aug–Nov). December is quiet, which makes it the right month to build the one asset the monopoly lens said was the only available moat: **the Indian MUN conference calendar** — dates, committees, agendas, chairs, results. It is unreachable by a competitor with a model API, it is the thing that makes the product's conference-shaped interface actually work, and it can be built in a quiet month by one person. **That is what December is for.**
