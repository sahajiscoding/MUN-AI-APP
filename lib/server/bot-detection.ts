/**
 * Bot detection utilities for x402 payment gating.
 *
 * Distinguishes programmatic agents / bots / crawlers from human browser traffic.
 *
 * Rules:
 * - A request with x402 headers (PAYMENT-SIGNATURE / PAYMENT-REQUIRED) is ALWAYS an agent.
 * - Known bot / agent User-Agent signatures (curl, python, node, agents, ai crawlers, etc.)
 *   or explicit "bot" / "spider" / "crawler" strings are classified as bots.
 * - Missing or non-browser User-Agent (absent, empty, or not containing Mozilla/Safari/Chrome/Firefox/Edge)
 *   is classified as a bot.
 * - Legitimate human browser navigation (contains Mozilla AND accepts text/html) is NOT a bot.
 */

const KNOWN_BOT_USER_AGENTS = [
  "curl",
  "wget",
  "python",
  "node-fetch",
  "undici",
  "axios",
  "got",
  "httpie",
  "postman",
  "insomnia",
  "bot",
  "crawler",
  "spider",
  "agent",
  "anthropic",
  "openai",
  "chatgpt",
  "claudebot",
  "gptbot",
  "bytespider",
  "cohere",
  "perplexity",
  "go-http-client",
  "java",
  "ruby",
  "libwww",
  "aiohttp",
  "urllib",
  "requests",
  "x402",
];

export interface BotClassificationResult {
  isBot: boolean;
  reason:
    | "x402_header_present"
    | "known_bot_user_agent"
    | "missing_user_agent"
    | "non_browser_user_agent"
    | "human_browser";
}

/**
 * Classifies whether an incoming request is from a bot / programmatic agent or a human browser.
 */
export function classifyBotRequest(headers: Headers): BotClassificationResult {
  // 1. Any request presenting x402 payment or SIWX headers is definitively an x402 machine/wallet client
  if (
    headers.has("payment-signature") ||
    headers.has("PAYMENT-SIGNATURE") ||
    headers.has("sign-in-with-x") ||
    headers.has("SIGN-IN-WITH-X") ||
    headers.has("x-payment") ||
    headers.has("X-PAYMENT")
  ) {
    return { isBot: true, reason: "x402_header_present" };
  }

  const userAgent = headers.get("user-agent")?.trim();
  if (!userAgent) {
    return { isBot: true, reason: "missing_user_agent" };
  }

  const lowerUa = userAgent.toLowerCase();

  // 2. Check for known bot strings or CLI/library user agents
  for (const botPattern of KNOWN_BOT_USER_AGENTS) {
    if (lowerUa.includes(botPattern)) {
      return { isBot: true, reason: "known_bot_user_agent" };
    }
  }

  // 3. Human browser signature check:
  // Legitimate modern human browsers include "Mozilla" in their User-Agent.
  // Missing "Mozilla" in standard HTTP navigation is characteristic of scripts / custom HTTP clients.
  const hasBrowserSignature =
    lowerUa.includes("mozilla/") ||
    lowerUa.includes("safari/") ||
    lowerUa.includes("chrome/") ||
    lowerUa.includes("firefox/");

  if (!hasBrowserSignature) {
    return { isBot: true, reason: "non_browser_user_agent" };
  }

  return { isBot: false, reason: "human_browser" };
}

/**
 * Returns true if the request is classified as a bot.
 */
export function isBotRequest(request: Request | Headers): boolean {
  const headers = request instanceof Headers ? request : request.headers;
  return classifyBotRequest(headers).isBot;
}
