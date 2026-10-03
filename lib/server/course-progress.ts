import { getCourseBySlug, type Course, type Lesson, type QuizQuestion } from "@/lib/courses";
import { quizzes } from "@/lib/quizzes";
import { quizAnswerKeys } from "@/lib/server/quiz-answer-keys";

/** Return the trusted server-side course for a slug. */
export function getTrustedCourse(slug: string) {
  return getCourseBySlug(slug);
}

/** Return server-side quiz questions with correct answers for a course slug. */
export function getTrustedQuestions(slug: string): QuizQuestion[] {
  const course = getCourseBySlug(slug);
  if (!course) return [];
  const courseQuiz = quizzes[slug] || [];
  const answerKey = quizAnswerKeys[slug] || [];
  return course.lessons.map((lesson, index) => {
    const question = courseQuiz[index];
    return question
      ? { ...question, correct: answerKey[index] ?? 0 }
      : makeFallbackQuestion(lesson);
  });
}

/** Server-only final-review list, paired with the answer-free client questions. */
export function buildTrustedCourseReviewQuestions(course: Course): QuizQuestion[] {
  const courseQuiz = quizzes[course.slug] ?? [];
  const answerKey = quizAnswerKeys[course.slug] ?? [];
  const questions: QuizQuestion[] = courseQuiz.map((question, index) => ({
    ...question,
    correct: answerKey[index] ?? 0,
  }));
  course.lessons.forEach((lesson, index) => {
    if (!courseQuiz[index]) questions.push(makeFallbackQuestion(lesson));
  });
  return questions;
}

/** Build a server-side fallback question carrying its correct answer index. */
function makeFallbackQuestion(lesson: Lesson): QuizQuestion {
  return {
    question: `Which topic is the focus of the lesson “${lesson.title}”?`,
    options: [lesson.title, "A completely unrelated topic", "A private social event", "An optional bonus activity"],
    correct: 0,
  };
}

/** Deduplicate and sort lesson indexes, keeping only valid positions. */
export function normalizeLessonIndexes(value: unknown, lessonCount: number) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((index): index is number => typeof index === "number" && Number.isInteger(index) && index >= 0 && index < lessonCount))].sort((a, b) => a - b);
}

/** Check whether a lesson unlocks next given sequentially completed lessons. */
export function isSequentiallyComplete(completedLessons: number[], lessonIndex: number) {
  return completedLessons.includes(lessonIndex) || completedLessons.every((index, position) => index === position) && lessonIndex === completedLessons.length;
}
