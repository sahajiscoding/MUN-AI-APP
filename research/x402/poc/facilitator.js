/**
 * Local x402 facilitator using the REAL @x402/core x402Facilitator +
 * REAL @x402/evm ExactEvmScheme verification logic.
 *
 * The chain is stubbed out (no RPC egress in this sandbox):
 *  - readContract         -> returns zero-ish values
 *  - writeContract        -> returns a fake tx hash (settle "succeeds")
 *  - waitForTransactionReceipt -> status: success
 *  - verifyTypedData      -> REAL viem ECDSA verification of EIP-712 signatures
 *  - getCode              -> "0x" (EOA)
 *
 * This means: all signature / amount / recipient / time-window / scheme
 * checks executed here are the genuine reference implementation's checks.
 * Only the on-chain side (nonce consumption, balances) is simulated.
 */
const express = require("express");
const { x402Facilitator } = require("@x402/core/facilitator");
const { registerExactEvmScheme } = require("@x402/evm/exact/facilitator");
const { verifyTypedData } = require("viem");

const NETWORK = process.env.NETWORK || "eip155:84532";

let settleCounter = 0;
let verifyCounter = 0;

// Track whether we simulate an "already used nonce" (on-chain effect)
let submittedNonces = new Map();

const signer = {
  getAddresses: () => ["0x000000000000000000000000000000000000dEaD"],
  readContract: async () => 0n,
  verifyTypedData: async ({ address, domain, types, primaryType, message, signature }) => {
    try {
      return await verifyTypedData({ address, domain, types, primaryType, message, signature });
    } catch (e) {
      return false;
    }
  },
  writeContract: async () => {
    settleCounter++;
    return `0x${String(settleCounter).padStart(64, "0")}`;
  },
  sendTransaction: async () => `0x${String(++settleCounter).padStart(64, "0")}`,
  waitForTransactionReceipt: async () => ({ status: "success" }),
  // USDC on Base Sepolia is a deployed contract; EOAs return "0x".
  getCode: async ({ address }) =>
    address?.toLowerCase() === "0x036cbd53842c5426634e7929541eC2318f3dcf7e".toLowerCase()
      ? "0x608060405234801561001057600080fd5b50"
      : "0x",
};

const facilitator = new x402Facilitator();
registerExactEvmScheme(facilitator, { signer, networks: NETWORK });

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/supported", (req, res) => res.json(facilitator.getSupported()));

app.post("/verify", async (req, res) => {
  verifyCounter++;
  const { paymentPayload, paymentRequirements } = req.body;
  // NOTE: deliberately no idempotency / nonce-reuse store here, mirroring the
  // reference facilitator: replay defence is expected to be on-chain only.
  const response = await facilitator.verify(paymentPayload, paymentRequirements);
  res.json(response);
});

app.post("/settle", async (req, res) => {
  const { paymentPayload, paymentRequirements } = req.body;
  const nonce = paymentPayload?.payload?.authorization?.nonce;
  if (process.env.NAIVE === "1") {
    // Facilitator that does NOT authoritatively enforce single-use on-chain
    // (e.g. returns success from a broadcast/simulated settle without waiting
    // for a receipt, or a chain where settlement is not yet final/reverted).
    const r = await facilitator.settle(paymentPayload, paymentRequirements);
    return res.json(r);
  }
  const alreadyUsed = submittedNonces.has(nonce);
  if (alreadyUsed) {
    // Simulate the on-chain revert you would get from a used EIP-3009 nonce
    return res.json({
      success: false,
      errorReason: "invalid_transaction_state",
      transaction: "",
      network: paymentRequirements.network,
      payer: paymentPayload?.payload?.authorization?.from,
    });
  }
  submittedNonces.set(nonce, Date.now());
  const response = await facilitator.settle(paymentPayload, paymentRequirements);
  res.json(response);
});

app.get("/stats", (req, res) => res.json({ verifyCounter, settleCounter }));

const PORT = parseInt(process.env.PORT || "4199", 10);
app.listen(PORT, "0.0.0.0", () => console.log(`facilitator listening on ${PORT}`));
