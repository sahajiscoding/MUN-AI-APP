# Monopoly lens

Source applied: the "Monopoly" lens in `lenses.md` (a summary of the framework in *Zero to One*). This memo speaks as the framework, not as its author.

**Score: 4 / 10 | Vote: PASS**

## What is strong

**Timing is genuinely good.** The MUN circuit in India is expanding (conferences in 108+ cities, a public calendar of 71 upcoming Indian conferences, two peak seasons a year), and frontier models are simultaneously getting *cheaper* at the mid-tier: GLM-5.3-Flash at **$0.15/M input / $0.50/M output** means a Quick-mode answer costs roughly **₹0.09** in inference. A business that could not have existed two years ago now has near-zero marginal cost on its default path. Naive consumer AI subscriptions (₹399–₹1,999/month) are priced for general chat, not for a three-week burst of MUN prep, so a ₹199 weekly pass is a genuinely different shape rather than a cheaper clone.

**A small market exists that could be *owned* rather than contested.** Not "students" and not "AI writing tools" — the concrete small market is **a specific school's delegation preparing for a specific conference, bought as a block by the club head or coordinator.** That is a market where one persuasive conversation yields 10–40 seats, where the buyer is reachable, and where a specialist can be unambiguously the best choice.

**There is a real secret available, and it is not the model.** It is the **conference calendar and institutional knowledge**: which conferences exist, on what dates, with what committees and agendas, in which cities, at what level, who chairs them, what tends to win. Nobody outside the circuit has that dataset. Combined with per-conference, per-committee prep material it is a proprietary asset — the thing that turns a generic chat wrapper into something an entrant cannot replicate by writing a better system prompt on a Tuesday.

## What would kill it — the top three, most dangerous first

**1. It is in a crowded market and has none of the four sources of durable advantage.**
- *Proprietary technology:* none identified. It is a system prompt, a model API and a UI. No retrieval, no dataset, no algorithm.
- *Network effects:* none. A delegate's prep improves nothing for the next delegate.
- *Economies of scale:* the ones present (cheaper inference) accrue to *everyone* in the category, including a free competitor with 80,000 users — scale advantage belongs to whoever has the volume, and that is not this business.
- *Brand:* none yet — no users, no reviews, no awards claimed on the public page.

Against a competitor claiming 58k–86k users, a free tier and cited sources, and against a **free** general model that does 70% of the job, this is the definition of competition without a moat. The lens's claim is uncomfortable but applies: in a crowded market, margins get competed away. Note the direction of the threat — the leader is currently priced *above* this product, which means the leader can cut price into this position at any time, and this product has no room to retreat.

**2. The engineering question is answered "incremental", not "breakthrough".** Nothing here is 10× better than the next option on anything a buyer cares about. It is arguably *worse* than the leader on the one axis MUN delegates are most sensitive to — whether you can trust the facts you will say out loud. A position paper with an invented resolution number is not a 10% problem; it is the delegate's credibility. The product has no retrieval layer, so on that axis it is behind, not ahead.

**3. Durability is close to zero as currently built.** What stops a copycat in month six? Realistically nothing: three prompt templates, a model API and a paywall are a weekend of work for anyone with an API key — or a *feature* for the incumbent, which already has the users and the sources. Worse, the threat is not only other companies: the general models keep absorbing the capability that *is* the product, so the winning move for a big lab is to make this business unnecessary rather than to compete with it.

## The questions I would ask the founder

1. What do you know about MUN in India that nobody with a model API could look up? If the answer is "which prompts work", that is not a secret, that is a leak.
2. Which *specific* small market are you going to own first — name the schools, the conferences, the cities — and what share of it can you get this season?
3. If Model Diplomat drops Pro to $5/month or makes it free for students, what is your business for the rest of the year?
4. If GPT-6 ships a "MUN mode" next quarter, what remains of your offer?
5. Distribution: how do the first hundred *paying* customers arrive, one at a time, and what does each cost you? A product with no path to buyers is not a business, and "MUN Instagram" is a hope, not a channel, until it is a plan with dates and numbers.
6. Over ten years, on what does this hold its position — the brand among Indian school MUN clubs, or nothing?

## Why PASS, and what would move it

The product is well built and the market is real, but as pitched this is a feature-shaped business competing in a crowded category with an incumbent holding the users and the trust, and with free substitutes on both sides of it. On this lens's own criteria, there is no monopoly available at this price, in this shape, with this offer — and PASS is a result, not a failure.

It does not have to stay that way. There is a route to a defendable position, and it is not a better prompt:

1. **Own the circuit, not the tool.** Become the system of record for Indian MUN conferences — dates, committees, agendas, chairs, results. That data is a genuine secret, it compounds, and it makes you the place delegates go *first*, before they even want an AI.
2. **Sell blocks, not seats.** Win MUN clubs and school coordinators; a 30-seat school licence at a low per-seat price is a different, more defensible business than one ₹299 impulse purchase at a time, and it comes with the club's credibility behind it.
3. **Be the rigour brand.** If "everything is verifiable" is the promise, build it — index the primary sources (UN resolutions, treaty text, official statements, voting records) and refuse to answer outside them. That is a defensible claim with a real technical component, and it is the exact axis on which MUN cares.
