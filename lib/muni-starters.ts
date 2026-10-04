/** Workspace modes that get rotating starter prompts. */
export type MuniToolMode =
  | "research"
  | "country-profile"
  | "position-paper"
  | "speech"
  | "poi"
  | "resolution";

/**
 * Muni's rotating starter prompts.
 *
 * Each workspace mode combines 102 shared MUN topics with 40 mode-specific
 * verbs and 25 mode-specific objects: 102 × 40 × 25 = 102,000 unique
 * `Topic — verb object` prompts per mode. The empty state draws a fresh
 * random handful on every mount, so every refresh shows new threads.
 */

const TOPICS: string[] = [
  "UNSC reform",
  "Climate finance",
  "DISEC cyber norms",
  "Refugee protection",
  "Maritime security",
  "AI governance",
  "Nuclear non-proliferation",
  "Peacekeeping mandates",
  "Global health security",
  "Food security",
  "Water scarcity",
  "Deep-sea mining",
  "Space militarization",
  "Autonomous weapons",
  "Misinformation warfare",
  "Economic sanctions",
  "Debt relief",
  "Digital privacy",
  "Counterterrorism",
  "Humanitarian corridors",
  "Child soldiers",
  "Gender equality",
  "Indigenous rights",
  "Ocean plastic",
  "Biodiversity loss",
  "Deforestation",
  "Carbon markets",
  "Green tech transfer",
  "Pandemic preparedness",
  "Antimicrobial resistance",
  "Universal health coverage",
  "Migration compacts",
  "Statelessness",
  "Human trafficking",
  "Cybercrime treaty",
  "Ransomware gangs",
  "Election interference",
  "AI disinformation",
  "Quantum security",
  "Semiconductor supply chains",
  "Rare-earth minerals",
  "Energy transition",
  "Oil phaseout",
  "Fertilizer access",
  "Small-island states",
  "Least-developed countries",
  "Megacity governance",
  "Aviation emissions",
  "Shipping decarbonization",
  "Arctic governance",
  "Outer space debris",
  "Internet governance",
  "Digital divide",
  "E-waste",
  "Circular economy",
  "Child labour",
  "Forced labour",
  "Social protection floors",
  "Youth unemployment",
  "Girls' education",
  "School meals",
  "Press freedom",
  "Journalist safety",
  "Protest rights",
  "Death penalty",
  "Torture ban",
  "Prison reform",
  "Drug policy",
  "Tobacco control",
  "Nuclear energy",
  "Antarctic treaty",
  "Satellite regulation",
  "Textile workers",
  "Minimum wage",
  "Teacher shortages",
  "Academic freedom",
  "Opioid crisis",
  "Road safety",
  "Public transport",
  "Smart cities",
  "Urban slums",
  "Oil spills",
  "Coral reefs",
  "Glacier retreat",
  "Desertification",
  "Monsoon failures",
  "Locust swarms",
  "Fisheries collapse",
  "Whaling ban",
  "Seabed cables",
  "Port security",
  "Strait passages",
  "Refugee resettlement",
  "Border walls",
  "Visa regimes",
  "Diaspora voting",
  "Remittance flows",
  "Microfinance",
  "Sovereign debt",
  "IMF quotas",
  "World Bank lending",
  "Vaccine equity",
];

type ModeBanks = { verbs: string[]; objects: string[] };

