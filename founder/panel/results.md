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

# Buyer panel: MUN Prep App (AI preparation workspace for Model UN delegates, India-first, ₹199/week or ₹299/month)

**9 buy · 31 pass** (22% buy) out of 40 simulated buyers. Seed 11, so the same cards can be dealt again.

These are simulated buyers, not customers. Use this to find objections and weak spots, then confirm the big ones with real people before you spend.

## By segment

| group | buyers | buy rate |
| --- | ---: | ---: |
| Club head or coordinator buying for a group | 5 | 40%  (thin) |
| Circuit regular chasing awards | 6 | 33%  (thin) |
| College delegate, own pocket money | 14 | 21% |
| School delegate, parent pays | 15 | 13% |

## By buying behaviour

| group | buyers | buy rate |
| --- | ---: | ---: |
| Award chaser, reads past papers | 5 | 60%  (thin) |
| First conference, no idea what to expect | 6 | 50%  (thin) |
| Taught by a school MUN coach | 6 | 33%  (thin) |
| Already uses ChatGPT for everything | 9 | 11% |
| Prepares the night before | 8 | 0% |
| Reads reviews and asks seniors first | 3 | 0%  (thin) |
| Deal hunter | 3 | 0%  (thin) |

## By income

| group | buyers | buy rate |
| --- | ---: | ---: |
| $1,392,000 and up | 14 | 29% |
| under $680,000 | 13 | 23% |
| $680,000 to $1,392,000 | 13 | 15% |

## Why they pass

| reason | buyers | in their words |
| --- | ---: | --- |
| trust | 10 | "My coach gives us material I can check with him. If the AI says something wrong in an unmoderated caucus I am the one standing there." (P002) · "I always check reviews before paying and I could not find anyone who used this. That is not proof it works, that is proof nobody is saying it does." (P004) |
| price | 7 | "226000 a year is not a lot and it is my own money. I would panic-buy the night before, but I would rather phone a friend who has done it." (P003) · "There is no free trial and I never pay full price for something I have not tested. I will wait for a discount." (P005) |
| other | 5 | "Our school coach runs sessions and my parents already paid 2500 for the conference. I will ask him, not an app." (P007) · "My school coach hands us templates and checks our papers. I do not need to pay for the same thing." (P026) |
| convenience | 5 | "I do everything the night before and I reach for whatever is already open. Asking an app to do MUN specifically has never occurred to me." (P009) · "A senior in my WhatsApp group sent me their whole folder of old papers. I have free material sitting right there." (P012) |
| quality | 3 | "I use ChatGPT every day and it is fine. I am not paying for a version of what I already have without seeing a difference." (P024) · "At 11pm the night before I would pay anything, but you have to show me something first. 199 for a week I will only use once is not convincing either." (P025) |
| habit | 1 | "I already have ChatGPT and my coach has templates. Adding one more thing to pay for is friction I do not need this week." (P006) |

## Why they buy

| reason | buyers | in their words |
| --- | ---: | --- |
| quality | 5 | "I have three conferences this season and the difference between a good brief and a thin one is the difference between speaking and sitting silent. 299 is nothing next to what I spend on travel." (P011) · "I have come second twice. Anything that sharpens my opening speech is worth a month of pocket money and 299 is nothing." (P016) |
| need | 4 | "I have never been in committee and I am honestly scared. Having a brief ready in my own committee's words is worth more than the money." (P001) · "I run my school's club and I would spend 299 to test it for the whole team. If it works I want it for twenty people, not one." (P013) |

## What would flip a no

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

*(Implementation update: The top flip condition — "Any free trial at all" / "free so I can see the quality" — has been directly resolved by launching the 3-day free trial with 1,000,000 tokens/day and no credit card required).*

Buyers say they would buy **2.0 times** in the first month on average.

40 buyers gave all four price answers. Run founder-pricing's van_westendorp.py on the answers folder.
