export type Course = {
  slug: string;
  title: string;
  category: string;
  icon: string;
  description: string;
  lessons: Lesson[];
  quiz?: QuizQuestion[];
};

export type QuizQuestion = {
  question: string;
  options: string[];
  correct: number;
};

export type Lesson = {
  title: string;
  content: string;
};

export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

export const categories: Category[] = [
  { id: "mun", name: "Model United Nations", icon: "🏛️", color: "var(--ink)" },
  { id: "debate", name: "Debate & Speech", icon: "🎤", color: "var(--oxblood)" },
  { id: "democracy", name: "Elections & Democracy", icon: "🗳️", color: "var(--patina)" },
  { id: "government", name: "Government & Policy", icon: "📜", color: "var(--brass)" },
  { id: "global", name: "Global Affairs", icon: "🌍", color: "var(--ink)" },
  { id: "law", name: "Law & Rights", icon: "⚖️", color: "var(--oxblood)" },
];

export const courses: Course[] = [
  // ─── MODEL UNITED NATIONS ───────────────────────────────────────────
  {
    slug: "mun-basics",
    title: "MUN Basics",
    category: "mun",
    icon: "📋",
    description: "Learn the fundamentals of Model United Nations — what it is, how it works, and how to get started.",
    lessons: [
      {
        title: "What is MUN?",
        content: `Model United Nations (MUN) is an academic simulation of the United Nations where students role-play as delegates representing different countries. The goal is to research, debate, and collaborate on global issues following actual UN procedures.

**Key Concepts:**
• Each delegate represents a specific country's position, not their own
• Committees simulate real UN bodies (UNGA, UNSC, WHO, etc.)
• Delegates debate resolutions, amendments, and draft documents
• The conference follows formal rules of procedure

**Why MUN Matters:**
• Builds public speaking and negotiation skills
• Teaches research and analytical thinking
• Develops understanding of international relations
• Creates networking opportunities with like-minded students`
      },
      {
        title: "Types of Committees",
        content: `**General Assembly (GA)**
The main deliberative body of the UN. All 193 member states are represented. GA committees discuss a wide range of global issues and pass non-binding resolutions.

**Security Council (UNSC)**
Deals with international peace and security. Has 15 members (5 permanent with veto power). Can pass binding resolutions.

**Economic and Social Council (ECOSOC)**
Coordinates economic, social, and humanitarian work of the UN and specialized agencies.

**Specialized Agencies**
• WHO (World Health Organization) — global health issues
• UNICEF (UN Children's Fund) — children's rights
• UNDP (UN Development Programme) — development goals
• ILO (International Labour Organization) — labor standards
• UNESCO (UN Education, Scientific and Cultural Organization)

**Crisis Committees**
Simulate fast-paced crisis scenarios (wars, natural disasters, political emergencies) requiring quick decision-making.`
      },
      {
        title: "Rules of Procedure",
        content: `Rules of procedure govern how committees operate. Understanding them gives you a strategic advantage.

**Key Procedural Motions:**

**Motion to Open/Close Debate**
Opens or closes the floor for discussion. Requires a simple majority.

**Motion for Moderated Caucus**
Allows delegates to speak in short intervals (30-60 seconds) on a specific sub-topic. The chair controls who speaks.

**Motion for Unmoderated Caucus**
Delegates move around freely to negotiate, form blocs, and discuss informal agreements.

**Motion to Set Speaking Time**
Changes the allocated speaking time per delegate (typically 60-90 seconds).

**Motion for a Roll Call Vote**
Delegates must publicly state their vote (yes/no/abstain). Used for important resolutions.

**Point of Procedure:**
• Point of Order — chair made a procedural error
• Point of Inquiry — clarification on procedure
• Point of Personal Privilege — delegate cannot hear, etc.`
      },
      {
        title: "How Resolutions Work",
        content: `A draft resolution is the formal document that committees work towards passing.

**Structure of a Resolution:**

**1. Heading**
Lists the committee, sponsors, and signatories.

**2. Preambulatory Clauses**
• Start with present participle verbs (Recognizing, Expressing, Deeply concerned)
• Provide background and context
• Reference past UN resolutions or conventions
• Do NOT end with a comma

**3. Operative Clauses**
• Start with action verbs (Urges, Recommends, Calls upon)
• Outline specific actions the committee recommends
• Are numbered sequentially
• End with a semicolon (except the last, which ends with a period)

**Example Preambulatory Clause:**
"Recognizing the urgent need to address climate change in developing nations,"

**Example Operative Clause:**
"1. Urges all member states to reduce carbon emissions by 40% before 2030;"`
      },
    ],
  },
  {
    slug: "position-papers",
    title: "Position Papers",
    category: "mun",
    icon: "📝",
    description: "Master the art of writing compelling position papers that showcase your country's stance.",
    lessons: [
      {
        title: "What is a Position Paper?",
        content: `A position paper is a formal document that outlines your country's stance on the committee's agenda. It demonstrates your research and understanding of the issue.

**Why Write One?**
• Shows the chair you've done your research
• Provides a roadmap for your speeches and negotiations
• Helps you organize your thoughts before the conference
• Many committees require submission before the conference

**Length:** Typically 1-2 pages (500-1000 words)
**Format:** Formal, third-person, diplomatic language`
      },
      {
        title: "Position Paper Structure",
        content: `**1. Committee and Topic Header**
Clearly state the committee name and agenda topic.

**2. Country Introduction (1 paragraph)**
Brief introduction to your country's relevant background and relationship to the topic.

**3. Past Actions and Policies (1-2 paragraphs)**
What your country has done previously regarding this issue:
• Relevant domestic policies
• International agreements signed
• UN votes and statements
• Regional cooperation efforts

**4. Country's Position (2-3 paragraphs)**
Your country's specific stance on the agenda:
• Key arguments supporting your position
• Economic, political, or social reasoning
• Alignment with national interests
• References to international law or conventions

**5. Proposed Solutions (1-2 paragraphs)**
What your country recommends:
• Specific policy proposals
• Cooperation frameworks
• Implementation mechanisms
• Funding or resource allocation ideas

**6. Conclusion**
Reaffirm your country's commitment and willingness to cooperate.`
      },
      {
        title: "Writing Tips",
        content: `**Do's:**
✓ Use formal, diplomatic language
✓ Support claims with facts and data
✓ Reference specific UN resolutions or conventions
✓ Write from your country's perspective, not your own
✓ Proofread for grammar and spelling
✓ Follow the required format

**Don'ts:**
✗ Use first person ("I think...")
✗ Make unsupported claims
✗ Copy from Wikipedia directly
✗ Be overly emotional or biased
✗ Use informal language or slang
✗ Exceed the word/page limit

**Language Tips:**
• "The delegation of India believes..." (not "I think India should...")
• "It is imperative that..." (not "We really need to...")
• "The government of Brazil recognizes..." (not "Brazil should definitely...")`
      },
    ],
  },
  {
    slug: "research-strategies",
    title: "Research Strategies",
    category: "mun",
    icon: "🔍",
    description: "Learn how to research effectively for MUN — finding reliable sources and organizing information.",
    lessons: [
      {
        title: "Where to Research",
        content: `**Primary Sources (Most Valuable):**
• UN Official Documents (documents.un.org)
• Your country's Ministry of Foreign Affairs website
• International treaties and conventions
• Government white papers and policy documents
• Official UN voting records

**Secondary Sources:**
• Academic journals and papers
• Think tank reports (Brookings, CFR, Chatham House)
• Reputable news sources (Reuters, AP, BBC)
• CIA World Factbook (country profiles)
• UN Association publications

**Country-Specific Sources:**
• Your country's UN mission website
• National parliament/congress websites
• Government statistical agencies
• Think tanks based in your country

**Avoid:**
✗ Wikipedia as a primary source (use for initial orientation only)
✗ Unverified blogs or opinion pieces
✗ Outdated statistics (always check the year)
✗ Sources with clear political bias`
      },
      {
        title: "Research Organization",
        content: `**Step 1: Understand the Topic**
• Read the background guide thoroughly
• Identify key issues and sub-topics
• Note the committee's scope and mandate

**Step 2: Research Your Country**
• Foreign policy priorities
• Relevant domestic laws and policies
• International alliances and memberships
• Economic ties to the issue
• Historical involvement

**Step 3: Research the Issue**
• Global statistics and trends
• Past UN actions and resolutions
• Stakeholder positions (other countries, NGOs)
• Potential solutions that have been proposed

**Step 4: Take Notes**
• Create a research document with sections
• Use citation format for easy reference
• Highlight key facts and statistics
• Note opposing viewpoints

**Step 5: Organize by Theme**
• Group research by sub-topics
• Identify connections between issues
• Prepare for different debate angles`
      },
    ],
  },
  {
    slug: "bloc-strategy",
    title: "Bloc Strategy",
    category: "mun",
    icon: "🤝",
    description: "Learn how to form alliances, lead blocs, and navigate coalition politics in committees.",
    lessons: [
      {
        title: "Forming Blocs",
        content: `A "bloc" is an informal alliance of countries that share similar positions on an issue. Blocs are the backbone of MUN diplomacy.

**Why Blocs Matter:**
• No single country can pass a resolution alone
• Blocs pool resources and ideas
• They create voting majorities
• They provide negotiating power

**How Blocs Form:**
1. During unmoderated caucuses, delegates approach like-minded countries
2. A leader emerges (often the most vocal or well-researched delegate)
3. The bloc agrees on core principles and goals
4. Members collaborate on a draft resolution

**Types of Blocs:**
• **Majority bloc** — largest group, often dominates voting
• **Minority bloc** — smaller group with distinct position
• **Cross-cutting bloc** — bridges different viewpoints

**Tips for Joining a Bloc:**
• Approach countries with similar positions during unmods
• Listen more than you speak initially
• Offer valuable research or draft clauses
• Be willing to compromise on some issues`
      },
      {
        title: "Leading a Bloc",
        content: `**Qualities of a Good Bloc Leader:**
• Well-researched on the topic
• Strong communicator and negotiator
• Inclusive — makes everyone feel heard
• Decisive when the bloc needs direction
• Flexible — willing to adapt strategy

**Leadership Strategies:**
1. **Set the Vision** — Clearly articulate what the bloc wants to achieve
2. **Delegate Tasks** — Assign clause drafting, research, and outreach
3. **Build Consensus** — Find common ground on contentious issues
4. **Manage Conflict** — Resolve disagreements diplomatically
5. **Coordinate Strategy** — Decide who speaks, when, and on what

**When to Compromise:**
• When you can achieve 80% of your goals
• When holding out would lose key allies
• When the chair signals time is running out
• When a slightly modified version still serves your interests

**When to Stand Firm:**
• On core principles that define your position
• When your bloc has a clear majority
• When the compromise violates international law`
      },
    ],
  },

  // ─── DEBATE & SPEECH ───────────────────────────────────────────────
  {
    slug: "public-speaking",
    title: "Public Speaking",
    category: "debate",
    icon: "🎤",
    description: "Build confidence and master the fundamentals of effective public speaking.",
    lessons: [
      {
        title: "Overcoming Stage Fright",
        content: `Stage fright is normal — even experienced speakers feel nervous. The key is managing it, not eliminating it.

**Before the Speech:**
• Prepare thoroughly — confidence comes from knowledge
• Practice out loud multiple times
• Visualize success
• Take deep breaths (4 counts in, 4 counts hold, 4 counts out)
• Arrive early and familiarize yourself with the room

**During the Speech:**
• Start with a strong opening (you've prepared this)
• Focus on friendly faces in the audience
• Use pauses — they feel longer to you than to the audience
• Keep water nearby
• Remember: the audience wants you to succeed

**After the Speech:**
• Reflect on what went well
• Note areas for improvement
• Ask for feedback from peers
• Celebrate your progress

**Long-Term Confidence Building:**
• Practice speaking in low-stakes situations
• Join a debate club or Toastmasters
• Record yourself and review
• Gradually increase your audience size`
      },
      {
        title: "Voice and Delivery",
        content: `**Volume:**
• Speak loud enough for the back row to hear
• Project your voice from your diaphragm, not your throat
• Vary volume for emphasis — louder for key points, softer for dramatic moments

**Pace:**
• Average speaking rate: 130-150 words per minute
• Slow down for important points
• Speed up slightly for exciting or energetic content
• Pause after key statements (2-3 seconds)

**Pitch:**
• Vary your pitch to avoid monotone
• Go higher for questions or excitement
• Go lower for serious or authoritative statements

**Articulation:**
• Enunciate clearly
• Avoid filler words (um, uh, like, you know)
• Practice tongue twisters to improve clarity

**Body Language:**
• Stand tall with shoulders back
• Make eye contact (3-5 seconds per person)
• Use purposeful gestures (avoid fidgeting)
• Move purposefully — don't pace or sway`
      },
      {
        title: "Structuring a Speech",
        content: `**The 3-Part Structure:**

**1. Opening (10-15% of time)**
• Grab attention with a hook (question, statistic, story)
• State your main thesis or position
• Preview your key arguments

**2. Body (70-80% of time)**
• Present 2-4 main arguments
• Support each with evidence (facts, data, examples)
• Use transitions between points
• Address counterarguments

**3. Closing (10-15% of time)**
• Summarize your key points
• Restate your thesis with conviction
• End with a call to action or memorable statement

**Speech Templates:**

**Opening Speech (60-90 seconds):**
"Honorable chair, distinguished delegates, the delegation of [country] recognizes [issue]. [2-3 sentences on the problem]. [Country's position]. [Proposed solution]. We look forward to working with all delegations."

**Moderated Caucus (30-60 seconds):**
"Honorable chair, on the topic of [sub-topic], the delegation of [country] [position]. [1-2 supporting points]. [Solution or call to action]."`
      },
    ],
  },
  {
    slug: "argumentation",
    title: "Argumentation",
    category: "debate",
    icon: "🧠",
    description: "Learn how to build strong arguments and counter your opponents effectively.",
    lessons: [
      {
        title: "Building Arguments",
        content: `**The Claim-Evidence-Reasoning (CER) Framework:**

**Claim:** Your main point or assertion
**Evidence:** Facts, data, or examples that support it
**Reasoning:** Explanation of how the evidence supports the claim

**Example:**
• Claim: "Developing nations need financial support for climate adaptation"
• Evidence: "According to the IPCC, climate-related disasters cost developing countries $520 billion annually"
• Reasoning: "Without external financial mechanisms, these nations cannot afford adaptation measures, perpetuating inequality"

**Types of Evidence:**
• Statistics and data
• Expert opinions
• Historical precedents
• Case studies
• International law or treaties
• Personal testimonials (use sparingly)

**Strengthening Arguments:**
• Anticipate counterarguments and address them
• Use multiple types of evidence
• Connect to universal principles (human rights, sustainability)
• Make it relevant to your country's position`
      },
      {
        title: "Rebuttal Techniques",
        content: `A rebuttal is a response to an opponent's argument that undermines its validity.

**Rebuttal Frameworks:**

**1. Challenge the Evidence**
"The delegation cites outdated data from 2015. More recent studies from 2023 show..."

**2. Challenge the Logic**
"While the statistic is accurate, the conclusion doesn't follow because..."

**3. Offer Alternative Evidence**
"The delegation mentions economic costs, but fails to consider the humanitarian costs of inaction..."

**4. Reframe the Issue**
"This isn't just an economic issue — it's a matter of fundamental human rights..."

**5. Point Out Contradictions**
"The delegation advocates for sovereignty while simultaneously requesting international intervention..."

**Rebuttal Tips:**
• Stay calm and respectful
• Address the argument, not the person
• Use their own evidence against them when possible
• Be concise — don't ramble
• Prepare for common counterarguments in advance`
      },
    ],
  },

  // ─── ELECTIONS & DEMOCRACY ─────────────────────────────────────────
  {
    slug: "voting-systems",
    title: "Voting Systems",
    category: "democracy",
    icon: "🗳️",
    description: "Understand different voting methods and how they shape democratic outcomes.",
    lessons: [
      {
        title: "Majority vs Plurality",
        content: `**Simple Majority (50% + 1)**
The candidate or option with more than half of votes wins. Used in most UN General Assembly votes.

**Plurality (First Past the Post)**
The candidate with the most votes wins, even without a majority. Used in many national elections (US, UK, India).

**Pros of Plurality:**
• Simple to understand and count
• Quick results
• Encourages two-party systems

**Cons of Plurality:**
• Winner may lack majority support
• Can discourage third parties
• Strategic voting becomes common

**Supermajority (e.g., 2/3 or 3/4)**
Requires a larger margin for approval. Used for constitutional amendments, UN Security Council permanent member decisions.

**Why It Matters:**
Different voting systems produce different outcomes. A candidate who wins under plurality might lose under ranked-choice voting. Understanding these differences is crucial for policy discussions.`
      },
      {
        title: "Electoral Systems Worldwide",
        content: `**First Past the Post (FPTP)**
Used in: US, UK, India, Canada
• Single-member districts
• Simple plurality wins
• Tends to create two-party systems

**Proportional Representation (PR)**
Used in: Germany, Netherlands, Sweden, Brazil
• Party lists or mixed systems
• Seats proportional to vote share
• Encourages multi-party systems
• Often requires coalition governments

**Ranked Choice Voting (RCV)**
Used in: Australia, Ireland, some US cities
• Voters rank candidates in order of preference
• If no majority, lowest candidate eliminated
• Votes redistributed to next preference
• Ensures winner has broad support

**Mixed-Member Proportional (MMP)**
Used in: Germany, New Zealand
• Combination of FPTP and PR
• Voters cast two votes (local representative + party)
• Balances local representation with proportionality

**Single Transferable Vote (STV)**
Used in: Ireland, Malta
• Multi-member districts
• Voters rank candidates
• Complex but ensures proportional outcomes`
      },
    ],
  },
  {
    slug: "campaign-strategy",
    title: "Campaign Strategy",
    category: "democracy",
    icon: "📢",
    description: "Learn the fundamentals of political campaign planning and execution.",
    lessons: [
      {
        title: "Campaign Planning",
        content: `**Phase 1: Foundation**
• Define your campaign's mission and vision
• Identify your target audience
• Research the electoral landscape
• Set measurable goals

**Phase 2: Strategy Development**
• Develop your core message
• Choose campaign themes
• Plan outreach methods
• Allocate resources (time, money, volunteers)

**Phase 3: Execution**
• Launch campaign activities
• Begin voter outreach
• Media engagement
• Fundraising

**Phase 4: Get Out The Vote (GOTV)**
• Intensify voter contact
• Remind supporters to vote
• Address last-minute concerns
• Ensure transportation to polls

**Campaign Materials:**
• Campaign slogan (short, memorable, resonant)
• One-page policy platform
• Social media content calendar
• Volunteer training materials
• Fundraising strategy`
      },
    ],
  },

  // ─── GOVERNMENT & POLICY ───────────────────────────────────────────
  {
    slug: "un-bodies",
    title: "UN Bodies & Structure",
    category: "government",
    icon: "🏛️",
    description: "Learn about the different UN bodies, their roles, and how they work together.",
    lessons: [
      {
        title: "The UN System",
        content: `**Principal Organs:**

**1. General Assembly (UNGA)**
• Main deliberative body
• All 193 member states
• Discusses and makes recommendations
• Approves budget
• Elects non-permanent Security Council members

**2. Security Council (UNSC)**
• Primary responsibility for international peace and security
• 15 members (5 permanent: US, UK, France, Russia, China)
• Can authorize sanctions, peacekeeping, and military action
• Permanent members have veto power

**3. Economic and Social Council (ECOSOC)**
• Coordinates economic, social, and humanitarian work
• 54 member states
• Oversees specialized agencies and programs

**4. International Court of Justice (ICJ)**
• Principal judicial organ
• Settles legal disputes between states
• Advisory opinions on legal questions

**5. Secretariat**
• Carries out day-to-day work
• Led by the Secretary-General
• Employs international staff worldwide

**6. Trusteeship Council**
• Suspended operations in 1994 (all trust territories independent)`
      },
      {
        title: "Specialized Agencies",
        content: `Specialized agencies are independent organizations working with the UN through the coordinating mechanism of ECOSOC.

**Key Agencies:**

**WHO (World Health Organization)**
• Sets global health standards
• Coordinates disease response
• Current focus: pandemic preparedness

**UNICEF (UN Children's Fund)**
• Protects children's rights
• Provides humanitarian aid
• Education and health programs

**UNDP (UN Development Programme)**
• Supports sustainable development
• Implements SDGs
• Governance and poverty reduction

**ILO (International Labour Organization)**
• Sets labor standards
• Promotes decent work
• Addresses forced labor and child labor

**UNESCO (UN Education, Scientific and Cultural Organization)**
• Protects cultural heritage
• Promotes education
• Science and communication programs

**FAO (Food and Agriculture Organization)**
• Fight hunger globally
• Agricultural development
• Food security programs

**UNHCR (UN High Commissioner for Refugees)**
• Protects refugees and displaced persons
• Emergency response
• Resettlement programs`
      },
    ],
  },
  {
    slug: "policy-making",
    title: "Policy Making",
    category: "government",
    icon: "📋",
    description: "Understand how policies are created, implemented, and evaluated at national and international levels.",
    lessons: [
      {
        title: "The Policy Cycle",
        content: `**1. Agenda Setting**
Issues gain attention and become priority for government action. Influenced by media, public opinion, crises, and interest groups.

**2. Policy Formulation**
Developing specific proposals to address the issue. Involves research, consultation, and drafting.

**3. Policy Adoption**
Formal approval through legislative or executive process. Requires political will and coalition building.

**4. Policy Implementation**
Putting the policy into action through government agencies, regulations, and programs.

**5. Policy Evaluation**
Assessing whether the policy achieved its goals. Involves data collection, analysis, and reporting.

**6. Policy Adjustment**
Modifying the policy based on evaluation findings. The cycle then repeats.

**Factors Influencing Policy:**
• Public opinion and media attention
• Interest group lobbying
• Economic conditions
• International pressure or agreements
• Judicial decisions
• Technological changes
• Political ideology`
      },
    ],
  },

  // ─── GLOBAL AFFAIRS ────────────────────────────────────────────────
  {
    slug: "conflict-resolution",
    title: "Conflict Resolution",
    category: "global",
    icon: "🕊️",
    description: "Study international conflict resolution methods and peacekeeping strategies.",
    lessons: [
      {
        title: "Types of Conflict",
        content: `**Interstate Conflict**
Wars or tensions between sovereign nations. Examples: India-Pakistan tensions, Russia-Ukraine war.

**Intrastate Conflict**
Civil wars or internal conflicts within a country. Examples: Syrian civil war, Yemen crisis.

**Ethnic/Religious Conflict**
Tensions based on ethnic or religious differences. Examples: Myanmar (Rohingya), Ethiopia (Tigray).

**Resource Conflicts**
Disputes over natural resources like water, oil, or minerals. Examples: Nile River disputes, South China Sea.

**Conflict Prevention Methods:**
• Diplomatic negotiations
• Economic incentives/disincentives
• International mediation
• Confidence-building measures
• Early warning systems

**Conflict Resolution Methods:**
• Peace negotiations
• UN peacekeeping operations
• Economic sanctions
• International tribunals
• Transitional justice mechanisms`
      },
      {
        title: "Peacekeeping Operations",
        content: `**What is Peacekeeping?**
UN peacekeeping deploys military, police, and civilian personnel to help countries navigate the path from conflict to peace.

**Types of Peacekeeping:**

**Traditional Peacekeeping**
• Monitor ceasefires
• Buffer zones
• Limited mandate

**Multidimensional Peacekeeping**
• Electoral assistance
• Human rights monitoring
• Rule of law and security sector reform
• Civilian protection

**Robust Peacekeeping**
• Use of force to protect civilians
• Authorised under Chapter VII

**Key Principles:**
• Consent of the parties
• Impartiality
• Non-use of force except in self-defense

**Current UN Missions:**
• MINUSMA (Mali) — peace and security
• UNMISS (South Sudan) — protecting civilians
• UNIFIL (Lebanon) — monitoring ceasefire
• MONUSCO (DRC) — protecting civilians`
      },
    ],
  },
  {
    slug: "climate-diplomacy",
    title: "Climate Diplomacy",
    category: "global",
    icon: "🌡️",
    description: "Explore international climate negotiations, agreements, and the role of diplomacy in addressing climate change.",
    lessons: [
      {
        title: "History of Climate Agreements",
        content: `**1992: United Nations Framework Convention on Climate Change (UNFCCC)**
Established the framework for international climate negotiations. Aim: stabilize greenhouse gas concentrations.

**1997: Kyoto Protocol**
First binding emissions reduction targets for developed nations. Required 5% reduction from 1990 levels.

**2009: Copenhagen Accord**
Non-binding agreement. Set goal of limiting warming to 2°C. Failed to produce a binding successor to Kyoto.

**2015: Paris Agreement**
• Goal: limit warming to 1.5°C above pre-industrial levels
• Nationally Determined Contributions (NDCs) — each country sets own targets
• Global stocktake every 5 years
• Climate finance承诺 of $100 billion/year

**2021: Glasgow Climate Pact**
• Phasedown of coal power
• Enhanced NDCs
• Climate finance mechanisms
• Methane reduction pledge

**Key Challenges:**
• Ambition gap between pledges and action
• Climate finance for developing nations
• Loss and damage compensation
• Technology transfer`
      },
    ],
  },

  // ─── LAW & RIGHTS ──────────────────────────────────────────────────
  {
    slug: "human-rights",
    title: "Human Rights",
    category: "law",
    icon: "⚖️",
    description: "Understand the foundation of international human rights law and its application.",
    lessons: [
      {
        title: "Universal Declaration of Human Rights",
        content: `The UDHR, adopted in 1948, is the foundational document of international human rights law. It outlines 30 fundamental rights.

**Key Rights:**

**Civil and Political Rights:**
• Right to life, liberty, and security (Article 3)
• Freedom from slavery (Article 4)
• Right to a fair trial (Article 10)
• Freedom of thought, conscience, and religion (Article 18)
• Freedom of opinion and expression (Article 19)
• Right to peaceful assembly (Article 20)
• Right to participate in government (Article 21)

**Economic, Social, and Cultural Rights:**
• Right to work and equal pay (Article 23)
• Right to rest and leisure (Article 24)
• Right to education (Article 26)
• Right to participate in cultural life (Article 27)

**Core Principles:**
• Universality — applies to all people everywhere
• Inalienability — cannot be taken away
• Indivisibility — all rights are equally important
• Non-discrimination — applies regardless of status

**International Bodies:**
• UN Human Rights Council
• Office of the High Commissioner for Human Rights (OHCHR)
• Treaty Bodies (monitor specific conventions)`
      },
      {
        title: "International Humanitarian Law",
        content: `**What is IHL?**
International Humanitarian Law (IHL) regulates armed conflicts to protect those not fighting and restrict methods of warfare.

**Core Principles:**
• Distinction — distinguish between combatants and civilians
• Proportionality — attacks must not cause excessive civilian harm
• Military Necessity — force only used for legitimate military purposes
• Humanity — avoid unnecessary suffering

**Geneva Conventions (1949):**
• Protect wounded and sick soldiers
• Protect prisoners of war
• Protect civilians in occupied territories
• Common Article 3 — minimum protection in all conflicts

**Additional Protocols:**
• Protocol I — international armed conflicts
• Protocol II — non-international armed conflicts

**War Crimes:**
• Targeting civilians
• Using prohibited weapons
• Torture of prisoners
• Taking hostages
• Sexual violence

**Accountability:**
• International Criminal Court (ICC)
• International Criminal Tribunals
• Universal jurisdiction`
      },
    ],
  },
  {
    slug: "international-law",
    title: "International Law",
    category: "law",
    icon: "📜",
    description: "Learn the principles of international law and how they govern relations between nations.",
    lessons: [
      {
        title: "Sources of International Law",
        content: `**1. Treaties and Conventions**
Binding agreements between states. Example: Paris Agreement, Geneva Conventions.

**2. Customary International Law**
General practice accepted as law. Based on:
• State practice (what countries actually do)
• Opinio juris (belief that the practice is legally required)

**3. General Principles of Law**
Common legal principles recognized by civilized nations (good faith, due process).

**4. Judicial Decisions**
Decisions of international courts and tribunals (ICJ, ICC).

**5. Scholarly Writings**
Publicist writings used to interpret and develop international law.

**Key Principles:**
• Sovereign equality of states
• Non-intervention in domestic affairs
• Peaceful settlement of disputes
• Self-determination of peoples
• Pacta sunt servanda (treaties must be followed)

**International Courts:**
• International Court of Justice (ICJ) — state disputes
• International Criminal Court (ICC) — individual criminal responsibility
• International Tribunal for the Law of the Sea (ITLOS)
• WTO Dispute Settlement Body`
      },
    ],
  },
];

export function getCourseBySlug(slug: string): Course | undefined {
  return courses.find((c) => c.slug === slug);
}

export function getCoursesByCategory(categoryId: string): Course[] {
  return courses.filter((c) => c.category === categoryId);
}
