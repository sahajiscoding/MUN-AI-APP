import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyBotRequest, isBotRequest } from "@/lib/server/bot-detection";

describe("Bot Detection Classification", () => {
  it("identifies requests presenting x402 payment headers as bots", () => {
    const headers1 = new Headers({ "PAYMENT-SIGNATURE": "dummy-sig" });
    assert.equal(isBotRequest(headers1), true);
    assert.equal(classifyBotRequest(headers1).reason, "x402_header_present");

    const headers2 = new Headers({ "payment-signature": "dummy-sig" });
    assert.equal(isBotRequest(headers2), true);

    const headers3 = new Headers({ "x-payment": "legacy-sig" });
    assert.equal(isBotRequest(headers3), true);
  });

  it("identifies known bot User-Agents (curl, python, node-fetch, agents, etc.)", () => {
    const botUserAgents = [
      "curl/7.88.1",
      "Wget/1.21.3",
      "python-requests/2.31.0",
      "node-fetch/3.3.0",
      "axios/1.6.0",
      "Go-http-client/1.1",
      "PostmanRuntime/7.32.3",
      "Anthropic-AI-Agent/1.0",
      "GPTBot/1.0 (+https://openai.com/gptbot)",
      "ClaudeBot/1.0",
      "x402-client/1.0",
    ];

    for (const ua of botUserAgents) {
      const headers = new Headers({ "user-agent": ua });
      assert.equal(isBotRequest(headers), true, `Expected ${ua} to be identified as bot`);
      assert.equal(classifyBotRequest(headers).reason, "known_bot_user_agent");
    }
  });

  it("identifies missing or empty User-Agent as a bot", () => {
    const headers = new Headers();
    assert.equal(isBotRequest(headers), true);
    assert.equal(classifyBotRequest(headers).reason, "missing_user_agent");

    const emptyHeaders = new Headers({ "user-agent": "   " });
    assert.equal(isBotRequest(emptyHeaders), true);
    assert.equal(classifyBotRequest(emptyHeaders).reason, "missing_user_agent");
  });

  it("identifies non-browser User-Agent lacking browser engine token as a bot", () => {
    const customAgentHeaders = new Headers({
      "user-agent": "MyCustomDataScraper 1.0",
      accept: "application/json",
    });
    assert.equal(isBotRequest(customAgentHeaders), true);
    assert.equal(classifyBotRequest(customAgentHeaders).reason, "non_browser_user_agent");
  });

  it("classifies legitimate human desktop and mobile browsers as non-bot", () => {
    const browserUserAgents = [
      // Chrome macOS
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      // Firefox Windows
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0",
      // Safari iOS
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      // Edge Windows
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    ];

    for (const ua of browserUserAgents) {
      const headers = new Headers({
        "user-agent": ua,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      });
      assert.equal(isBotRequest(headers), false, `Expected browser ${ua} to NOT be a bot`);
      assert.equal(classifyBotRequest(headers).reason, "human_browser");
    }
  });
});
