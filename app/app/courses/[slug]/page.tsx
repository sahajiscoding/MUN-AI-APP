"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, CheckCircle2, Lock, Trophy } from "lucide-react";
import { ProtectedAppShell } from "@/components/protected-app-shell";
import { getCourseBySlug, type QuizQuestion } from "@/lib/courses";
import { quizzes } from "@/lib/quizzes";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase/client";

export default function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, getIdToken } = useAuth();
  const course = getCourseBySlug(slug);

  const [completedLessons, setCompletedLessons] = useState<number[]>([]);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const courseQuiz = quizzes[slug] || [];
  const totalLessons = course?.lessons.length || 0;
  const percent = totalLessons > 0 ? Math.round((completedLessons.length / totalLessons) * 100) : 0;

  // Load progress from Supabase
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
        if (data) {
          setCompletedLessons((data.completed_lessons as number[]) || []);
          if (data.quiz_total > 0) {
            setQuizScore(data.quiz_score);
            setQuizSubmitted(true);
          }
        }
      });
  }, [user, slug]);

  // Save progress to Supabase
  async function saveProgress(lessons: number[], score?: number, total?: number) {
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
          completed_at: lessons.length === totalLessons ? new Date().toISOString() : undefined,
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

  function toggleLesson(index: number) {
    const next = completedLessons.includes(index)
      ? completedLessons.filter((i) => i !== index)
      : [...completedLessons, index];
    setCompletedLessons(next);
    saveProgress(next);
  }

  function submitQuiz() {
    if (!courseQuiz.length) return;
    let score = 0;
    courseQuiz.forEach((q, i) => {
      if (quizAnswers[i] === q.correct) score++;
    });
    setQuizScore(score);
    setQuizSubmitted(true);
    saveProgress(completedLessons, score, courseQuiz.length);
  }

  if (!course) {
    return (
      <ProtectedAppShell>
        <div className="flex items-center justify-center h-screen">
          <p className="text-[var(--muted)]">Course not found.</p>
        </div>
      </ProtectedAppShell>
    );
  }

  return (
    <ProtectedAppShell>
      <div className="max-w-4xl mx-auto px-5 py-8">
        {saveError ? <p className="mb-4 rounded-lg border border-red-900/20 bg-red-900/5 px-3 py-2 text-sm text-red-900" role="alert">{saveError}</p> : null}
        <Link
          href="/app/courses"
          className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--ink)] transition mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to courses
        </Link>

        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{course.icon}</span>
            <div>
              <p className="label-text text-[var(--patina)]">Course</p>
              <h1 className="display-type text-3xl sm:text-4xl">{course.title}</h1>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)] max-w-2xl">
            {course.description}
          </p>

          {/* Progress bar */}
          <div className="mt-4 max-w-md">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-[var(--muted)]">
                {completedLessons.length}/{totalLessons} lessons completed
              </span>
              <span className="font-bold text-[var(--patina)]">{percent}%</span>
            </div>
            <div className="h-2 bg-black/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--patina)] rounded-full transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </header>

        {/* Lessons */}
        <div className="space-y-4">
          <h2 className="display-type text-xl mb-2">Lessons</h2>
          {course.lessons.map((lesson, i) => {
            const isCompleted = completedLessons.includes(i);
            return (
              <article
                key={i}
                className={`surface rounded-xl p-6 transition ${isCompleted ? "ring-2 ring-[var(--patina)]/30" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleLesson(i)}
                    className="shrink-0 mt-0.5"
                    title={isCompleted ? "Mark as incomplete" : "Mark as complete"}
                  >
                    <div className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold transition ${
                      isCompleted
                        ? "bg-[var(--patina)] text-white"
                        : "bg-[var(--ink)] text-[var(--paper)]"
                    }`}>
                      {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </div>
                  </button>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{lesson.title}</h3>
                    <div className="mt-3 prose prose-sm prose-neutral max-w-none whitespace-pre-wrap leading-7">
                      {lesson.content}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Quiz Section */}
        {courseQuiz.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="display-type text-xl flex items-center gap-2">
                <Trophy className="h-5 w-5 text-[var(--brass)]" />
                Quiz
              </h2>
              {quizSubmitted && (
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  (quizScore / courseQuiz.length) >= 0.7
                    ? "bg-[var(--patina)]/10 text-[var(--patina)]"
                    : "bg-[var(--oxblood)]/10 text-[var(--oxblood)]"
                }`}>
                  {quizScore}/{courseQuiz.length} ({Math.round((quizScore / courseQuiz.length) * 100)}%)
                </span>
              )}
            </div>

            {!showQuiz && !quizSubmitted && (
              <button
                onClick={() => setShowQuiz(true)}
                className="button-primary px-5 py-2 text-sm font-semibold"
              >
                Start Quiz
              </button>
            )}

            {showQuiz && !quizSubmitted && (
              <div className="space-y-6">
                {courseQuiz.map((q, qi) => (
                  <div key={qi} className="surface rounded-xl p-5">
                    <p className="font-semibold text-sm mb-3">
                      {qi + 1}. {q.question}
                    </p>
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => (
                        <label
                          key={oi}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                            quizAnswers[qi] === oi
                              ? "border-[var(--patina)] bg-[var(--patina)]/5"
                              : "border-[var(--line)] hover:bg-black/5"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q${qi}`}
                            checked={quizAnswers[qi] === oi}
                            onChange={() => {
                              const next = [...quizAnswers];
                              next[qi] = oi;
                              setQuizAnswers(next);
                            }}
                            className="accent-[var(--patina)]"
                          />
                          <span className="text-sm">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <button
                  onClick={submitQuiz}
                  disabled={quizAnswers.filter((a) => a !== undefined).length < courseQuiz.length}
                  className="button-primary px-5 py-2 text-sm font-semibold disabled:opacity-40"
                >
                  Submit Quiz
                </button>
              </div>
            )}

            {quizSubmitted && (
              <div className="surface rounded-xl p-6">
                <div className="text-center">
                  <Trophy className={`h-10 w-10 mx-auto mb-3 ${
                    (quizScore / courseQuiz.length) >= 0.7 ? "text-[var(--patina)]" : "text-[var(--oxblood)]"
                  }`} />
                  <p className="text-2xl font-bold mb-1">
                    {quizScore}/{courseQuiz.length}
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    {(quizScore / courseQuiz.length) >= 0.7
                      ? "Great job! You passed the quiz."
                      : "Keep studying and try again!"}
                  </p>
                  <button
                    onClick={() => {
                      setQuizSubmitted(false);
                      setQuizAnswers([]);
                      setShowQuiz(true);
                    }}
                    className="mt-4 button-secondary px-4 py-2 text-sm font-semibold"
                  >
                    Retake Quiz
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link
            href="/app/courses"
            className="button-secondary inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold"
          >
            <BookOpen className="h-4 w-4" />
            Browse more courses
          </Link>
        </div>
      </div>
    </ProtectedAppShell>
  );
}
