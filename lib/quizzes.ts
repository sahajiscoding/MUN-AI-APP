import type { Course, Lesson } from "@/lib/courses";

/**
 * Public quiz content is safe to import from client components. Correct-answer
 * indexes live only in lib/server/quiz-answer-keys.ts.
 */
export type PublicQuizQuestion = {
  question: string;
  options: string[];
};

export const quizzes: Record<string, PublicQuizQuestion[]> = {
  "mun-basics": [
    { question: "What is the primary goal of MUN?", options: ["To win awards", "To research, debate, and collaborate on global issues", "To practice public speaking only", "To travel to New York"] },
    { question: "Which UN body can pass binding resolutions?", options: ["General Assembly", "ECOSOC", "Security Council", "Secretariat"] },
    { question: "What motion allows delegates to negotiate freely?", options: ["Moderated Caucus", "Unmoderated Caucus", "Roll Call Vote", "Point of Order"] },
    { question: "Preambulatory clauses end with what punctuation?", options: ["Period", "Semicolon", "Comma", "No punctuation"] },
  ],
  "position-papers": [
    { question: "How long is a typical position paper?", options: ["3-4 pages", "1-2 pages", "5+ pages", "Half a page"] },
    { question: "Which pronoun should you use in a position paper?", options: ["I think...", "We believe...", "The delegation of India believes...", "In my opinion..."] },
    { question: "What should a position paper include?", options: ["Personal opinions only", "Country's stance with supporting evidence", "A list of friends in the committee", "Your school's achievements"] },
  ],
  "research-strategies": [
    { question: "Which is a primary source for MUN research?", options: ["Wikipedia", "UN Official Documents", "A random blog", "Twitter posts"] },
    { question: "What should you avoid in research?", options: ["Academic journals", "Think tank reports", "Unverified blogs", "Government websites"] },
  ],
  "bloc-strategy": [
    { question: "Why are blocs important in MUN?", options: ["They look impressive", "No single country can pass a resolution alone", "They guarantee awards", "They're required by rules"] },
    { question: "When should you compromise in a bloc?", options: ["Never", "When you can achieve 80% of your goals", "Only when forced", "When the chair tells you to"] },
  ],
  "public-speaking": [
    { question: "What is the average speaking rate?", options: ["100-120 wpm", "130-150 wpm", "200-220 wpm", "80-100 wpm"] },
    { question: "How long should eye contact last per person?", options: ["1 second", "3-5 seconds", "10 seconds", "Don't make eye contact"] },
    { question: "What percentage of a speech should the opening be?", options: ["30-40%", "10-15%", "50%", "1-2%"] },
  ],
  argumentation: [
    { question: "What does CER stand for?", options: ["Claim-Evidence-Reasoning", "Committee-Evidence-Response", "Country-Election-Resolution", "Claim-Evaluation-Result"] },
    { question: "Which is a rebuttal technique?", options: ["Ignoring the argument", "Challenging the evidence", "Changing the topic", "Getting angry"] },
  ],
  "voting-systems": [
    { question: "What is First Past the Post?", options: ["A running race", "Candidate with most votes wins", "Majority wins", "Random selection"] },
    { question: "Which system uses voter rankings?", options: ["FPTP", "Ranked Choice Voting", "Simple Majority", "Lottery"] },
  ],
  "campaign-strategy": [
    { question: "What is the first phase of campaign planning?", options: ["Get Out The Vote", "Foundation", "Media engagement", "Fundraising"] },
  ],
  "un-bodies": [
    { question: "How many permanent members does the UNSC have?", options: ["3", "5", "10", "15"] },
    { question: "Which organ carries out day-to-day UN work?", options: ["General Assembly", "Security Council", "Secretariat", "ICJ"] },
  ],
  "policy-making": [
    { question: "What is the first step of the policy cycle?", options: ["Policy evaluation", "Agenda setting", "Policy implementation", "Policy adjustment"] },
  ],
  "conflict-resolution": [
    { question: "What is traditional peacekeeping primarily?", options: ["Using force", "Monitoring ceasefires and buffer zones", "Building schools", "Economic sanctions"] },
  ],
  "climate-diplomacy": [
    { question: "What is the goal of the Paris Agreement?", options: ["Zero emissions by 2030", "Limit warming to 1.5°C", "Ban all fossil fuels", "Plant 1 trillion trees"] },
  ],
  "human-rights": [
    { question: "When was the Universal Declaration of Human Rights adopted?", options: ["1945", "1948", "1960", "2000"] },
    { question: "Which principle means rights apply to all people?", options: ["Indivisibility", "Non-discrimination", "Universality", "Inalienability"] },
  ],
  "international-law": [
    { question: "What does 'pacta sunt servanda' mean?", options: ["Peace is necessary", "Treaties must be followed", "War is last resort", "All men are equal"] },
  ],
};

function makeFallbackQuestion(lesson: Lesson): PublicQuizQuestion {
  return {
    question: `Which topic is the focus of the lesson “${lesson.title}”?`,
    options: [lesson.title, "A completely unrelated topic", "A private social event", "An optional bonus activity"],
  };
}

/** Build the answer-free final review in the exact order shown to learners. */
export function buildCourseReviewQuestions(course: Course): PublicQuizQuestion[] {
  const courseQuiz = quizzes[course.slug] ?? [];
  const questions = [...courseQuiz];
  course.lessons.forEach((lesson, index) => {
    if (!courseQuiz[index]) questions.push(makeFallbackQuestion(lesson));
  });
  return questions;
}
