"use client";

import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  BrainCircuit,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Compass,
  Database,
  FileSearch,
  GitBranch,
  Globe2,
  Layers3,
  Lightbulb,
  MessageCircle,
  MessageSquareText,
  Network,
  Pause,
  Play,
  Quote,
  Radar,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Users,
  Waypoints,
  Zap,
} from "lucide-react";
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  answerAgent,
  buildScenarioReport,
  simulateRound,
  surveyProfileSignals,
  type ReportSection,
  type ScenarioReport,
  type SimAction,
  type SimPlatform,
} from "@/lib/mirofish/engine";
import {
  evidenceCaveat,
  godEyeEvents,
  graphEdges,
  graphNodes,
  scenarioSeed,
  seededAgents,
  stanceMeta,
  type AgentProfile,
  type GraphNode,
  type GodEyeEvent,
} from "@/lib/mirofish/simulation-data";

type ChatLine = { role: "agent" | "delegate"; content: string };
type ConsoleStep = { id: number; name: string; sub: string; icon: typeof Network };

const steps: ConsoleStep[] = [
  { id: 0, name: "Graph Build", sub: "Map the seed", icon: Network },
  { id: 1, name: "Env Setup", sub: "Shape the room", icon: Layers3 },
  { id: 2, name: "Simulation", sub: "Run both feeds", icon: Activity },
  { id: 3, name: "Report Agent", sub: "Read the signals", icon: FileSearch },
  { id: 4, name: "Deep Interaction", sub: "Ask the agents", icon: MessageCircle },
];

const initialActions = simulateRound(1, seededAgents, godEyeEvents[0]);
const initialReport = buildScenarioReport(1, seededAgents, initialActions, godEyeEvents[0]);
const initialSurveyPrompt = "What would most increase confidence in trying MUN Prep?";

const graphPointById: Record<string, { x: number; y: number }> = {
  app_mun_prep: { x: 460, y: 250 },
  offer_trial_3d: { x: 460, y: 55 },
  offer_weekly_199: { x: 700, y: 115 },
  offer_monthly_299: { x: 700, y: 360 },
  feature_research: { x: 460, y: 455 },
  feature_writing: { x: 220, y: 360 },
  feature_debate: { x: 220, y: 135 },
  trust_sources: { x: 315, y: 45 },
  trust_peer_proof: { x: 605, y: 45 },
  concern_coach: { x: 70, y: 250 },
  concern_generic_ai: { x: 850, y: 250 },
};

const coreLabelById: Record<string, string> = {
  app_mun_prep: "MUN Prep",
  offer_trial_3d: "3-day trial",
  offer_weekly_199: "₹199 · week",
  offer_monthly_299: "₹299 · month",
  feature_research: "Research",
  feature_writing: "Papers + speeches",
  feature_debate: "POIs + clauses",
  trust_sources: "Source proof",
  trust_peer_proof: "Peer proof",
  concern_coach: "Coach / school",
  concern_generic_ai: "Generic AI",
};

const stanceColors: Record<string, string> = {
  "trial-curious": "#8ad1bd",
  "needs-evidence": "#f1bb72",
  "needs-social-proof": "#e5a4a6",
  "coach-led": "#c2b0e6",
  "group-adoption": "#91b6e7",
  "price-check": "#f2d780",
  "value-check": "#a9c79a",
};

const stageCopy = [
  {
    eyebrow: "01 / Knowledge graph",
    title: "Start with the product, not a generic prompt.",
    description: "A compact GraphRAG-style map connects the live offer, preparation tools, and the questions carried by the existing synthetic panel.",
  },
  {
    eyebrow: "02 / Environment setup",
    title: "Give the room a memory before it speaks.",
    description: "Inspect the four persona dimensions, choose the timeline depth, and see exactly which synthetic profiles are in the sandbox.",
  },
  {
    eyebrow: "03 / Dual-platform simulation",
    title: "Watch the same launch travel two feeds.",
    description: "Advance Info Plaza and Topic Community together. Inject a live fact or a clearly marked what-if into the next round.",
  },
  {
    eyebrow: "04 / ReACT report agent",
    title: "Turn the activity into a cautious read.",
    description: "Trace the local tool calls, separate signal from evidence, and leave with real-world tests—not a made-up conversion forecast.",
  },
  {
    eyebrow: "05 / Deep interaction",
    title: "Ask one persona—or survey the whole room.",
    description: "Interview a memory-grounded agent or aggregate the panel's remembered priorities. Every answer stays in this browser.",
  },
];

function getInitials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatActionLabel(actionType: string) {
  return actionType.replace(/_/g, " ").toLowerCase();
}

