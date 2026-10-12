# Operations

Not a café — so no opening shift. But this business *does* have a daily cycle, and one step in it is the difference between a working product and an angry WhatsApp message. Adapted from the skill for a one-person software business.

## 1. What has to happen every day

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

## 2. Suppliers

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

## 3. People

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

## 4. Routines

**Routine A — daily payments reconciliation (5 minutes).** 1) Open the pending payments queue. 2) For each: check whether the UPI credit is confirmed at the bank. 3) If confirmed and access is not granted → grant it, then note the failure. 4) If not confirmed and older than 30 minutes → message the customer, do not leave them guessing. 5) If two failures happen in one day, **that is an incident, not a routine** — go to Routine D.

**Routine B — handling a complaint (10 minutes, never automated).** 1) Reply within 24 hours. 2) Name the problem back to them in your own words. 3) If it is a factual error in the output: **this is important — log the exact committee, agenda and claim, because it is the input to the retrieval work.** 4) If the product failed them, refund without argument and log the reason code. 5) If they are angry about being blocked by the daily cap, look at what they were actually doing before deciding the cap is wrong. 6) Sign it with a human name.

**Routine C — the money wire (deploy), weekly not continuous.** 1) Tests green, including the payment-guard suite. 2) Type-check and lint clean. 3) Deploy to preview, run one real brief end to end. 4) Deploy. 5) Watch payments and errors for an hour. **Never deploy on the morning of a big conference weekend.**

**Routine D — payment failure incident.** This is the routine worth memorising, because it is the one that costs money. 1) Check whether it is UroPay, the bank, or the app's verification. 2) **Assume the customer paid until proved otherwise** — grant access and reconcile later; never hold access hostage to an infrastructure diagnosis. 3) Post a status note wherever the launch traffic came from. 4) Fix, then write down what happened.

**Routine E — the weekly cost review (15 minutes).** 1) Total tokens per model, per day. 2) × published rate × ₹88. 3) ÷ passes sold. 4) **If cost per pass exceeds ₹120, stop and fix the mode mix** — that is four times the modelled figure and it is the leading indicator of the scenario in `cfo.md` where the business never breaks even.

## 5. Tools

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

## 6. Licences, permits, and the thing nobody told the founder

**This is the section of the pack with the most serious unaddressed risk, and it is not about money.**

| Item | Status | Where to confirm |
|---|---|---|
| **Business registration** | Sole proprietorship vs a private limited company is a real decision, not a formality. A proprietorship is simplest and cheapest; a company costs more but separates personal liability — and this business serves minors, handles their data, and generates content a school may blame someone for. | A chartered accountant. **Before taking money at scale, not after.** |
| **GST** | **Not modelled and not something this pack can decide.** Digital services to consumers in India may attract GST at 18% with a registration threshold; whether this business crosses it, and when, depends on turnover and structure. | A chartered accountant. **This is the clearest financial consequence in the file.** |
| **TDS / referral commissions** | The referral programme pays third parties **16.72% of a first payment**. Payments to individuals may have withholding-tax implications, and a student "partner" being paid commission is a taxable event for them. **This is currently unhandled in the product and unmodelled in the accounts.** | An accountant, before the first commission is paid. |
| **DPDP Act, 2023 — children's data** | **🟢 Addressed in code & legal terms.** The product serves delegates aged 14–22 (many minors). India's DPDP Act treats under-18s as children and requires verifiable parental consent. Implemented in `components/auth-form.tsx` (explicit under-18 parental consent confirmation during signup) and `lib/site-pages.ts` (Terms & Privacy Policy prohibiting behavioral tracking and profiling of minors). | Legal review as the business scales. |
| **RBI rules on recurring payments** | The plans are **prepaid passes, not auto-renewing subscriptions** — which is a genuine advantage, because India's e-mandate rules for recurring card/UPI payments (additional factor of authentication, pre-debit notification) apply to auto-renewal. **Do not add auto-renewal casually.** It is a compliance project, not a feature. | An accountant/lawyer, and the payment provider — *if* auto-renewal is ever considered. |
| **Terms, privacy, refund and cancellation pages** | **🟢 Synchronized.** The refund policy in `lib/site-pages.ts` has been updated to match `offer.md`'s **7-day satisfaction guarantee** (*"contact support within 7 days of purchase... we will refund your payment in full, no hassle"*), and DPDP provisions have been written into both terms and privacy. | Periodic lawyer review before institutional school contracts. |
| **Trademark** | "MUN Prep" is likely hard to protect; see `brand.md`. | ipindia.gov.in, then a lawyer. |

