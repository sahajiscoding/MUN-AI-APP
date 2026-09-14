"use client";

import { ArrowDown, Bot, Loader2, MessageSquare, Plus, Send } from "lucide-react";
import { Streamdown } from "streamdown";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { PaywallModal } from "@/components/paywall-modal";

type ToolWorkspaceProps = {
  eyebrow: string;
  title: string;
  description: string;
  mode: "research" | "country-profile" | "position-paper" | "speech" | "poi" | "resolution";
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

function isSafeExternalUrl(value: string) {
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function ToolWorkspace({ eyebrow, title, description, mode }: ToolWorkspaceProps) {
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

  function handleOutputScroll() {
    const element = outputRef.current;
    if (!element) return;

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    const atLatest = distanceFromBottom < 80;
    shouldAutoScrollRef.current = atLatest;
    setShowJumpToLatest(streaming && !atLatest);
  }

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

  // Keep the selected chat synchronized for deep links, sidebar clicks, and browser back/forward.
  useEffect(() => {
    const syncFromUrl = () => {
      setChatId(urlChatId);
    };
    const handleChatOpen = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail.id;
      if (id) setChatId(id);
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener("mun:open-chat", handleChatOpen);

    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener("mun:open-chat", handleChatOpen);
    };
  }, [pathname, urlChatId]);

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

    async function loadChat() {
      try {
        const token = await getIdToken();
        const response = await fetch(`/api/chats/${encodeURIComponent(selectedChatId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await response.json()) as {
          chat?: { prompt: string; output: string; model: string; turns?: ConversationTurn[] };
          error?: string;
        };

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
          const message = error instanceof Error ? error.message : "That saved chat could not be opened.";
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
      .then((res) => res.json())
      .then((data) => {
        setHasAccess(data.entitlement?.status === "active");
      })
      .catch(() => {
        setHasAccess(false);
      });
  }, [user, getIdToken]);

  function handleNewChat() {
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
    if (chatId) {
      window.history.replaceState(null, "", pathname);
      setChatId(null);
    }
  }

  function handleCancel() {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setStatus("Generation cancelled.");
    setLoading(false);
    setLoadingSavedChat(false);
    setStreaming(false);
  }

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
      const activeModel = responseMode === "max" ? "Kimi K3" : "DeepSeek V4 Flash";
      setStatus(`Connecting to ${activeModel} · ${responseMode}…`);
      const response = await fetch("/api/ai/research", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
          signal: controller.signal,
          body: JSON.stringify({
            committee: "General",
            agenda: prompt,
            chatId: chatId || undefined,
            conversation: priorTurns.slice(-12),
            tool: mode,
          country: "Any",
          experienceLevel: "intermediate",
          responseMode,
          maxTokens,
          temperature
        })
      });

      setStatus("Waiting for the first token…");

      if (!response.ok) {
        const data = await response.json();
        if (data.code === "paid_access_required") {
          rollbackPendingTurn();
          setHasAccess(false);
          setShowPaywall(true);
          return;
        }
        rollbackPendingTurn();
        throw new Error(data.error ?? "Failed to generate response.");
      }

      const contentType = response.headers.get("Content-Type") || "";
      let savedChatId = response.headers.get("X-Chat-Id");

      if (contentType.includes("text/event-stream") && response.body) {
        // Streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";
        let finishReason: string | undefined;

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
        setStatus(
          wasLengthLimited
            ? `${activeModel} · ${responseMode} · provider output limit reached`
            : `${activeModel} · ${responseMode} · complete`
        );
        if (fullContent) {
          setTurns((current) => [...current, { role: "assistant", content: fullContent }]);
          setOutput("");
        } else {
          rollbackPendingTurn();
        }
      } else {
        // Non-streaming fallback
        const data = await response.json();
        const content = typeof data.content === "string" ? data.content : "";
        if (content) {
          setTurns((current) => [...current, { role: "assistant", content }]);
        } else {
          rollbackPendingTurn();
        }
        setOutput("");
        savedChatId = data.chatId || savedChatId;
        setStatus(`${activeModel} · ${responseMode}`);
      }

      if (savedChatId) {
        window.history.replaceState(null, "", `${pathname}?chat=${encodeURIComponent(savedChatId)}`);
        setChatId(savedChatId);
        window.dispatchEvent(new Event("mun:chat-created"));
      }
    } catch (caught) {
      rollbackPendingTurn();
      if (caught instanceof Error && caught.name === "AbortError") {
        setStatus("Generation cancelled.");
      } else {
        setStatus(caught instanceof Error ? caught.message : "Something went wrong.");
      }
    } finally {
      requestControllerRef.current = null;
      setLoading(false);
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PaywallModal open={showPaywall} onClose={() => { setShowPaywall(false); }} />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3 shrink-0">
        <div>
          <p className="label-text">{eyebrow}</p>
          <h1 className="display-type text-2xl">{title}</h1>
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
      <div ref={outputRef} onScroll={handleOutputScroll} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
                  <div className="surface flex-1 rounded-xl px-5 py-4">
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
                <div className="surface flex-1 rounded-xl px-5 py-4">
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
                      className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-[var(--ink)] align-middle"
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
          <div className="flex flex-col items-center justify-center h-full text-center px-5">
            <div className="max-w-md">
              <div className="grid h-16 w-16 mx-auto place-items-center rounded-full bg-[var(--ink)] text-[var(--paper)] mb-6">
                <Bot className="h-8 w-8" />
              </div>
              <h2 className="display-type text-2xl mb-3">{title}</h2>
              <p className="text-sm leading-6 text-[var(--muted)]">{description}</p>
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
      <div className="shrink-0 border-t border-[var(--line)] bg-[var(--paper)]/95 px-3 py-3 backdrop-blur-sm sm:px-5 sm:py-3.5">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 surface rounded-xl border border-[var(--line)] px-4 py-3">
            <textarea
              className="min-h-[2.5rem] max-h-32 flex-1 resize-none bg-transparent px-1 outline-none text-sm leading-6"
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

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex rounded-lg border border-[var(--line)] overflow-hidden">
                {(["quick", "thorough", "max"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => { setResponseMode(item); }}
                    className={
                      responseMode === item
                        ? "bg-[var(--ink)] text-[var(--paper)] px-2 py-1 text-xs font-semibold"
                        : "px-2 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-black/5"
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
                className="grid h-8 w-8 place-items-center rounded-full bg-[var(--ink)] text-[var(--paper)] disabled:opacity-40 transition"
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
