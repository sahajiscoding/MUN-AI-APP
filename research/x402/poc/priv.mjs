/**
 * Logging proxy: sits between the app under test and the local mock
 * facilitator, printing the x402 fields the facilitator receives so tampered
 * values are visible.
 *
 * Analysis fixture only — see README.md in this directory. Two details below
 * are deliberate rather than incidental:
 *
 *   - Only three endpoints are forwarded, and each upstream URL is a string
 *     literal in the map below. The caller's path selects an entry; it never
 *     becomes part of the URL. A general forwarding proxy is the thing you
 *     would not want here, even on localhost.
 *   - An upstream failure is logged locally and never described to the caller.
 */
import http from "node:http";

/** The only endpoints this proxy forwards: constant in, literal out. */
const UPSTREAM = new Map([
  ["/supported", "http://127.0.0.1:4199/supported"],
  ["/verify", "http://127.0.0.1:4199/verify"],
  ["/settle", "http://127.0.0.1:4199/settle"],
]);

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

    let pathname;
    try {
      pathname = new URL(req.url ?? "/", "http://127.0.0.1:4199").pathname;
    } catch {
      pathname = "";
    }

    const upstreamUrl = UPSTREAM.get(pathname);
    if (!upstreamUrl) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_a_facilitator_endpoint" }));
      return;
    }

    const init = { method: req.method, headers: { "content-type": "application/json" } };
    if (body) init.body = body;
    try {
      const up = await fetch(upstreamUrl, init);
      res.writeHead(up.status, { "content-type": "application/json" });
      res.end(await up.text());
    } catch (error) {
      // Local diagnostic only. The caller learns that the upstream is down and
      // nothing about the internals.
      console.error("proxy: upstream fetch failed:", error);
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "upstream_unreachable" }));
    }
  });
});

logger.listen(4399, "0.0.0.0", () => console.log("logging proxy 4399 -> facilitator 4199"));
