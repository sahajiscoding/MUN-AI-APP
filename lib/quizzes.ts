import type { QuizQuestion } from "@/lib/courses";

export const quizzes: Record<string, QuizQuestion[]> = {
  "mun-basics": [
    { question: "What is the primary goal of MUN?", options: ["To win awards", "To research, debate, and collaborate on global issues", "To practice public speaking only", "To travel to New York"], correct: 1 },
    { question: "Which UN body can pass binding resolutions?", options: ["General Assembly", "ECOSOC", "Security Council", "Secretariat"], correct: 2 },
    { question: "What motion allows delegates to negotiate freely?", options: ["Moderated Caucus", "Unmoderated Caucus", "Roll Call Vote", "Point of Order"], correct: 1 },
    { question: "Preambulatory clauses end with what punctuation?", options: ["Period", "Semicolon", "Comma", "No punctuation"], correct: 2 },
  ],
  "position-papers": [
    { question: "How long is a typical position paper?", options: ["3-4 pages", "1-2 pages", "5+ pages", "Half a page"], correct: 1 },
    { question: "Which pronoun should you use in a position paper?", options: ["I think...", "We believe...", "The delegation of India believes...", "In my opinion..."], correct: 2 },
    { question: "What should a position paper include?", options: ["Personal opinions only", "Country's stance with supporting evidence", "A list of friends in the committee", "Your school's achievements"], correct: 1 },
  ],
  "research-strategies": [
    { question: "Which is a primary source for MUN research?", options: ["Wikipedia", "UN Official Documents", "A random blog", "Twitter posts"], correct: 1 },
    { question: "What should you avoid in research?", options: ["Academic journals", "Think tank reports", "Unverified blogs", "Government websites"], correct: 2 },
  ],
  "bloc-strategy": [
    { question: "Why are blocs important in MUN?", options: ["They look impressive", "No single country can pass a resolution alone", "They guarantee awards", "They're required by rules"], correct: 1 },
    { question: "When should you compromise in a bloc?", options: ["Never", "When you can achieve 80% of your goals", "Only when forced", "When the chair tells you to"], correct: 1 },
  ],
  "public-speaking": [
    { question: "What is the average speaking rate?", options: ["100-120 wpm", "130-150 wpm", "200-220 wpm", "80-100 wpm"], correct: 1 },
    { question: "How long should eye contact last per person?", options: ["1 second", "3-5 seconds", "10 seconds", "Don't make eye contact"], correct: 1 },
    { question: "What percentage of a speech should the opening be?", options: ["30-40%", "10-15%", "50%", "1-2%"], correct: 1 },
  ],
  "argumentation": [
    { question: "What does CER stand for?", options: ["Claim-Evidence-Reasoning", "Committee-Evidence-Response", "Country-Election-Resolution", "Claim-Evaluation-Result"], correct: 0 },
    { question: "Which is a rebuttal technique?", options: ["Ignoring the argument", "Challenging the evidence", "Changing the topic", "Getting angry"], correct: 1 },
  ],
  "voting-systems": [
    { question: "What is First Past the Post?", options: ["A running race", "Candidate with most votes wins", "Majority wins", "Random selection"], correct: 1 },
    { question: "Which system uses voter rankings?", options: ["FPTP", "Ranked Choice Voting", "Simple Majority", "Lottery"], correct: 1 },
  ],
  "campaign-strategy": [
    { question: "What is the first phase of campaign planning?", options: ["Get Out The Vote", "Foundation", "Media engagement", "Fundraising"], correct: 1 },
  ],
  "un-bodies": [
    { question: "How many permanent members does the UNSC have?", options: ["3", "5", "10", "15"], correct: 1 },
    { question: "Which organ carries out day-to-day UN work?", options: ["General Assembly", "Security Council", "Secretariat", "ICJ"], correct: 2 },
  ],
  "policy-making": [
    { question: "What is the first step of the policy cycle?", options: ["Policy evaluation", "Agenda setting", "Policy implementation", "Policy adjustment"], correct: 1 },
  ],
  "conflict-resolution": [
    { question: "What is traditional peacekeeping primarily?", options: ["Using force", "Monitoring ceasefires and buffer zones", "Building schools", "Economic sanctions"], correct: 1 },
  ],
  "climate-diplomacy": [
    { question: "What is the goal of the Paris Agreement?", options: ["Zero emissions by 2030", "Limit warming to 1.5°C", "Ban all fossil fuels", "Plant 1 trillion trees"], correct: 1 },
  ],
  "human-rights": [
    { question: "When was the Universal Declaration of Human Rights adopted?", options: ["1945", "1948", "1960", "2000"], correct: 1 },
    { question: "Which principle means rights apply to all people?", options: ["Indivisibility", "Non-discrimination", "Universality", "Inalienability"], correct: 2 },
  ],
  "international-law": [
    { question: "What does 'pacta sunt servanda' mean?", options: ["Peace is necessary", "Treaties must be followed", "War is last resort", "All men are equal"], correct: 1 },
  ],
};
