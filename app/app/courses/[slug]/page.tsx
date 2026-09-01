"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Lock,
  RotateCcw,
  Trophy,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { ProtectedAppShell } from "@/components/protected-app-shell";
import { getCourseBySlug, type Lesson, type QuizQuestion } from "@/lib/courses";
import { quizzes } from "@/lib/quizzes";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase/client";

type CheckpointState = "idle" | "correct" | "incorrect";

const answerColors = [
  "border-[#c8534b] hover:bg-[#c8534b] hover:text-white",
  "border-[#2d887f] hover:bg-[#2d887f] hover:text-white",
  "border-[#c2943b] hover:bg-[#c2943b] hover:text-white",
  "border-[#6570a8] hover:bg-[#6570a8] hover:text-white",
];

function isSafeExternalUrl(value: string) {
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:" || url.origin === window.location.origin;
  } catch {
    return false;
  }
}

function makeFallbackQuestion(lesson: Lesson): QuizQuestion {
  return {
    question: `Which topic is the focus of the lesson “${lesson.title}”?`,
    options: [lesson.title, "A completely unrelated topic", "A private social event", "An optional bonus activity"],
    correct: 0,
  };
}

export default function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, getIdToken } = useAuth();
  const course = getCourseBySlug(slug);

  const [completedLessons, setCompletedLessons] = useState<number[]>([]);
  const [quizScore, setQuizScore] = useState(0);
  const [quizTotal, setQuizTotal] = useState(0);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [finalQuizStarted, setFinalQuizStarted] = useState(false);
  const [finalQuestionIndex, setFinalQuestionIndex] = useState(0);
  const [finalAnswers, setFinalAnswers] = useState<number[]>([]);
  const [activeAnswer, setActiveAnswer] = useState<number | null>(null);
  const [checkpointState, setCheckpointState] = useState<CheckpointState>("idle");
  const [hasReachedLessonEnd, setHasReachedLessonEnd] = useState(false);
  const [reviewLessonIndex, setReviewLessonIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const lessonEndRef = useRef<HTMLDivElement>(null);

  const courseQuiz = useMemo(() => (course ? quizzes[slug] || [] : []), [course, slug]);
  const lessonQuestions = useMemo(
    () => (course ? course.lessons.map((lesson, index) => courseQuiz[index] || makeFallbackQuestion(lesson)) : []),
    [course, courseQuiz]
  );
  const finalQuizQuestions = useMemo(() => {
    if (!course) return [];
    const questions = [...courseQuiz];
    course.lessons.forEach((lesson, index) => {
      if (!courseQuiz[index]) questions.push(makeFallbackQuestion(lesson));
    });
    return questions;
  }, [course, courseQuiz]);

  const totalLessons = course?.lessons.length || 0;
  const completedCount = completedLessons.length;
  const percent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  const activeLessonIndex = course
    ? course.lessons.findIndex((_, index) => !completedLessons.includes(index))
    : -1;
  const allLessonsComplete = totalLessons > 0 && activeLessonIndex === -1;
  const activeQuestion = activeLessonIndex >= 0 ? lessonQuestions[activeLessonIndex] : null;
  const finalQuestion = finalQuizQuestions[finalQuestionIndex];

  useEffect(() => {
    if (!user || !slug) return;
    const supabase = getSupabase();

    supabase
      .from("course_progress")
      .select("completed_lessons, quiz_score, quiz_total")
      .eq("uid", user.id)
      .eq("course_slug", slug)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const savedLessons = Array.isArray(data.completed_lessons)
          ? (data.completed_lessons as number[]).filter((index) => Number.isInteger(index))
          : [];
        setCompletedLessons(savedLessons.sort((a, b) => a - b));
        setQuizScore(data.quiz_score || 0);
        setQuizTotal(data.quiz_total || 0);
        setQuizSubmitted((data.quiz_total || 0) > 0);
      });
  }, [user, slug]);

  useEffect(() => {
    setHasReachedLessonEnd(false);
    setActiveAnswer(null);
    setCheckpointState("idle");
    setReviewLessonIndex(null);
  }, [activeLessonIndex]);

  useEffect(() => {
    if (activeLessonIndex < 0 || !lessonEndRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setHasReachedLessonEnd(true);
      },
      { rootMargin: "0px 0px -12% 0px" }
    );
    observer.observe(lessonEndRef.current);
    return () => observer.disconnect();
  }, [activeLessonIndex]);

  async function saveProgress(
    lessons: number[],
    score?: number,
    total?: number,
    completedAt = false
  ) {
    if (!user) return;
    setSaving(true);
    setSaveError("");
    try {
      const token = await getIdToken();
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          course_slug: slug,
          completed_lessons: lessons,
          quiz_score: score,
          quiz_total: total,
          completed_at: completedAt ? new Date().toISOString() : undefined,
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Could not save progress.");
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save progress. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function submitCheckpoint() {
    if (activeLessonIndex < 0 || activeAnswer === null || !activeQuestion) return;
    const correct = activeAnswer === activeQuestion.correct;
    setCheckpointState(correct ? "correct" : "incorrect");
    if (!correct) return;

    const nextLessons = [...new Set([...completedLessons, activeLessonIndex])].sort((a, b) => a - b);
    setCompletedLessons(nextLessons);
    void saveProgress(nextLessons);
  }

  function resetCheckpoint() {
    setActiveAnswer(null);
    setCheckpointState("idle");
  }

  function startFinalQuiz() {
    setFinalAnswers([]);
    setFinalQuestionIndex(0);
    setFinalQuizStarted(true);
    setQuizSubmitted(false);
  }

  function chooseFinalAnswer(optionIndex: number) {
    const next = [...finalAnswers];
    next[finalQuestionIndex] = optionIndex;
    setFinalAnswers(next);
  }

  function submitFinalQuiz(answers: number[]) {
    const score = finalQuizQuestions.reduce(
      (total, question, index) => total + (answers[index] === question.correct ? 1 : 0),
      0
    );
    setQuizScore(score);
    setQuizTotal(finalQuizQuestions.length);
    setQuizSubmitted(true);
    setFinalQuizStarted(false);
    void saveProgress(
      completedLessons,
      score,
      finalQuizQuestions.length,
      score / Math.max(finalQuizQuestions.length, 1) >= 0.7
    );
  }

  function advanceFinalQuiz() {
    if (finalAnswers[finalQuestionIndex] === undefined) return;
    if (finalQuestionIndex === finalQuizQuestions.length - 1) {
      submitFinalQuiz(finalAnswers);
      return;
    }
    setFinalQuestionIndex((current) => current + 1);
  }

  if (!course) {
    return (
      <ProtectedAppShell>
        <div className="flex h-screen items-center justify-center">
          <p className="text-[var(--muted)]">Course not found.</p>
        </div>
      </ProtectedAppShell>
    );
  }

  return (
    <ProtectedAppShell>
      <div className="mx-auto max-w-4xl px-5 py-8 pb-16">
        {saveError ? (
          <p className="mb-4 rounded-lg border border-red-900/20 bg-red-900/5 px-3 py-2 text-sm text-red-900" role="alert">
            {saveError}
          </p>
        ) : null}

        <Link
          href="/app/courses"
          className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--muted)] transition hover:text-[var(--ink)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to courses
        </Link>

        <header className="mb-8">
          <div className="flex items-start gap-3">
            <span className="mt-1 text-3xl" aria-hidden="true">{course.icon}</span>
            <div>
              <p className="label-text text-[var(--patina)]">Course journey</p>
              <h1 className="display-type text-3xl sm:text-4xl">{course.title}</h1>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">{course.description}</p>

          <div className="mt-6 rounded-2xl border border-[var(--line)] bg-white/35 p-4 shadow-[0_12px_34px_rgba(39,35,28,0.06)] sm:p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Your progress</p>
                <p className="mt-1 text-sm font-semibold text-[var(--ink)]">
                  {completedCount}/{totalLessons} lessons completed
                </p>
              </div>
              <span className="text-2xl font-bold text-[var(--patina)]">{percent}% done</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-black/10" aria-label={`${percent}% done`}>
              <div
                className="h-full rounded-full bg-[var(--patina)] transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--patina)]" />
                Finish each lesson check to unlock the next one
              </span>
              {saving ? <span className="text-[var(--brass)]">Saving progress…</span> : null}
            </div>
          </div>
        </header>

        <section aria-labelledby="course-roadmap">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="label-text text-[var(--brass)]">Learn by doing</p>
              <h2 id="course-roadmap" className="display-type mt-1 text-2xl">Course roadmap</h2>
            </div>
            <span className="hidden text-xs font-semibold text-[var(--muted)] sm:block">Lesson → check → next lesson</span>
          </div>

          <div className="space-y-4">
            {course.lessons.map((lesson, index) => {
              const isCompleted = completedLessons.includes(index);
              const isActive = index === activeLessonIndex && !allLessonsComplete;
              const isLocked = !isCompleted && !isActive;
              const isReviewing = reviewLessonIndex === index;

              return (
                <article
                  key={lesson.title}
                  className={`overflow-hidden rounded-2xl border transition ${
                    isActive
                      ? "border-[var(--patina)]/55 bg-[var(--surface)] shadow-[0_16px_40px_rgba(39,35,28,0.09)]"
                      : isCompleted
                        ? "border-[var(--patina)]/25 bg-white/45"
                        : "border-[var(--line)] bg-black/[0.025]"
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
                    <div
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold ${
                        isCompleted
                          ? "bg-[var(--patina)] text-white"
                          : isActive
                            ? "bg-[var(--ink)] text-[var(--paper)]"
                            : "bg-black/10 text-[var(--muted)]"
                      }`}
                    >
                      {isCompleted ? <Check className="h-5 w-5" /> : isLocked ? <Lock className="h-4 w-4" /> : index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--muted)]">Lesson {index + 1}</p>
                      <h3 className="mt-0.5 truncate text-base font-bold text-[var(--ink)] sm:text-lg">{lesson.title}</h3>
                    </div>
                    {isCompleted ? (
                      <button
                        type="button"
                        onClick={() => setReviewLessonIndex(isReviewing ? null : index)}
                        className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[var(--patina)] transition hover:text-[var(--ink)]"
                      >
                        {isReviewing ? "Close" : "Review"}
                        <ChevronRight className={`h-4 w-4 transition-transform ${isReviewing ? "rotate-90" : ""}`} />
                      </button>
                    ) : isActive ? (
                      <span className="rounded-full bg-[var(--brass)]/15 px-2.5 py-1 text-[11px] font-bold text-[var(--brass)]">Up next</span>
                    ) : (
                      <span className="hidden text-xs font-semibold text-[var(--muted)] sm:block">Locked</span>
                    )}
                  </div>

                  {isActive || isReviewing ? (
                    <div className="border-t border-[var(--line)] px-4 pb-5 pt-5 sm:px-8 sm:pb-7 sm:pt-6">
                      <div className="chat-markdown text-sm leading-7 sm:text-[15px]">
                        <Streamdown
                          mode="static"
                          parseIncompleteMarkdown
                          lineNumbers={false}
                          linkSafety={{ enabled: true, onLinkCheck: isSafeExternalUrl }}
                        >
                          {lesson.content}
                        </Streamdown>
                      </div>

                      {isActive ? (
                        <>
                          <div ref={lessonEndRef} className="mt-6 border-t border-dashed border-[var(--line)] pt-5">
                            {!hasReachedLessonEnd ? (
                              <div className="rounded-xl bg-[var(--brass)]/10 p-4">
                                <p className="text-sm font-semibold text-[var(--ink)]">Keep reading — the knowledge check unlocks when you reach the end of this lesson.</p>
                              </div>
                            ) : activeQuestion ? (
                              <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 sm:p-6">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 text-[var(--patina)]">
                                    <CircleHelp className="h-5 w-5" />
                                    <p className="text-xs font-bold uppercase tracking-[0.12em]">Knowledge check</p>
                                  </div>
                                  <span className="text-xs font-semibold text-[var(--muted)]">1 question</span>
                                </div>
                                <h4 className="mt-4 text-lg font-bold leading-7 text-[var(--ink)]">{activeQuestion.question}</h4>
                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                  {activeQuestion.options.map((option, optionIndex) => {
                                    const selected = activeAnswer === optionIndex;
                                    return (
                                      <button
                                        key={option}
                                        type="button"
                                        onClick={() => {
                                          setActiveAnswer(optionIndex);
                                          setCheckpointState("idle");
                                        }}
                                        className={`min-h-16 rounded-xl border-2 px-4 py-3 text-left text-sm font-bold transition active:scale-[0.98] ${
                                          selected
                                            ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] shadow-md"
                                            : `${answerColors[optionIndex % answerColors.length]} bg-white/65 text-[var(--ink)]`
                                        }`}
                                      >
                                        <span className="mr-2 opacity-60">{String.fromCharCode(65 + optionIndex)}</span>
                                        {option}
                                      </button>
                                    );
                                  })}
                                </div>
                                {checkpointState === "incorrect" ? (
                                  <div className="mt-4 flex flex-col gap-3 rounded-xl bg-[var(--oxblood)]/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                                    <p className="font-semibold text-[var(--oxblood)]">Not quite. Review the lesson and try the check again.</p>
                                    <button type="button" onClick={resetCheckpoint} className="button-secondary shrink-0 px-3 py-2 text-xs font-bold">
                                      Try again
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={submitCheckpoint}
                                    disabled={activeAnswer === null}
                                    className="button-primary mt-5 inline-flex items-center gap-2 px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    Check answer
                                    <ChevronRight className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : isLocked ? (
                    <div className="border-t border-[var(--line)] px-4 py-4 text-sm text-[var(--muted)] sm:px-5">
                      Complete the previous lesson and its knowledge check to unlock this lesson.
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        {allLessonsComplete && finalQuizQuestions.length > 0 ? (
          <section className="mt-8" aria-labelledby="final-review">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="label-text text-[var(--brass)]">You made it to the finish line</p>
                <h2 id="final-review" className="display-type mt-1 flex items-center gap-2 text-2xl">
                  <Trophy className="h-6 w-6 text-[var(--brass)]" />
                  Final course review
                </h2>
              </div>
              {quizSubmitted ? (
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${quizScore / Math.max(quizTotal, 1) >= 0.7 ? "bg-[var(--patina)]/10 text-[var(--patina)]" : "bg-[var(--oxblood)]/10 text-[var(--oxblood)]"}`}>
                  {quizScore}/{quizTotal} · {Math.round((quizScore / Math.max(quizTotal, 1)) * 100)}%
                </span>
              ) : null}
            </div>

            {!finalQuizStarted && !quizSubmitted ? (
              <div className="surface rounded-2xl p-6 sm:p-8">
                <p className="max-w-xl text-sm leading-6 text-[var(--muted)]">
                  Test what you learned across every lesson. Pick an answer, move through the questions, and see your result at the end.
                </p>
                <button type="button" onClick={startFinalQuiz} className="button-primary mt-5 inline-flex items-center gap-2 px-5 py-3 text-sm font-bold">
                  Start final review
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            {finalQuizStarted && finalQuestion ? (
              <div className="surface rounded-2xl p-4 sm:p-7">
                <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                  <span>Question {finalQuestionIndex + 1} of {finalQuizQuestions.length}</span>
                  <span>{Math.round(((finalQuestionIndex + 1) / finalQuizQuestions.length) * 100)}% through</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10">
                  <div className="h-full rounded-full bg-[var(--brass)] transition-all" style={{ width: `${((finalQuestionIndex + 1) / finalQuizQuestions.length) * 100}%` }} />
                </div>
                <h3 className="mt-7 text-xl font-bold leading-8 text-[var(--ink)] sm:text-2xl">{finalQuestion.question}</h3>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {finalQuestion.options.map((option, optionIndex) => {
                    const selected = finalAnswers[finalQuestionIndex] === optionIndex;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => chooseFinalAnswer(optionIndex)}
                        className={`min-h-20 rounded-2xl border-2 px-5 py-4 text-left text-sm font-bold transition active:scale-[0.98] sm:text-base ${
                          selected
                            ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] shadow-lg"
                            : `${answerColors[optionIndex % answerColors.length]} bg-white/65 text-[var(--ink)]`
                        }`}
                      >
                        <span className="mr-2 opacity-60">{String.fromCharCode(65 + optionIndex)}</span>
                        {option}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={advanceFinalQuiz}
                  disabled={finalAnswers[finalQuestionIndex] === undefined}
                  className="button-primary mt-6 inline-flex items-center gap-2 px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {finalQuestionIndex === finalQuizQuestions.length - 1 ? "See my result" : "Next question"}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            {quizSubmitted ? (
              <div className="surface rounded-2xl p-6 text-center sm:p-8">
                <Trophy className={`mx-auto mb-3 h-11 w-11 ${quizScore / Math.max(quizTotal, 1) >= 0.7 ? "text-[var(--patina)]" : "text-[var(--oxblood)]"}`} />
                <p className="text-3xl font-bold text-[var(--ink)]">{quizScore}/{quizTotal}</p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {quizScore / Math.max(quizTotal, 1) >= 0.7 ? "Excellent work — you completed the course review." : "You completed the review. Revisit the lessons and give it another try."}
                </p>
                <button type="button" onClick={startFinalQuiz} className="button-secondary mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-bold">
                  <RotateCcw className="h-4 w-4" />
                  Retake review
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="mt-10 text-center">
          <Link href="/app/courses" className="button-secondary inline-flex items-center gap-2 px-5 py-2 text-sm font-bold">
            <BookOpen className="h-4 w-4" />
            Browse more courses
          </Link>
        </div>
      </div>
    </ProtectedAppShell>
  );
}
