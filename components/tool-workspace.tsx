"use client";

import { ArrowDown, Bot, Landmark, Loader2, MessageSquare, Plus, Send } from "lucide-react";
import { Streamdown } from "streamdown";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { AuthAvatar } from "@/components/auth-avatar";
import { PaywallModal } from "@/components/paywall-modal";
import { readJsonResponse } from "@/lib/http";
import { sanitizePublicMessage } from "@/lib/safe-message";

type ToolWorkspaceProps = {
  eyebrow: string;
  title: string;
  description: string;
  mode: "research" | "country-profile" | "position-paper" | "speech" | "poi" | "resolution";
  greeting?: string;
  starters?: string[];
};

type ResponseMode = "quick" | "thorough" | "max";

type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

const responseModeConfig: Record<ResponseMode, { label: string; maxTokens: number; temperature: number }> = {
  quick: { label: "Quick", maxTokens: 1800, temperature: 0.45 },
  thorough: { label: "Thorough", maxTokens: 8000, temperature: 0.7 },
  max: { label: "Max", maxTokens: 12000, temperature: 0.85 },
};

type DeskWelcome = { greeting: string; starters: string[] };

const deskWelcomeDefaults: Record<ToolWorkspaceProps["mode"], DeskWelcome> = {
  research: {
    greeting: "Muni pulled this morning's briefs. Pick a thread and we'll build your case.",
    starters: [
      "UNSC reform — where does India stand?",
      "DISEC cyber norms — map the blocs",
      "Climate finance — opposition arguments to expect",
    ],
  },
  "country-profile": {
    greeting: "Give me a country and a committee — I'll sketch its policy spine.",
    starters: [
      "Brazil in UNEP on deforestation",
      "Japan in DISEC on autonomous weapons",
      "Kenya in WHO on pandemic preparedness",
    ],
  },
  "position-paper": {
    greeting: "Bring a topic and a delegation — we'll turn policy into paragraphs.",
    starters: [
      "Outline a position paper on maritime security",
      "Draft operative clauses on AI governance",
      "Turn these points into a stance paragraph",
    ],
  },
  speech: {
    greeting: "Ninety seconds, one gavel, zero filler. What's the motion?",
    starters: [
      "Write a 90-second opening speech",
      "Moderated caucus angles on refugees",
      "A sharp POI follow-up line",
    ],
  },
  poi: {
    greeting: "Points of information win debates. Feed me a claim to dismantle.",
    starters: [
      "Counter: sanctions always work",
      "Rebut a climate reparations argument",
      "Turn this weakness into a question",
    ],
  },
  resolution: {
    greeting: "Preambulatory, operative, unshakeable. What's the agenda?",
    starters: [
      "Draft a resolution on cyber warfare",
      "Preambulatory clauses for peacekeeping",
      "Review my operative clauses",
    ],
  },
};

/** Checks whether a markdown link URL is safe to open. */
function isSafeExternalUrl(value: string) {
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// A proxy may buffer an event-stream and re-serve it as plain text with a
// rewritten content type. Recover the answer from such a body.
/** Recovers streamed answer text from a proxied SSE body. */
function extractSSEContent(text: string): string {
  let out = "";
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const parsed = JSON.parse(data) as { content?: unknown };
      if (typeof parsed.content === "string") out += parsed.content;
    } catch {
      // Ignore malformed chunks.
    }
  }
  return out;
}

