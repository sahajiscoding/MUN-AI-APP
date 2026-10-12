# x402: Does It Work, and Is It Safe?

**An independent technical review of the x402 HTTP payment protocol — specification, reference SDKs, real-world deployments, and economy.**

| | |
|---|---|
| **Review date** | 2026-10-11 |
| **Versions tested** | `@x402/core` `2.10.0` (Apr 13, 2026) and `2.28.0` (latest, Sep 2026); source checkout at `x402-foundation/x402` @ `dd927a26` |
| **Method** | Spec + source audit, plus a live local testbed (real SDK middleware, a real facilitator running the SDK's own verification code, official client SDK signing real EIP-712 payloads), plus a literature/industry review |
| **Artifacts** | `research/x402/poc/` (reproducible harness), raw logs in this folder |
| **Revision** | 2026-10-12 — §8 corrected (the app uses **UroPay** on Next.js + Supabase; not Razorpay, not Firebase) and extended with the in-repo remediation record (§8.2). Protocol findings in §1–§7 are unchanged. |

---

## 0. Bottom line

**Does it work?** Yes, mechanically — I ran the full 402 → sign → retry → settle → serve loop end-to-end against the current published SDK, and it works. **Economically, mostly not yet**: independent analysis removes ~89% of the dollar volume as wash/test/self-dealing, real traffic is roughly **$28k–$42k per day** at an average payment of **$0.05–$0.20**, and the protocol's own public counter has not moved since March 2026. **Security: not safe by default.** I reproduced three of the four most-cited attack classes against the *latest* SDK, and a July 2026 peer-review-style study that black-box tested 15 real facilitators (99% of all x402 traffic) found that **every one violated at least one security rule**, yielding **31 previously-unknown vulnerabilities** including validated free-shopping and asset-theft exploits.

**The core structural problem in one sentence:** x402 protects the *token transfer* with strong cryptography, but it does **not** protect the *service* — the payment proof is not bound to the resource it buys, is not single-use at the HTTP layer, and the decision to serve is made in a different layer, at a different time, than the decision that money moved.

**What is genuinely solid:** price integrity (amount and recipient are cryptographically bound — I could not tamper with either direction), fail-closed behaviour (no bypass when the facilitator is down, malformed, or ambiguous), robust path-normalisation in the reference Express adapter, and a well-maintained, fast-moving codebase.

---

## 1. What x402 actually is

x402 revives HTTP `402 Payment Required` (reserved since 1997) as a machine-readable payment negotiation layer. Three roles:

| Role | Job |
|---|---|
| **Client** (agent, script, browser) | Signs a payment authorization; retries the request with proof |
| **Resource server** (merchant) | Prices endpoints, verifies proof, gates access, triggers settlement |
| **Facilitator** (usually a third party) | Verifies proofs and submits the on-chain transaction, **paying the gas** |

**Wire format (v2).** Server returns `402` with `PAYMENT-REQUIRED` (base64 JSON: `resource`, `accepts[]` with `scheme/network/asset/amount/payTo/maxTimeoutSeconds/extra`). Client retries with `PAYMENT-SIGNATURE` (base64 JSON: `x402Version`, `payload` = signed authorization, `accepted`, optional `resource`). Server returns `PAYMENT-RESPONSE` with the tx hash. (v1 used `X-PAYMENT`.)

**EVM settlement** is a gasless EIP-3009 `transferWithAuthorization`: the client signs an EIP-712 `TransferWithAuthorization` over exactly six fields — `from`, `to`, `value`, `validAfter`, `validBefore`, `nonce`. The facilitator submits it and pays gas. **No facilitator, resource, route, or price identifier is inside that signature** — this single design fact is the root of several findings below.

**Payment flows (added mid-2026, current SDK).** `authorization` = verify → **run handler** → settle. `upfront` = settle → run handler. `escrow` = both. For EVM EIP-3009 and Permit2, **the default is still `authorization`** (`paymentFlows = { eip3009: { supported: ["authorization","upfront"], default: "authorization" } }`).

**Governance.** Started at Coinbase (May 2025), x402 Foundation with Cloudflare (Sept 2025), contributed to the **Linux Foundation** (launched April 2026 with 22 members; operational 14 July 2026 with ~40 members incl. Visa, Mastercard, Google, AWS, Stripe, Cloudflare). The canonical repo moved to `x402-foundation/x402`; `coinbase/x402` is now a development fork. 6.7k stars, 2,160 forks, **698 open issues**, 80–200 commits/month, 354 contributors — actively developed (and, judging by the issue count, actively churning).

---

## 2. Does it work?

### 2.1 Mechanically: yes — verified myself

```
unpaid GET /api/cheap                     -> 402 (PAYMENT-REQUIRED, cache-control: no-store)
client signs EIP-3009, retries w/ header  -> 200 {"resource":"cheap",...}  (+ PAYMENT-RESPONSE)
402 -> sign -> retry -> settle -> serve   -> full loop works
```

Adoption infrastructure is real: AWS integrated x402 into CloudFront (June 2026) and shipped AgentCore payments GA (18 Aug 2026); Cloudflare exposes x402 in its edge stack; Circle, Visa and others have published integrations.

### 2.2 Economically: the numbers are much weaker than the headline

| Metric | Value | Source |
|---|---|---|
| Coinbase-reported cumulative | 165M transactions, ~$50M volume, 69k agents (Apr 2026); 185M+ / ~480k agents (Jun 2026) | issuer-reported, unaudited |
| Artemis + Visa, after filtering | **109.6M transactions, ~$15.0M** — i.e. **89% of dollar volume removed** as wash/test/internal; avg payment **$0.14** | Artemis/Visa report, data as of 21 Apr 2026 |
| Independently verifiable daily settlement | **~$28,000–$41,800/day**, ~131k tx/day, avg **$0.05–$0.20** | CoinDesk (Mar 2026), Helios Analytics (Sept 2026) |
| Sellers | ~5,300 counted vs 22,000 displayed | Artemis/Visa |
| Trend | daily settlement volume **down 93% YTD**, **down 55% over 3 months** (7-day avg ~$41.8k vs Q4-2025 peaks near $800k/day) | Helios Analytics, Sept 2026 |
| Coinbase's own concession | **25–30%** of transactions "may have been generated by users trying to climb public leaderboards" | Lincoln Murr (Coinbase), CoinDesk, 23 Aug 2026 |
| The public counter | x402.org "Last 30 Days" showed the *same four numbers* in March, July, twice in August and again in September 2026 | independent audit of the page |
| Base's own 30-day figure | 3.1M transactions / $1.2M value | Base, 29 May 2026 |

Productisation is also still gated: **Cloudflare Pay Per Crawl is *still* closed beta 15 months after launching (Jul 2025)**, its "accrued earnings balance is not currently visible in the dashboard," and the Monetization Gateway is a US-only closed beta (opened 30 Sept 2026). Cloudflare's wallet handles (`*.cloudflare.pay`) could be *reserved* but as of 15 Sept 2026 **could not send, receive or hold funds**. Cloudflare's own claim of ">1 billion 402 responses/day" measures *challenges issued*, not payments made.

The honest reading of a real deployment: a developer who ran a paid-per-page site since 8 Aug 2026 reported that **every payment came from his own agents, on testnet** — "no search crawler is turning up and paying me."

**Verdict on "does it work":** the rail works; the demand isn't there yet, and the published adoption numbers are inflated by roughly an order of magnitude on the metric that matters (money).

---

## 3. Security findings — reproduced against the current SDK

Everything in this section I ran myself against `@x402/core/express/evm@2.28.0` (latest) using the official client SDK to produce authentic payloads. Raw evidence is in this folder. The merchant and facilitator are the real reference implementations; only the blockchain RPC is stubbed (no chain egress in the sandbox), and I flag exactly what that stub means for each result.

### 3.1 🔴 A payment is not bound to the resource it buys

**What the protocol does:** the 402 challenge contains `resource.url`; the client echoes a `resource` object in the retry payload. **Nothing compares them.** Verification checks the EIP-712 signature's `to`, `value`, `validBefore`, and the `accepted` block — never the requested route.

**Reproduced:**

| Test | Result |
|---|---|
| Payment bought for `/api/cheap`, sent to `/api/twin` (same price, different endpoint) | **HTTP 200 — twin resource served** |
| Same, with the attacker **rewriting** `resource.url` to `/api/twin` | **HTTP 200** |
| Same, with the `resource` field **deleted entirely** | **HTTP 200** (so it isn't even a string check) |
| Tampering `accepted.extra` (client-supplied) | **HTTP 200** (matching is a subset check, not equality) |

Code-level confirmation: `findMatchingRequirements()` compares the server's requirement with the client's echoed `accepted` via `paymentRequirementsMatchAccepted()`; the `resource` object is not part of `accepted` and is never consulted. The earlier study (`arXiv:2605.11781`) reported the same thing across three independently audited SDKs: *"a payment signed for resource A on Endpoint-1 can be replayed for resources B, C, and D on the same server."*

**Impact.** Any two endpoints with the same price, recipient and network share one payment class. This is not a theoretical "£99 for £1" bypass (price *is* enforced — see §3.6), but it breaks per-resource metering, per-resource authorisation, and any audit trail that says "this payment was for *that*". It also means a "pay once, get one" guarantee does not exist per resource.

**Fix that works with today's USDC:** `nonce` is the only free-form signed field in EIP-3009. A merchant can require `nonce = keccak256(resource_id ‖ salt)` and verify it — binding the authorisation to the route using only fields that already exist. Permit2-based flows can carry it in the witness. Neither is specified or implemented in the reference stack.

### 3.2 🔴 Replay protection is on-chain only — the HTTP layer has none

`/verify` is stateless and never records a nonce. I called the reference facilitator's `/verify` five times with the *same* payload: `[true, true, true, true, true]`. Single-use is delegated entirely to the fact that the EIP-3009 nonce can only be consumed once *on chain*.

**Reproduced (8 parallel requests, one payment, 250 ms non-idempotent handler):**

| Metric | Result |
|---|---|
| HTTP 200s | **1 / 8** |
| **Server-side executions of the paid handler** | **8 / 8** |
| Wall time | 291 ms |

Because the default `authorization` flow **runs the handler before settling** (it buffers the response and only releases it if settlement succeeds), the *client* gets one response — but the *server does the work N times*. With a facilitator that doesn't authoritatively enforce single-use on chain — a broadcast-only/optimistic one, a `settlement_pending` path, a degraded RPC, a cache-permitting CDN, or any custom facilitator — I reproduced **full free service**:

```
one payment, 6 concurrent replays  -> statuses [200,200,200,200,200,200]  6/6 grants
one payment, 10 sequential replays -> 10 × 200                           10/10 grants
```

Code evidence that this is a design choice, not a bug: the reference project's test suite contains **no replay or idempotency tests for the payment flow at all** (nonce-storage tests exist only for the unrelated `sign-in-with-x` auth extension). The x402 spec's entire security section (§10.1) reads: replay is prevented because "each authorization includes a unique 32-byte nonce" and "EIP-3009 contracts inherently prevent nonce reuse at the smart contract level." That protects the *token*, not the *service*.

**The only shipped mitigation is opt-in and incomplete:** the `payment-identifier` extension (client-generated idempotency key). It ships helper functions (`generatePaymentId`, `extractPaymentIdentifier`, …) and **no storage/dedup implementation whatsoever** — the application must build the store, the server must declare `required: true`, and the client must choose to send an id. It is not on by default.

### 3.3 🔴 The payer's authorisation can be consumed by anyone (settlement preemption)

The signed EIP-712 message has no facilitator field (verified from the SDK's own `authorizationTypes`: `from, to, value, validAfter, validBefore, nonce`). The payload travels in an HTTP header, and **the facilitator itself — plus any observer on the request path — receives everything needed to submit it on chain first.**

**Reproduced:**

```
attacker settles the client's PAYMENT-SIGNATURE directly
  -> {"success":true,"transaction":"0x…10"}
legitimate client then requests the resource
  -> HTTP 402   ← paid, but denied
```

The earlier study validated the same on live testnet: the on-chain transfer succeeded with the attacker's submission, consumed the nonce, and the endpoint's own settlement then failed with a 402.

**Impact:** the client is charged and receives nothing; the merchant's facilitator burns gas on a reverted transaction. This is a griefing/DoS primitive, not a theft primitive — the money still reaches the merchant. But it also means the merchant **cannot** rely on "my facilitator settled it" as evidence about *who* the payer transacted with, and it makes the facilitator's settlement outcome non-authoritative by construction.

### 3.4 🟠 Cache leakage: fixed in the SDK, absent from the spec, and historically real

| Version | `Cache-Control` on 402 | on paid 200 |
|---|---|---|
| `@x402/core` **2.10.0** (Apr 2026) | **none** | **none** |
| `@x402/*` **2.28.0** (Sep 2026) | `no-store` | `private` |

The fix landed 30 July 2026 (TS/Py #2990, Go #2956) and first shipped in **2.21.0 (4 Aug 2026)**. Before that, a CDN could legitimately cache a paid response and serve it to unpaid clients — the July 2026 study measured exactly that on live endpoints, and the earlier paper reported a "production CDN cache leak". **The specification still contains zero occurrences of `Cache-Control` or `no-store`**, so any implementation not using the reference SDK inherits the bug by default. Anyone pinned to an older SDK, or running an edge/Next.js/Hono deployment with its own caching rules, needs to verify this themselves.

### 3.5 🟠 Everything the client says about the resource goes to a third party

Confirmed with a logging proxy in front of the facilitator. The facilitator receives, on **both** `/verify` and `/settle`, the full `paymentRequirements`, the full `accepted` block, the complete authorization (`from`, `to`, `value`, `validBefore`, `nonce`), the signature, **and the client-supplied `resource.description`**:

```
>>> FACILITATOR RECEIVES POST /verify
    payload.resource : {"url":"http://…/api/cheap",
                        "description":"CONFIDENTIAL: invoice for jane.doe@acme.com re: 2026 salary review"}
```

So a client that puts task context, a user identifier, or a document title into `resource.description` hands it to a third party that is normally under no data-processing agreement. This confirms the core claim of `arXiv:2604.11430` ("every payment request carries metadata to the payment server and the centralised facilitator API before any on-chain settlement occurs"). Also note: the merchant forwards a **bearer credential** (§3.3) to that third party on every request.

### 3.6 ✅ What holds up (tested, not assumed)

| Test | Result |
|---|---|
| Forge a cheap payment for the $99 route (sign `value=1`, claim `amount=10000`) | **402** — rejected |
| Claim a smaller accepted amount than the route charges | **402** — rejected |
| Path-normalisation bypasses: `//api/cheap`, `/api/cheap/`, `/API/cheap`, `/%61pi/cheap`, `/api/./cheap`, `/api%2Fcheap`, `//api/cheap`, `/api/x/../cheap` | **all 402** — no bypass |
| Duplicate `PAYMENT-SIGNATURE` headers (sent as raw bytes, two identical header names) | **402** — fails closed |
| Garbage header / v1 downgrade attempt / valid v2 payload in the v1 header | **402** — all rejected |
| Unpaid request with the facilitator unreachable | **500** — no free content (fail-closed) |

Price and recipient integrity are cryptographically sound. The reference Express adapter is robust to the header-confusion and normalisation classes that the literature flagged against other stacks.

### 3.7 🟠 Availability: the facilitator is a hard single point of failure

With the facilitator unreachable, **every** request to a paid route returned `500 Internal Server Error` — including requests with no payment at all. There is no graceful degradation, no fallback, and the default facilitator request timeout is **90 seconds**, during which a hanging facilitator holds the request open. Given that one facilitator (Coinbase, 77.17M transactions / $26.85M) accounts for the clear majority of the ecosystem, this is an ecosystem-level concentration risk: **a single operator's outage degrades unrelated merchants, and a flaw in one facilitator affects every merchant behind it.**

---

## 4. What other researchers found (and I did not re-run)

| Work | Key findings |
|---|---|
| **`arXiv:2607.19545`** — *When HTTP 402 Meets the Blockchain* (Jul 2026). Black-box tested **15 real facilitators** used by >60k sellers / >360k buyers, collectively **99% of x402 transactions** | **49 rule violations → 31 previously-unknown vulnerabilities. Every facilitator violated ≥1 rule; every rule was violated by ≥1 platform.** SR7 (re-verify before settle) violated by **14/15**; SR5 (fail-fast, idempotency, freshness) **14/15**; SR8 (unambiguous settlement semantics) **9/15**. Four attack classes: **Free Shopping, Asset Theft, Service Denial, Gas Abuse**. A validated **free-shopping** exploit: `/verify` is stateless and doesn't reserve the nonce, `/settle` isn't bound to a verification result → one proof reused across many concurrent requests. A validated **ERC-6492 asset-theft** exploit at a top-volume facilitator: attacker-controlled `factoryAddress`/`factoryCalldata` were submitted blindly by the facilitator's settlement EOA, letting an attacker encode `approve`/`transfer` and drain the facilitator — *and the API reported failure even after the attacker's transaction confirmed*. Ecosystem cost: **> $202k burned in gas/fees**, incl. **$5.8k purely on reverting submissions**; 22.9k ATA-creating transactions cost >$5.7k. Reported to vendors Jan 2026; Coinbase, PayAI and Mogami acknowledged and confirmed six distinct vulnerabilities, some fixed; **one facilitator (xEcho) had no security reporting channel at all.** |
| **`arXiv:2605.11781`** — *Five Attacks on x402* (May 2026), 25,000+ requests across 48 configs, plus 3 SDK audits and 4 live endpoints | Settlement-path inconsistency (revert-grant under optimistic execution; **unauthorised settlement preemption**), **replay/idempotency (DGR = n; on a live endpoint, 248 grants from a single payment)**, header/proxy confusion + **cache leakage on live CDNs**, and **agent server-selection manipulation** (up to **71.8%** bias under metadata manipulation, **60.2%** under 5-Sybil flooding). Revert-grant probability up to **5.18% even with honest facilitators**. Discovery registry measured at 13,760 endpoints across 420 domains, with the top 9 domains holding **87.8%** of registrations and **one domain 77.5%**. |
| **`arXiv:2604.11430`** — *Hardening x402: PII-Safe Agentic Payments* (Jun 2026) | Confirms payment metadata is sent to server + centralised facilitator pre-settlement with no DPA; proposes pre-execution redaction, spending policies, and replay-guarded clients. Reports PERSON recall ceiling ≈50% for PII in URL-path metadata. |
| **`x402-conformance`** (community tooling) | Ships explicit checks for "paywall bypass by re-encoding the request path" (RS-SEC-012) and replay rejection, implying both have been observed in the wild. |

### Published advisories for the SDKs

| Advisory | Severity | Affected | Fixed in | Substance |
|---|---|---|---|---|
| **GHSA-3j63-5h8p-gf7c** (20 Aug 2025) | High | `x402`, `x402-next`, `x402-express`, `x402-hono` `<0.5.2` | 0.5.2 | Vulnerability in outdated SDK versions; "primarily impacts builders working on resource servers" (details withheld) |
| **GHSA-qr2g-p6q7-w82m** (6 Mar 2026) | High | `@x402/svm` `<2.6.0`, `x402` (PyPI) `<2.3.0`, Go `<2.5.0` | 2.6.0 / 2.3.0 / 2.5.0 | Signature-verification flaw on **Solana**: a malformed/reused `PAYMENT-SIGNATURE` could be accepted as valid → free API access without settlement. Fix path: simulation-based smart-wallet verification (adds CPI-inner-instruction inspection, fee-payer isolation, address-lookup-table resolution). |

### Ecosystem incident

**402Bridge (Oct 2025):** an x402-ecosystem bridge lost user funds after a private-key leak — *"the authorization mechanism had been poorly designed, users had granted the contract unlimited allowance, allowing the attacker to drain their assets directly"*; ~200 users affected, hundreds of thousands of dollars, funds laundered cross-chain. Not a protocol flaw per se, but it is the pattern the ecosystem's unlimited-approval and gas-sponsoring extensions invite.

### Independent audit status

I could not find a published third-party audit of the x402 protocol or reference SDKs by a major firm (Trail of Bits / OpenZeppelin / Certora / etc.). The security work that exists is academic (the three papers above), community tooling, GitHub advisories, and a HackerOne channel for Coinbase. For a protocol positioning itself as payments infrastructure used by Visa/Mastercard/AWS/Cloudflare, that is a **material assurance gap**.

---

## 5. Consolidated vulnerability catalogue

Severity reflects exploitability × impact *in a default reference deployment*, not CVSS theatre.

| # | Issue | Severity | Reproduced? | Status |
|---|---|---|---|---|
| 1 | Payment not bound to resource/route | **High** | Yes, latest SDK | Open — not specified, not implemented |
| 2 | No HTTP-layer idempotency; replay ⇒ duplicate grants when settlement isn't authoritative | **High** | Yes (6/6, 10/10 with non-authoritative settle) | Open — opt-in extension only |
| 3 | Handler executes before settlement ⇒ N× unpaid compute per payment | **High** | Yes (8 executions / 1 payment) | Default flow; `upfront` exists but is not the default |
| 4 | Settlement preemption ⇒ paid-but-denied | **Medium-High** | Yes | Open — inherent to EIP-3009 + header transport |
| 5 | Facilitator `/verify` stateless, no nonce reservation (SR7/TOCTTOU) | **Medium-High** | Yes (5/5 verify true) | Open — in reference facilitator & all 15 live ones tested |
| 6 | Cache leakage of paid responses | **Medium** | Yes on 2.10.0 (none); fixed in ≥2.21.0 | Fixed in SDK; **not in spec**; old deployments exposed |
| 7 | Client metadata forwarded to third-party facilitator | **Medium** (privacy/compliance) | Yes | Open — by design |
| 8 | Facilitator as hard single point of failure (500s, 90 s default timeout) | **Medium** (availability) | Yes | Open |
| 9 | ERC-6492 settlement semantics → facilitator asset theft | **Critical** (on affected facilitators) | Reported by others; top-volume facilitator affected | Vendor mitigation in progress |
| 10 | Sponsored-gas abuse / unbounded cost | **Medium** | Reported by others (>$202k ecosystem costs) | Open — bounds not standardised |
| 11 | Solana signature-verification bypass | **High** | Advisory | Fixed ≥2.6.0 |
| 12 | Agent discovery manipulation (Sybil / metadata poisoning) | **Medium** | Reported by others | Open |

**Specification-level gap summary** (grepped across all specs): the word `Cache-Control` — never appears. `idempotency` — appears only in the optional extension and one `SHOULD` in the Hedera scheme. `TOCTTOU` / "re-verify before settle" — never. "resource binding" — never. The spec's security section covers on-chain replay and nothing else. **The attacks above are not implementation accidents; they are unspecified behaviours that each implementer re-decides.**

---

## 6. Why this shape of problem exists

x402 is a *synchronous web* layer bolted onto an *asynchronous settlement* layer, with a *third party* in the middle:

1. **The gate is weaker than the guarantee.** Access is gated on `verify` (off-chain, stateless, cheap to fake-check) while money moves at `settle` (on-chain, later). Everything called "paid" is really "a valid-looking promise".
2. **The signature covers money, not intent.** EIP-3009's message has no field for *what* was bought, so the protocol cannot express "this £0.01 buys GET /api/cheap once at 14:02".
3. **Trust is centralised but responsibility isn't.** Facilitators concentrate trust (one flaw → every merchant behind it), yet the spec doesn't require them to re-verify, to bound gas, to enforce idempotency, or to keep proof semantics unambiguous.
4. **Incentives reward volume.** Gas is sponsored by the facilitator, so attackers can make victims pay for *failed* transactions; and because the public metrics are transaction counts, the ecosystem rewards exactly the activity that inflates them (25–30% by Coinbase's own estimate).

---

## 7. If you build on x402: hardening checklist

Ordered by impact. Items 1–5 are non-negotiable for anything handling real money.

**Merchant / resource server**

1. **Never release a resource on `verify` alone.** Require a confirmed on-chain settlement (receipt + nonce-consumed check) before serving — or use the `upfront`/`escrow` flow if the reference SDK version supports it. `authorization` (default) means you do the work first and hope.
2. **Add your own idempotency store keyed on the payment identity** (`payer + nonce`, or the `payment-identifier` id). Reject duplicates *atomically before* dispatch — a `SELECT … FOR UPDATE` / Redis `SETNX`, not an in-process Map. Do not rely on the extension being enforced; it ships no store.
3. **Bind the payment to the route yourself.** Require the EIP-3009 `nonce` to be `keccak256(resource_id ‖ client_salt)` (or use Permit2's witness) and verify it. This is the only free-form signed field available today.
4. **Set `Cache-Control: no-store` on 402s and `no-store` (or at minimum `private`) on paid responses** at the app, CDN, and edge layers — and test it through your actual CDN.
5. **Set aggressive facilitator timeouts** (a few seconds, not the 90 s default), implement a circuit breaker, and fail closed with `402`/`503` (not `500`) so clients can retry.
6. **Treat the facilitator as untrusted infrastructure.** Cross-check the returned tx hash against an independent RPC; prefer a reputable facilitator or self-host; maintain a fallback; log both verify and settle outcomes with the payment identity.
7. **Do not put anything sensitive in `resource.description`** — it goes to the facilitator in cleartext.
8. **For anything with side effects (email, DB writes, LLM calls, provisioning), require settlement first** or make the effect idempotent and reversible. Otherwise one payment buys N executions.
9. **Re-verify before settling** (freshness window, balance, nonce still unused) to avoid paying gas on reverts — a cost hole the July study measured across the whole ecosystem.
10. **Consider not exposing `ERC-1271`/`ERC-6492` support** unless your facilitator demonstrably constrains settlement semantics (this is the class that enabled the validated asset-theft exploit).

**Facilitator operator**

11. **Reserve nonces atomically at verify time**, not just at settle — otherwise concurrent replays all pass.
12. **Enforce a minimum remaining validity window** and re-verify immediately before broadcast (SR7). Live facilitators were observed enforcing as little as 3–7 s at verify and nothing at settle.
13. **Bound sponsored execution**: explicit gas/compute caps, allow-listed program/contract calls, reject zero-value and unprofitable payments, and reject any settlement payload with unexpected instructions, extra signers, or alternative token programs.
14. **Never blindly execute attacker-supplied deployment calldata** — validate ERC-6492 wrappers cryptographically and verify the target is a genuine counterfactual wallet address.
15. **Return success only when it is true**: a `success` response must mean the intended transfer settled on chain — not that a transaction was broadcast, and not while side effects from unrelated attacker-chosen execution have already occurred.

**Client / agent**

16. Cap spend per payee, per endpoint, per time window; allow-list endpoints; refuse to sign for unexpected `payTo`/`asset`.
17. Assume the payment header is a bearer credential — don't log it, don't route it through third-party proxies, prefer TLS end-to-end to the merchant.
18. Expect prompt-injection attacks: a fetched page can contain a `402`-shaped instruction convincing your agent to pay. x402 makes "pay this address" a legitimate-looking action.
19. Verify receipts: check the tx hash on chain rather than trusting `PAYMENT-RESPONSE`.

---

## 8. Recommendation for this repository (MUN-AI-APP)

> **Correction (2026-10-12).** An earlier revision of this section described the app as "Next.js/Firebase" with **Razorpay** subscriptions. Both are wrong. The app is **Next.js 16 + Supabase** (no Firebase dependency exists in `package.json`), and the payment provider is **UroPay** (`https://api.uropai.in`), not Razorpay. The recommendations below are unchanged in substance, but are restated against the real stack. The correction is the author's, not the user's — the repo was audited before this section was written and the provider was misread.

### 8.1 What the app actually runs today

Two payment rails, deliberately split by payer type:

| Rail | Payer | Mechanism | State |
|---|---|---|---|
| **UroPay** | Humans (browser sessions) | Server-side order creation → hosted checkout → HMAC-SHA256-signed webhook, 5-minute timestamp window, hex-64 signature compared with `timingSafeEqual`, order status re-fetched authoritatively, full binding validation (order id, merchant ref, amount, currency, environment), HTTPS checkout-host allowlist | **Sound.** Audited line by line; no changes required. |
| **x402** | Bots / agents | `402` + `PAYMENT-REQUIRED` → `PAYMENT-SIGNATURE` → facilitator `/verify` + `/settle` | **Was vulnerable (F1–F10 below). Remediated 2026-10-12.** |

- **Do not replace UroPay for consumer subscriptions.** x402 adds refunds' absence, chargeback-free irreversibility, a facilitator dependency, key-management burden, and no consumer-protection story — none of which is compensated for by micropayment granularity on a subscription product. The UroPay flow is already server-side, webhook-verified, and UID-bound; x402 would weaken three of those four properties (UID binding becomes wallet binding; webhook verification becomes third-party ascertainment; server-side secrets remain, plus wallet keys now on the critical path).
- **x402 is a plausible fit only for the narrow, metered, machine-facing surface it is already used for** — bot access to `/api/ai/research` and `/api/x402/content`, priced at $0.05 and $0.005, i.e. below the fee floor of any human checkout. Keep it there. Pilot on testnet first (`X402_NETWORK=eip155:84532`).
- **Treat settlement as the gate, not verification**, and keep the route-binding + idempotency controls below, because the protocol does not provide either.

### 8.2 Defects found in this repository, and what was done about them

The protocol-level findings in §3 were not hypothetical here: the app's own x402 integration reproduced the *ledger*, *fail-open*, and *replay* classes. All are now fixed in-tree.

| # | Defect | Severity | Fix |
|---|---|---|---|
| F1 | `payments.uid` was `NOT NULL REFERENCES auth.users(id)`, but the x402 writer supplied `00000000-…-0000` → foreign-key violation on **every** insert, swallowed by a `logger.warn`. The entire bot revenue stream was unrecorded. | 🔴 | `payments.uid` nullable **only** for `plan_id = 'x402-bot-microtransaction'`, enforced by a `CHECK` so human rows still require an owner; writer now returns a boolean and never throws. |
| F2 | Fail-open branch in `app/api/ai/research/route.ts`: any outcome that was not `payment-error` or `payment-verified` set `isX402Bot = true` and served the AI for free. | 🔴 | Deleted. Any non-verified outcome now produces an unconditional fail-closed 402. |
| F3 | No HTTP-layer replay/idempotency — §3.2 applied verbatim. One signed authorization produced N grants against any facilitator not authoritative for single-use. | 🔴 | New primitive-keyed `x402_payment_claims` table + `claimX402Payment`; identity is `sha256("x402-v1\|network\|asset\|payer\|nonce")` from **signed fields only**. Replay → `409 payment_already_consumed`. |
| F4 | Payment not bound to `resource`/`slug`. | 🟠 | `resourceKey` is derived from the route's own parameters and recorded on the claim. |
| F5 | Paid content served with no `Cache-Control`, on **both** paid routes. A CDN was entitled to store a bought body and serve it to unpaid callers for the whole TTL — and `no-cache` (which the AI stream used) still permits a shared cache to *store* it. | 🟠 | All three AI-route response paths plus the content route now emit `private, no-store, max-age=0` for machine callers; every 402/409/429/503 emits `no-store`. |
| F6 | `X402_PAY_TO` defaulted to the placeholder `0x…0001`, so payments could be directed at an address nobody controls. | 🟠 | `assertValidPayTo` now throws on missing, malformed, zero, and sentinel addresses; the server refuses to start the paid route. |
| F7 | Ledger amount used `Math.round(amountUsd * 100)` → $0.005 stored as `1` instead of `5000` atomic USDC. | 🟠 | `usdPriceToAtomicUnits` with explicit 6-decimal handling; unit difference documented in the migration. |
| F8 | `supabase/migrations/20261011_x402_payments.sql` was a no-op (comments only). | ⚪ | Superseded by `20261012_x402_payment_guard.sql`. |
| F9 | Machine callers could not be metered: `reserve_ai_usage` writes `ai_usage_daily.uid`, which references `auth.users`, so **every** paid bot request failed with a 503 *after* the payment had settled. | 🔴 | Machine budget is now enforced against the claims table **before** settlement (over-budget → 429, never charged). Discovered during remediation. |
| F10 | The machine UID `00000000-…-0000` fails the v4 pattern in `saveChatTranscript`, so bot transcripts were silently discarded — no error, no log. | 🟠 | Machine namespace is now `00000000-0000-4000-8000-000000000000`: v4-shaped so storage works, and impossible to collide with a real account. |
| F11 | **Introduced by F9's fix.** F9 rightly stopped the 503 by metering machines on the claims table — but only on *request count*. `responseMode` and `maxTokens` arrive in the caller's own body and were passed straight to the router, so a **$0.05 payment could buy up to 12,000 Kimi K3 completion tokens (~$0.19, 3.8× the price)**. At the 60-request daily cap that is **~$8.30 of net loss per bot per day**, and the number of bots is not bounded. | 🔴 | `lib/server/x402-machine-limits.ts` — `grantedResponseLimits()` fixes a machine caller's mode to the model its payment covers and caps its completion ceiling inside the price. `tests/x402-machine-limits.test.ts` asserts the *cost bound* at the published rates, so raising the ceiling without raising the price fails the suite. |

**Verified, not assumed.** F1–F11 were fixed with test suites (33 cases across `tests/x402-payment-guard.test.ts` and `tests/x402-machine-limits.test.ts`) that pin the invariants rather than the implementation:

- exactly one grant under 12-way concurrency;
- no grant when settlement reports success but the claim is already taken (the non-authoritative-facilitator case);
- no grant when the claim store is unreachable;
- an over-budget machine caller refused **without being charged** (settlement call count asserted, not just the status code);
- client-controlled `resource` / `description` / `accepted.extra` fields cannot influence payment identity;
- the placeholder payout address is rejected, and a missing payout address yields a named `503 payment_rail_misconfigured` rather than an opaque 500.

This suite is wired into CI (`main.yml`, before lint/typecheck) as **`Payment guard tests (behavioural, offline)`**. It was chosen over the full `pnpm test` because the rest of the suite asserts against the live x402 facilitator and needs network egress, which would make CI flaky and red for reasons unrelated to this repo.

Full suite status: **100 pass / 2 fail** across 102 cases, where the 2 failures are this sandbox's lack of network egress when the facilitator SDK initialises (`no supported payment kinds loaded from any facilitator`). They are not regressions — the same 2 assertions failed before any change, and they pass in CI where egress exists. `typecheck`, `lint` (0 errors), and `check:manifests` are clean.

**Two operational notes.** `X402_PAY_TO` is now genuinely required — set it to a wallet you control before this deploys, or the paid routes will return 503 by design (the old behaviour was to advertise a burn address and lose the money). And the `payments.amount` column now carries two different units depending on `currency`: whole INR for UroPay, atomic USDC (6 dp) for x402. Filter by `currency` before summing.

---

## 9. Verdict

| Question | Answer |
|---|---|
| Does the protocol work? | **Yes**, mechanically — verified end-to-end on the current SDK. |
| Is there real economic usage? | **Marginal and inflated.** ~$15M filtered cumulative volume; ~$28–42k/day; 25–30% of activity admitted as leaderboard farming by its own sponsor; public dashboards inconsistent with on-chain reality. |
| Is it production-safe as shipped? | **No.** Not by default. Three attack classes reproduce on the latest SDK, one class had a validated asset-theft exploit on a top facilitator, and every one of 15 live facilitators violated at least one security rule. |
| Can it be made safe? | **Yes, with effort.** Every attack in §5 is mitigable — but mitigation currently lives in application code and operational discipline, not in the protocol. The spec would need to mandate: route/resource binding, atomic single-use at verify, settlement-gated release, cache directives, facilitator re-verification, and sponsored-cost bounds. |
| Would I put money through it today? | **Only with settlement-gated release, my own idempotency store, route-bound nonces, and a self-hosted or cross-checked facilitator** — and only for low-value, metered, machine-facing endpoints. |

---

## Appendix A — Reproducing this review

The harness in `research/x402/poc/` runs entirely offline (no testnet RPC needed):

- `facilitator.js` — a local facilitator built from the **real** `@x402/core` `x402Facilitator` + **real** `@x402/evm` `ExactEvmScheme`, with a chain stub (`writeContract` returns a fake hash, `getCode` returns bytecode only for the USDC address, `verifyTypedData` is real viem ECDSA). All signature/amount/recipient/time/scheme checks are the reference implementation's own. `NAIVE=1` additionally models a facilitator that does not authoritatively enforce on-chain single-use (for the multi-grant test); the default configuration simulates the real on-chain nonce revert.
- `server.js` — a merchant using the **real** `@x402/express` `paymentMiddleware`, protecting four routes with identical and differing prices.
- `attack2.mjs`, `experiments.mjs`, `tamper2.mjs`, `seq.mjs`, `pathbypass.mjs`, `headers.mjs`, `rawdup.mjs`, `priv.mjs` — the tests described in §3.

```bash
cd research/x402/poc && npm install
PORT=4199 node facilitator.js &                      # real SDK facilitator, stubbed chain
PORT=4198 FACILITATOR_URL=http://127.0.0.1:4199 node server.js &
node attack2.mjs       # baseline, resource swap, replay, amplification, price, verify-replay
node experiments.mjs   # (SRV/FAC env) amount tampering, multi-grant, preemption
node tamper2.mjs       # resource-field tampering (rewrite / delete)
node pathbypass.mjs    # 11 path-encoding aliases
node rawdup.mjs        # duplicate-header behaviour (raw bytes)
```

To reproduce the version-difference result in §3.4, install `@x402/*@2.10.0` instead of `latest` and check `cache-control` on the 402 and the paid 200.

**Scope and limitations, stated plainly:** my testbed stubs the blockchain, so I cannot confirm on-chain settlement timing, gas outcomes, or chain-level races; §4 lines are third-party findings I did not independently reproduce; my tests cover the TypeScript reference stack (Express adapter) — Go, Python, Rust, and the edge/Next.js/Hono adapters were reviewed by reading, not by running; and the ecosystem figures in §2 come from third-party analysts with unpublished methodologies, which is itself part of the story.

## Appendix B — Sources

**Primary artifacts reviewed:** `x402-foundation/x402` (spec v1/v2, schemes `exact`/`upto`/`batch-settlement`, extensions `payment-identifier`/`bazaar`/`sign-in-with-x`/`offer-and-receipt`/`http-message-signatures`/gas-sponsoring, TypeScript/Go/Python/Java SDKs, e2e harness, Technical Charter); `@x402/*@2.10.0` and `@2.28.0` on npm; GHSA-3j63-5h8p-gf7c; GHSA-qr2g-p6q7-w82m.

**Research:** arXiv 2605.11781 (Five Attacks, May 2026) · arXiv 2607.19545 (Facilitator risks, Jul 2026) · arXiv 2604.11430 (PII-safe x402, Jun 2026) · `x402-conformance`.

**Reporting and data:** Coinbase developer blog (launch, May 2025) · CoinDesk (11 Mar 2026; 23 Aug 2026) · Artemis/Visa "Agentic Payments from the Ground Up" (Jul 2026, data 21 Apr 2026) · Helios Analytics / Jamie Coutts (Sept 2026) · DWFLabs x402 research · Khala Research (Mar 2026) · Cloudflare Pay Per Crawl & Monetization Gateway announcements and docs · AWS AgentCore/CloudFront x402 documentation · x402scan ecosystem data · independent audit of the x402.org counter (Sept 2026) · 4Pillars, dropstab, spark.money, rzlt.io ecosystem analyses · 402Bridge post-mortem.
