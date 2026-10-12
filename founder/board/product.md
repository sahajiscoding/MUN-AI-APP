# Product lens

Source applied: the "Product" lens in `lenses.md` (a summary of the ideas in Isaacson's *Steve Jobs* and the public record of how Apple built products). This memo speaks as the framework, not as its author.

**Score: 7 / 10 | Vote: FUND IF**

## What is strong

**The moment has been chosen correctly, and it is a good one.** The product is not "an AI for students" — it is aimed at a specific, vivid, high-stakes hour: *five days before committee, with a country you did not choose and an agenda you have never studied.* That is a real moment with real pressure, and the tool list maps onto it honestly. Research brief, country position, position paper, opening speech, POIs, resolution clauses is exactly the order the work actually happens in. Somebody who understands MUN built the shape of this, and it shows.

**The interface has taste.** The live site reads like a product, not a project: "Prepare like your committee starts tomorrow." is a good headline, the tools are named like a delegate's desk rather than like prompt presets, and the pricing is expressed in time-boxes (weekly, monthly) that match the natural unit of MUN prep — a conference is an event with a date, so a pass with an expiry is the correct commercial shape. ₹199 for one week is a genuinely thoughtful packaging decision.

**The engineering craft is above average and mostly invisible, which is the right place for it.** Payment verification is server-side and authoritative, entitlements are enforced on the server, admin sessions require MFA, secrets never reach the browser, and the AI keys never leave the server. Recently, the bot-payment path was hardened so a single paid call can never be replayed into unlimited free ones. None of this is visible to a delegate, and all of it is the difference between a toy and something you can charge money for. A business that is careful where nobody is looking tends to be careful where they are.

**Ruthless focus is present in one place that matters.** One product, one price ladder, one job. That is rare and it is an asset — protect it.

**The bot rail is charming and probably irrelevant.** Selling API calls to machine agents over HTTP 402 is intellectually lovely and currently earns nothing. Keep it if it costs nothing; do not let it consume the founder's attention, because no delegate will ever care.

## What would kill it — the top three, most dangerous first

**1. The experience is handed between systems at the two worst possible moments, and both seams leak.**
- *Seam one — the sign-in wall before the price.* A visitor who taps "View access" is thrown into an authentication screen. They cannot see what they are buying, for how much. The product hides its single most persuasive fact — that it costs less than the coffee they will drink before committee — behind an account they have not been given a reason to create.
- *Seam two — paying before seeing.* The delegate must hand over ₹199 *before* the product has demonstrated the one thing they are quietly terrified about: whether the output is any good. Every other AI tool on earth lets a person type first. This is not a pricing problem; it is a craft problem. The first five minutes are the product, and right now the first five minutes are a paywall.

**2. The product's own promise and the product's architecture disagree, which is the most serious craft failure here.** The system prompt says: separate verified facts from recommendations, do not invent citations, mark unsupported claims as "needs verification". That is a promise the architecture cannot keep, because **there is no retrieval layer** — the model answers from its weights alone. So the interface silently asks the delegate to trust unverified text, and the one safety valve (a "needs verification" flag the model must remember to emit) depends on the model's cooperation, not on evidence. In a committee room, a delegate says a number out loud and a chair checks it. Simplifying this is the hard part, and the simplification has not been made: either **go and get the sources** (index the primary corpus, cite everything, refuse to answer outside it) or **drop the pretence of authority** and make the product a sharp *strategy* coach — speech structure, blocs, POI tactics, rebuttal drills — where being wrong about a resolution number does not matter. Right now it does both jobs half-way.

**3. Three modes is a spec sheet, not a decision.** A delegate who is anxious and short on time should not be handed a token slider called Quick/Thorough/Max and left to choose their own model. That is the founder's vocabulary — it maps to GLM-5.3-Flash and Kimi K3, not to a delegate's need. Worse, "Max" quietly costs the business roughly **150× the default per request** (Kimi K3 at $3/$15 per million tokens versus GLM-5.3-Flash at $0.15/$0.50) with no cap tied to what the customer paid. That is an engineering decision leaking into both the customer's experience *and* the company's margins at the same time. Say no to it. The delegate does not want a mode; the delegate wants the answer to be good, on the first try, without thinking about it — and the fix is one decision made *for* them, plus a deliberate upgrade path for the rare delegate who truly needs 12,000 tokens.

## The questions I would ask the founder

1. Describe the first five minutes a real delegate has with this product. If any of it is "sign in, then pay", you have not designed the experience yet.
2. If a chair asks the delegate where a figure came from, what is the honest answer the product has prepared them for?
3. What is the one thing? Name the single job you must be the best in the country at — and then name what you are going to cut to get there. (My answer, if you asked: cut the three modes to one, and cut the courses library down to the handful that earns its place.)
4. What does the delegate see *after* the conference — is there any way for winning to feed back into the product as proof for the next delegate?
5. Where does the experience break at 8am on the morning of the conference, on a phone, on Indian mobile data, with five minutes left?
6. Does the delegate ever hear the product say "I don't know"? If it never does, it is lying.

## If FUND IF: the conditions

1. **One mode by default, chosen for the buyer.** Replace the Quick/Thorough/Max control with a single best answer, and tie the expensive model to something the business can afford — a plan tier or an internal quality judgement, not a free-for-all toggle.
2. **Let a delegate feel the product before paying.** A capped free first experience (a few requests, one per account) is the whole top of the funnel. Make the price visible on the page, before sign-in.
3. **Resolve the rigour contradiction in one direction.** Either index real sources and cite them, or reposition to strategy and stop implying factual authority. Do not ship the middle.
4. **Build the deadline into the interface.** The delegate's mental model is a date and a committee. Ask for the conference date once and shape the whole workspace around "you have 5 days, here is the order to do this in." This is the strongest lever available and it costs nothing in inference.
5. **Design the seam between the two roles.** The person who pays is often a parent or a school; the person who uses it is a teenager on a phone at 11pm. Decide how each of them is convinced, and do not make them go through the same door.
6. **Make the first screenshot the ad.** A real brief, with the committee's name in it, shown before sign-in, sells this product better than any headline — and it is the fastest way to find out whether the output is actually good enough to charge for.
