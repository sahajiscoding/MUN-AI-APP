import type { AgentProfile, AgentStance, GodEyeEvent } from "@/lib/mirofish/simulation-data";

export type SimPlatform = "twitter" | "reddit";
export type SimSentiment = "open" | "curious" | "conditional" | "skeptical";

export type SimAction = {
  id: string;
  round: number;
  time: string;
  platform: SimPlatform;
  actionType: string;
  agentId: string;
  agentName: string;
  handle: string;
  stance: AgentStance;
  sentiment: SimSentiment;
  content: string;
  injectionId: string;
  synthetic: true;
};

export type ToolTraceItem = {
  name: "QuickSearch" | "PanoramaSearch" | "InsightForge" | "InterviewSubAgent";
  purpose: string;
  detail: string;
};

export type ReportSection = {
  title: string;
  body: string;
  emphasis?: string;
};

export type ScenarioReport = {
  title: string;
  snapshot: string;
  sections: ReportSection[];
  trace: ToolTraceItem[];
};

export type SurveyItem = {
  label: string;
  count: number;
  percent: number;
  stance: AgentStance;
};

const TWITTER_ACTIONS = ["POST", "LIKE", "REPOST", "QUOTE", "FOLLOW", "IDLE"] as const;
const REDDIT_ACTIONS = ["POST", "COMMENT", "LIKE", "DISLIKE", "SEARCH", "TREND", "FOLLOW", "MUTE", "REFRESH", "IDLE"] as const;

