import { getCourseBySlug, type Lesson, type QuizQuestion } from "@/lib/courses";
import { quizzes } from "@/lib/quizzes";

export function getTrustedCourse(slug: string) {
  return getCourseBySlug(slug);
}

export function getTrustedQuestions(slug: string): QuizQuestion[] {
  const course = getCourseBySlug(slug);
  if (!course) return [];
  const courseQuiz = quizzes[slug] || [];
  const questions = course.lessons.map((lesson, index) => courseQuiz[index] || makeFallbackQuestion(lesson));
  return questions;
}

function makeFallbackQuestion(lesson: Lesson): QuizQuestion {
  return {
    question: `Which topic is the focus of the lesson “${lesson.title}”?`,
    options: [lesson.title, "A completely unrelated topic", "A private social event", "An optional bonus activity"],
    correct: 0,
  };
}

export function normalizeLessonIndexes(value: unknown, lessonCount: number) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((index): index is number => typeof index === "number" && Number.isInteger(index) && index >= 0 && index < lessonCount))].sort((a, b) => a - b);
}

export function isSequentiallyComplete(completedLessons: number[], lessonIndex: number) {
  return completedLessons.includes(lessonIndex) || completedLessons.every((index, position) => index === position) && lessonIndex === completedLessons.length;
}