function SentimentPill({ sentiment }: { sentiment: SimAction["sentiment"] }) {
  const style: Record<SimAction["sentiment"], string> = {
    open: "border-emerald-200/70 bg-emerald-50 text-emerald-800",
    curious: "border-sky-200/80 bg-sky-50 text-sky-800",
    conditional: "border-amber-200/80 bg-amber-50 text-amber-900",
    skeptical: "border-rose-200/80 bg-rose-50 text-rose-800",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] ${style[sentiment]}`}>
      {sentiment}
    </span>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="label-text text-[var(--patina)]">{eyebrow}</p>
        <h2 className="display-type mt-2 text-3xl leading-tight sm:text-4xl">{title}</h2>
      </div>
      <p className="max-w-xl text-sm leading-6 text-[var(--muted)] sm:text-right">{description}</p>
    </div>
  );
}

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "amber" | "red" }) {
  const toneClass = {
    neutral: "border-[var(--line)] bg-white/50 text-[var(--muted)]",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-rose-200 bg-rose-50 text-rose-800",
  }[tone];
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{children}</span>;
}

function MetricCard({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Activity }) {
  return (
    <div className="surface rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="label-text text-[0.65rem]">{label}</p>
        <Icon className="h-4 w-4 text-[var(--patina)]" aria-hidden="true" />
      </div>
      <p className="display-type mt-3 text-3xl">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{note}</p>
    </div>
  );
}

function DimensionCard({ label, text, icon: Icon, index }: { label: string; text: string; icon: typeof Activity; index: number }) {
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-white/45 p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--patina)]/10 text-[var(--patina)]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="label-text text-[0.62rem]">Memory {String(index).padStart(2, "0")}</p>
          <h4 className="mt-0.5 text-sm font-bold">{label}</h4>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{text}</p>
    </article>
  );
}

function getGraphPositions() {
  const agents = graphNodes.filter((node) => node.ui_group === "agent");
  const positions = new Map<string, { x: number; y: number }>();
  for (const node of graphNodes) {
    if (node.ui_group === "agent") continue;
    const point = graphPointById[node.uuid];
    if (point) positions.set(node.uuid, point);
  }
  agents.forEach((node, index) => {
    const angle = (index / Math.max(agents.length, 1)) * Math.PI * 2 - Math.PI / 2;
    positions.set(node.uuid, {
      x: 460 + Math.cos(angle) * 136,
      y: 250 + Math.sin(angle) * 136,
    });
  });
  return positions;
}

const graphPositions = getGraphPositions();
const graphAgentByNodeId: Map<string, AgentProfile> = new Map(seededAgents.map((agent) => [`agent_${agent.id}`, agent] as const));

function GraphCanvas({ selectedId }: { selectedId: string }) {
  return (
    <div className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#191d1b]">
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(29,111,104,0.32),transparent_34%)]" />
        <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:28px_28px]" />
      </div>
      <div className="relative flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2 text-white">
          <Waypoints className="h-4 w-4 text-[#8ad1bd]" aria-hidden="true" />
          <span className="text-sm font-semibold">GraphRAG · temporal memory</span>
        </div>
        <span className="mono-type text-[0.65rem] uppercase tracking-[0.14em] text-white/45">51 nodes / 88 edges</span>
      </div>
      <div className="relative overflow-x-auto">
        <svg
          className="mx-auto block min-w-[720px] max-w-full"
          viewBox="0 0 920 510"
          role="img"
          aria-label="Relationship graph connecting the MUN Prep product, offers, delegate agents, and trust concerns"
        >
          <g stroke="#ded7ca" strokeOpacity="0.12" strokeWidth="1">
            {graphEdges.map((edge) => {
              const source = graphPositions.get(edge.source_node_uuid);
              const target = graphPositions.get(edge.target_node_uuid);
              if (!source || !target) return null;
              return <line key={edge.uuid} x1={source.x} y1={source.y} x2={target.x} y2={target.y} />;
            })}
          </g>
          <g>
            {graphNodes.filter((node) => node.ui_group === "agent").map((node) => {
              const point = graphPositions.get(node.uuid);
              const agent = graphAgentByNodeId.get(node.uuid);
              if (!point || !agent) return null;
              return (
                <circle
                  key={node.uuid}
                  cx={point.x}
                  cy={point.y}
                  r={selectedId === node.uuid ? 5 : 3.5}
                  fill={stanceColors[agent.stance] || "#a9c79a"}
                  opacity={selectedId === node.uuid ? 1 : 0.78}
                />
              );
            })}
          </g>
          <g>
            {graphNodes.filter((node) => node.ui_group !== "agent").map((node) => {
              const point = graphPositions.get(node.uuid);
              if (!point) return null;
              const selected = node.uuid === selectedId;
              const isApp = node.uuid === "app_mun_prep";
              const color = node.ui_group === "trust" ? "#e5a4a6" : node.ui_group === "concern" ? "#f1bb72" : node.ui_group === "offer" ? "#8ad1bd" : "#91b6e7";
              return (
                <g key={node.uuid}>
                  {selected ? <circle cx={point.x} cy={point.y} r={isApp ? 25 : 17} fill="none" stroke={color} strokeOpacity="0.45" strokeWidth="1.5" /> : null}
                  <circle cx={point.x} cy={point.y} r={isApp ? 15 : 9} fill={selected ? color : "#252d29"} stroke={color} strokeWidth={selected ? 2 : 1.3} />
                  <circle cx={point.x} cy={point.y} r={isApp ? 5 : 2.5} fill={selected ? "#171b19" : color} opacity="0.95" />
                  <text
                    x={point.x}
                    y={point.y + (point.y < 75 ? 23 : point.y > 425 ? -20 : 25)}
                    fill="#f7f3ea"
                    fontSize={isApp ? 12 : 10}
                    fontWeight={isApp ? 700 : 600}
                    textAnchor="middle"
                    opacity="0.9"
                  >
                    {coreLabelById[node.uuid] || node.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 px-4 py-3 text-[0.68rem] text-white/60 sm:px-5">
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#8ad1bd]" /> Offer</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#91b6e7]" /> Product tool</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#e5a4a6]" /> Trust question</span>
        <span className="ml-auto inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/80" /> 40 synthetic agents</span>
      </div>
    </div>
  );
}

function GraphNodeCard({ node, active, onClick }: { node: GraphNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-3 text-left transition ${active ? "border-[var(--patina)] bg-[var(--patina)]/10 shadow-sm" : "border-[var(--line)] bg-white/45 hover:border-black/20 hover:bg-white/75"}`}
      aria-pressed={active}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{node.name}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{node.summary}</p>
        </div>
        <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "text-[var(--patina)]" : "text-[var(--muted)]"}`} aria-hidden="true" />
      </div>
    </button>
  );
}

function AgentAvatar({ agent, size = "sm" }: { agent: AgentProfile; size?: "sm" | "lg" }) {
  const sizeClass = size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-xs";
  const color = stanceColors[agent.stance] || "#a9c79a";
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-xl border font-bold ${sizeClass}`}
      style={{ borderColor: `${color}88`, backgroundColor: `${color}20`, color }}
      aria-hidden="true"
    >
      {getInitials(agent.name)}
    </span>
  );
}