function stableHash(input: string) {
  let value = 2166136261;
  for (const character of input) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function pick<T>(values: readonly T[], seed: string): T {
  return values[stableHash(seed) % values.length];
}

function getSentiment(agent: AgentProfile, injection: GodEyeEvent): SimSentiment {
  if (injection.id === "source-demo" && agent.stance === "needs-evidence") return "curious";
  if (injection.id === "sample-brief" && ["trial-curious", "value-check"].includes(agent.stance)) return "open";
  if (injection.id === "club-pilot" && ["group-adoption", "coach-led"].includes(agent.stance)) return "curious";
  if (agent.stance === "needs-evidence" || agent.stance === "needs-social-proof") return "skeptical";
  if (agent.stance === "trial-curious") return "open";
  if (agent.stance === "value-check") return "curious";
  return "conditional";
}

function currentMessage(agent: AgentProfile, injection: GodEyeEvent, round: number) {
  if (injection.id === "source-demo" && agent.stance === "needs-evidence") {
    return `${agent.name}: A source-by-source walkthrough would help me evaluate the brief. I would still open and verify the sources before speaking.`;
  }
  if (injection.id === "sample-brief" && agent.stance === "trial-curious") {
    return `${agent.name}: A public sample would let me judge the format before signing up. I would test it against my own committee brief next.`;
  }
  if (injection.id === "club-pilot" && agent.stance === "group-adoption") {
    return `${agent.name}: A guided club pilot could show whether this fits our delegation. A coordinator and coach should review the output with us.`;
  }
  if (injection.id === "trial-live" && agent.stance === "trial-curious") {
    return `${agent.name}: Three days without a payment card is enough for me to try one real committee brief before choosing a pass.`;
  }
  if (agent.stance === "needs-evidence") {
    return `${agent.name}: The trial lowers payment risk, but I still need claims I can verify before using them at the dais.`;
  }
  if (agent.stance === "needs-social-proof") {
    return `${agent.name}: I want a real delegate example or recommendation before trusting the output. A free trial alone is not independent proof.`;
  }
  if (agent.stance === "coach-led") {
    return `${agent.name}: I would compare it with our coach's material and ask a teacher to review one output before changing my routine.`;
  }
  if (agent.stance === "group-adoption") {
    return `${agent.name}: The trial makes an individual test easier, but a club needs a coordinator-led pilot and a clear group path.`;
  }
  if (agent.stance === "price-check") {
    return `${agent.name}: I would test the workflow first, then compare ₹199 for a week with ₹299 for a month against my conference dates.`;
  }
  if (round % 2 === 0) {
    return `${agent.name}: I want to see a MUN-specific example that is useful on my phone and meaningfully different from a generic AI prompt.`;
  }
  return agent.currentReaction;
}

function platformAction(platform: SimPlatform, seed: string, round: number) {
  const actions = platform === "twitter" ? TWITTER_ACTIONS : REDDIT_ACTIONS;
  if (round === 1) return "POST";
  return pick(actions, `${seed}:${platform}:${round}`);
}

function summarizeAction(actionType: string, message: string, platform: SimPlatform) {
  if (actionType === "IDLE") return "Read the thread and held a response.";
  if (actionType === "LIKE") return `Liked a thread: ${message}`;
  if (actionType === "REPOST") return `Reposted a delegate's question: ${message}`;
  if (actionType === "FOLLOW") return "Followed the MUN Prep conversation to watch for examples.";
  if (actionType === "SEARCH") return "Searched for evidence about the product's claims and outputs.";
  if (actionType === "TREND") return "Checked whether the trial or evidence question is gaining attention.";
  if (actionType === "MUTE") return "Muted a promotional thread until independent proof appears.";
  if (actionType === "REFRESH") return "Refreshed the discussion to look for a coach or delegate reply.";
  if (actionType === "DISLIKE") return `Disliked a claim that felt too strong: ${message}`;
  if (actionType === "COMMENT" && platform === "reddit") return message;
  if (actionType === "QUOTE") return `Quoted the thread with a question: ${message}`;
  return message;
}

/**
 * Deterministically simulate one round across the two social environments.
 * It uses synthetic profiles and fixed rules rather than human or LLM agents.
 */
export function simulateRound(
  round: number,
  agents: AgentProfile[],
  injection: GodEyeEvent
): SimAction[] {
  if (!Number.isInteger(round) || round < 1) throw new RangeError("Round must be a positive integer.");
  if (agents.length === 0) return [];

  const actions: SimAction[] = [];
  for (const platform of ["twitter", "reddit"] as const) {
    for (const agent of agents) {
      const seed = `${round}:${agent.id}:${injection.id}`;
      const actionType = platformAction(platform, seed, round);
      const message = currentMessage(agent, injection, round);
      actions.push({
        id: `${round}-${platform}-${agent.id}`,
        round,
        time: `T+${round * 6}h`,
        platform,
        actionType,
        agentId: agent.id,
        agentName: agent.name,
        handle: agent.handle,
        stance: agent.stance,
        sentiment: getSentiment(agent, injection),
        content: summarizeAction(actionType, message, platform),
        injectionId: injection.id,
        synthetic: true,
      });
    }
  }
  return actions;
}

/** Produce the persona's local, memory-grounded answer for the chat simulator. */
export function answerAgent(agent: AgentProfile, question: string) {
  const normalized = question.toLowerCase();
  if (/source|citation|fact|accurate|verify|evidence/.test(normalized)) {
    return agent.stance === "needs-evidence"
      ? "That is still my main concern. I would open a source for each important claim and check whether it actually supports the sentence before using it in committee."
      : "I would still want the sources to be easy to inspect. A polished brief is useful, but I would verify the factual claims myself before speaking from it.";
  }
  if (/price|₹|rupee|cost|pay|subscription/.test(normalized)) {
    return "The free trial is useful because I can judge the workflow first. After that, ₹199 for a week fits one conference better; ₹299 for a month only makes sense if I have several weeks or conferences to prepare for.";
  }
  if (/coach|teacher|school|club|team|group|delegat/.test(normalized)) {
    return agent.stance === "group-adoption" || agent.stance === "coach-led"
      ? "I would want a coach or coordinator involved. Let a small group test the brief together, note what is wrong, and decide from that—not from an invented testimonial."
      : "A school coach already gives me a reference point. I would be more comfortable if they could review one real output and see where it helps or falls short.";
  }
  if (/trial|free|card|sample|brief/.test(normalized)) {
    return "Three days with no card lowers the risk of trying it. I would use the trial on my actual committee and country, then decide whether the output is worth paying for.";
  }
  if (/chatgpt|generic|different|alternative/.test(normalized)) {
    return "Show me what changes when I use my committee, country, and agenda. If it is only a generic answer in a different screen, I already have free tools; the workflow has to be more useful, not just more specialized in its wording.";
  }
  return `${agent.currentReaction} ${agent.flipCondition ? `The thing that would change my mind is: ${agent.flipCondition}` : "I would need to see a real example tied to my committee."}`;
}

const surveyLabelByStance: Record<AgentStance, string> = {
  "trial-curious": "Try a real brief during the free trial",
  "needs-evidence": "Verify sources and factual claims",
  "needs-social-proof": "See independent delegate proof",
  "coach-led": "Get coach or school review",
  "group-adoption": "Run a guided club pilot",
  "price-check": "Match the pass to conference timing",
  "value-check": "Compare with a generic AI prompt",
};

/** Aggregate remembered profile signals; results are not live poll responses. */
export function surveyProfileSignals(question: string, agents: AgentProfile[]): SurveyItem[] {
  if (agents.length === 0) return [];
  const normalized = question.trim().toLowerCase();
  const counts = new Map<AgentStance, number>();
  for (const agent of agents) counts.set(agent.stance, (counts.get(agent.stance) || 0) + 1);

  let matchedStances: AgentStance[] | null = null;
  let matchLabel = "Profiles with a related remembered signal";
  let displayStance: AgentStance = "needs-evidence";
  if (/trust|confiden|source|citation|fact|accurate|verif|evidence/.test(normalized)) {
    matchedStances = ["needs-evidence", "needs-social-proof"];
    matchLabel = "Evidence or peer-proof memory";
    displayStance = "needs-evidence";
  } else if (/price|₹|rupee|cost|pay|afford|expensive|cheap/.test(normalized)) {
    matchedStances = ["price-check"];
    matchLabel = "Price-sensitive memory";
    displayStance = "price-check";
  } else if (/coach|teacher|school|club|team|group|delegat/.test(normalized)) {
    matchedStances = ["coach-led", "group-adoption"];
    matchLabel = "Coach or group-adoption memory";
    displayStance = "group-adoption";
  } else if (/trial|free|sample|preview|test/.test(normalized)) {
    matchedStances = ["trial-curious"];
    matchLabel = "Trial or sample memory";
    displayStance = "trial-curious";
  } else if (/example|generic|different|value|useful/.test(normalized)) {
    matchedStances = ["value-check"];
    matchLabel = "Concrete-value memory";
    displayStance = "value-check";
  }

  if (matchedStances) {
    const matched = agents.filter((agent) => matchedStances?.includes(agent.stance)).length;
    const remaining = agents.length - matched;
    const matchedItems: SurveyItem[] = [
      { stance: displayStance, label: matchLabel, count: matched, percent: Math.round((matched / agents.length) * 100) },
      { stance: "value-check", label: "Other top-memory signals", count: remaining, percent: Math.round((remaining / agents.length) * 100) },
    ];
    return matchedItems.filter((item) => item.count > 0);
  }

  return [...counts.entries()]
    .map(([stance, count]) => ({
      stance,
      label: surveyLabelByStance[stance],
      count,
      percent: Math.round((count / agents.length) * 100),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Build the local ReACT-style report and its inspectable tool trace. */
export function buildScenarioReport(
  round: number,
  agents: AgentProfile[],
  events: SimAction[],
  injection: GodEyeEvent
): ScenarioReport {
  const platformPosts = events.filter((event) => event.round === round);
  const skepticalCount = agents.filter((agent) =>
    ["needs-evidence", "needs-social-proof", "coach-led"].includes(agent.stance)
  ).length;
  const trace: ToolTraceItem[] = [
    {
      name: "QuickSearch",
      purpose: "Retrieve the current offer and profile memories relevant to this question.",
      detail: `Read ${agents.length} synthetic profile memories and the selected scenario event; no network calls.`,
    },
    {
      name: "PanoramaSearch",
      purpose: "Map broad relationships, recurring objections, and platform activity.",
      detail: `${events.length} generated timeline actions across two platforms; ${round} simulated round${round === 1 ? "" : "s"}.`,
    },
    {
      name: "InsightForge",
      purpose: "Attribute changed reactions to the injected event without claiming causality.",
      detail: `${skepticalCount} profile memories still center evidence, peer proof, or coach review. Stance categories are not votes.`,
    },
    {
      name: "InterviewSubAgent",
      purpose: "Ask representative synthetic profiles what would change their view.",
      detail: "Profile-grounded prompts run locally with deterministic response templates; no independent agents or external model.",
    },
  ];

  let eventRead = "The current 3-day trial lowers the cost of first inspection; it does not equal proof of accuracy or endorsement.";
  let nextTest = "Watch a real delegate use one committee brief, then ask them to verify every important claim against its cited source.";
  if (injection.id === "sample-brief") {
    eventRead = "A public sample could make quality easier to inspect before signup, but this is a what-if and does not establish that a sample library exists.";
    nextTest = "Show one consented, representative sample brief to real delegates and record which sections they find usable or wrong.";
  } else if (injection.id === "source-demo") {
    eventRead = "A hypothetical source walkthrough directly addresses the evidence concern; delegates must still be able to open and assess the underlying references.";
    nextTest = "Have a coach and delegates verify a small set of claims against the linked primary sources before publishing any proof claim.";
  } else if (injection.id === "club-pilot") {
    eventRead = "A guided club pilot may surface coordinator and coach concerns earlier, but no delegation offer or school endorsement is assumed.";
    nextTest = "Ask two real club coordinators to test a small guided pilot before setting a group price or promising school adoption.";
  }

  return {
    title: "ReACT scenario read",
    snapshot: `Round ${round} · ${injection.label}`,
    sections: [
      {
        title: "Signal, not forecast",
        body: `${agents.length} synthetic profiles contributed to this local replay. ${platformPosts.length} actions were generated in the selected round. These are modeled reactions from old panel memories, not new people, independent votes, or purchase predictions.`,
        emphasis: "Do not infer conversion intent from action counts.",
      },
      {
        title: "What moved",
        body: eventRead,
      },
      {
        title: "The unresolved tension",
        body: "Reducing payment risk and making the MUN workflow concrete can help with first use. The more persistent questions are whether the facts can be checked, whether a real coach would trust the output, and whether the tool is distinct from free general-purpose AI.",
      },
      {
        title: "Next real-world test",
        body: nextTest,
        emphasis: "Replace simulated signals with consented delegate evidence before changing the offer.",
      },
    ],
    trace,
  };
}
