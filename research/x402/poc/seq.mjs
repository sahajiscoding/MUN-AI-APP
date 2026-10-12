import { x402HTTPClient } from "@x402/core/http";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { POC_PRIVATE_KEY } from "./key.mjs";
const SRV = process.env.SRV;
const a = privateKeyToAccount(POC_PRIVATE_KEY);
const c = new x402Client(); c.register("eip155:*", new ExactEvmScheme(a));
const hc = new x402HTTPClient(c);
const ch = await fetch(`${SRV}/api/cheap`); const b = await ch.json();
const pr = hc.getPaymentRequiredResponse(n => ch.headers.get(n), b);
const payload = await hc.createPaymentPayload(pr);
const headers = hc.encodePaymentSignatureHeader(payload);
const codes = [];
for (let i = 0; i < 10; i++) { const r = await fetch(`${SRV}/api/cheap`, { headers }); codes.push(r.status); await r.text(); }
console.log("sequential replay statuses:", JSON.stringify(codes));
const st = await fetch(`${SRV}/stats`).then(r => r.json());
console.log("payments required:", 1, "| paid-handler executions:", st.handlerRuns.cheap, "| 200s delivered:", codes.filter(x=>x===200).length);