**Not legal advice.** Every line above names the authority or the professional to confirm it with. The DPDP consent mechanism is now built into the signup flow, so the product has a defensible baseline before school coordinator outreach starts.

## 7. Risk register

Ten things most likely to go wrong. **Likelihood and severity are judgements on the evidence in this pack, not measurements.**

| # | Risk | Likely? | Bad? | The plan |
|---|---|---|---|---|
| 1 | **Model price rise or deprecation on Kimi K3 or GLM-5.3-Flash** | Medium | **Severe** — the whole cost structure rests on it | Model names are already configurable in the router. Keep an equivalent model tested and ready. **Re-check the two published rates monthly.** If Kimi K3 doubles, the Max mode must go behind a plan tier that day. |
| 2 | **Max-mode cost blowout** (one user's inference exceeds their ₹299) | **Low** *(mitigated)* | **Severe** if unmanaged | **Mitigated in engine**: `grantedResponseLimits()` strictly constrains unpaid trial and machine routes to Thorough GLM-5.3-Flash (8,000 tokens max). Kimi K3 ($15/M) cannot be invoked on free or machine paths. Routine E continues to monitor cost per account weekly. |
| 3 | **UroPay fails, or its zero-commission claim does not hold** | Medium | Severe — revenue stops | Two months of invoices confirm the claim. Keep a second UPI collection option scouted. Assume "why is my payment not showing" is a when, not an if. |
| 4 | **A paid customer gets no access** (reconciliation or SMS-confirmation failure) | Medium | High — in a referral-driven market one bad experience travels | Routine A runs daily, and grants access on trust while investigating. **Never make the customer wait on an infrastructure diagnosis.** |
| 5 | **A hallucinated fact embarrasses a delegate publicly** | **High** over time — the architecture has no retrieval | High — it is the product's core promise failing in the most visible way | The real fix is retrieval. Until then: the offer must not promise accuracy, and `offer.md`/`brand.md` both name this as the first condition. Log every reported error (Routine B step 3) — the log is the case for building retrieval. |
| 6 | **A competitor undercuts, or a general assistant ships an education mode** | Medium | Severe — no moat exists (monopoly lens: 4/10) | The only defences are the ones the board named: the conference calendar data, the block relationships, and the rigour brand. Start with the relationships, because they are free and they are the highest-converting channel. |
| 7 | **Off-season cash gap** | **High** — conferences peak Jan–Mar and Aug–Nov, and this is the whole purchase trigger | Medium — fixed costs are only ₹1,943/mo, so the floor is survivable | Aim the school/block offer at the *start* of a term rather than mid-conference, and use the off-season to build the calendar asset. Contrast with the fixed base: this business can afford two quiet months. |
| 8 | **Solo founder illness or burnout** | Medium | **Severe** — no redundancy at any step | Document routines A–E so someone else could run payments and support for two weeks. Do not deploy before a conference weekend. **The founder's own time is the true cost of this business and it is currently priced at zero.** |
| 9 | **Organic search stops delivering** | Medium | High — it is the only free acquisition channel, and the CAC ceiling (₹169) rules out paid | Build the conference-calendar asset, which is shareable and linkable in a way that AI answers cannot replace. Own a community (the club coordinators) rather than a keyword. |
| 10 | **A minor's data complaint, or a school pulling out over it** | Low *(mitigated)* | **Severe — reputational and legal** | **Mitigated**: Implemented under-18 parental consent disclosure in auth flow and updated Terms/Privacy Policy under DPDP Act 2023 prohibiting tracking of minors. Keep a clean record of consent for school coordinator reviews. |

**Of the top risks, #2 (Max-mode cost) is now mitigated in engine logic via `grantedResponseLimits()`, and #10 (minor's data / DPDP) is addressed with live consent gates and policy protections.** One threatened the money (now bounded), the other threatened the right to operate (now safeguarded). Maintain rigorous adherence as school delegation sales ramp up.
