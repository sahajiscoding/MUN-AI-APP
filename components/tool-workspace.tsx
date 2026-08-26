"use client";

import { Bot, Loader2, Plus, Send } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { PaywallModal } from "@/components/paywall-modal";

type ToolWorkspaceProps = {
  eyebrow: string;
  title: string;
  description: string;
  mode: "research" | "country-profile" | "position-paper" | "speech" | "poi" | "resolution";
};

type ResponseMode = "quick" | "thorough" | "max";

const responseModeConfig: Record<ResponseMode, { label: string; maxTokens: number; temperature: number }> = {
  quick: { label: "Quick", maxTokens: 1000, temperature: 0.7 },
  thorough: { label: "Thorough", maxTokens: 2600, temperature: 0.85 },
  max: { label: "Max", maxTokens: 6000, temperature: 1.0 },
};

const toolInstructions: Record<ToolWorkspaceProps["mode"], string> = {
  research: "Build a complete research brief.",
  "country-profile": "Prioritize foreign policy, voting patterns, blocs, and red lines.",
  "position-paper": "Prioritize position paper structure, arguments, and policy proposals.",
  speech: "Prioritize opening speech angles and moderated caucus speeches.",
  poi: "Prioritize POIs, likely attacks, rebuttals, and defensive prep.",
  resolution: "Prioritize operative clauses, sponsors, signatories, and negotiation strategy."
};

export function ToolWorkspace({ eyebrow, title, description, mode }: ToolWorkspaceProps) {
  const { user, getIdToken } = useAuth();
  const pathname = usePathname();
  const [chatId, setChatId] = useState<string | null>(null);
  const [input, setInput] = useState("");
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

  // Auto-scroll as content streams in
  useEffect(() => {
    if (outputRef.current && streaming) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, streaming]);

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

    return () => window.clearInterval(timer);
  }, [loading]);

  // Keep the selected chat synchronized for deep links, sidebar clicks, and browser back/forward.
  useEffect(() => {
    const syncFromUrl = () => {
      setChatId(new URLSearchParams(window.location.search).get("chat"));
    };
    const handleChatOpen = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) setChatId(id);
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener("mun:open-chat", handleChatOpen);

    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener("mun:open-chat", handleChatOpen);
    };
  }, [pathname]);

  // Load a saved conversation when the sidebar opens one.
  useEffect(() => {
    if (!chatId || !user) return;

    const selectedChatId = chatId;
    let cancelled = false;
    setLoading(true);
    setLoadingSavedChat(true);
    setStreaming(false);
    setStatus("Loading saved chat…");
    setOutput("");

    async function loadChat() {
      try {
        const token = await getIdToken();
        const response = await fetch(`/api/chats/${encodeURIComponent(selectedChatId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await response.json()) as {
          chat?: { prompt: string; output: string; model: string };
          error?: string;
        };

        if (!response.ok || !data.chat) {
          throw new Error(data.error || "That saved chat could not be opened.");
        }

        if (!cancelled) {
          setInput(data.chat.prompt);
          setOutput(data.chat.output);
          setStatus(`${data.chat.model} · saved chat`);
        }
      } catch (error) {
        if (!cancelled) {
          setInput("");
          setOutput("");
          setStatus(error instanceof Error ? error.message : "That saved chat could not be opened.");
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
    setOutput("");
    setStatus("");
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
    if (!input.trim() || loading) return;

    // Check entitlement before sending
    if (hasAccess === false) {
      setShowPaywall(true);
      return;
    }

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
      setStatus(`Connecting to MiniMax M3 · ${responseMode}…`);
      const response = await fetch("/api/ai/research", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
          signal: controller.signal,
          body: JSON.stringify({
            committee: "General",
            agenda: `${input}\n\nTool focus: ${toolInstructions[mode]}`,
            tool: mode,
          country: "Any",
          experienceLevel: "intermediate",
          provider: "nvidia",
          maxTokens,
          temperature
        })
      });

      setStatus("Waiting for the first token…");

      if (!response.ok) {
        const data = await response.json();
        if (data.code === "paid_access_required") {
          setHasAccess(false);
          setShowPaywall(true);
          return;
        }
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
                if (parsed.content) {
                  if (!fullContent) {
                    setStatus(`MiniMax M3 · ${responseMode} · writing`);
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

        setStatus(`MiniMax M3 · ${responseMode}`);
      } else {
        // Non-streaming fallback
        const data = await response.json();
        setOutput(data.content);
        savedChatId = data.chatId || savedChatId;
        setStatus(`MiniMax M3 · ${responseMode}`);
      }

      if (savedChatId) {
        window.history.replaceState(null, "", `${pathname}?chat=${encodeURIComponent(savedChatId)}`);
        setChatId(savedChatId);
        window.dispatchEvent(new Event("mun:chat-created"));
      }
    } catch (caught) {
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
    <div className="flex flex-col h-screen">
      <PaywallModal open={showPaywall} onClose={() => setShowPaywall(false)} />

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
      <div ref={outputRef} className="flex-1 overflow-y-auto">
        {loading && !output ? (
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
        ) : output ? (
          <div className="max-w-3xl mx-auto px-5 py-6 space-y-6">
            {/* User message */}
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl bg-[var(--ink)] px-4 py-3 text-[var(--paper)]">
                <p className="text-sm leading-6">{input}</p>
              </div>
            </div>

            {/* AI response */}
            <div className="flex gap-3">
              <div className="shrink-0 mt-1">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--patina)] text-white">
                  <Bot className="h-4 w-4" />
                </div>
              </div>
              <div className="flex-1 surface rounded-2xl px-5 py-4">
                {status && (
                  <p className="mb-3 text-xs text-[var(--muted)]">{status}</p>
                )}
                <article className="prose prose-neutral max-w-none whitespace-pre-wrap leading-7 text-sm">
                  {output}
                  {streaming && (
                    <span className="inline-block w-2 h-4 bg-[var(--ink)] animate-pulse ml-0.5 align-middle" />
                  )}
                </article>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-5">
            <div className="max-w-md">
              <div className="grid h-16 w-16 mx-auto place-items-center rounded-full bg-[var(--ink)] text-[var(--paper)] mb-6">
                <Bot className="h-8 w-8" />
              </div>
              <h2 className="display-type text-3xl mb-3">{title}</h2>
              <p className="text-sm leading-6 text-[var(--muted)]">{description}</p>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-[var(--line)] px-5 py-4 shrink-0">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 surface rounded-2xl border border-[var(--line)] px-4 py-3">
            <textarea
              className="flex-1 resize-none bg-transparent outline-none text-sm leading-6 max-h-32 min-h-[2.5rem]"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about ${title.toLowerCase()}...`}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as any);
                }
              }}
            />

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex rounded-lg border border-[var(--line)] overflow-hidden">
                {(["quick", "thorough", "max"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setResponseMode(item)}
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
