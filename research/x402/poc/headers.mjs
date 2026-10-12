import { x402HTTPClient } from "@x402/core/http";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
const SRV = process.env.SERVER || "http://127.0.0.1:4198";
const a = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const c = new x402Client(); c.register("eip155:*", new ExactEvmScheme(a));
const hc = new x402HTTPClient(c);
async function buy(path="/api/cheap") {
  const ch = await fetch(`${SRV}${path}`); const b = await ch.json();
  const pr = hc.getPaymentRequiredResponse(n => ch.headers.get(n), b);
  const payload = await hc.createPaymentPayload(pr);
  return { pr, payload, headers: hc.encodePaymentSignatureHeader(payload) };
}
const F = t => console.log(`\n${"─".repeat(74)}\n${t}\n${"─".repeat(74)}`);

F("H1) duplicate PAYMENT-SIGNATURE headers (proxy/header ambiguity)");
{
  const { headers } = await buy();
  const good = headers["PAYMENT-SIGNATURE"];
  const r1 = await fetch(`${SRV}/api/cheap`, { headers: { "PAYMENT-SIGNATURE": good, "X-PAYMENT": "not-json" } });
  console.log(`valid v2 + garbage X-PAYMENT -> ${r1.status} ${r1.status===200?"(accepted)":"(rejected)"}`);
  const r2 = await fetch(`${SRV}/api/cheap`, { headers: { "X-PAYMENT": good } });
  console.log(`valid payload placed in the v1 header X-PAYMENT -> ${r2.status}`);
  const r3 = await fetch(`${SRV}/api/cheap`, { headers: { "PAYMENT-SIGNATURE": "AAAA" } });
  console.log(`garbage PAYMENT-SIGNATURE -> ${r3.status}`);
}

F("H2) version confusion: v1 payload claiming network 'base-sepolia' against a v2 route");
{
  const { payload } = await buy();
  const v1 = { ...payload, x402Version: 1, accepted: { ...payload.accepted, network: "base-sepolia" } };
  const h = { "X-PAYMENT": Buffer.from(JSON.stringify(v1)).toString("base64") };
  const r = await fetch(`${SRV}/api/cheap`, { headers: h });
  console.log(`v1 downgrade attempt -> ${r.status} ${r.status===200?"*** ACCEPTED ***":"(rejected)"}`);
}

F("H3) fail-closed test: point the merchant at a dead facilitator");
{
  console.log("(run separately with a dead facilitator) -> see /tmp/deadfac.txt");
}
