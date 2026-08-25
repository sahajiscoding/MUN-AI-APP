"use client";

import { Bot, Loader2, Plus, Send } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import type { AIProvider } from "@/lib/ai/types";
import { PaywallModal } from "@/components/paywall-modal";

type ToolWorkspaceProps = {
  eyebrow: string;
  title: string;
  description: string;
  mode: "research" | "country-profile" | "position-paper" | "speech" | "poi" | "resolution";
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
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<AIProvider>("openrouter");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

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
    setInput("");
    setOutput("");
    setStatus("");
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
    setStatus("");
    setOutput("");

    try {
      const token = await getIdToken();
      const response = await fetch("/api/ai/research", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          committee: "General",
          agenda: `${input}\n\nTool focus: ${toolInstructions[mode]}`,
          country: "Any",
          experienceLevel: "intermediate",
          provider
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // If 402 paid access required, show paywall
        if (data.code === "paid_access_required") {
          setHasAccess(false);
          setShowPaywall(true);
          return;
        }
        throw new Error(data.error ?? "Failed to generate response.");
      }

      setOutput(data.content);
      setStatus(`${data.provider} / ${data.model}`);
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setLoading(false);
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
      <div className="flex-1 overflow-y-auto">
        {output ? (
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
                {(["openrouter", "nvidia"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setProvider(item)}
                    className={
                      provider === item
                        ? "bg-[var(--ink)] text-[var(--paper)] px-2 py-1 text-xs font-semibold"
                        : "px-2 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-black/5"
                    }
                  >
                    {item === "openrouter" ? "Max" : "Mid"}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={loading || !input.trim()}
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
