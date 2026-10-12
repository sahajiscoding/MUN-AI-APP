# Brand

The business already has a brand, and it is better than a new one would be. This file names it, protects it, and fixes the one thing wrong with it — which is not the look. **The look is right. The promise is the part that lies.**

## What exists today, read from the code

- **Name:** "MUN Prep App" (`app/layout.tsx` metadata, `lib/site-pages.ts` — 28 uses). The site's own name is *MUN Prep*; "App" is a suffix in the title tag.
- **Palette** (`app/globals.css`): paper `#f7f3ea`, ink `#171412`, **oxblood `#7a1f2b`**, **brass `#b78a42`**, **patina `#1d6f68`**, muted `#625951`.
- **Type:** serif display (`Georgia, Cambria, "Times New Roman"`), humanist body (`Aptos, "Avenir Next", "Segoe UI"`), mono for data (`Cascadia Code, Consolas`).
- **Voice, as actually written on the site:** "Prepare like your committee starts tomorrow." · "Research, draft, and debate from one focused Model United Nations prep workspace." · "View access".

This is a **documents-and-diplomacy** identity: aged paper, a diplomatic oxblood, a brass institutional accent, a patina green like oxidised bronze, and serif headings — the visual language of treaties, letterheads and committee placards. It reads serious, literate and slightly archival. For a product whose output is a position paper, that is precisely the right metaphor, and it is a *better* brand than most competitors'. It should not be thrown away.

**The fix is one line of copy, not a redesign.**

## Name

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

### Shortlist of three

1. **MUN Prep** — keep it. SEO is the only acquisition channel this business can afford (see `marketing.md`: the CAC ceiling is ₹169, which rules out paid ads). A descriptive, literal name is worth more here than a clever one, because it is what a coordinator types into Google. **Recommendation: keep `MUN Prep` as the product name and let the brand work be about the promise, not the name.**
2. **Caucus** — the strongest alternative if the founder wants to grow into a category brand rather than a search entry. Only worth it later; renaming now would throw away whatever search presence exists.
3. **Circuit** — the name for the *data asset* the monopoly lens recommended, if it is ever built (the conference calendar). It is a better name for a future product than for this one.

### Checks the founder must run — I can only do public searches, and nothing is registered until it is registered

- **Trademark:** search the **Indian register (ipindia.gov.in)** for "MUN Prep" in classes **9** (downloadable software), **41** (education, training, entertainment) and **42** (SaaS, software design). If the founder ever sells to the US/UK, also check **USPTO** (tmsearch.uspto.gov) and **UKIPO** in the same classes. **"MUN" and "Model United Nations" are widely used generically and are likely unprotectable on their own** — the protection would be in the distinctive part, which "Prep" is not. The honest expectation is that "MUN Prep" is hard to trademark and easy for someone else to use. **A trademark lawyer confirms this; a name is not owned until it is registered.**
- **Domain:** check `.com`, `.in`, and `.app` for `munprep` and the variants actually being considered. **Do not assume any are free** — check at a registrar.
- **Handles:** check `@munprep` on Instagram, TikTok, X and YouTube. A delegate discovers this on Instagram, so an available handle matters more than the domain here.
- **Confusion:** keep clear of **Model Diplomat** (name, and its "record at your back" language), **Best Delegate**, **WiseMee**, **mymun** and **MUN Command**. Nothing in the shortlist collides.

## The promise, the tagline, the voice

### The one-line promise

> **Every brief, paper and speech comes with where it came from — and you can check every one before you say it out loud.**

**This promise cannot be made truthfully today.** The app's own system prompt instructs the model not to invent citations and to mark doubtful claims as "needs verification", but there is **no retrieval layer** — the model is answering from its weights, so nothing can actually be pointed at. The instruction is a hope, not a mechanism.

**Choose one and commit:**

- **(a) Build it:** index real sources (UN documents, government statements, treaty texts, current affairs) and cite them. Then the promise above is true, and it is the promise that beats the category leader on its own ground. **This is the board's recommendation and the product lens's condition 3.**
- **(b) Stop implying it:** reposition as a **strategy coach** — committee procedure, debate tactics, speech structure, resolution wording, how to caucus. Promise *"a delegate who knows what to say and when"*, not *"facts you can trust"*. In that version the promise becomes: *"You will walk into committee knowing exactly what to do — and how to say it."* That is true to what the architecture actually does, and it is a real product.

**Until one is chosen, the brand must not claim accuracy.** That is not a positioning preference, it is the difference between a brand promise and a lie — and in a category where a competitor is publicly campaigning against tools that invent citations, it is also the difference between a debate the founder can win and one he cannot afford to have.

### Tagline — three options

1. **"Know what to say, and where it came from."** — the rigour promise, for path (a).
2. **"Speak like you've done this before."** — the confidence promise, safe on either path, aimed at the first-timer (50% buy rate).
3. **"Three weeks out. One brief. No lies."** — the honest one; pairs with the "who this is not for" post in `marketing.md`. Blunt, memorable, and it makes the free brief a brand behaviour rather than a promotion.

**Recommendation: use 2 on the site, 1 once retrieval exists.** 3 belongs in the launch campaign where the honesty is the point.

### Voice — three adjectives

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

### Before / after — one line from `pitch.md`

**Before:** *"Tell it your committee, your agenda and your country. It writes your research brief, your country's position, your position paper, your opening speech, your POIs and your draft resolution clauses."*

**After:** *"Give it your committee, your agenda and your country. It gives you the research, the sources behind it, and the outline of what to say — and you write the paper that goes in, because it's your committee."*

The rewrite drops the promise that the product does the delegate's work, takes the integrity objection away, and stops claiming a source base that does not exist yet.

## The look

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

## The first five touchpoints

1. **The homepage** (currently "Prepare like your committee starts tomorrow." **Change it.** It sells to the night-before crammer, the cohort that bought at 0%): → **"Three weeks to go. Your committee, your country, your brief — and the sources behind it."** *(drop the last clause until retrieval exists)*, with **the price visible and a free first brief button above the fold.**
2. **The confirmation screen after payment** (the only warm moment the product currently has): not "Payment successful." → *"You're in. Tell us your conference date and we'll build your prep order backwards from it."* This is also where the countdown from the product lens gets born.
3. **The receipt/email:** plain, branded, and it states the refund promise in the same words used on the site. A receipt is the first thing a parent reads; write it for the parent.
4. **The first social post:** the screen recording of a real brief being generated for a real committee. No music, no captions over the top, no cuts. The product is the proof.
5. **The reply to the first complaint:** *"That's a fair complaint. Here's what I'm changing, and here's your refund if you want one."* Written by the founder, signed by the founder, no template. This reply will be screenshotted and posted in a WhatsApp group more often than any ad — it is a brand asset, and it should be treated like one.

## Rules

- Never a screenshot of the competitor's product that has been mocked up rather than taken live, and never a comparison that is not literally true.
- Never a font, icon or image the founder has no right to use; the system-font stack above already avoids this entirely.
- Never a claim of accuracy, awards or endorsements the product cannot evidence.
- **Not legal advice on trademarks.** The India, USPTO and UKIPO searches above are the founder's to run, and a lawyer confirms before any money is spent on the name.
