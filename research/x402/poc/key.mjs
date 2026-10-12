/**
 * The signer the PoC scripts pay with.
 *
 * These scripts need *a* signer, not a particular one: nothing in the testbed
 * checks who the payer is, and the facilitator verifies each signature against
 * whatever `from` address the payload carries. A literal private key used to
 * live in each script.
 *
 * That literal was the publicly documented Anvil/Hardhat test-account key —
 * worthless, and not a real credential by any measure. It is removed anyway,
 * for two reasons: a hardcoded private key is indistinguishable from a leaked
 * one to a secret scanner (this repository should not carry the pattern at
 * all, even as a false positive), and a fixture that mints its own account
 * cannot silently depend on one that has been funded, drained or reused
 * elsewhere. Set POC_PRIVATE_KEY to reproduce a specific run byte for byte.
 */
import { generatePrivateKey } from "viem/accounts";

export const POC_PRIVATE_KEY = process.env.POC_PRIVATE_KEY ?? generatePrivateKey();
