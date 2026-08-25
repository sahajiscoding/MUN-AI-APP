"use client";

import { Bot, Loader2, Send, ShieldAlert, Plus } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import type { AIProvider } from "@/lib/ai/types";

type ToolWorkspaceProps = {
  eyebrow: string;
  title: string;
  description: string;
  mode: "research" | "country-profile" | "position-paper" | "speech" | "poi" | "resolution";
};

const defaults = {
  committee: "UNHRC",
  agenda: "Protecting journalists in conflict zones",
  country: "India",
  experienceLevel: "intermediate"
};

export function ToolWorkspace({ eyebrow, title, description, mode }: ToolWorkspaceProps) {
  const { getIdToken } = useAuth();
  const [committee, setCommittee] = useState(defaults.committee);
  const [agenda, setAgenda] = useState(defaults.agenda);
  const [country, setCountry] = useState(defaults.country);
  const [experienceLevel, setExperienceLevel] = useState(defaults.experienceLevel);
  const [provider, setProvider] = useState<AIProvider>("openrouter");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const toolInstruction = useMemo(() => {
    const map: Record<ToolWorkspaceProps["mode"], string> = {
      research: "Build a complete research brief.",
      "country-profile": "Prioritize foreign policy, voting patterns, blocs, and red lines.",
      "position-paper": "Prioritize position paper structure, arguments, and policy proposals.",
      speech: "Prioritize opening speech angles and moderated caucus speeches.",
      poi: "Prioritize POIs, likely attacks, rebuttals, and defensive prep.",
      resolution: "Prioritize operative clauses, sponsors, signatories, and negotiation strategy."
    };

    return map[mode];
  }, [mode]);

  function handleNewChat() {
    setCommittee(defaults.committee);
    setAgenda(defaults.agenda);
    setCountry(defaults.country);
    setExperienceLevel(defaults.experienceLevel);
    setProvider("openrouter");
    setOutput("");
    setStatus("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
          committee,
          agenda: `${agenda}\n\nTool focus: ${toolInstruction}`,
          country,
          experienceLevel,
          provider
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "The AI workspace could not generate a brief.");
      }

      setOutput(data.content);
      setStatus(`Generated with ${data.provider} / ${data.model}`);
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header with new chat button */}
      <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
        <div>
          <p className="label-text">{eyebrow}</p>
          <h1 className="display-type text-2xl">{title}</h1>
        </div>
        <button
          onClick={handleNewChat}
          className="button-secondary flex items-center gap-2 px-4 py-2 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </button>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto">
        {output ? (
          <div className="max-w-4xl mx-auto px-5 py-6">
            {/* User message */}
            <div className="mb-6 flex justify-end">
              <div className="max-w-[80%] rounded-2xl bg-[var(--ink)] px-4 py-3 text-[var(--paper)]">
                <p className="text-sm font-semibold mb-1">Your request</p>
                <p className="text-sm opacity-80">
                  {committee} — {country} — {agenda.slice(0, 100)}...
                </p>
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
              <p className="text-sm leading-6 text-[var(--muted)] mb-8">{description}</p>
            </div>
          </div>
        )}
      </div>

      {/* Input area at bottom */}
      <div className="border-t border-[var(--line)] bg-[var(--surface)] px-5 py-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="surface rounded-2xl border border-[var(--line)] p-4">
            <div className="grid gap-3 sm:grid-cols-2 mb-3">
              <input
                className="input-field text-sm"
                value={committee}
                onChange={(e) => setCommittee(e.target.value)}
                placeholder="Committee (e.g. UNHRC)"
                required
              />
              <input
                className="input-field text-sm"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Country (e.g. India)"
                required
              />
            </div>

            <textarea
              className="input-field text-sm min-h-[4rem] resize-y mb-3"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="Describe your agenda or topic..."
              required
            />

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <select
                  className="input-field text-xs py-1 px-2"
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                >
                  <option value="first-timer">First timer</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>

                <div className="flex rounded-lg border border-[var(--line)] overflow-hidden">
                  {(["openrouter", "nvidia"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setProvider(item)}
                      className={
                        provider === item
                          ? "bg-[var(--ink)] text-[var(--paper)] px-3 py-1 text-xs font-semibold"
                          : "px-3 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-black/5"
                      }
                    >
                      {item === "openrouter" ? "Max" : "Mid"}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="button-primary flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {loading ? "Generating..." : "Send"}
              </button>
            </div>

            {status && !output && (
              <p className="mt-3 text-xs text-[var(--muted)]">{status}</p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