const BANKS: Record<MuniToolMode, ModeBanks> = {
  research: {
    verbs: [
      "map", "brief", "compare", "rank", "explain", "trace", "audit", "forecast",
      "summarize", "profile", "chart", "decode", "unpack", "survey", "interrogate",
      "pressure-test", "benchmark", "timeline", "frame", "scope", "triage", "weigh",
      "connect", "challenge", "verify", "contextualize", "dissect", "preview",
      "game out", "stress-test", "cross-check", "synthesize", "distill", "annotate",
      "cluster", "sequence", "prioritize", "deconstruct", "reframe", "translate",
    ],
    objects: [
      "the bloc positions", "a delegate's stance", "opposition arguments",
      "clause ideas", "speech angles", "veto dynamics", "funding gaps",
      "enforcement options", "precedent cases", "minority reports",
      "abstention risks", "amendment paths", "consensus points", "red lines",
      "compromise zones", "sponsor lists", "voting math", "media narratives",
      "NGO positions", "expert testimony", "historical parallels",
      "regional splits", "great-power rifts", "small-state leverage",
      "fallback options",
    ],
  },
  "country-profile": {
    verbs: [
      "profile", "align", "place", "anchor", "brief", "situate", "connect",
      "contrast", "track", "audit", "map", "rank", "summarize", "decode",
      "frame", "link", "benchmark", "trace", "weigh", "preview", "triangulate",
      "distill", "outline", "sketch", "assess", "grade", "cluster", "sequence",
      "narrate", "ground", "localize", "historicize", "compare", "interrogate",
      "forecast", "simplify", "sharpen", "update", "humanize", "quantify",
    ],
    objects: [
      "the policy spine", "voting patterns", "the treaty record",
      "the alliance web", "trade leverage", "aid flows", "military posture",
      "climate pledges", "the human-rights file", "development goals",
      "the regional role", "diaspora links", "the energy mix", "tech ambitions",
      "health systems", "education stats", "colonial legacy", "border disputes",
      "maritime claims", "nuclear status", "sanctions exposure", "the debt profile",
      "the election calendar", "leadership style", "public opinion",
    ],
  },
  "position-paper": {
    verbs: [
      "draft", "frame", "sharpen", "structure", "open", "close", "phrase",
      "upgrade", "tighten", "formalize", "outline", "thesis", "evidence",
      "cite", "hedge", "assert", "concede", "pivot", "preempt", "quote",
      "number", "title", "signpost", "balance", "temper", "harden", "clarify",
      "compress", "sequence", "bullet", "headline", "footnote", "attribute",
      "polish", "finalize", "proof", "submit", "format", "style", "paragraph",
    ],
    objects: [
      "the stance paragraph", "operative clauses", "preambulatory lines",
      "the opening hook", "the closing push", "bloc-friendly language",
      "veto-proof wording", "consensus phrases", "red-line statements",
      "compromise offers", "evidence blocks", "data points", "historical backing",
      "legal grounding", "moral framing", "economic logic", "security rationale",
      "humanitarian appeal", "rebuttal reserves", "amendment bait",
      "sponsor pitches", "title options", "the position summary",
      "delegation voice", "formal tone",
    ],
  },
  speech: {
    verbs: [
      "open", "close", "punch", "pause", "land", "deliver", "project", "pace",
      "stress", "lift", "drop", "aim", "fire", "hold", "command", "channel",
      "summon", "invoke", "quote", "echo", "repeat", "build", "crest",
      "resolve", "challenge", "dare", "invite", "warn", "urge", "plead",
      "demand", "propose", "move", "second", "yield", "thank", "welcome",
      "honor", "salute", "time",
    ],
    objects: [
      "the opening hook", "the gavel moment", "a 90-second arc",
      "moderated-caucus angles", "the applause line", "a POI trap",
      "the moral high ground", "delegate attention", "bloc energy",
      "the quiet room", "rhetorical questions", "rule-of-three lists",
      "vivid statistics", "human stories", "historic echoes", "treaty references",
      "data punches", "urgency framing", "hope pivots", "warning shots",
      "calls to action", "memorable closers", "quotable lines", "floor control",
      "speaker presence",
    ],
  },
  poi: {
    verbs: [
      "counter", "dismantle", "expose", "puncture", "flip", "redirect",
      "corner", "press", "probe", "test", "unmask", "deflate", "rebut",
      "reframe", "reclaim", "mirror", "stretch", "shrink", "freeze", "rush",
      "slow", "sharpen", "blunt", "split", "trap", "spring", "dodge", "absorb",
      "return", "deflect", "disarm", "outflank", "preempt", "undercut",
      "outlast", "outshine", "spotlight", "archive", "table", "shelve",
    ],
    objects: [
      "sanctions myths", "climate excuses", "vague promises", "weak data",
      "circular logic", "strawman claims", "false equivalence",
      "cherry-picked stats", "moving goalposts", "empty rhetoric",
      "deflection tactics", "whataboutism", "fear-mongering", "rosy forecasts",
      "hidden costs", "missing citations", "outdated facts", "biased sources",
      "logical leaps", "unspoken assumptions", "quiet contradictions",
      "uncomfortable votes", "past abstentions", "broken pledges",
      "inconvenient precedents",
    ],
  },
  resolution: {
    verbs: [
      "draft", "write", "number", "preface", "table", "merge", "split",
      "amend", "strengthen", "soften", "insert", "delete", "reorder",
      "renumber", "sponsor", "co-sponsor", "circulate", "negotiate",
      "finalize", "proofread", "format", "cite", "reference", "ground",
      "anchor", "balance", "sequence", "group", "cluster", "prune", "expand",
      "compress", "clarify", "define", "scope", "limit", "sunset", "review",
      "trigger", "adopt",
    ],
    objects: [
      "operative clauses", "preambulatory lines", "implementation steps",
      "funding mechanisms", "review conferences", "reporting duties",
      "sunset provisions", "enforcement teeth", "monitoring bodies",
      "verification regimes", "peacekeeping mandates", "sanctions relief",
      "aid corridors", "ceasefire terms", "tribunal referrals", "arms embargoes",
      "no-fly terms", "demilitarized zones", "refugee returns", "demining plans",
      "election timelines", "transition councils", "truth commissions",
      "safeguard clauses", "amnesties",
    ],
  },
};

/** Exact number of distinct prompts available for a mode. */
export function countStarterCombinations(mode: MuniToolMode): number {
  const banks = BANKS[mode];
  return TOPICS.length * banks.verbs.length * banks.objects.length;
}

/** Builds one prompt from its indices (useful for tests/audits). */
export function buildStarter(mode: MuniToolMode, topic: number, verb: number, object: number): string {
  const banks = BANKS[mode];
  return `${TOPICS[topic % TOPICS.length]} — ${banks.verbs[verb % banks.verbs.length]} ${banks.objects[object % banks.objects.length]}`;
}

/**
 * Draws `count` distinct random prompts for a mode. Uniform over the full
 * combination space, so every refresh surfaces a fresh set of threads.
 */
export function getRotatingStarters(mode: MuniToolMode, count = 3): string[] {
  const banks = BANKS[mode];
  const total = countStarterCombinations(mode);
  const picked = new Set<number>();
  while (picked.size < Math.min(count, total)) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    picked.add(array[0] % total);
  }
  return [...picked].map((index) => {
    const topic = Math.floor(index / (banks.verbs.length * banks.objects.length));
    const rest = index % (banks.verbs.length * banks.objects.length);
    const verb = Math.floor(rest / banks.objects.length);
    const object = rest % banks.objects.length;
    return buildStarter(mode, topic, verb, object);
  });
}
