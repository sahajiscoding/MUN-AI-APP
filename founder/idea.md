# MUN Prep App (working name; live at mun-ai-app.vercel.app)

- **What it is:** A web workspace that helps a Model UN delegate do the week's prep before a conference — AI research briefs, country policy profiles, position papers, opening speeches, POIs, rebuttals, and resolution drafting, plus a library of MUN courses, a terminology glossary and quizzes.
- **Who it is for:** Model UN delegates. Primarily Indian school and college students, roughly 14–22, English-medium, who are preparing for a specific conference date. Secondary: MUN club heads, school MUN coordinators, and MUN coaches/trainers who prep delegations.
- **What it sells, at what price:** A **3-day Free Trial** upon signup (unlimited requests, 1,000,000 token/day cap, Max mode safely downgraded to Thorough), followed by two time-boxed passes sold in Indian rupees through UroPay (UPI): **₹199 for a 7-day Weekly Pass** and **₹299 for a 30-day Monthly Pass**. Both give the same core access — the difference is duration and two monthly extras (longer prep history, multiple committee workspaces, priority model routing, export-ready drafts). Separately, the app sells machine access to bots/crawlers via x402 microtransactions ($0.05 per AI research call, $0.005 per content call), which is a rounding-error revenue line today.
- **Where and how:** Entirely online, browser-based, no app store. Customers arrive through Google search, MUN Instagram/WhatsApp communities, and a **referral partner programme** (partners get a unique link and **16.72% commission on a referred customer's first purchase**). Delivery is instant: pay by UPI, entitlement activates server-side, access runs for the period bought.
- **Budget and constraints:** The product is already built and deployed (Next.js 16 + Supabase on Vercel, UroPay for payments, NVIDIA NIM models for inference). There is no salary cost — it is a solo founder building in public. The binding constraints are (a) **distribution**: converting trial users to paid passes through direct outreach, and (b) **inference cost control**: the app exposes a "Max" mode backed by Kimi K3 that costs roughly 150× the default mode per request; this is now strictly bounded on trial and bot access via `grantedResponseLimits()`.

## What is already decided (do not re-open)

- Price points: ₹199/week, ₹299/month. Set in `lib/plans.ts`.
- Payment rail: UroPay. Flat monthly fee, **zero per-transaction commission**. Not negotiable in this analysis.
- Usage caps: 60 AI requests/day and 300,000 tokens/day **per user**, regardless of plan.
- GPU/provider: NVIDIA NIM — GLM-5.3-Flash for Quick and Thorough modes, Kimi K3 for Max mode.
