"use client";

import { Bot, Loader2, Send, ShieldAlert } from "lucide-react";
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
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="surface rounded-panel p-5 sm:p-6">
        <p className="label-text">{eyebrow}</p>
        <h1 className="display-type mt-3 text-4xl sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">{description}</p>

        <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="label-text">Committee</span>
            <input
              className="input-field mt-2"
              value={committee}
              onChange={(event) => setCommittee(event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="label-text">Agenda</span>
            <textarea
              className="input-field mt-2 min-h-28 resize-y"
              value={agenda}
              onChange={(event) => setAgenda(event.target.value)}
              required
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label-text">Country</span>
              <input
                className="input-field mt-2"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                required
              />
            </label>

            <label className="block">
              <span className="label-text">Experience</span>
              <select
                className="input-field mt-2"
                value={experienceLevel}
                onChange={(event) => setExperienceLevel(event.target.value)}
              >
                <option value="first-timer">First timer</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
          </div>

          <fieldset>
            <legend className="label-text">Model route</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["openrouter", "nvidia"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setProvider(item)}
                  className={
                    provider === item
                      ? "button-primary px-3 text-sm font-semibold capitalize"
                      : "button-secondary px-3 text-sm font-semibold capitalize"
                  }
                >
                  {item === "openrouter" ? "GLM" : "MiniMax"}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            className="button-primary flex w-full items-center justify-center gap-2 px-4 font-semibold"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            {loading ? "Drafting brief..." : "Generate briefing"}
          </button>
        </form>
      </section>

      <section className="surface min-h-[34rem] rounded-panel p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
          <div>
            <p className="label-text">Output desk</p>
            <h2 className="display-type mt-2 text-3xl">Delegate brief</h2>
          </div>
          <Bot className="h-5 w-5 text-[var(--patina)]" aria-hidden="true" />
        </div>

        {status ? (
          <p className="mt-4 rounded-panel border border-[var(--line)] bg-white/40 px-3 py-2 text-sm text-[var(--muted)]">
            {status}
          </p>
        ) : null}

        {output ? (
          <article className="prose prose-neutral mt-5 max-w-none whitespace-pre-wrap leading-7">
            {output}
          </article>
        ) : (
          <div className="grid min-h-[24rem] place-items-center text-center">
            <div className="max-w-sm">
              <ShieldAlert className="mx-auto h-8 w-8 text-[var(--brass)]" aria-hidden="true" />
              <p className="mt-4 font-semibold">Paid AI tools verify account access first.</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Once Razorpay access is active for your Supabase account, this desk will generate
                structured MUN prep with the selected model route.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
