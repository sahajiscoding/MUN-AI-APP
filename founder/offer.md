# The offer

## The offer today, stated plainly

> *Pay ₹199 for a week (or ₹299 for a month). You cannot try it first. You cannot see the price until you sign in. There is no refund policy stated on the site. If it does not work for you, you have lost the money and the week.*

That is not an offer. **That is a price with a gamble attached.** The price is validated; the *offer* fails, and it fails for exactly one reason: it shifts every rupee of risk onto the buyer *before* they have seen a single line of the product's output.

## What the panel proved

**9 bought, 31 passed — a 22% buy rate, below the 25% bar.** Read the disclosure in `panel/results.md`: the panel is simulated, so treat 22% as a direction, not a measurement. But the *reasons* are the useful part, and they cluster brutally:

| Reason they passed | Buyers | The objection, in their words |
|---|---:|---|
| **Trust** | 10 | *"I don't trust AI facts in committee, the chair will catch me out."* (P002) · *"I could not find anyone who used this. That is not proof it works, that is proof nobody is saying it does."* (P004) |
| **Price** | 7 | *"There is no free trial and I never pay full price for something I have not tested."* (P005) · *"299 is a whole week of lunch."* (P008) |
| **Other (the coach)** | 5 | *"Our school coach runs sessions and my parents already paid 2500 for the conference. I will ask him, not an app."* (P007) |
| **Convenience (the free substitute)** | 5 | *"A senior in my WhatsApp group sent me their whole folder of old papers."* (P012) |
| **Quality** | 3 | *"At 11pm the night before I would pay anything, but you have to show me something first."* (P025) |

**The single most common flip condition across the whole panel was: show me the output first.** Four buyers asked directly for it; it was the top answer to "what would change your mind" in every segment.

## The bigger problem the panel exposed

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

## The offer to build instead

### For the delegate: **"The conference week" — ₹199, and you see it before you pay for it.**

**The stack, in the order they experience it:**

1. **A free brief, on your real committee.** Enter your committee, your agenda and your country. Get one complete research brief. No card, no sign-in beyond the account you already have. *This is the whole risk reversal, and it costs the founder about ₹0.07.*
2. **A week of full access for ₹199** — timed to *the date of your conference*, not to the calendar. The workspace asks when the conference is and shapes itself around the remaining days.
3. **The delegate's kit:** research brief, country position, position paper, opening speech, POIs, resolution clauses, and the courses/glossary tab when they hit a term they don't know.
4. **The guarantee: if the conference doesn't go better than it would have without it, tell us within 7 days and we'll refund it.** Word it exactly that loosely, and honour it without argument. At ₹0.07 per brief and UroPay charging nothing per transaction, the refund rate is far cheaper than the conversion rate it buys. *This is a founder decision, not a legal document — keep it as plain as it is written here and get an accountant's eye on the wording before publishing.*
5. **Proof, as it arrives.** Publish the first delegate who agrees to be named, with their conference, their committee, their result and their actual words. **Do not write a testimonial for anyone.** Until then, publish the *sources*: a public page showing where the facts in a MUN Prep brief come from.

### For the school or club: **"The delegation" — priced per block, not per seat.**

The panel's highest buy rate (40%) and the clear ask from a club head (*"If it works I want it for twenty people, not one"*). The shape is a term-length block for a delegation, invoiced to the school or the club, with the coordinator as the buyer and the delegate as the user. **The number is not set yet** — there are no real school deals to price from, so this goes to `ops.md` and `launch.md` as a task, not as a guess. What is decided here is the *shape*: one invoice, many seats, a term of access, and the coordinator deciding — not twenty teenagers each deciding on their own.

## Killing the three leaks

None of the offer work lands unless these are fixed, and they are all one-line changes:

1. **The price is behind a sign-in.** `/pricing` redirects anonymous visitors to `/auth/signin`. A delegate who cannot see the price cannot decide anything. **Show the price, and show it on the landing page.**
2. **There is no way to feel the product before paying.** Fixed by the free brief above.
3. **The site says nothing about what happens if it doesn't work.** Fixed by the guarantee above, written in one sentence a 15-year-old can parse.

## The first sentence

The current headline is *"Prepare like your committee starts tomorrow."* It is well written and it sells the wrong thing — it is aimed at the last-night crammer, **the group with a 0% buy rate.**

The offer's headline should name the buyer who actually buys, and the moment that buyer is in:

> **Three weeks to your conference. Your committee, your country, your brief — before you pay.**

That sentence names the committed delegate (an active season, a date in hand), promises the specific artefact, and kills the two biggest objections in the same breath: *you see it first*, and *it is shaped around your deadline*.

## What not to do

- **Do not add features to answer the objections.** The panel's passers did not say "it needs more modes". They said "I don't trust the facts" and "show me first". More modes would make the cost problem worse and answer none of it.
- **Do not answer the trust objection with clever copy.** The trust objection gets answered by retrieval, by sources the delegate can open, and by other delegates' results — in that order. **The copy problem is not a copy problem.**
- **Do not discount the price.** ₹123 is where buyers start distrusting the quality, per the pricing curve. A discount below that would convert *worse*, not better.
- **Do not launch the school offer blind.** Get two schools to agree before publishing a per-delegation price, or the first number becomes the anchor forever.

## Does this offer pass the value equation?

**Dream outcome: yes** — a delegate who speaks well and might win has a dream outcome, and it is measurable in an award.

**Perceived likelihood: currently no, and that is the whole battle.** The delegate does not believe the output is true. This is a *product* problem presenting as a marketing problem: no citations, no retrieval, no third-party proof, no free trial, and a direct competitor whose entire pitch is "we don't make things up".

**Time delay: excellent** — a brief in about a minute, on a phone, the night it's needed.

**Effort and sacrifice: poor, and it is the easiest fix in the pack** — sign in, then pay, then discover, with the price hidden until account creation. Every one of those steps is a deliberate choice that can be reversed in an afternoon.

**Two of the four favour the buyer strongly. One is a product flaw that must be fixed in the product. One is a copy-and-flow flaw that must be fixed today.** That is a good place for an offer to be: it is not a reason to stop, it is a reason these specific changes are the next thing to build.
