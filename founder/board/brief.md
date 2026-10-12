# Brief for the board

*(Stands alone: a reader who has not seen the conversation should be able to decide from this. No opinion of mine is added here.)*

## The business

**MUN Prep App** — a browser-based AI preparation workspace for Model UN delegates. Live and working at `https://mun-ai-app.vercel.app`. Built and run by one founder. No employees, no investors, no ad spend to date.

## What it does

The delegate signs in (Google or email), picks a tool, and gets AI-generated prep material scoped to their committee, agenda and country:

- **Research brief** — committee context, the country's position, likely blocs, opposition arguments, and a "verify this" checklist.
- **Country policy profiler** — a country's stance on a given agenda item.
- **Position paper builder** — the argument map, in paper structure.
- **Speech and POI practice** — opening speeches, moderated-caucus angles, points of information, rebuttal drills.
- **Resolution clause drafting** — operative clauses and draft resolution structure.

Alongside the AI tools: a library of ~16 MUN courses, a terminology glossary, quizzes, and the legal/policy pages. The AI answers in three user-selectable modes:

| Mode | Model behind it | Max output tokens |
|---|---|---|
| **Quick** (the default) | GLM-5.3-Flash | 1,800 |
| **Thorough** | GLM-5.3-Flash | 8,000 |
| **Max** | Kimi K3 | 12,000 |

*(Note: On unpaid trial and machine routes, `grantedResponseLimits()` automatically constrains Max requests to Thorough GLM-5.3-Flash at 8,000 tokens to prevent runaway inference cost).*

The system prompt instructs the model to separate verified facts from strategic recommendations, not to invent citations, and to mark source-backed claims it cannot support as "needs verification". **There is no retrieval layer:** the models answer from their own weights, with no indexed source corpus and no citation database behind them.

## Price and packaging

- **3-Day Free Trial — ₹0**, 3 days of full access, 1,000,000 tokens/day cap, no credit card required.
- **Weekly Pass — ₹199**, 7 days of access.
- **Monthly Pass — ₹299**, 30 days of access, plus longer prep history, multiple committee workspaces, priority model routing, export-ready drafts.
- **Public pricing:** `/pricing` is public and accessible without signing in, displaying direct "Start 3-Day Free Trial" CTAs alongside transparent plan pricing.

Usage caps: Trial users receive 1,000,000 tokens/day (with Max mode bounded to GLM-5.3-Flash Thorough). Paid plans receive 60 AI requests/day and 300,000 tokens/day per user.

## Who buys

Indian Model UN delegates, ~14–22, English-medium schooling. The buyer is often not the user: for school delegates a parent pays, or the school pays for the delegation; for college delegates the student pays from pocket money. A secondary buyer is the MUN coach or club head who preps a whole delegation and could pay for many seats at once.

**Market context (sourced):** mymun lists **71 upcoming MUN conferences in India** in Oct 2026–2027, with individual conferences between 100 and 1,800 delegates. IIMUN alone runs conferences in 108+ Indian cities and says it reaches 7,500–10,000 schools. One Delhi conference charges **₹2,500** as the delegate registration fee. The Indian circuit peaks January–March and August–November.

## Distribution

No paid acquisition yet. Three channels are in place:

1. **Referral partners.** A coach, club or MUN page gets a unique link and **16.72% of the referred customer's first payment** (~₹50 on a Monthly Pass). Attribution is first-touch, cookie-based, 30 days.
2. **Organic search / social** — the public courses, glossary and legal pages are indexable.
3. **The bot rail.** Crawlers and agents can buy content or AI calls over the x402 protocol at $0.005–$0.05 per call, paid in USDC on Base. This is live but has earned nothing yet.

## Money

| Line | Amount | Basis |
|---|---|---|
| Revenue per Weekly Pass | ₹199 | `lib/plans.ts` |
| Revenue per Monthly Pass | ₹299 | `lib/plans.ts` |
| Payment cost | ₹0 per transaction | UroPay charges a flat subscription (₹0 for ≤15 transactions/month, ₹100 for ≤50, ₹1,000 unlimited) and takes **no per-transaction commission** |
| Referral commission | 16.72% of first payment | ~₹33 on a Weekly Pass, ~₹50 on a Monthly Pass, once per referred customer |
| Hosting | Vercel — a paid product cannot stay on the free Hobby tier, so ~$20/month (≈₹1,760) | Vercel's terms; Hobby is non-commercial |
| Database/storage | Supabase free tier initially (₹0) | the app's data volume is small |
| Inference | GLM-5.3-Flash at **$0.15/M input, $0.50/M output**; Kimi K3 at **$3/M input, $15/M output** | published Z.ai and Moonshot rates, Sep–Oct 2026 |
| Cash spent so far | ≈₹0 (phone, laptop, and time) | solo build |

## The competitive picture in one line each

- **Model Diplomat** — the category leader: purpose-built MUN AI, cited primary sources, **free tier of 200 searches then 50/day**, Pro at **$20/month or $144/year**, and 58,000–86,000 users claimed across its own marketing pages.
- **ChatGPT** — free tier ₹0, ChatGPT Go ₹399/month, Plus ₹1,999/month. A general model with a good prompt does much of the same job.
- **Free position-paper generators and prompt packs** — dozens exist, including free no-login tools.
- **WiseMee, Best Delegate, MUN coaches** — free or fee-based teaching and content, competing for the same prep hours.

## What the founder wants to know

Whether this business can work as priced.
