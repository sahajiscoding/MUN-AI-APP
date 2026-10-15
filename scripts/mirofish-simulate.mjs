#!/usr/bin/env node
/**
 * Build a reproducible, local MiroFish-inspired scenario pack for MUN Prep.
 *
 * This is deliberately not the MiroFish runtime: it uses no LLM, OASIS, Zep,
 * external service, or real delegate data. It turns the repository's existing
 * synthetic panel into transparent agent profiles and a deterministic replay.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) => JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
const writeJson = (relativePath, value) => {
  writeFileSync(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`);
};
const writeJsonl = (relativePath, values) => {
  writeFileSync(path.join(root, relativePath), `${values.map((value) => JSON.stringify(value)).join("\n")}\n`);
};
const includesAny = (value, pattern) => pattern.test(String(value || ""));
const currentDate = "2026-10-15";

const customer = readJson("founder/customer.json");
const panel = readJson("founder/panel/panel.json");
const personas = readJson("founder/panel/personas.json");
const baseline = readJson("founder/panel/results.json");
const answers = new Map(
  personas.map((persona) => [
    persona.id,
    readJson(`founder/panel/answers/${persona.id}.json`),
  ])
);

if (personas.length !== panel.n || personas.length !== answers.size) {
  throw new Error("The panel, personas, and answer files must contain the same number of agents.");
}

const scenario = {
  app: "MUN Prep App",
  audience: customer.target,
  question:
    "How might India-based Model UN delegates react to the current MUN Prep workspace, its 3-day no-card trial, and ₹199 weekly / ₹299 monthly passes?",
  snapshot: "Public product surface and pricing plan, as of 2026-10-15",
  offer: {
    trial_days: 3,
    trial_requires_payment_card: false,
    weekly_price_inr: 199,
    monthly_price_inr: 299,
  },
  product_capabilities: [
    "Committee research and country policy preparation",
    "Position paper planning",
    "Speech drafting and practice",
    "Points of information practice",
    "Resolution clause planning",
    "MUN courses and glossary",
  ],
  evidence_boundary:
    "The source personas and prior answers are synthetic founder-panel material. The replay is a rule-based scenario, not a human study, a demand forecast, or a live MiroFish/OASIS/LLM run.",
};

const entityTypes = [
  { name: "Delegate", description: "Synthetic Model UN delegate persona in the existing panel." },
  { name: "MUNPrepApp", description: "The public MUN Prep product surface being explored." },
  { name: "PreparationArtifact", description: "A research, writing, or debate-preparation output." },
  { name: "Offer", description: "Trial and paid access terms visible to a delegate." },
  { name: "TrustSignal", description: "A checkable proof point that can change perceived risk." },
  { name: "Concern", description: "A stated friction or objection carried from the prior synthetic panel." },
  { name: "Club", description: "A school or community that may influence group adoption." },
  { name: "Conference", description: "The time-bound MUN event a delegate is preparing for." },
  { name: "Person", description: "Fallback entity for a named synthetic agent." },
  { name: "Organization", description: "Fallback entity for a club, school, or product organization." },
];

const edgeTypes = [
  { name: "PREPARES_WITH", source_targets: [{ source: "Delegate", target: "MUNPrepApp" }] },
  { name: "USES_FOR", source_targets: [{ source: "MUNPrepApp", target: "PreparationArtifact" }] },
  { name: "PRICED_AS", source_targets: [{ source: "MUNPrepApp", target: "Offer" }] },
  { name: "NEEDS_PROOF", source_targets: [{ source: "Delegate", target: "TrustSignal" }] },
  { name: "RAISES", source_targets: [{ source: "Delegate", target: "Concern" }] },
  { name: "INFLUENCED_BY", source_targets: [{ source: "Delegate", target: "Club" }] },
  { name: "PREPARES_FOR", source_targets: [{ source: "Delegate", target: "Conference" }] },
  { name: "SHARES_WITH", source_targets: [{ source: "Delegate", target: "Delegate" }] },
];

function stableHash(input) {
  let value = 2166136261;
  for (const character of String(input)) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function getStance(persona, answer) {
  const trigger = answer.would_change_my_mind || "";
  const segment = persona.segment || "";
  if (/club head|coordinator/i.test(segment) || /whole (team|delegation)|group price|school plan/i.test(trigger)) {
    return "group-adoption";
  }
  if (includesAny(trigger, /source|citation|accurate|fact|verify|claim/i)) return "needs-evidence";
  if (includesAny(trigger, /review|someone|friend|senior|award|proof|recommend/i)) return "needs-social-proof";
  if (includesAny(trigger, /trial|free|sample|brief|see the output|test it/i)) return "trial-curious";
  if (/coach|teacher|school/i.test(trigger) || /coach/i.test(answer.objection || "")) return "coach-led";
  if (answer.reason_code === "price" || /price|₹|rupee|discount|cheaper/i.test(trigger)) return "price-check";
  return "value-check";
}

function responseFor(persona, answer, stance) {
  const name = persona.name;
  const segment = persona.segment || "delegate";
  const trigger = answer.would_change_my_mind || "";
  const templates = {
    "group-adoption": `${name} sees the 3-day trial as a low-risk team test, but wants a delegation-level plan and a coach or coordinator in the decision.`,
    "needs-evidence": `${name} would try the free workspace, but still wants claims they can verify before using them at the dais. The trial lowers payment risk; it does not prove factual accuracy.`,
    "needs-social-proof": `${name} wants a real delegate reference or a public example before trusting the output. The no-card trial makes a first look easier, but does not replace independent proof.`,
    "trial-curious": `${name} is willing to inspect a real committee brief during the 3-day no-card trial, then decide whether ₹199 for a week or ₹299 for a month is worth it.`,
    "coach-led": `${name} is more likely to consider MUN Prep if a coach recommends it or a school can review the output; an individual trial alone may not displace the existing method.`,
    "price-check": `${name} compares a ₹199 conference-week pass with the ₹299 monthly option and wants to see enough value during the trial before choosing.`,
    "value-check": `${name} wants a concrete example tied to their own committee before adding another tool to the preparation routine.`,
  };
  return {
    id: persona.id,
    display_name: name,
    segment,
    behavior: persona.behaviour || "Unspecified",
    age: persona.age,
    stance,
    current_reaction: templates[stance],
    prior_reason_code: answer.reason_code,
    prior_synthetic_quote: answer.reason,
    prior_objection: answer.objection || persona.objection || "",
    remembered_flip_condition: trigger,
    evidence_note: "Modeled replay from synthetic panel material; not a new participant quote.",
  };
}

function agentMemory(persona, answer, stance) {
  const reaction = responseFor(persona, answer, stance);
  const priorConcern = (answer.objection || persona.objection || "none recorded").replace(/[.!?]+$/, "");
  return {
    experience: persona.behaviour_how || persona.behaviour || "A Model UN delegate preparing for a conference.",
    behavior: persona.behaviour || "Unspecified preparation style",
    memory: `Earlier synthetic panel answer: ${answer.reason_code || "unspecified"}. Prior concern: ${priorConcern}. Current modeled stance: ${stance}.`,
    social: `${persona.segment || "Delegate"}. Habit context: ${persona.habit || "not recorded"}.`,
    current_reaction: reaction.current_reaction,
    source_note: reaction.evidence_note,
  };
}

const agents = personas.map((persona, index) => {
  const answer = answers.get(persona.id);
  const stance = getStance(persona, answer);
  const userId = index + 1;
  const handle = `${persona.name.toLowerCase().replace(/[^a-z0-9]/g, "")}_${persona.id.toLowerCase()}`;
  const reaction = responseFor(persona, answer, stance);
  const personality = agentMemory(persona, answer, stance);
  const activitySeed = stableHash(`${panel.seed}:${persona.id}`);
  const profile = {
    user_id: userId,
    user_name: handle,
    name: persona.name,
    bio: `${persona.age}-year-old synthetic ${persona.segment || "MUN delegate"}; ${persona.behaviour || "preparation style unspecified"}.`,
    persona: {
      experience: personality.experience,
      behavior: personality.behavior,
      memory: personality.memory,
      social: personality.social,
    },
    karma: 8 + (activitySeed % 980),
    friend_count: 18 + (activitySeed % 460),
    follower_count: 12 + ((activitySeed >>> 3) % 2100),
    statuses_count: 5 + ((activitySeed >>> 7) % 120),
    age: persona.age,
    gender: "unspecified",
    mbti: "unspecified",
    country: "India",
    profession: persona.segment || "Model UN delegate",
    interested_topics: ["Model United Nations", "committee research", "delegate preparation"],
    source_entity_uuid: `agent_${persona.id}`,
    source_entity_type: "Delegate",
    created_at: `${currentDate}T00:00:00.000Z`,
  };
  return { persona, answer, stance, reaction, personality, profile };
});

const graphNodes = [
  {
    uuid: "app_mun_prep",
    name: "MUN Prep App",
    labels: ["MUNPrepApp", "Organization"],
    summary: "India-first Model UN preparation workspace with research, writing, and debate tools.",
    attributes: { snapshot: currentDate, audience: customer.target },
    ui_group: "product",
  },
  {
    uuid: "offer_trial_3d",
    name: "3-day free trial",
    labels: ["Offer"],
    summary: "Three days of access on signup with no payment card required.",
    attributes: { access_days: 3, card_required: false },
    ui_group: "offer",
  },
  {
    uuid: "offer_weekly_199",
    name: "Weekly Pass · ₹199",
    labels: ["Offer"],
    summary: "Seven days of paid access for conference-week preparation.",
    attributes: { price_inr: 199, access_days: 7 },
    ui_group: "offer",
  },
  {
    uuid: "offer_monthly_299",
    name: "Monthly Pass · ₹299",
    labels: ["Offer"],
    summary: "Thirty days of paid access for multi-conference preparation.",
    attributes: { price_inr: 299, access_days: 30 },
    ui_group: "offer",
  },
  {
    uuid: "feature_research",
    name: "Research & country policy",
    labels: ["PreparationArtifact"],
    summary: "Committee brief, country policy, blocs, and debate angles.",
    attributes: { mode: "research", route: "/app/research" },
    ui_group: "feature",
  },
  {
    uuid: "feature_writing",
    name: "Position papers & speeches",
    labels: ["PreparationArtifact"],
    summary: "Position paper and speech-building workspaces.",
    attributes: { modes: ["position-paper", "speech"] },
    ui_group: "feature",
  },
  {
    uuid: "feature_debate",
    name: "POIs & resolutions",
    labels: ["PreparationArtifact"],
    summary: "Practice points of information and resolution strategy.",
    attributes: { modes: ["poi", "resolution"] },
    ui_group: "feature",
  },
  {
    uuid: "trust_sources",
    name: "Checkable source proof",
    labels: ["TrustSignal"],
    summary: "A future validation need repeatedly present in the synthetic panel; do not imply it is fully solved by the current product.",
    attributes: { state: "open question", live_feature_claim: false },
    ui_group: "trust",
  },
  {
    uuid: "trust_peer_proof",
    name: "Independent delegate proof",
    labels: ["TrustSignal"],
    summary: "A real, consented delegate example or recommendation; no testimonial is invented in this scenario.",
    attributes: { state: "not yet established", live_feature_claim: false },
    ui_group: "trust",
  },
  {
    uuid: "concern_coach",
    name: "Coach / existing materials",
    labels: ["Concern"],
    summary: "Some delegates already rely on a coach, templates, or senior-shared preparation.",
    attributes: { source: "synthetic founder panel" },
    ui_group: "concern",
  },
  {
    uuid: "concern_generic_ai",
    name: "Generic AI substitution",
    labels: ["Concern"],
    summary: "Delegates compare a specialist MUN workflow with free general-purpose AI tools.",
    attributes: { source: "synthetic founder panel" },
    ui_group: "concern",
  },
];

for (const { persona, answer, stance } of agents) {
  graphNodes.push({
    uuid: `agent_${persona.id}`,
    name: persona.name,
    labels: ["Delegate", "Person"],
    summary: `${persona.age}-year-old synthetic ${persona.segment}; modeled current stance: ${stance}.`,
    attributes: {
      source_id: persona.id,
      behavior: persona.behaviour,
      segment: persona.segment,
      prior_reason_code: answer.reason_code,
      synthetic: true,
    },
    ui_group: "agent",
  });
}

const graphEdges = [];
function addEdge(source, target, name, fact, weight = 1, details = {}) {
  graphEdges.push({
    uuid: `edge_${String(graphEdges.length + 1).padStart(4, "0")}`,
    source_node_uuid: source,
    target_node_uuid: target,
    name,
    fact,
    weight,
    created_at: `${currentDate}T00:00:00.000Z`,
    valid_at: `${currentDate}T00:00:00.000Z`,
    invalid_at: null,
    expired_at: null,
    ...details,
  });
}

addEdge("app_mun_prep", "offer_trial_3d", "OFFERS", "The current signup flow grants a 3-day trial without a card.", 1);
addEdge("app_mun_prep", "offer_weekly_199", "PRICED_AS", "The weekly pass is ₹199 for seven days.", 1);
addEdge("app_mun_prep", "offer_monthly_299", "PRICED_AS", "The monthly pass is ₹299 for thirty days.", 1);
for (const featureId of ["feature_research", "feature_writing", "feature_debate"]) {
  addEdge("app_mun_prep", featureId, "USES_FOR", "The app provides a delegate-preparation workspace.", 1);
}
addEdge("app_mun_prep", "trust_sources", "NEEDS_TO_VALIDATE", "Source transparency remains a proof question, not a solved feature claim.", 0.82);
addEdge("app_mun_prep", "trust_peer_proof", "NEEDS_TO_VALIDATE", "Independent delegate proof is not fabricated by this replay.", 0.74);

for (const { persona, answer, stance } of agents) {
  const id = `agent_${persona.id}`;
  addEdge(id, "app_mun_prep", "EVALUATES", `${persona.name} profile evaluates the current app snapshot; modeled stance: ${stance}.`, 0.6);
  if (stance === "needs-evidence") {
    addEdge(id, "trust_sources", "NEEDS_PROOF", answer.would_change_my_mind || "Requests source evidence.", 0.9, { memory_type: "prior synthetic answer" });
  } else if (stance === "needs-social-proof") {
    addEdge(id, "trust_peer_proof", "NEEDS_PROOF", answer.would_change_my_mind || "Requests peer proof.", 0.84, { memory_type: "prior synthetic answer" });
  } else if (stance === "coach-led") {
    addEdge(id, "concern_coach", "RAISES", answer.objection || persona.objection || "Coach-led alternative.", 0.8, { memory_type: "prior synthetic answer" });
  } else if (stance === "price-check") {
    addEdge(id, "offer_weekly_199", "COMPARES", "Tests the one-week price against a one-conference need.", 0.7);
  } else {
    addEdge(id, "offer_trial_3d", "CONSIDERS", "Uses the trial as a low-risk first step; payment intent is not inferred.", 0.65);
  }
}

const ontology = {
  source: "https://github.com/666ghj/MiroFish",
  method: "MiroFish-inspired five-stage workflow; locally generated deterministic scenario artifacts",
  engine_limit: "Not the MiroFish runtime. No external LLM, OASIS, Zep, or network call is used.",
  seed: panel.seed,
  scenario,
  entity_types: entityTypes,
  edge_types: edgeTypes,
  analysis_summary:
    "Model how a 3-day no-card trial and MUN-specific workflow might change the conversation while keeping the synthetic-panel evidence boundary explicit. Focus on trial curiosity, trust/source proof, peer credibility, coach substitutes, and one-conference pricing.",
};

const graph = {
  graph_id: "mun-prep-swarm-2026-10-15",
  snapshot_at: `${currentDate}T00:00:00.000Z`,
  seed_prompt: scenario.question,
  node_count: graphNodes.length,
  edge_count: graphEdges.length,
  nodes: graphNodes,
  edges: graphEdges,
  temporal_memory: graphEdges.map((edge) => ({
    edge_uuid: edge.uuid,
    fact: edge.fact,
    valid_at: edge.valid_at,
    invalid_at: edge.invalid_at,
    source_note: "Synthetic panel replay and current product snapshot; not observed user behavior.",
  })),
};

const oasisProfiles = agents.map(({ profile }) => profile);

const scenarioEvents = [
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
    label: "What-if: show one sample brief before signup",
    description: "A hypothetical public sample is shown before account creation; no sample library is claimed to exist.",
    kind: "what-if",
    live_feature: false,
    hypothetical: true,
  },
  {
    id: "source-demo",
    label: "What-if: demo checkable sources",
    description: "A hypothetical source-by-source evidence walkthrough is presented; this is a test, not a current feature claim.",
    kind: "what-if",
    live_feature: false,
    hypothetical: true,
  },
  {
    id: "club-pilot",
    label: "What-if: invite a club to a guided pilot",
    description: "A hypothetical group trial with a coach or coordinator; no delegation price is invented.",
    kind: "what-if",
    live_feature: false,
    hypothetical: true,
  },
];

function deterministicPick(seed, options) {
  return options[stableHash(seed) % options.length];
}

function socialPost(persona, answer, stance, round, platform, event) {
  const name = persona.name;
  const baseByStance = {
    "group-adoption": `${name}: I'd test the 3-day workspace with our club before we decide anything. Who would review the brief with us?`,
    "needs-evidence": `${name}: The no-card trial helps me try it. I still need to open the sources before I would speak from the brief.`,
    "needs-social-proof": `${name}: I want a real delegate's example, not a polished claim. Has anyone in our circuit tried it?`,
    "trial-curious": `${name}: Three free days without a card is enough to test one real committee brief before choosing a pass.`,
    "coach-led": `${name}: Our coach and templates already cover some of this. A guided comparison would be more convincing than another AI pitch.`,
    "price-check": `${name}: ₹199 for the week could fit one conference; I would compare it with the ₹299 month after trying the workflow.`,
    "value-check": `${name}: I want to see how a MUN-specific brief differs from a prompt I can already write myself.`,
  };
  const injected = event?.id === "source-demo"
    ? `${name}: In this what-if, a source-by-source walkthrough answers my biggest question—but I would still click through and verify it myself.`
    : event?.id === "sample-brief"
      ? `${name}: If a sample brief were public, I could judge the format before signing up. That's a hypothetical, not something I have seen yet.`
      : event?.id === "club-pilot"
        ? `${name}: A coach-led club pilot could show whether the workflow fits a real delegation. We would need to review the output together.`
        : event?.id === "trial-live"
          ? `${name}: I can try the three-day no-card trial on my own committee before deciding whether to pay.`
          : null;
  const baselineText = baseByStance[stance] || baseByStance["value-check"];
  const content = round === 1 || platform === "twitter"
    ? (injected && round > 1 ? injected : baselineText)
    : (round % 2 === 0
      ? `I would ask my coach or a senior to review this first. ${answer.objection || persona.objection || "I still want to see the output."}`
      : baselineText);
  return content;
}

function actionTypeFor(seed, platform, round) {
  const twitterTypes = ["POST", "LIKE", "REPOST", "QUOTE", "FOLLOW", "IDLE"];
  const redditTypes = ["POST", "COMMENT", "LIKE", "DISLIKE", "SEARCH", "TREND", "FOLLOW", "MUTE", "REFRESH", "IDLE"];
  const types = platform === "twitter" ? twitterTypes : redditTypes;
  const preferred = round === 1 ? (platform === "twitter" ? "POST" : "POST") : null;
  return preferred || deterministicPick(`${seed}:${platform}:${round}`, types);
}

function makeActions(platform, event) {
  const actions = [];
  for (let round = 1; round <= 5; round += 1) {
    for (const { persona, answer, stance, profile } of agents) {
      const actionType = actionTypeFor(`${panel.seed}:${persona.id}`, platform, round);
      const content = socialPost(persona, answer, stance, round, platform, event);
      actions.push({
        round,
        time: `T+${round * 6}h`,
        platform,
        action_type: actionType,
        agent_id: persona.id,
        agent_name: persona.name,
        user_name: profile.user_name,
        persona_stance: stance,
        content: actionType === "IDLE" ? "Agent observed the thread without posting." : content,
        target: actionType === "COMMENT" || actionType === "QUOTE" ? "MUN Prep trial conversation" : null,
        reaction_delta: actionType === "LIKE" || actionType === "REPOST" ? 1 : actionType === "DISLIKE" ? -1 : 0,
        injected_event: event.id,
        synthetic: true,
      });
    }
  }
  return actions;
}

const baselineEvent = scenarioEvents[0];
const twitterActions = makeActions("twitter", baselineEvent);
const redditActions = makeActions("reddit", baselineEvent);

const stanceCounts = agents.reduce((counts, agent) => {
  counts[agent.stance] = (counts[agent.stance] || 0) + 1;
  return counts;
}, {});
const reactions = {
  generated_at: `${currentDate}T00:00:00.000Z`,
  source_panel: "founder/panel/personas.json + founder/panel/answers/P001.json–P040.json",
  scenario_snapshot: scenario.snapshot,
  sample_size: agents.length,
  methodology: "Deterministic, rule-based replay of existing synthetic panel memories against the current product snapshot. It creates no new human evidence, and its stances are not purchase predictions.",
  counts_by_modeled_stance: stanceCounts,
  agents: agents.map(({ reaction }) => reaction),
};

const reportSections = [
  { id: "scenario", title: "Scenario & scope", status: "complete" },
  { id: "signals", title: "Signals agents carry forward", status: "complete" },
  { id: "reactions", title: "What the product changes", status: "complete" },
  { id: "next-tests", title: "Experiments worth running", status: "complete" },
  { id: "limits", title: "Evidence boundary", status: "complete" },
];

const outline = {
  title: "MUN Prep App · synthetic swarm replay",
  generated_at: `${currentDate}T00:00:00.000Z`,
  scenario_question: scenario.question,
  sections: reportSections,
  toolchain: [
    { name: "QuickSearch", purpose: "Retrieve relevant panel memories and current product facts." },
    { name: "PanoramaSearch", purpose: "Map broad concerns, segments, and temporal relationships." },
    { name: "InsightForge", purpose: "Attribute the strongest frictions to evidence and scenario changes." },
    { name: "InterviewSubAgent", purpose: "Ask selected synthetic profiles what would change their view." },
  ],
};

const logEntries = [
  { at: `${currentDate}T00:00:01.000Z`, stage: "retrieval", action: "tool_call", tool_name: "QuickSearch", query: "3-day trial, card requirement, ₹199 / ₹299 current offer", details: { retrieved_from: ["lib/plans.ts", "founder/offer.md"], external_calls: 0 } },
  { at: `${currentDate}T00:00:02.000Z`, stage: "retrieval", action: "tool_result", tool_name: "QuickSearch", details: { product_facts: 4, caveat: "No claim that source-linked citations or public testimonials are already solved." } },
  { at: `${currentDate}T00:00:03.000Z`, stage: "mapping", action: "tool_call", tool_name: "PanoramaSearch", query: "all 40 synthetic profiles, segments, concerns, habits, and flip conditions", details: { nodes: graphNodes.length, edges: graphEdges.length, temporal_memories: graphEdges.length } },
  { at: `${currentDate}T00:00:04.000Z`, stage: "attribution", action: "tool_call", tool_name: "InsightForge", query: "Does a free trial resolve price, trust, or coach substitution?", details: { comparison: "archived synthetic answer vs current product snapshot", purchase_forecast: false } },
  { at: `${currentDate}T00:00:05.000Z`, stage: "interview", action: "tool_call", tool_name: "InterviewSubAgent", query: "What would change your mind after the product snapshot changed?", details: { synthetic_agents: agents.length, independent_humans: 0, external_llm_calls: 0 } },
  { at: `${currentDate}T00:00:06.000Z`, stage: "report", action: "report_complete", tool_name: null, details: { sections: reportSections.length, evidence_class: "synthetic, deterministic, exploratory only" } },
];

const currentReasons = Object.entries(stanceCounts)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .map(([stance, count]) => `- **${stance.replace(/-/g, " ")} — ${count} profiles.** A modeled replay category, not a purchase-intent count.`)
  .join("\n");

const report = `# MUN Prep App · synthetic swarm replay

> **Read this before interpreting the output.** The 40 profiles used here come from the existing *synthetic* founder panel. This deterministic local replay is not the MiroFish runtime, has no external LLM/OASIS/Zep calls, and creates no independent human evidence. Stance counts are not a conversion forecast. The original panel's pre-trial answers are memories, not fresh reactions from real delegates.

## Scenario

${scenario.question}

The current snapshot includes a **3-day free trial without a payment card**, ₹199 for a weekly pass, ₹299 for a monthly pass, and the research, country-policy, position-paper, speech, POI, resolution, course, and glossary workspaces. The prior synthetic panel was written against an older pay-first offer. This replay deliberately preserves that time boundary.

## Signals in the replay

${currentReasons}

### What the current trial appears to change

The trial is a concrete risk-reversal: trial-curious profiles can inspect the workflow before payment. It does **not** by itself answer whether facts are verifiable, whether a coach endorses the output, or whether the product is distinct from free general-purpose AI. Those remain product-proof questions, not copy problems.

### What not to infer

- Do not describe these modeled categories as 40 new votes, 40 independent agents, customers, or validated intent.
- The archived panel's original 9/40 (22.5%) buy result belongs to the prior synthetic offer and should not be re-labeled as the conversion rate for the current product.
- The source-evidence walkthrough, public sample brief, and club pilot are **what-if experiments** in the interactive console, not claims about features already shipped.
- No testimonial or named customer endorsement is created by this simulation.

## Experiments worth running with real delegates

1. Put a real committee brief in front of delegates during the trial and ask them to verify the underlying claims.
2. Ask a coach to review one output and record the criticism, not only the praise.
3. Test a consented, real sample brief before signup; do not manufacture a success story.
4. Ask club coordinators whether a guided pilot has value before setting a delegation price.
5. Measure actual trial activation and trial-to-paid conversion, segmented by conference timing and acquisition source.

## Method and provenance

- Seed: ${panel.seed}; profiles: ${agents.length}; timeline: five rounds on two simulated platforms.
- Inputs: 'founder/customer.json', 'founder/panel/personas.json', the 40 answer files, 'founder/panel/results.json', and the current product plan in 'lib/plans.ts'.
- Engine: transparent, deterministic scenario templates and memory tags; no network access and no model inference.
- MiroFish reference: https://github.com/666ghj/MiroFish. The five-stage workflow vocabulary is used as a design reference; this artifact is not an upstream-engine run.
`;

const reactionMarkdown = `# Post-swarm reactions · MUN Prep App

> **Synthetic replay, not research evidence.** These are rule-based, modeled reactions from the repository's original 40 synthetic panel personas after exposing their prior concern/flip-condition memory to the current product snapshot (3-day no-card trial, ₹199 weekly / ₹299 monthly). No new people were interviewed and no live LLM was called. Do not treat the counts as new votes or purchase forecasts.

- Profiles replayed: **${agents.length}**
- Scenario snapshot: **${scenario.snapshot}**
- Product change highlighted: **3-day free trial, no card required**
- Current evidence gap: **verifiable sources and independent delegate proof still need real validation**

## Modeled stance tags

${currentReasons}

## Agent-by-agent replay

| ID | Synthetic persona | Segment | Modeled stance | Current-snapshot reaction |
| --- | --- | --- | --- | --- |
${agents.map(({ reaction }) => `| ${reaction.id} | ${reaction.display_name} | ${reaction.segment.replace(/\|/g, "\\|")} | ${reaction.stance} | ${reaction.current_reaction.replace(/\|/g, "\\|")} |`).join("\n")}

## Interpretation guardrails

- This is a scenario replay, not a replication of independent sub-agents and not a live simulation in the upstream MiroFish engine.
- Archived quotes in founder/panel/answers/ predate the current trial and remain unchanged. This file does not overwrite the panel's original findings.
- Use these reactions to frame real user interviews. Replace model outputs with actual evidence before changing pricing, positioning, or product scope.
`;

const simulationConfig = {
  simulation_id: "mun-prep-swarm-2026-10-15",
  seed: panel.seed,
  engine: "local deterministic MiroFish-inspired replay",
  external_services: [],
  agents: { count: agents.length, profile_source: "founder/panel/personas.json", memory_source: "founder/panel/answers/P001.json–P040.json" },
  timeline: { rounds: 5, hours_per_round: 6, timezone: "Asia/Kolkata" },
  time_simulation_config: {
    start_time: `${currentDate}T09:00:00+05:30`,
    step_hours: 6,
    round_count: 5,
    timezone: "Asia/Kolkata",
    memory_policy: "Append-only action episodes; base persona snapshots are immutable.",
  },
  agent_activity_config: {
    max_actions_per_agent_per_platform_per_round: 1,
    action_selection: "Deterministic hash of seed, profile ID, platform, round, and injected event.",
    active_platforms: ["twitter", "reddit"],
    action_types: {
      twitter: ["POST", "LIKE", "REPOST", "QUOTE", "FOLLOW", "IDLE"],
      reddit: ["POST", "COMMENT", "LIKE", "DISLIKE", "SEARCH", "TREND", "FOLLOW", "MUTE", "REFRESH", "IDLE"],
    },
  },
  platforms: [
    { id: "twitter", name: "Info Plaza", action_types: ["POST", "LIKE", "REPOST", "QUOTE", "FOLLOW", "IDLE"] },
    { id: "reddit", name: "Topic Community", action_types: ["POST", "COMMENT", "LIKE", "DISLIKE", "SEARCH", "TREND", "FOLLOW", "MUTE", "REFRESH", "IDLE"] },
  ],
  event_config: {
    event_injection_mode: "Operator-controlled God's-eye event before each round.",
    baseline_event_id: baselineEvent.id,
    events: scenarioEvents,
  },
  god_eye_events: scenarioEvents,
  caveats: [
    "All agents and social actions are synthetic and generated from existing synthetic panel inputs.",
    "No independent LLM agents, OASIS runtime, or external graph database is used.",
    "A scenario stance is not a purchase prediction or evidence of customer demand.",
  ],
};

const runState = {
  simulation_id: "mun-prep-swarm-2026-10-15",
  status: "completed",
  generated_at: `${currentDate}T00:00:00.000Z`,
  stage: "report_complete",
  seed: panel.seed,
  rounds_completed: 5,
  agent_count: agents.length,
  graph: { nodes: graphNodes.length, edges: graphEdges.length },
  platforms: {
    twitter: { actions: twitterActions.length },
    reddit: { actions: redditActions.length },
  },
  modeled_stance_counts: stanceCounts,
  baseline_reference: {
    buys: baseline.buys,
    passes: baseline.passes,
    total: baseline.answered,
    rate: baseline.buy_rate,
    label: "Original synthetic panel result for the prior pay-first offer; not a current conversion estimate.",
  },
  runtime_boundary: "Offline deterministic replay; no real users, external LLM, OASIS, or Zep.",
};

const outDir = path.join(root, "founder/mirofish");
mkdirSync(outDir, { recursive: true });
writeJson("founder/mirofish/ontology.json", ontology);
writeJson("founder/mirofish/graph.json", graph);
writeJson("founder/mirofish/oasis_profiles.json", oasisProfiles);
writeJson("founder/mirofish/simulation_config.json", simulationConfig);
writeJson("founder/mirofish/run_state.json", runState);
writeJson("founder/mirofish/outline.json", outline);
writeJsonl("founder/mirofish/twitter_actions.jsonl", twitterActions);
writeJsonl("founder/mirofish/reddit_actions.jsonl", redditActions);
writeJsonl("founder/mirofish/agent_log.jsonl", logEntries);
writeFileSync(path.join(outDir, "report.md"), `${report}\n`);
writeJson("founder/panel/swarm-reactions.json", reactions);
writeFileSync(path.join(root, "founder/panel/swarm-reactions.md"), `${reactionMarkdown}\n`);

console.log(`Generated ${agents.length} synthetic agent profiles across two 5-round timelines.`);
console.log(`Graph: ${graphNodes.length} nodes, ${graphEdges.length} edges.`);
console.log(`Modeled stance tags: ${JSON.stringify(stanceCounts)}`);
console.log("No human data, live LLM calls, or purchase forecasts were added.");