/** AI debate workspace with streaming chat, history, and paywall gating. */
export function ToolWorkspace({ eyebrow, title, description, mode, greeting, starters }: ToolWorkspaceProps) {
  const { user, getIdToken } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlChatId = searchParams.get("chat");
  const [chatId, setChatId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [responseMode, setResponseMode] = useState<ResponseMode>("quick");
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSavedChat, setLoadingSavedChat] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [chatLoadError, setChatLoadError] = useState("");

  // Follow the stream only while the user is already near the latest content.
  // Once they scroll up, leave their reading position alone.
  useEffect(() => {
    if (outputRef.current && streaming && shouldAutoScrollRef.current) {
      outputRef.current.scrollTo({ top: outputRef.current.scrollHeight, behavior: "auto" });
    }
  }, [output, streaming]);

  /** Tracks scroll position to decide whether to follow the live stream. */
  function handleOutputScroll() {
    const element = outputRef.current;
    if (!element) return;

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    const atLatest = distanceFromBottom < 80;
    shouldAutoScrollRef.current = atLatest;
    setShowJumpToLatest(streaming && !atLatest);
  }

  /** Scrolls the transcript to the latest streamed content. */
  function jumpToLatest() {
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: "smooth" });
  }

  // Keep the user informed while the model is waiting for its first token.
  useEffect(() => {
    if (!loading) {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => { window.clearInterval(timer); };
  }, [loading]);

  /** Clears the conversation and aborts any in-flight generation. */
  const resetConversationState = useCallback(() => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setInput("");
    setTurns([]);
    setOutput("");
    setStatus("");
    setChatLoadError("");
    setLoading(false);
    setLoadingSavedChat(false);
    setStreaming(false);
  }, []);

  /** Starts a new chat and drops the saved-chat URL parameter. */
  const handleNewChat = useCallback(() => {
    resetConversationState();

    // Drop ?chat= from the URL so the old conversation cannot be restored.
    if (chatId || urlChatId) {
      window.history.replaceState(null, "", pathname);
    }
    setChatId(null);
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
  }, [chatId, pathname, urlChatId, resetConversationState]);

  // Keep the selected chat synchronized for deep links, sidebar clicks, and browser back/forward.
  useEffect(() => {
    /** Syncs the selected chat id from the current URL. */
    const syncFromUrl = () => {
      setChatId(urlChatId);
    };
    /** Opens the saved chat requested by the sidebar event. */
    const handleChatOpen = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail.id;
      if (id) setChatId(id);
    };

    /** Handles a sidebar request to start a new chat. */
    const handleNewChatRequest = () => {
      handleNewChat();
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener("mun:open-chat", handleChatOpen);
    window.addEventListener("mun:new-chat", handleNewChatRequest);

    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener("mun:open-chat", handleChatOpen);
      window.removeEventListener("mun:new-chat", handleNewChatRequest);
    };
  }, [pathname, urlChatId, handleNewChat]);

  // Starting a new chat must clear the previous conversation. The sidebar
  // "New chat" entry is a plain navigation to the tool root (it only drops
  // ?chat= from the URL), so without this the old turns would stay rendered
  // behind the new URL. Any transition of the selected chat to null resets
  // all conversation state, including aborting an in-flight generation.
  const prevChatIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevChatIdRef.current === undefined) {
      prevChatIdRef.current = chatId;
      return;
    }
    if (chatId === null && prevChatIdRef.current !== null) {
      resetConversationState();
    }
    prevChatIdRef.current = chatId;
  }, [chatId, resetConversationState]);

  // Load a saved conversation when the sidebar opens one.
  useEffect(() => {
    if (!chatId || !user) return;

    const selectedChatId = chatId;
    let cancelled = false;
    setLoading(true);
    setLoadingSavedChat(true);
    setStreaming(false);
    setStatus("Loading saved chat…");
    setChatLoadError("");

    /** Loads the saved chat transcript for the given chat. */
    async function loadChat() {
      try {
        const token = await getIdToken();
        const response = await fetch(`/api/chats/${encodeURIComponent(selectedChatId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await readJsonResponse<{
          chat?: { prompt: string; output: string; model: string; turns?: ConversationTurn[] };
          error?: string;
        }>(response)) ?? {};

        if (!response.ok || !data.chat) {
          throw new Error(data.error || "That saved chat could not be opened.");
        }

        if (!cancelled) {
          const loadedTurns = Array.isArray(data.chat.turns) && data.chat.turns.length > 0
            ? data.chat.turns
            : [
                ...(data.chat.prompt ? [{ role: "user" as const, content: data.chat.prompt }] : []),
                ...(data.chat.output ? [{ role: "assistant" as const, content: data.chat.output }] : []),
              ];
          setTurns(loadedTurns);
          setInput("");
          setOutput("");
          setChatLoadError("");
          setStatus(`${data.chat.model} · saved chat`);
        }
      } catch (error) {
        if (!cancelled) {
          // Never render raw error text: SDK/network errors can embed
          // request URLs carrying credentials.
          const message = sanitizePublicMessage(error, "That saved chat could not be opened.");
          setChatLoadError(message);
          setStatus(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingSavedChat(false);
          setStreaming(false);
        }
      }
    }

    void loadChat();
    return () => {
      cancelled = true;
    };
  }, [chatId, getIdToken, user]);

  // Check entitlement on mount
  useEffect(() => {
    if (!user) return;

    getIdToken()
      .then((token) =>
        fetch("/api/me/entitlement", {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then((res) => readJsonResponse<{ entitlement?: { status?: string } }>(res))
      .then((data) => {
        setHasAccess(data?.entitlement?.status === "active");
      })
      .catch(() => {
        setHasAccess(false);
      });
  }, [user, getIdToken]);

  /** Cancels the in-flight AI generation. */
  function handleCancel() {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setStatus("Generation cancelled.");
    setLoading(false);
    setLoadingSavedChat(false);
    setStreaming(false);
  }

  /** Submits the prompt and streams the AI response into the transcript. */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt || loading) return;

    // Check entitlement before sending
    if (hasAccess === false) {
      setShowPaywall(true);
      return;
    }

    const priorTurns = turns;
    /** Restores the prior transcript when a submission fails. */
    const rollbackPendingTurn = () => {
      setTurns(priorTurns);
      setOutput("");
    };
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
    setTurns((current) => [...current, { role: "user", content: prompt }]);
    setLoading(true);
    setLoadingSavedChat(false);
    setStreaming(true);
    setElapsedSeconds(0);
    setStatus("Preparing your request…");
    setOutput("");

    const { maxTokens, temperature } = responseModeConfig[responseMode];

    const controller = new AbortController();
    requestControllerRef.current = controller;

    try {
      const token = await getIdToken();
      const activeModel = responseMode === "max" ? "Kimi K3" : "GLM 5.3 Flash";
      setStatus(`Connecting to ${activeModel} · ${responseMode}…`);
      const requestPayload = {
        committee: "General",
        agenda: prompt,
        chatId: chatId || undefined,
        conversation: priorTurns.slice(-12),
        tool: mode,
        country: "Any",
        experienceLevel: "intermediate",
        responseMode,
        maxTokens,
        temperature,
      };
      /** Posts the prompt to the research API, optionally as a stream. */
    const postResearch = (asStream: boolean) =>
        fetch("/api/ai/research", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify(asStream ? requestPayload : { ...requestPayload, stream: false }),
        });

      let savedChatId: string | null = null;
      let generationSucceeded = false;

      // Returns true when the paywall was shown (caller must stop).
      /** Handles API errors, showing the paywall when access is required. */
      async function handleErrorResponse(res: Response): Promise<boolean> {
        const errData = (await readJsonResponse<{ code?: string; error?: string }>(res)) ?? {};
        if (errData.code === "paid_access_required") {
          rollbackPendingTurn();
          setHasAccess(false);
          setShowPaywall(true);
          return true;
        }
        rollbackPendingTurn();
        throw new Error(errData.error ?? "Failed to generate response.");
      }

      /** Consumes a JSON response and appends its content to the transcript. */
      async function consumeJsonResult(res: Response): Promise<void> {
        const cloned = res.clone();
        let data: { content?: unknown; chatId?: string; error?: unknown } = {};
        try {
          data = (await readJsonResponse<typeof data>(res)) ?? {};
        } catch {
          // Not JSON (a proxy may have rewritten the content type) — fall
          // through to the SSE-text salvage below.
        }
        let content = typeof data.content === "string" ? data.content : "";
        if (!content) {
          content = extractSSEContent(await cloned.text().catch(() => ""));
        }
        if (!content) {
          rollbackPendingTurn();
          throw new Error(
            typeof data.error === "string" && data.error
              ? data.error
              : "The AI returned an empty response. Please try again."
          );
        }
        setTurns((current) => [...current, { role: "assistant", content }]);
        generationSucceeded = true;
        setOutput("");
        if (typeof data.chatId === "string" && data.chatId) savedChatId = data.chatId;
        setStatus(`${activeModel} · ${responseMode}`);
      }

      let response = await postResearch(true);

      setStatus("Waiting for the first token…");

      if (!response.ok) {
        if (await handleErrorResponse(response)) return;
      }

      const contentType = response.headers.get("Content-Type") || "";
      savedChatId = response.headers.get("X-Chat-Id");

      if (contentType.includes("text/event-stream") && response.body) {
        // Streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";
        let finishReason: string | undefined;
        let streamError: string | undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (typeof parsed.finishReason === "string") {
                  finishReason = parsed.finishReason;
                }
                if (typeof parsed.error === "string" && parsed.error) {
                  streamError = parsed.error;
                }
                if (parsed.content) {
                  if (!fullContent) {
                    setStatus(`${activeModel} · ${responseMode} · writing`);
                  }
                  fullContent += parsed.content;
                  setOutput(fullContent);
                }
              } catch {
                // skip malformed chunks
              }
            }
          }
        }

        const wasLengthLimited = finishReason === "length" || finishReason === "max_tokens";
        if (fullContent) {
          setTurns((current) => [...current, { role: "assistant", content: fullContent }]);
          setOutput("");
          generationSucceeded = true;
          setStatus(
            wasLengthLimited
              ? `${activeModel} · ${responseMode} · provider output limit reached`
              : `${activeModel} · ${responseMode} · complete`
          );
        } else if (!streamError) {
          // The stream opened but carried nothing and the provider reported
          // no failure — typical when an intercepting proxy (ZAP, corporate
          // gateway) swallows event-stream bodies. Retry once as plain JSON,
          // which passes through such proxies untouched.
          setStatus("Live updates were blocked by the network, retrying…");
          response = await postResearch(false);
          if (!response.ok) {
            if (await handleErrorResponse(response)) return;
          }
          await consumeJsonResult(response);
        } else {
          rollbackPendingTurn();
          throw new Error(streamError);
        }
      } else {
        await consumeJsonResult(response);
      }

      // Only point the URL at the saved chat after content actually exists.
      // The server persists the chat when the stream ends, so navigating
      // earlier makes the loader fetch a chat that is not saved yet and
      // shows a bogus "could not be opened" error.
      if (generationSucceeded && savedChatId) {
        window.history.replaceState(null, "", `${pathname}?chat=${encodeURIComponent(savedChatId)}`);
        setChatId(savedChatId);
        window.dispatchEvent(new Event("mun:chat-created"));
      }
    } catch (caught) {
      rollbackPendingTurn();
      if (caught instanceof Error && caught.name === "AbortError") {
        setStatus("Generation cancelled.");
      } else {
        setStatus(sanitizePublicMessage(caught, "Something went wrong."));
      }
    } finally {
      requestControllerRef.current = null;
      setLoading(false);
      setStreaming(false);
    }
  }

  return (
    <div className="flex min-h-0 h-full w-full min-w-0 flex-1 flex-col">
      <PaywallModal open={showPaywall} onClose={() => { setShowPaywall(false); }} />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3 shrink-0">
        <div>
          <p className="label-text text-[var(--brass)]">{eyebrow}</p>
          <h1 className="display-type text-[1.7rem] leading-tight">{title}</h1>
        </div>
        <button
          onClick={handleNewChat}
          className="button-secondary flex items-center gap-2 px-4 py-2 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
      </div>

      {/* Messages area */}
      <div ref={outputRef} onScroll={handleOutputScroll} className="relative min-h-0 flex-1 basis-0 overflow-y-auto overscroll-contain">
        {loading && turns.length === 0 && !output ? (
          <div className="flex h-full items-center justify-center px-5 text-center" aria-live="polite">
            <div className="w-full max-w-md">
              <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-[var(--ink)] text-[var(--paper)] shadow-sm">
                <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
              </div>
              <h2 className="display-type mb-2 text-2xl">
                {loadingSavedChat ? "Loading saved chat" : "Generating your response"}
              </h2>
              <p className="text-sm leading-6 text-[var(--muted)]">
                {status || "The model is preparing your answer…"}
              </p>
              <div className="mt-5 flex items-center justify-center gap-3 text-xs text-[var(--muted)]">
                <span>{elapsedSeconds}s elapsed</span>
                <span aria-hidden="true">·</span>
                <span>
                  {responseModeConfig[responseMode].label} mode · up to {responseModeConfig[responseMode].maxTokens} tokens
                </span>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="button-secondary mt-6 px-4 py-2 text-sm font-semibold"
              >
                Cancel generation
              </button>
            </div>
          </div>
        ) : turns.length > 0 || output ? (
          <div className="max-w-3xl mx-auto px-5 py-5 space-y-5">
            {turns.map((turn, index) =>
              turn.role === "user" ? (
                <div className="flex justify-end" key={`${turn.role}-${index}`}>
                  <div className="max-w-[80%] rounded-xl bg-[var(--ink)] px-4 py-3 text-[var(--paper)]">
                    <p className="whitespace-pre-wrap text-sm leading-6">{turn.content}</p>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3" key={`${turn.role}-${index}`}>
                  <div className="mt-1 shrink-0">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--patina)] text-white">
                      <Bot className="h-4 w-4" aria-hidden="true" />
                    </div>
                  </div>
                  <div className="desk-ai-card surface flex-1 rounded-xl px-5 py-4">
                    <div className="chat-markdown text-sm leading-7">
                      <Streamdown
                        mode="static"
                        parseIncompleteMarkdown
                        lineNumbers={false}
                        linkSafety={{ enabled: true, onLinkCheck: isSafeExternalUrl }}
                      >
                        {turn.content}
                      </Streamdown>
                    </div>
                  </div>
                </div>
              )
            )}

            {output ? (
              <div className="flex gap-3">
                <div className="mt-1 shrink-0">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--patina)] text-white">
                    <Bot className="h-4 w-4" aria-hidden="true" />
                  </div>
                </div>
                <div className="desk-ai-card surface flex-1 rounded-xl px-5 py-4">
                  {status ? <p className="mb-3 text-xs text-[var(--muted)]" aria-live="polite">{status}</p> : null}
                  <div className="chat-markdown text-sm leading-7">
                    <Streamdown
                      mode="streaming"
                      isAnimating
                      animated
                      parseIncompleteMarkdown
                      lineNumbers={false}
                      linkSafety={{ enabled: true, onLinkCheck: isSafeExternalUrl }}
                    >
                      {output}
                    </Streamdown>
                    <span
                      className="desk-stream-cursor ml-0.5 inline-block h-4 w-2 animate-pulse align-middle"
                      aria-label="Response is still being generated"
                    />
                  </div>
                </div>
              </div>
            ) : loading && turns.length > 0 ? (
              <div className="flex gap-3" aria-live="polite">
                <div className="mt-1 shrink-0">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--patina)] text-white">
                    <Bot className="h-4 w-4" aria-hidden="true" />
                  </div>
                </div>
                <div className="surface flex-1 rounded-xl px-5 py-4">
                  <p className="text-sm text-[var(--muted)]">{status || "Generating your response…"}</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : chatLoadError ? (
          <div className="flex h-full items-center justify-center px-5 text-center" role="alert">
            <div className="max-w-md rounded-xl border border-[var(--oxblood)]/25 bg-[var(--paper-strong)] p-6 shadow-sm">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--oxblood)] text-[var(--paper)]">
                <MessageSquare className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="display-type mt-4 text-2xl">Saved chat could not be opened</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{chatLoadError}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => { window.location.reload(); }} className="button-primary px-4 py-2 text-sm font-semibold">Try again</button>
                <button type="button" onClick={handleNewChat} className="button-secondary px-4 py-2 text-sm font-semibold">Start new chat</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="desk-seal-watermark relative flex h-full flex-col items-center justify-center overflow-y-auto px-5 py-10 text-center">
            <Landmark
              className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 text-[var(--brass)] opacity-[0.07]"
              aria-hidden="true"
            />
            <div className="desk-fade-in relative w-full max-w-xl">
              <p className="label-text text-[var(--brass)]">{eyebrow}</p>
              <h2 className="display-type mt-3 text-4xl sm:text-5xl">{title}</h2>
              <div className="mt-2 flex justify-center">
                <AuthAvatar activeField={null} isTyping={false} status="idle" size="md" />
              </div>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                {greeting ?? deskWelcomeDefaults[mode].greeting}
              </p>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">{description}</p>
              <div className="mt-6 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:flex-wrap">
                {(starters ?? deskWelcomeDefaults[mode].starters).map((starter, index) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => {
                      setInput(starter);
                      inputRef.current?.focus();
                    }}
                    className="desk-chip-in surface rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition hover:-translate-y-0.5 sm:max-w-[16rem]"
                    style={{ animationDelay: `${120 + index * 60}ms` }}
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {showJumpToLatest && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="sticky bottom-4 left-full ml-auto mr-5 flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--ink)] shadow-sm transition hover:bg-black/5"
          >
            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
            Jump to latest
          </button>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-[var(--line)] bg-[var(--paper)]/95 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:px-5 sm:py-3.5 sm:pb-3.5">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="group flex items-end gap-2 surface rounded-2xl border border-[var(--line)] px-4 py-3 shadow-[0_18px_50px_rgba(23,20,18,0.14)]">
            <div className="min-w-0 flex-1">
              <textarea
                ref={inputRef}
                className="min-h-[2.5rem] max-h-32 w-full resize-none bg-transparent px-1 outline-none text-sm leading-6"
                value={input}
                onChange={(e) => { setInput(e.target.value); }}
                placeholder={`Ask about ${title.toLowerCase()}...`}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSubmit(e as any);
                  }
                }}
              />
              <p className="hidden px-1 pt-1 text-[11px] text-[var(--muted)] group-focus-within:block">
                Enter ↵ to send · Shift + Enter for a new line
                {input.length > 0 ? <span aria-hidden="true"> · {input.length} characters</span> : null}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex rounded-full border border-[var(--brass)]/40 bg-[var(--brass)]/10 p-0.5 overflow-hidden">
                {(["quick", "thorough", "max"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => { setResponseMode(item); }}
                    className={
                      responseMode === item
                        ? "rounded-full bg-[var(--ink)] text-[var(--paper)] px-2.5 py-1 text-xs font-semibold"
                        : "rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-black/5"
                    }
                  >
                    {item === "quick" ? "Quick" : item === "thorough" ? "Thorough" : "Max"}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Send message"
                title="Send message"
                className="desk-send-button grid h-8 w-8 place-items-center rounded-full bg-[var(--ink)] text-[var(--paper)] disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {status && !output && (
            <p className="mt-2 text-xs text-[var(--muted)] text-center">{status}</p>
          )}
        </form>
      </div>
    </div>
  );
}
