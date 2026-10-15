import graphArtifact from "@/founder/mirofish/graph.json";
import profileArtifact from "@/founder/mirofish/oasis_profiles.json";
import reactionArtifact from "@/founder/panel/swarm-reactions.json";

export type AgentStance =
  | "trial-curious"
  | "needs-evidence"
  | "needs-social-proof"
  | "coach-led"
  | "group-adoption"
  | "price-check"
  | "value-check";

export type PersonaDimensions = {
  experience: string;
  behavior: string;
  memory: string;
  social: string;
};

export type AgentProfile = {
  id: string;
  userId: number;
  handle: string;
  name: string;
  age: number;
  country: string;
  segment: string;
  behavior: string;
  bio: string;
  stance: AgentStance;
  currentReaction: string;
  priorReasonCode: string;
  priorQuote: string;
  priorObjection: string;
  flipCondition: string;
  persona: PersonaDimensions;
};

export type GraphNode = {
  uuid: string;
  name: string;
  labels: string[];
  summary: string;
  attributes: Record<string, unknown>;
  ui_group?: string;
};

export type GraphEdge = {
  uuid: string;
  source_node_uuid: string;
  target_node_uuid: string;
  name: string;
  fact: string;
  weight: number;
};

const reactionById = new Map(
  reactionArtifact.agents.map((reaction) => [reaction.id, reaction] as const)
);

/** Synthetic agent profiles derived from the repository's existing panel. */
export const seededAgents: AgentProfile[] = profileArtifact.map((profile) => {
  const id = profile.source_entity_uuid.replace("agent_", "");
  const reaction = reactionById.get(id);

  return {
    id,
    userId: profile.user_id,
    handle: profile.user_name,
    name: profile.name,
    age: profile.age,
    country: profile.country,
    segment: reaction?.segment || profile.profession,
    behavior: reaction?.behavior || profile.persona.behavior,
    bio: profile.bio,
    stance: (reaction?.stance || "value-check") as AgentStance,
    currentReaction: reaction?.current_reaction || profile.persona.memory,
    priorReasonCode: reaction?.prior_reason_code || "unspecified",
    priorQuote: reaction?.prior_synthetic_quote || "",
    priorObjection: reaction?.prior_objection || "",
    flipCondition: reaction?.remembered_flip_condition || "",
    persona: {
      experience: profile.persona.experience,
      behavior: profile.persona.behavior,
      memory: profile.persona.memory,
      social: profile.persona.social,
    },
  };
});

/** Static graph facts used by the Graph Build canvas and search. */
export const graphNodes = graphArtifact.nodes as GraphNode[];
export const graphEdges = graphArtifact.edges as GraphEdge[];

export const stanceMeta: Record<AgentStance, { label: string; shortLabel: string }> = {
  "trial-curious": { label: "Trial curious", shortLabel: "Trial" },
  "needs-evidence": { label: "Needs evidence", shortLabel: "Evidence" },
  "needs-social-proof": { label: "Needs peer proof", shortLabel: "Peer proof" },
  "coach-led": { label: "Coach-led", shortLabel: "Coach" },
  "group-adoption": { label: "Group adoption", shortLabel: "Group" },
  "price-check": { label: "Price check", shortLabel: "Price" },
  "value-check": { label: "Wants a concrete example", shortLabel: "Value" },
};

export const stanceOrder: AgentStance[] = [
  "needs-evidence",
  "needs-social-proof",
  "trial-curious",
  "value-check",
  "group-adoption",
  "coach-led",
  "price-check",
];

export type GodEyeEvent = {
  id: string;
  label: string;
  description: string;
  kind: string;
  live_feature: boolean;
  hypothetical: boolean;
};

export const godEyeEvents: GodEyeEvent[] = [
  {
    id: "trial-live",
    label: "3-day free trial is live",
    description: "New signups receive three days of access without a payment card.",
    kind: "product",
    live_feature: true,
    hypothetical: false,
  },
  {
    id: "sample-brief",
    label: "What-if: show a sample brief before signup",
    description: "Hypothetical public sample; not a claim that a sample library currently exists.",
    kind: "what-if",
    live_feature: false,
    hypothetical: true,
  },
  {
    id: "source-demo",
    label: "What-if: demonstrate checkable sources",
    description: "Hypothetical source-by-source walkthrough; test idea, not a current feature claim.",
    kind: "what-if",
    live_feature: false,
    hypothetical: true,
  },
  {
    id: "club-pilot",
    label: "What-if: invite a club to a guided pilot",
    description: "Hypothetical coach-led club test; no delegation price or endorsement is invented.",
    kind: "what-if",
    live_feature: false,
    hypothetical: true,
  },
];

export const scenarioSeed =
  "How might India-based MUN delegates react to MUN Prep's 3-day no-card trial, MUN-specific workflow, and ₹199 weekly / ₹299 monthly passes?";

export const evidenceCaveat =
  "Synthetic scenario replay only. The source personas were already simulated; this local engine adds no independent human evidence and does not forecast purchases.";
