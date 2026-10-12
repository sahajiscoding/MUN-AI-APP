# x402 testbed (offline)

Reproduces the findings in `../x402-security-review.md`. Everything runs locally — **no blockchain RPC or testnet access is required.**

## What's here

| File | Role |
|---|---|
| `facilitator.js` | Facilitator built from the **real** `@x402/core` `x402Facilitator` + **real** `@x402/evm` `ExactEvmScheme`, with the chain stubbed (`writeContract` returns a fake hash; `getCode` returns bytecode only for the USDC address; `verifyTypedData` is real viem ECDSA). All signature / amount / recipient / time-window / scheme checks are the reference implementation's own. `NAIVE=1` models a facilitator that does not authoritatively enforce on-chain single-use (for the multi-grant test). |
| `server.js` | Merchant using the **real** `@x402/express` `paymentMiddleware`. Routes: `/api/cheap` ($0.01), `/api/twin` ($0.01, identical terms), `/api/expensive` ($99), `POST /api/expensive-sideeffect` (250 ms non-idempotent work). `/stats` reports handler executions. |
| `attack2.mjs` | Baseline loop, resource swap, replay, compute amplification, price escalation, facilitator `/verify` replay. |
| `tamper2.mjs` | Resource-field tampering (untouched / rewritten / deleted) and `accepted.extra` tampering. |
| `experiments.mjs` | Amount tampering (both directions), multi-grant against a non-authoritative facilitator, settlement preemption. |
| `seq.mjs` | 10 sequential replays of a single payment header. |
| `pathbypass.mjs` | 11 path/encoding aliases of a paid route. |
| `headers.mjs`, `rawdup.mjs` | Header precedence, v1 downgrade, garbage header, genuine duplicate-header bytes. |
| `key.mjs` | The payer account, generated per run. Nothing here depends on which address pays. |
| `priv.mjs` | Logging proxy that shows exactly what a third-party facilitator receives (forwards `/supported`, `/verify` and `/settle`, and nothing else). |

## Run

```bash
npm install

# 1. facilitator (authoritative mode)
PORT=4199 node facilitator.js &

# 2. merchant pointing at it
PORT=4198 FACILITATOR_URL=http://127.0.0.1:4199 node server.js &

# 3. tests
node attack2.mjs
node tamper2.mjs
node pathbypass.mjs
node headers.mjs
node rawdup.mjs
SERVER=http://127.0.0.1:4198 FACILITATOR=http://127.0.0.1:4199 node experiments.mjs

# multi-grant against a facilitator without authoritative on-chain enforcement
PORT=4299 NAIVE=1 node facilitator.js &
PORT=4298 FACILITATOR_URL=http://127.0.0.1:4299 node server.js &
SERVER=http://127.0.0.1:4298 FACILITATOR=http://127.0.0.1:4299 node experiments.mjs   # section F
SERVER=http://127.0.0.1:4298 node seq.mjs

# privacy: what the facilitator sees
node priv.mjs &                                                    # proxy on :4399
PORT=4398 FACILITATOR_URL=http://127.0.0.1:4399 node server.js &   # merchant via proxy
# then send a payment whose payload.resource.description contains a marker string
```

Ports are overridable via `PORT`, `FACILITATOR_URL`, `SERVER`, `FACILITATOR`, `NETWORK`, `PAY_TO`.

Each script signs with an account it generates at startup (`key.mjs`), because nothing in the
testbed checks who the payer is. Set `POC_PRIVATE_KEY=0x...` to run every script as one known
account, or to reproduce a run exactly.

To compare SDK versions (e.g. the §3.4 cache-control difference), install a pinned version and re-check the headers:

```bash
npm i @x402/core@2.10.0 @x402/evm@2.10.0 @x402/express@2.10.0
```

## Limitations

The chain is stubbed, so on-chain timing, gas outcomes, and chain-level races are **not** exercised — those findings come from the published research cited in the review. Tests target the TypeScript reference stack (Express adapter); other language SDKs and adapters were reviewed by reading code, not by running.
