import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  answerAgent,
  buildScenarioReport,
  simulateRound,
  surveyProfileSignals,
} from "@/lib/mirofish/engine";
import type { AgentProfile, GodEyeEvent } from "@/lib/mirofish/simulation-data";

const liveTrial: GodEyeEvent = {
  id: "trial-live",
  label: "3-day free trial is live",
  description: "Three days without a card.",
  kind: "product",
  live_feature: true,
  hypothetical: false,
};

const sourceWhatIf: GodEyeEvent = {
  id: "source-demo",
  label: "What-if: demonstrate checkable sources",
  description: "A hypothetical source walkthrough.",
  kind: "what-if",
  live_feature: false,
  hypothetical: true,
};

function makeAgent(id: string, stance: AgentProfile["stance"]): AgentProfile {
  return {
    id,
    userId: Number(id.slice(1)),
    handle: id.toLowerCase(),
    name: id === "P001" ? "Aisha" : "Emil",
    age: 18,
    country: "India",
    segment: "Synthetic delegate",
    behavior: "Checks evidence before using a claim.",
    bio: "Synthetic test profile.",
    stance,
    currentReaction: "I want a real committee example before deciding.",
    priorReasonCode: stance === "needs-evidence" ? "trust" : "quality",
    priorQuote: "I would open the source myself.",
    priorObjection: "I need facts I can verify.",
    flipCondition: "If every claim came with a source I could open.",
    persona: {
      experience: "Has attended a school conference.",
      behavior: "Reviews sources.",
      memory: "Prior synthetic panel memory.",
      social: "Asks a coach before paying.",
    },
  };
}

const agents = [makeAgent("P001", "needs-evidence"), makeAgent("P002", "trial-curious")];

describe("MiroFish-inspired local scenario engine", () => {
  it("creates deterministic paired-platform actions for each synthetic profile", () => {
    const first = simulateRound(2, agents, liveTrial);
    const second = simulateRound(2, agents, liveTrial);

    assert.equal(first.length, agents.length * 2);
    assert.deepEqual(first, second);
    assert.deepEqual(new Set(first.map((action) => action.platform)), new Set(["twitter", "reddit"]));
    assert.ok(first.every((action) => action.synthetic && action.round === 2));
  });

  it("changes the evidence-concern response for a clearly marked what-if", () => {
    const actions = simulateRound(2, agents, sourceWhatIf);
    const evidenceAgentActions = actions.filter((action) => action.agentId === "P001");

    assert.equal(evidenceAgentActions.length, 2);
    assert.ok(evidenceAgentActions.some((action) => action.content.includes("source-by-source walkthrough")));
    assert.ok(evidenceAgentActions.every((action) => action.sentiment === "curious"));
    assert.ok(evidenceAgentActions.every((action) => action.injectionId === "source-demo"));
  });

  it("aggregates only existing memory tags for a focused question", () => {
    const focused = surveyProfileSignals("How could delegates verify sources and evidence?", [
      makeAgent("P001", "needs-evidence"),
      makeAgent("P002", "needs-social-proof"),
      makeAgent("P003", "trial-curious"),
    ]);

    assert.equal(focused.reduce((sum, item) => sum + item.count, 0), 3);
    assert.equal(focused[0]?.label, "Evidence or peer-proof memory");
    assert.equal(focused[0]?.count, 2);
    assert.equal(focused[1]?.count, 1);
  });

  it("answers locally from a persona memory without pretending to interview a person", () => {
    const reply = answerAgent(agents[0], "Can I verify the sources?");
    assert.match(reply, /open a source/i);
    assert.match(answerAgent(agents[1], "What does the trial change?"), /Three days with no card/i);
  });

  it("builds a report with a tool trace and no purchase forecast", () => {
    const events = simulateRound(1, agents, liveTrial);
    const report = buildScenarioReport(1, agents, events, liveTrial);

    assert.equal(report.trace.length, 4);
    assert.equal(report.sections.length, 4);
    assert.match(report.sections[0]?.body || "", /not new people/i);
    assert.match(report.snapshot, /3-day free trial/);
  });
});
