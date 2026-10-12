/**
 * x402 resource server (the "merchant") using the REAL @x402/express middleware.
 *
 * Three paid routes:
 *   GET /api/cheap      $0.01
 *   GET /api/twin       $0.01  (identical terms, different path)
 *   GET /api/expensive  $99.00
 *   POST /api/expensive-sideeffect  $0.01  (non-idempotent work)
 *
 * The handler records every invocation in `handlerRuns` — so we can measure
 * how much *work* a single payment buys.
 */
const express = require("express");
const { paymentMiddleware } = require("@x402/express");
const { x402ResourceServer, HTTPFacilitatorClient } = require("@x402/core/server");
const { ExactEvmScheme } = require("@x402/evm/exact/server");

const PORT = parseInt(process.env.PORT || "4198", 10);
const NETWORK = process.env.NETWORK || "eip155:84532";
const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://127.0.0.1:4199";
const PAY_TO = process.env.PAY_TO || "0x000000000000000000000000000000000000bEEF";

const stats = { handlerRuns: {}, grants: 0 };

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const server = new x402ResourceServer(facilitatorClient);
server.register(NETWORK, new ExactEvmScheme());

const routes = {
  "GET /api/cheap": {
    accepts: { payTo: PAY_TO, scheme: "exact", price: "$0.01", network: NETWORK },
    description: "cheap data",
  },
  "GET /api/twin": {
    accepts: { payTo: PAY_TO, scheme: "exact", price: "$0.01", network: NETWORK },
    description: "different resource, same price",
  },
  "GET /api/expensive": {
    accepts: { payTo: PAY_TO, scheme: "exact", price: "$99.00", network: NETWORK },
    description: "expensive data",
  },
  "POST /api/expensive-sideeffect": {
    accepts: { payTo: PAY_TO, scheme: "exact", price: "$0.01", network: NETWORK },
    description: "non-idempotent work",
  },
};

const app = express();
app.use(express.json());

app.use(paymentMiddleware(routes, server));

function count(key) {
  stats.handlerRuns[key] = (stats.handlerRuns[key] || 0) + 1;
}

app.get("/api/cheap", (req, res) => {
  count("cheap");
  res.json({ resource: "cheap", secret: "cheap-value-42" });
});

app.get("/api/twin", (req, res) => {
  count("twin");
  res.json({ resource: "twin", secret: "twin-value-43" });
});

app.get("/api/expensive", (req, res) => {
  count("expensive");
  res.json({ resource: "expensive", secret: "EXPENSIVE-REPORT-CONTENTS" });
});

app.post("/api/expensive-sideeffect", async (req, res) => {
  count("sideeffect");
  // simulate expensive, non-idempotent work (LLM call, email, DB write...)
  await new Promise(r => setTimeout(r, 250));
  res.json({ resource: "sideeffect", sendsEmail: true, runNumber: stats.handlerRuns.sideeffect });
});

app.get("/stats", (req, res) => res.json(stats));

app.listen(PORT, "0.0.0.0", () => console.log(`resource server listening on ${PORT}`));
