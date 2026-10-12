import http from "node:http";

const logger = http.createServer(async (req, res) => {
  let body = "";
  req.on("data", d => (body += d));
  req.on("end", async () => {
    if (body) {
      console.log(`\n>>> FACILITATOR RECEIVES ${req.method} ${req.url}`);
      try {
        const j = JSON.parse(body);
        console.log("    paymentRequirements   :", JSON.stringify(j.paymentRequirements));
        console.log("    payload.resource      :", JSON.stringify(j.paymentPayload?.resource));
        console.log("    payload.accepted      :", JSON.stringify(j.paymentPayload?.accepted));
        console.log("    authorization         :", JSON.stringify(j.paymentPayload?.payload?.authorization));
        console.log("    signature             :", String(j.paymentPayload?.payload?.signature).slice(0, 30) + "...");
      } catch {
        console.log("    (non-JSON body)");
      }
    }
    const init = { method: req.method, headers: { "content-type": "application/json" } };
    if (body) init.body = body;
    try {
      const up = await fetch(`http://127.0.0.1:4199${req.url}`, init);
      res.writeHead(up.status, { "content-type": "application/json" });
      res.end(await up.text());
    } catch (e) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(e) }));
    }
  });
});

logger.listen(4399, "0.0.0.0", () => console.log("logging proxy 4399 -> facilitator 4199"));
