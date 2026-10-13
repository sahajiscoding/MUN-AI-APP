import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "@/lib/api";
import { callNvidiaKimi, callNvidiaResearch } from "@/lib/ai/nvidia";

// Regression tests for the misconfiguration behind
// "NVIDIA nvapi-... request failed (404): 404 page not found": an API key
// sitting in a *model* env var. Before the guard, that value was sent upstream
// as the model name (gateway 404) and echoed back to end users inside the
// error string — a key leak. The provider must fail closed with an actionable
// operator error instead.

const KEY_ENV = "NVIDIA_API_KEY";
const MODEL_ENVS = ["NVIDIA_KIMI_MODEL", "NVIDIA_RESEARCH_MODEL"] as const;

const VALID_KEY = "nvapi-test-key-0000000000000000000000000000000";

const savedEnv: Record<string, string | undefined> = {};
const originalFetch = globalThis.fetch;

/** Hermetic stand-in for the NVIDIA gateway: 200 with an empty SSE body. */
function stubFetchOk() {
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } }),
      { status: 200, headers: { "content-type": "text/event-stream" } },
    );
}

/** Drain a result stream into plain text so its events can be asserted on. */
async function readAll(result: { stream?: ReadableStream<Uint8Array> }) {
  assert.ok(result.stream, "NVIDIA adapter must return a stream");
  const reader = result.stream.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

const input = {
  messages: [{ role: "user" as const, content: "hello" }],
};

beforeEach(() => {
  for (const name of [KEY_ENV, ...MODEL_ENVS]) savedEnv[name] = process.env[name];
  process.env[KEY_ENV] = VALID_KEY;
  for (const name of MODEL_ENVS) delete process.env[name];
  stubFetchOk();
});

afterEach(() => {
  for (const [name, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  globalThis.fetch = originalFetch;
});

describe("NVIDIA model env guard", () => {
  it("rejects an API key pasted into NVIDIA_KIMI_MODEL before any network call", () => {
    process.env.NVIDIA_KIMI_MODEL = "nvapi-leaked-in-the-wrong-variable-123";

    assert.throws(
      () => callNvidiaKimi(input),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 500);
        assert.equal(error.code, "nvidia_model_misconfigured");
        // Actionable: names the broken variable and the fix.
        assert.match(error.message, /NVIDIA_KIMI_MODEL/);
        assert.match(error.message, /NVIDIA_API_KEY/);
        // Never echoes the leaked key material back to anyone.
        assert.ok(!error.message.includes("nvapi-leaked"));
        return true;
      },
    );
  });

  it("rejects an API key pasted into NVIDIA_RESEARCH_MODEL", () => {
    process.env.NVIDIA_RESEARCH_MODEL = "nvapi-leaked-in-the-wrong-variable-456";

    assert.throws(
      () => callNvidiaResearch(input),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.code, "nvidia_model_misconfigured");
        assert.match(error.message, /NVIDIA_RESEARCH_MODEL/);
        assert.ok(!error.message.includes("nvapi-leaked"));
        return true;
      },
    );
  });

  it("rejects the reverse swap: a model ID sitting in NVIDIA_API_KEY", () => {
    process.env.NVIDIA_API_KEY = "moonshotai/kimi-k3";

    assert.throws(
      () => callNvidiaKimi(input),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 500);
        assert.equal(error.code, "nvidia_key_misconfigured");
        assert.match(error.message, /NVIDIA_API_KEY/);
        // The guidance itself must not contain the swapped-in value verbatim.
        assert.ok(!error.message.includes("moonshotai"));
        return true;
      },
    );
  });

  it("still fails closed when NVIDIA_API_KEY is absent entirely", () => {
    delete process.env[KEY_ENV];

    assert.throws(
      () => callNvidiaResearch(input),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.code, "nvidia_not_configured");
        return true;
      },
    );
  });
});

describe("NVIDIA model resolution still works for valid config", () => {
  it("uses the default models when no overrides are set", async () => {
    assert.equal((await callNvidiaKimi(input)).model, "moonshotai/kimi-k3");
    assert.equal((await callNvidiaResearch(input)).model, "z-ai/glm-5-3-flash");
  });

  it("accepts a real model ID override", async () => {
    process.env.NVIDIA_RESEARCH_MODEL = "z-ai/glm-5-3-flash";
    assert.equal((await callNvidiaResearch(input)).model, "z-ai/glm-5-3-flash");
  });

  it("keeps mapping legacy research model aliases to the current model", async () => {
    process.env.NVIDIA_RESEARCH_MODEL = "z-ai/glm-5.3-flash";
    assert.equal((await callNvidiaResearch(input)).model, "z-ai/glm-5-3-flash");
  });
});

describe("NVIDIA error strings are safe to show end users", () => {
  it("streams an actionable message for a gateway 404", async () => {
    // What NVIDIA's gateway returns for an unknown model: plain-text 404.
    globalThis.fetch = async () => new Response("404 page not found", { status: 404 });

    const text = await readAll(await callNvidiaResearch(input));
    assert.match(text, /NVIDIA z-ai\/glm-5-3-flash request failed \(404\): 404 page not found/);
    assert.ok(!text.includes(VALID_KEY), "streamed error must never contain the API key");
  });

  it("redacts key material a provider embeds in its error body", async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ error: { message: "Rejected Bearer nvapi-abc123secret from account" } }),
        { status: 401, headers: { "content-type": "application/json" } },
      );

    const text = await readAll(await callNvidiaResearch(input));
    assert.ok(!text.includes("nvapi-abc123secret"), "provider-echoed key must be redacted");
    assert.match(text, /\[redacted\]/);
  });
});