function AgentListRow({ agent, active, onClick }: { agent: AgentProfile; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${active ? "bg-[var(--ink)] text-[var(--paper)]" : "hover:bg-black/5"}`}
      aria-pressed={active}
    >
      <AgentAvatar agent={agent} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold">{agent.name}</span>
          <span className={`mono-type text-[0.6rem] ${active ? "text-white/55" : "text-[var(--muted)]"}`}>{agent.id}</span>
        </span>
        <span className={`mt-0.5 block truncate text-xs ${active ? "text-white/65" : "text-[var(--muted)]"}`}>{stanceMeta[agent.stance].label}</span>
      </span>
    </button>
  );
}

function ToolTraceCard({ name, purpose, detail, index }: { name: string; purpose: string; detail: string; index: number }) {
  const Icon = name === "QuickSearch" ? Search : name === "PanoramaSearch" ? Compass : name === "InsightForge" ? BrainCircuit : MessageSquareText;
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-white/55 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--ink)] text-[var(--paper)]"><Icon className="h-4 w-4" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-mono text-sm font-bold">{name}</h4>
            <span className="mono-type text-[0.63rem] uppercase tracking-[0.12em] text-[var(--muted)]">trace {String(index + 1).padStart(2, "0")}</span>
          </div>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{purpose}</p>
          <p className="mt-2 rounded-lg bg-black/[0.035] px-3 py-2 text-xs leading-5 text-[var(--ink)]">{detail}</p>
        </div>
      </div>
    </article>
  );
}

function ReportSectionCard({ section, index }: { section: ReportSection; index: number }) {
  return (
    <article className="relative rounded-2xl border border-[var(--line)] bg-white/55 p-5">
      <div className="flex items-start gap-3">
        <span className="mono-type grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--ink)] text-[0.68rem] font-bold text-[var(--paper)]">{String(index + 1).padStart(2, "0")}</span>
        <div>
          <h3 className="text-sm font-bold">{section.title}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{section.body}</p>
          {section.emphasis ? <p className="mt-3 border-l-2 border-[var(--brass)] pl-3 text-xs font-semibold leading-5 text-[var(--ink)]">{section.emphasis}</p> : null}
        </div>
      </div>
    </article>
  );
}

function ActionCard({ action, agent }: { action: SimAction; agent?: AgentProfile }) {
  const PlatformIcon = action.platform === "twitter" ? Globe2 : MessageCircle;
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-white/55 p-4 transition hover:bg-white/80">
      <div className="flex items-start gap-3">
        {agent ? <AgentAvatar agent={agent} /> : <span className="grid h-9 w-9 place-items-center rounded-xl bg-black/5"><PlatformIcon className="h-4 w-4" aria-hidden="true" /></span>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-bold">{action.agentName}</span>
            <span className="mono-type text-[0.65rem] text-[var(--muted)]">@{action.handle}</span>
            <span className="ml-auto inline-flex items-center gap-1 text-[0.65rem] font-semibold text-[var(--muted)]"><PlatformIcon className="h-3.5 w-3.5" aria-hidden="true" />{action.platform === "twitter" ? "Info Plaza" : "Topic Community"}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-black/[0.055] px-2 py-0.5 text-[0.63rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{formatActionLabel(action.actionType)}</span>
            <SentimentPill sentiment={action.sentiment} />
            <span className="mono-type text-[0.62rem] text-[var(--muted)]">R{action.round} · {action.time}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--ink)]">{action.content}</p>
        </div>
      </div>
    </article>
  );
}

function getSurveyBarColor(stance: string) {
  return stanceColors[stance] || "#8ad1bd";
}

/** Five-stage, browser-local MiroFish-inspired simulation console. */
export function MirofishConsole() {
  const [activeStep, setActiveStep] = useState(0);
  const [highestStep, setHighestStep] = useState(0);
  const [graphSearch, setGraphSearch] = useState("");
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState("app_mun_prep");
  const [graphBuild, setGraphBuild] = useState(1);
  const [profileSearch, setProfileSearch] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("P002");
  const [maxRounds, setMaxRounds] = useState(5);
  const [round, setRound] = useState(1);
  const [selectedInjectionId, setSelectedInjectionId] = useState(godEyeEvents[0].id);
  const [lastInjection, setLastInjection] = useState<GodEyeEvent>(godEyeEvents[0]);
  const [events, setEvents] = useState<SimAction[]>(initialActions);
  const [platformFilter, setPlatformFilter] = useState<"all" | SimPlatform>("all");
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<ScenarioReport>(initialReport);
  const [showTrace, setShowTrace] = useState(false);
  const [interactionMode, setInteractionMode] = useState<"chat" | "survey">("chat");
  const [chatLines, setChatLines] = useState<ChatLine[]>([
    { role: "agent", content: seededAgents.find((agent) => agent.id === "P002")?.currentReaction || "I would want to check the sources before using the brief." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [surveyPrompt, setSurveyPrompt] = useState(initialSurveyPrompt);
  const [surveyResults, setSurveyResults] = useState(() => surveyProfileSignals(initialSurveyPrompt, seededAgents));
  const [surveyComplete, setSurveyComplete] = useState(true);
  const [surveyNote, setSurveyNote] = useState("");
  const [runNotice, setRunNotice] = useState("");
  const timerRef = useRef<number | null>(null);

  const selectedAgent = seededAgents.find((agent) => agent.id === selectedAgentId) || seededAgents[0];
  const selectedInjection = godEyeEvents.find((event) => event.id === selectedInjectionId) || godEyeEvents[0];
  const selectedGraphNode = graphNodes.find((node) => node.uuid === selectedGraphNodeId) || graphNodes[0];
  const coreNodes = useMemo(() => graphNodes.filter((node) => node.ui_group !== "agent"), []);
  const filteredGraphNodes = coreNodes.filter((node) =>
    `${node.name} ${node.summary} ${node.labels.join(" ")}`.toLowerCase().includes(graphSearch.trim().toLowerCase())
  );
  const filteredAgents = useMemo(() => {
    const query = profileSearch.trim().toLowerCase();
    if (!query) return seededAgents;
    return seededAgents.filter((agent) =>
      `${agent.id} ${agent.name} ${agent.segment} ${agent.behavior} ${stanceMeta[agent.stance].label}`.toLowerCase().includes(query)
    );
  }, [profileSearch]);
  const visibleActions = events
    .filter((action) => platformFilter === "all" || action.platform === platformFilter)
    .slice()
    .reverse()
    .slice(0, 16);
  const eventCounts = useMemo(() => {
    const byPlatform = { twitter: 0, reddit: 0 };
    for (const event of events) byPlatform[event.platform] += 1;
    return byPlatform;
  }, [events]);
  const completedStages = Math.min(highestStep, steps.length - 1);
  const currentStage = stageCopy[activeStep];
  const isAtRoundLimit = round >= maxRounds;

  function navigateToStep(step: number) {
    setActiveStep(step);
    setHighestStep((value) => Math.max(value, step));
  }

  function clearPendingRun() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function queueTimelineUpdate(nextRound: number, nextEvents: SimAction[], injection: GodEyeEvent) {
    clearPendingRun();
    setIsRunning(true);
    setRunNotice("");
    timerRef.current = window.setTimeout(() => {
      setEvents(nextEvents);
      setRound(nextRound);
      setLastInjection(injection);
      setReport(buildScenarioReport(nextRound, seededAgents, nextEvents, injection));
      setIsRunning(false);
      setRunNotice(`Round ${nextRound} complete · ${nextEvents.length} total platform actions in the timeline.`);
      timerRef.current = null;
    }, 360);
  }

  function runNextRound() {
    if (isRunning || isAtRoundLimit) return;
    const nextRound = round + 1;
    const nextEvents = [...events, ...simulateRound(nextRound, seededAgents, selectedInjection)];
    queueTimelineUpdate(nextRound, nextEvents, selectedInjection);
  }

  function runAllRounds() {
    if (isRunning || isAtRoundLimit) return;
    const nextEvents = [...events];
    let nextRound = round;
    for (let current = round + 1; current <= maxRounds; current += 1) {
      nextRound = current;
      nextEvents.push(...simulateRound(current, seededAgents, selectedInjection));
    }
    queueTimelineUpdate(nextRound, nextEvents, selectedInjection);
  }

  function resetSimulation() {
    clearPendingRun();
    const baselineEvents = simulateRound(1, seededAgents, godEyeEvents[0]);
    setEvents(baselineEvents);
    setRound(1);
    setSelectedInjectionId(godEyeEvents[0].id);
    setLastInjection(godEyeEvents[0]);
    setReport(buildScenarioReport(1, seededAgents, baselineEvents, godEyeEvents[0]));
    setIsRunning(false);
    setRunNotice("Baseline replay restored from the deterministic seed.");
    setPlatformFilter("all");
  }

  function refreshReport() {
    setReport(buildScenarioReport(round, seededAgents, events, lastInjection));
    setShowTrace(false);
  }

  function chooseAgent(agentId: string) {
    const nextAgent = seededAgents.find((agent) => agent.id === agentId) || seededAgents[0];
    setSelectedAgentId(agentId);
    setChatLines([{ role: "agent", content: nextAgent.currentReaction }]);
    setChatInput("");
  }

  function sendChatLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = chatInput.trim().slice(0, 500);
    if (!content || !selectedAgent) return;
    const reply = answerAgent(selectedAgent, content);
    setChatLines((current) => [...current, { role: "delegate", content }, { role: "agent", content: reply }]);
    setChatInput("");
  }

  function submitSurvey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = surveyPrompt.trim().slice(0, 220);
    if (!prompt) return;
    setSurveyPrompt(prompt);
    setSurveyResults(surveyProfileSignals(prompt, seededAgents));
    setSurveyComplete(true);
    setSurveyNote("Re-aggregated the same 40 remembered profile tags; no new agent answers were generated.");
  }

  function setAgentPrompt(prompt: string) {
    setChatInput(prompt);
  }

  function renderGraphStage() {
    const graphAgentCount = graphNodes.filter((node) => node.ui_group === "agent").length;
    return (
      <>
        <SectionHeading
          eyebrow={currentStage.eyebrow}
          title={currentStage.title}
          description={currentStage.description}
        />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(290px,0.8fr)]">
          <div className="space-y-4">
            <GraphCanvas selectedId={selectedGraphNodeId} />
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="Graph nodes" value={String(graphNodes.length)} note={`${graphAgentCount} synthetic delegates + product facts`} icon={Network} />
              <MetricCard label="Relationship edges" value={String(graphEdges.length)} note="Temporal facts with source notes" icon={GitBranch} />
              <MetricCard label="Build version" value={`0${graphBuild}`} note="Reproducible founder-panel seed · 11" icon={Database} />
            </div>
          </div>
          <aside className="surface flex min-h-[32rem] flex-col rounded-[1.6rem] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label-text text-[var(--patina)]">Entity explorer</p>
                <h3 className="display-type mt-1 text-2xl">Knowledge map</h3>
              </div>
              <button
                type="button"
                onClick={() => { setGraphBuild((value) => value + 1); setSelectedGraphNodeId("app_mun_prep"); }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-semibold hover:bg-black/5"
                title="Reload the seeded local graph"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Rebuild
              </button>
            </div>
            <label className="relative mt-4 block">
              <span className="sr-only">Search graph entities</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
              <input className="input-field pl-9 text-sm" value={graphSearch} onChange={(event) => setGraphSearch(event.target.value)} placeholder="Search app, offer, trust…" />
            </label>
            <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1" aria-label="Graph entities">
              {filteredGraphNodes.map((node) => (
                <GraphNodeCard key={node.uuid} node={node} active={selectedGraphNodeId === node.uuid} onClick={() => setSelectedGraphNodeId(node.uuid)} />
              ))}
              {filteredGraphNodes.length === 0 ? <p className="py-8 text-center text-sm text-[var(--muted)]">No graph entities match that search.</p> : null}
            </div>
            {selectedGraphNode ? (
              <div className="mt-4 rounded-xl bg-[var(--ink)] p-4 text-[var(--paper)]">
                <div className="flex items-center gap-2 text-[#8ad1bd]"><Target className="h-4 w-4" aria-hidden="true" /><span className="label-text text-[0.62rem] text-[#8ad1bd]">Selected memory</span></div>
                <p className="mt-2 text-sm font-bold">{selectedGraphNode.name}</p>
                <p className="mt-1 text-xs leading-5 text-white/65">{selectedGraphNode.summary}</p>
                <p className="mono-type mt-3 text-[0.6rem] text-white/35">{selectedGraphNode.uuid}</p>
              </div>
            ) : null}
          </aside>
        </div>
        <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-[var(--line)] bg-white/45 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--patina)]/10 text-[var(--patina)]"><Sparkles className="h-5 w-5" aria-hidden="true" /></span>
            <div><p className="text-sm font-bold">Seed question</p><p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">{scenarioSeed}</p></div>
          </div>
          <button type="button" onClick={() => navigateToStep(1)} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 text-sm font-semibold text-[var(--paper)] hover:bg-[var(--ink)]/85">
            Configure agents <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </>
    );
  }

  function renderEnvironmentStage() {
    const selectedAgentIdForGraph = selectedAgent ? `agent_${selectedAgent.id}` : "";
    return (
      <>
        <SectionHeading eyebrow={currentStage.eyebrow} title={currentStage.title} description={currentStage.description} />
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <MetricCard label="Agent profiles" value={String(seededAgents.length)} note="Replayed from the existing founder panel" icon={Users} />
          <MetricCard label="Memory dimensions" value="04" note="Experience · behavior · memory · social" icon={BrainCircuit} />
          <MetricCard label="Social environments" value="02" note="Info Plaza + Topic Community" icon={Globe2} />
        </div>
        <div className="grid min-h-[37rem] gap-4 xl:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.55fr)]">
          <aside className="surface flex min-h-[32rem] flex-col rounded-[1.6rem] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div><p className="label-text text-[var(--patina)]">OASIS-style profiles</p><h3 className="display-type mt-1 text-2xl">Agent roster</h3></div>
              <Pill><Users className="h-3 w-3" aria-hidden="true" /> 40 profiles</Pill>
            </div>
            <label className="relative mt-4 block">
              <span className="sr-only">Search synthetic agent profiles</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
              <input className="input-field pl-9 text-sm" value={profileSearch} onChange={(event) => setProfileSearch(event.target.value)} placeholder="Search persona, segment, stance…" />
            </label>
            <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
              {filteredAgents.map((agent) => <AgentListRow key={agent.id} agent={agent} active={agent.id === selectedAgentId} onClick={() => chooseAgent(agent.id)} />)}
              {filteredAgents.length === 0 ? <p className="py-8 text-center text-sm text-[var(--muted)]">No profiles match.</p> : null}
            </div>
            <div className="mt-3 border-t border-[var(--line)] pt-3">
              <p className="text-xs leading-5 text-[var(--muted)]">Named personas are synthetic records from the existing founder panel; they are not product users or interviewees.</p>
            </div>
          </aside>
          {selectedAgent ? (
            <section className="surface min-w-0 rounded-[1.6rem] p-4 sm:p-6">
              <div className="flex flex-col justify-between gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-start">
                <div className="flex items-start gap-4">
                  <AgentAvatar agent={selectedAgent} size="lg" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="display-type text-3xl">{selectedAgent.name}</h3><Pill tone="amber">{selectedAgent.id}</Pill></div>
                    <p className="mt-1 text-sm text-[var(--muted)]">{selectedAgent.age} · {selectedAgent.country} · {selectedAgent.segment}</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{selectedAgent.bio}</p>
                  </div>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--line)] bg-white/60 px-3 py-1.5 text-xs font-bold">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stanceColors[selectedAgent.stance] }} />
                  {stanceMeta[selectedAgent.stance].label}
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <DimensionCard index={1} label="Experience" text={selectedAgent.persona.experience} icon={BookOpen} />
                <DimensionCard index={2} label="Behavior" text={selectedAgent.persona.behavior} icon={Activity} />
                <DimensionCard index={3} label="Memory" text={selectedAgent.persona.memory} icon={Database} />
                <DimensionCard index={4} label="Social" text={selectedAgent.persona.social} icon={Users} />
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-rose-200/80 bg-rose-50/65 p-4">
                  <div className="flex items-center gap-2 text-rose-800"><ShieldAlert className="h-4 w-4" aria-hidden="true" /><p className="label-text text-[0.62rem] text-rose-800">Prior synthetic objection</p></div>
                  <p className="mt-2 text-sm leading-6 text-rose-950">{selectedAgent.priorObjection || "No prior objection recorded."}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/65 p-4">
                  <div className="flex items-center gap-2 text-emerald-800"><Lightbulb className="h-4 w-4" aria-hidden="true" /><p className="label-text text-[0.62rem] text-emerald-800">Remembered flip condition</p></div>
                  <p className="mt-2 text-sm leading-6 text-emerald-950">{selectedAgent.flipCondition || "No flip condition recorded."}</p>
                </div>
              </div>
              <div className="mt-5 rounded-2xl bg-[var(--ink)] p-4 text-[var(--paper)] sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3"><Timer className="mt-0.5 h-5 w-5 shrink-0 text-[#8ad1bd]" aria-hidden="true" /><div><p className="text-sm font-bold">Timeline depth</p><p className="mt-1 text-xs leading-5 text-white/55">Choose the maximum paired rounds. Both platforms advance together.</p></div></div>
                  <div className="flex items-center gap-3 sm:min-w-56"><input className="w-full accent-[#8ad1bd]" type="range" min={Math.max(3, round)} max="8" value={Math.max(maxRounds, round)} onChange={(event) => setMaxRounds(Number(event.target.value))} aria-label="Maximum simulation rounds" /><span className="mono-type min-w-10 text-right text-sm text-[#8ad1bd]">{Math.max(maxRounds, round)} / 8</span></div>
                </div>
                <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2"><Pill tone="green"><Globe2 className="h-3 w-3" aria-hidden="true" /> Info Plaza</Pill><Pill tone="green"><MessageCircle className="h-3 w-3" aria-hidden="true" /> Topic Community</Pill></div>
                  <button type="button" onClick={() => navigateToStep(2)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#f7f3ea] px-4 text-sm font-bold text-[var(--ink)] hover:bg-white">
                    Enter simulation <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <span className="sr-only">Selected graph entity is {selectedAgentIdForGraph}</span>
            </section>
          ) : null}
        </div>
      </>
    );
  }

  function renderSimulationStage() {
    return (
      <>
        <SectionHeading eyebrow={currentStage.eyebrow} title={currentStage.title} description={currentStage.description} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Current round" value={`${round} / ${maxRounds}`} note={isAtRoundLimit ? "Timeline limit reached" : "Two environments run in parallel"} icon={Clock3} />
          <MetricCard label="Synthetic agents" value={String(seededAgents.length)} note="A replay of existing panel memories" icon={Users} />
          <MetricCard label="Info Plaza actions" value={String(eventCounts.twitter)} note="Twitter-style timeline · simulated" icon={Globe2} />
          <MetricCard label="Topic Community actions" value={String(eventCounts.reddit)} note="Reddit-style community · simulated" icon={MessageCircle} />
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.72fr)]">
          <section className="surface min-w-0 rounded-[1.6rem] p-4 sm:p-5">
            <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="label-text text-[var(--patina)]">Live timeline</p><h3 className="display-type mt-1 text-2xl">Room activity</h3></div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="simulation-platform-filter">Filter timeline platform</label>
                <select id="simulation-platform-filter" className="input-field min-h-10 w-auto py-1.5 text-xs font-semibold" value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value as "all" | SimPlatform)}>
                  <option value="all">Both platforms</option>
                  <option value="twitter">Info Plaza</option>
                  <option value="reddit">Topic Community</option>
                </select>
                <button type="button" onClick={resetSimulation} disabled={isRunning} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold hover:bg-black/5 disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reset</button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white/45 p-3">
              <div className="flex items-center gap-2"><span className={`grid h-8 w-8 place-items-center rounded-lg ${isRunning ? "bg-amber-100 text-amber-800" : isAtRoundLimit ? "bg-emerald-100 text-emerald-800" : "bg-[var(--patina)]/10 text-[var(--patina)]"}`}>{isRunning ? <Pause className="h-4 w-4" aria-hidden="true" /> : isAtRoundLimit ? <Check className="h-4 w-4" aria-hidden="true" /> : <Radio className="h-4 w-4" aria-hidden="true" />}</span><div><p className="text-sm font-bold">{isRunning ? "Simulating next timeline state…" : isAtRoundLimit ? "Timeline complete" : "Baseline world loaded"}</p><p className="text-xs text-[var(--muted)]">{runNotice || `${events.length} synthetic actions · seed 11 · local-only run`}</p></div></div>
              <div className="flex gap-2">
                <button type="button" onClick={runNextRound} disabled={isRunning || isAtRoundLimit} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--line)] bg-white/60 px-3 text-xs font-bold hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"><Play className="h-3.5 w-3.5" aria-hidden="true" /> Run next</button>
                <button type="button" onClick={runAllRounds} disabled={isRunning || isAtRoundLimit} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--ink)] px-3 text-xs font-bold text-[var(--paper)] hover:bg-[var(--ink)]/85 disabled:cursor-not-allowed disabled:opacity-50"><Zap className="h-3.5 w-3.5" aria-hidden="true" /> Run all</button>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {visibleActions.map((action) => (
                <ActionCard key={action.id} action={action} agent={seededAgents.find((agent) => agent.id === action.agentId)} />
              ))}
              {visibleActions.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--line)] px-6 py-12 text-center"><Activity className="mx-auto h-7 w-7 text-[var(--muted)]" aria-hidden="true" /><p className="mt-3 text-sm font-semibold">No actions in this view yet.</p><p className="mt-1 text-xs text-[var(--muted)]">Run a round to fill the timeline.</p></div> : null}
              {events.length > visibleActions.length ? <p className="py-1 text-center text-xs text-[var(--muted)]">Showing the latest {visibleActions.length} activity cards. All {events.length} actions are included in the report trace.</p> : null}
            </div>
          </section>
          <aside className="space-y-4">
            <div className="surface rounded-[1.6rem] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--ink)] text-[var(--paper)]"><EyeIcon /></span>
                <div><p className="label-text text-[var(--oxblood)]">God’s-eye variable injection</p><h3 className="display-type mt-1 text-2xl">Change the world state</h3></div>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Inject one event before the next round. The selected event changes the deterministic templates and the report read.</p>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-bold">Scenario event</span>
                <select className="input-field text-sm" value={selectedInjectionId} onChange={(event) => setSelectedInjectionId(event.target.value)}>
                  {godEyeEvents.map((injection) => <option key={injection.id} value={injection.id}>{injection.label}</option>)}
                </select>
              </label>
              <div className={`mt-3 rounded-xl border p-3 ${selectedInjection.hypothetical ? "border-amber-200 bg-amber-50/70" : "border-emerald-200 bg-emerald-50/70"}`}>
                <div className="flex items-center gap-2">{selectedInjection.hypothetical ? <Lightbulb className="h-4 w-4 text-amber-800" aria-hidden="true" /> : <BadgeCheck className="h-4 w-4 text-emerald-800" aria-hidden="true" />}<span className={`label-text text-[0.62rem] ${selectedInjection.hypothetical ? "text-amber-900" : "text-emerald-900"}`}>{selectedInjection.hypothetical ? "What-if · not a live feature" : "Current product fact"}</span></div>
                <p className="mt-2 text-xs leading-5 text-[var(--ink)]">{selectedInjection.description}</p>
              </div>
              <button type="button" onClick={runNextRound} disabled={isRunning || isAtRoundLimit} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--patina)] px-4 text-sm font-bold text-white hover:bg-[#185d57] disabled:cursor-not-allowed disabled:opacity-50">
                <Sparkles className="h-4 w-4" aria-hidden="true" /> Inject & run next round
              </button>
              <p className="mt-2 text-center text-[0.68rem] leading-5 text-[var(--muted)]">A what-if tests a hypothesis; it is not evidence that the feature exists.</p>
            </div>
            <div className="rounded-[1.6rem] border border-[var(--line)] bg-[#f2eadc] p-4 sm:p-5">
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[var(--patina)]" aria-hidden="true" /><p className="label-text text-[0.65rem]">Simulation guardrail</p></div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">The social feed is generated from synthetic profile memory. Likes, posts, and sentiment are illustrative interactions—not observed engagement.</p>
            </div>
          </aside>
        </div>
      </>
    );
  }

  function renderReportStage() {
    return (
      <>
        <SectionHeading eyebrow={currentStage.eyebrow} title={currentStage.title} description={currentStage.description} />
        <div className="overflow-hidden rounded-[1.6rem] bg-[#171b19] text-[var(--paper)] shadow-xl">
          <div className="relative px-5 py-6 sm:px-7 sm:py-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(29,111,104,0.32),transparent_30%)]" aria-hidden="true" />
            <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div>
                <p className="label-text text-[#8ad1bd]">ReportAgent · ReACT-style local trace</p>
                <h3 className="display-type mt-2 text-3xl sm:text-4xl">{report.title}</h3>
                <p className="mt-2 text-sm text-white/60">{report.snapshot} · {seededAgents.length} synthetic profiles · no model call</p>
              </div>
              <button type="button" onClick={refreshReport} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 text-sm font-semibold text-white hover:bg-white/10"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh report</button>
            </div>
            <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><p className="label-text text-[0.62rem] text-white/45">Evidence class</p><p className="mt-2 text-sm font-bold">Synthetic replay</p></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><p className="label-text text-[0.62rem] text-white/45">Latest event</p><p className="mt-2 text-sm font-bold">{lastInjection.label}</p></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><p className="label-text text-[0.62rem] text-white/45">Purchase forecast</p><p className="mt-2 text-sm font-bold">None generated</p></div>
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3"><div><p className="label-text text-[var(--patina)]">Findings</p><h3 className="display-type mt-1 text-2xl">The careful read</h3></div><Pill tone="amber"><ShieldAlert className="h-3 w-3" aria-hidden="true" /> Hypothesis, not evidence</Pill></div>
            {report.sections.map((section, index) => <ReportSectionCard key={section.title} section={section} index={index} />)}
          </div>
          <aside className="space-y-3">
            <div className="surface rounded-[1.6rem] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3"><div><p className="label-text text-[var(--patina)]">Report tools</p><h3 className="display-type mt-1 text-2xl">Inspect the trace</h3></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--patina)]/10 text-[var(--patina)]"><BrainCircuit className="h-4 w-4" aria-hidden="true" /></span></div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">The trace mirrors MiroFish’s tool-assisted report pattern. Each step here runs locally over the seed bundle.</p>
              <button type="button" onClick={() => setShowTrace((value) => !value)} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white/55 px-4 text-sm font-bold hover:bg-white">
                {showTrace ? "Hide tool calls" : "Open tool calls"}<ChevronRight className={`h-4 w-4 transition ${showTrace ? "rotate-90" : ""}`} aria-hidden="true" />
              </button>
            </div>
            <div className="rounded-[1.6rem] border border-[var(--line)] bg-[#f2eadc] p-4 sm:p-5">
              <div className="flex items-center gap-2"><Lightbulb className="h-4 w-4 text-[var(--brass)]" aria-hidden="true" /><p className="label-text text-[0.62rem]">Best next action</p></div>
              <p className="mt-2 text-sm font-semibold leading-6">Test a real delegate brief with a coach and collect specific corrections before claiming source trust.</p>
              <button type="button" onClick={() => navigateToStep(4)} className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[var(--patina)] hover:underline">Interview the room <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
            </div>
          </aside>
        </div>
        {showTrace ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{report.trace.map((item, index) => <ToolTraceCard key={item.name} name={item.name} purpose={item.purpose} detail={item.detail} index={index} />)}</div> : null}
      </>
    );
  }

  function renderInteractionStage() {
    return (
      <>
        <SectionHeading eyebrow={currentStage.eyebrow} title={currentStage.title} description={currentStage.description} />
        <div className="mb-4 inline-flex rounded-xl border border-[var(--line)] bg-white/45 p-1" role="tablist" aria-label="Deep interaction mode">
          <button type="button" role="tab" aria-selected={interactionMode === "chat"} onClick={() => setInteractionMode("chat")} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold transition ${interactionMode === "chat" ? "bg-[var(--ink)] text-[var(--paper)]" : "text-[var(--muted)] hover:bg-black/5"}`}><MessageCircle className="h-4 w-4" aria-hidden="true" /> Agent chat</button>
          <button type="button" role="tab" aria-selected={interactionMode === "survey"} onClick={() => setInteractionMode("survey")} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold transition ${interactionMode === "survey" ? "bg-[var(--ink)] text-[var(--paper)]" : "text-[var(--muted)] hover:bg-black/5"}`}><BarChart3 className="h-4 w-4" aria-hidden="true" /> World survey</button>
        </div>
        {interactionMode === "chat" && selectedAgent ? (
          <div className="grid min-h-[38rem] gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
            <section className="surface flex min-h-[34rem] min-w-0 flex-col overflow-hidden rounded-[1.6rem]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-4 sm:px-5">
                <div className="flex items-center gap-3"><AgentAvatar agent={selectedAgent} /><div><p className="text-sm font-bold">InterviewSubAgent</p><p className="text-xs text-[var(--muted)]">Local memory-grounded chat · no LLM call</p></div></div>
                <label className="flex items-center gap-2 text-xs font-semibold"><span className="sr-only">Select an agent to interview</span><span className="text-[var(--muted)]">Interview</span><select className="input-field min-h-10 w-40 py-1.5 text-xs font-semibold sm:w-48" value={selectedAgentId} onChange={(event) => chooseAgent(event.target.value)}>{seededAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.id} · {agent.name}</option>)}</select></label>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-white/25 p-4 sm:p-5" aria-live="polite">
                <div className="mb-1 flex items-start gap-2 rounded-xl border border-[var(--line)] bg-white/50 p-3 text-xs leading-5 text-[var(--muted)]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--patina)]" aria-hidden="true" /><span>Answers are generated from {selectedAgent.name}’s synthetic panel memory and fixed local rules. They are not new interviews or factual claims about real delegates.</span></div>
                {chatLines.map((line, index) => (
                  <div key={`${line.role}-${index}`} className={`flex ${line.role === "delegate" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${line.role === "delegate" ? "rounded-br-md bg-[var(--ink)] text-[var(--paper)]" : "rounded-bl-md border border-[var(--line)] bg-white/80 text-[var(--ink)]"}`}>
                      {line.role === "agent" ? <p className="mb-1 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-[var(--patina)]">{selectedAgent.name} · {stanceMeta[selectedAgent.stance].shortLabel}</p> : null}
                      <p>{line.content}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-[var(--line)] p-4 sm:px-5">
                <div className="mb-3 flex flex-wrap gap-2">
                  {[
                    "What makes you trust a brief?",
                    "How does the trial change your view?",
                    "Would your coach use this?",
                  ].map((prompt) => <button key={prompt} type="button" onClick={() => setAgentPrompt(prompt)} className="rounded-full border border-[var(--line)] bg-white/50 px-3 py-1.5 text-[0.68rem] font-semibold text-[var(--muted)] hover:bg-white">{prompt}</button>)}
                </div>
                <form onSubmit={sendChatLine} className="flex items-end gap-2">
                  <label className="sr-only" htmlFor="agent-chat-input">Ask the selected synthetic agent</label>
                  <textarea id="agent-chat-input" className="input-field min-h-[48px] max-h-28 resize-y py-3 text-sm" rows={1} maxLength={500} value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder={`Ask ${selectedAgent.name} about their decision…`} />
                  <button type="submit" disabled={!chatInput.trim()} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--patina)] text-white hover:bg-[#185d57] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send interview question"><Send className="h-4 w-4" aria-hidden="true" /></button>
                </form>
                <p className="mt-2 text-[0.65rem] text-[var(--muted)]">{chatInput.length} / 500 · Stored only in this page session.</p>
              </div>
            </section>
            <aside className="space-y-4">
              <div className="surface rounded-[1.6rem] p-4 sm:p-5">
                <div className="flex items-center gap-3"><AgentAvatar agent={selectedAgent} size="lg" /><div><p className="label-text text-[var(--patina)]">Interview subject</p><h3 className="display-type text-2xl">{selectedAgent.name}</h3></div></div>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{selectedAgent.currentReaction}</p>
                <div className="mt-4 rounded-xl border border-[var(--line)] bg-white/50 p-3"><p className="label-text text-[0.62rem]">Modeled stance</p><p className="mt-1 text-sm font-bold">{stanceMeta[selectedAgent.stance].label}</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Current product snapshot, interpreted through old synthetic memory.</p></div>
              </div>
              <div className="rounded-[1.6rem] border border-amber-200 bg-amber-50/65 p-4 sm:p-5">
                <div className="flex items-center gap-2 text-amber-900"><Quote className="h-4 w-4" aria-hidden="true" /><p className="label-text text-[0.62rem] text-amber-900">Archived panel quote</p></div>
                <p className="mt-3 text-sm italic leading-6 text-amber-950">“{selectedAgent.priorQuote || selectedAgent.priorObjection}”</p>
                <p className="mt-2 text-[0.65rem] leading-5 text-amber-900/75">Synthetic baseline answer · {selectedAgent.id} · predates the current free trial</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DimensionCard index={1} label="Experience" text={selectedAgent.persona.experience} icon={BookOpen} />
                <DimensionCard index={2} label="Behavior" text={selectedAgent.persona.behavior} icon={Activity} />
              </div>
            </aside>
          </div>
        ) : null}
        {interactionMode === "survey" ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <section className="surface rounded-[1.6rem] p-4 sm:p-6">
              <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--patina)]/10 text-[var(--patina)]"><BarChart3 className="h-5 w-5" aria-hidden="true" /></span><div><p className="label-text text-[var(--patina)]">PanoramaSearch · profile roll-up</p><h3 className="display-type mt-1 text-2xl">Batch world survey</h3></div></div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Frame a question, then inspect the most relevant remembered signal on each profile. A lightweight keyword filter groups each agent’s existing stance tags; it does not collect new answers.</p>
              <form onSubmit={submitSurvey} className="mt-5 space-y-3">
                <label className="block"><span className="mb-1.5 block text-xs font-bold">Survey prompt</span><textarea className="input-field min-h-28 resize-y text-sm leading-6" rows={4} maxLength={220} value={surveyPrompt} onChange={(event) => { setSurveyPrompt(event.target.value); setSurveyComplete(false); setSurveyNote(""); }} /></label>
                <button type="submit" disabled={!surveyPrompt.trim()} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 text-sm font-bold text-[var(--paper)] hover:bg-[var(--ink)]/85 disabled:opacity-50"><Play className="h-4 w-4" aria-hidden="true" /> Aggregate 40 profile memories</button>
              </form>
              <div className="mt-4 space-y-2 rounded-xl border border-[var(--line)] bg-white/45 p-3 text-xs leading-5 text-[var(--muted)]">
                <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--patina)]" aria-hidden="true" /> No network call, no stored response, and no new agent memory.</p>
                <p className="flex items-start gap-2"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brass)]" aria-hidden="true" /> Counts describe this synthetic profile set only; they are not population estimates.</p>
              </div>
            </section>
            <section className="surface rounded-[1.6rem] p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="label-text text-[var(--patina)]">Modeled priority distribution</p><h3 className="display-type mt-1 max-w-2xl text-2xl">{surveyPrompt || "Your survey"}</h3></div><Pill tone="amber"><Users className="h-3 w-3" aria-hidden="true" /> {surveyComplete ? "40 profiles" : "Awaiting run"}</Pill></div>
              {surveyComplete ? (
                <div className="mt-5 space-y-4">
                  {surveyResults.map((item) => (
                    <div key={item.stance}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-semibold">{item.label}</span><span className="mono-type text-[var(--muted)]">{item.count} / {seededAgents.length} · {item.percent}%</span></div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full transition-all" style={{ width: `${item.percent}%`, backgroundColor: getSurveyBarColor(item.stance) }} /></div>
                    </div>
                  ))}
                  <div className="mt-5 rounded-2xl bg-[var(--ink)] p-4 text-[var(--paper)]">
                    <div className="flex items-center gap-2 text-[#8ad1bd]"><Activity className="h-4 w-4" aria-hidden="true" /><p className="label-text text-[0.62rem] text-[#8ad1bd]">How to read this</p></div>
                    <p className="mt-2 text-sm leading-6 text-white/70">Each profile contributes one existing memory category. A simple keyword matcher can group those tags for targeted prompts. This is a profile-memory histogram, not a live poll or a new response.</p>
                    {surveyNote ? <p className="mt-2 text-xs text-white/45">{surveyNote}</p> : null}
                  </div>
                </div>
              ) : (
                <div className="mt-6 grid min-h-64 place-items-center rounded-2xl border border-dashed border-[var(--line)] text-center"><div><BarChart3 className="mx-auto h-8 w-8 text-[var(--muted)]" aria-hidden="true" /><p className="mt-3 text-sm font-semibold">Run the profile roll-up</p><p className="mt-1 text-xs text-[var(--muted)]">No new answers will be generated.</p></div></div>
              )}
            </section>
          </div>
        ) : null}
      </>
    );
  }

  function renderActiveStage() {
    if (activeStep === 0) return renderGraphStage();
    if (activeStep === 1) return renderEnvironmentStage();
    if (activeStep === 2) return renderSimulationStage();
    if (activeStep === 3) return renderReportStage();
    return renderInteractionStage();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-4 sm:px-6 sm:pt-6 xl:px-8">
        <div className="mx-auto max-w-[1520px]">
          <section className="relative overflow-hidden rounded-[1.8rem] bg-[#17211f] px-5 py-6 text-[var(--paper)] shadow-[0_22px_60px_rgba(23,20,18,0.18)] sm:px-8 sm:py-8 xl:px-10">
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_38%,rgba(52,145,128,0.3),transparent_32%)]" />
              <div className="absolute right-0 top-0 h-full w-1/2 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:linear-gradient(to_left,black,transparent)]" />
            </div>
            <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="green"><Sparkles className="h-3 w-3" aria-hidden="true" /> MiroFish-inspired Swarm Lab</Pill>
                  <span className="mono-type text-[0.65rem] uppercase tracking-[0.15em] text-white/40">MUN PREP / LAB 01</span>
                </div>
                <h1 className="display-type mt-5 max-w-3xl text-4xl leading-[1.03] sm:text-5xl xl:text-6xl">Read the room before you launch.</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/68 sm:text-base">A 40-profile, two-platform scenario replay of the MUN Prep App—built to surface what delegates may question, not to manufacture proof that they will buy.</p>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:max-w-[23rem]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4"><p className="label-text text-[0.6rem] text-white/45">Profiles in the room</p><p className="display-type mt-1 text-3xl">40</p><p className="mt-1 text-[0.65rem] text-white/45">synthetic memory set</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4"><p className="label-text text-[0.6rem] text-white/45">Platforms</p><p className="display-type mt-1 text-3xl">02</p><p className="mt-1 text-[0.65rem] text-white/45">parallel timelines</p></div>
              </div>
            </div>
            <div className="relative mt-6 flex flex-col gap-2 border-t border-white/10 pt-4 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 shrink-0 text-[#f1bb72]" aria-hidden="true" /><span>Rule-based local simulation · no live LLM, OASIS, Zep, or real delegate data</span></span>
              <a href="https://github.com/666ghj/MiroFish" target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1.5 font-semibold text-[#8ad1bd] hover:text-white">MiroFish workflow reference <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></a>
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-amber-200/80 bg-amber-50/75 p-4 sm:flex sm:items-start sm:gap-3" aria-label="Simulation evidence boundary">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" aria-hidden="true" />
            <div className="flex-1"><p className="text-sm font-bold text-amber-950">Synthetic scenario, not market evidence</p><p className="mt-1 text-xs leading-5 text-amber-950/75">{evidenceCaveat} The archived buyer panel predates the current free trial; its original 9/40 result is not a conversion estimate for this version.</p></div>
            <a href="https://github.com/666ghj/MiroFish" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-amber-900 hover:underline sm:mt-0">Source <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></a>
          </section>

          <nav className="mt-6 overflow-x-auto pb-2" aria-label="MiroFish simulation stages">
            <ol className="grid min-w-[780px] grid-cols-5 gap-2">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const active = activeStep === index;
                const complete = completedStages > index;
                return (
                  <li key={step.id}>
                    <button type="button" onClick={() => navigateToStep(index)} aria-current={active ? "step" : undefined} className={`group flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${active ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] shadow-md" : "border-[var(--line)] bg-white/45 text-[var(--ink)] hover:bg-white/80"}`}>
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${active ? "bg-white/10 text-[#8ad1bd]" : complete ? "bg-emerald-100 text-emerald-800" : "bg-black/5 text-[var(--muted)]"}`}>{complete ? <Check className="h-4 w-4" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}</span>
                      <span className="min-w-0"><span className={`mono-type block text-[0.62rem] uppercase tracking-[0.12em] ${active ? "text-white/45" : "text-[var(--muted)]"}`}>0{index + 1} · {step.sub}</span><span className="mt-0.5 block truncate text-sm font-bold">{step.name}</span></span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]"><span className="mono-type">STEP {String(activeStep + 1).padStart(2, "0")} / 05</span><ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /><span className="font-semibold text-[var(--ink)]">{steps[activeStep].name}</span></div>
            <div className="flex flex-wrap gap-2"><Pill><Database className="h-3 w-3" aria-hidden="true" /> Seed 11</Pill><Pill><Users className="h-3 w-3" aria-hidden="true" /> Synthetic profiles</Pill><Pill tone="green"><CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Local-only</Pill></div>
          </div>

          <main className="mt-6 pb-4">{renderActiveStage()}</main>

          <footer className="mt-5 flex flex-col gap-3 border-t border-[var(--line)] py-5 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-3xl leading-5">MiroFish is the workflow reference. This application uses its own transparent, deterministic demo engine and synthetic source material; it is not an upstream MiroFish execution.</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => navigateToStep(Math.max(0, activeStep - 1))} disabled={activeStep === 0} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[var(--line)] px-3 font-semibold hover:bg-black/5 disabled:opacity-40">Back</button>
              {activeStep < steps.length - 1 ? <button type="button" onClick={() => navigateToStep(activeStep + 1)} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[var(--ink)] px-3 font-semibold text-[var(--paper)] hover:bg-[var(--ink)]/85">Next stage <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></button> : <button type="button" onClick={() => navigateToStep(0)} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[var(--ink)] px-3 font-semibold text-[var(--paper)] hover:bg-[var(--ink)]/85"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Start over</button>}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function EyeIcon() {
  return <Radar className="h-5 w-5 text-[#8ad1bd]" aria-hidden="true" />;
}
