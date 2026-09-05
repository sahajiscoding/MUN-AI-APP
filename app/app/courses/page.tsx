"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { ProtectedAppShell } from "@/components/protected-app-shell";
import { categories, courses } from "@/lib/courses";
import { useAuth } from "@/components/auth-provider";

type ProgressMap = Record<string, { completed: number; total: number; quizScore: number; quizTotal: number }>;

export default function CoursesPage() {
  const { user, getIdToken } = useAuth();
  const [progress, setProgress] = useState<ProgressMap>({});

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function loadProgress() {
      try {
        const token = await getIdToken();
        const response = await fetch("/api/progress", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const result = (await response.json()) as { progress?: Array<{ course_slug: string; completed_lessons?: unknown; quiz_score?: number; quiz_total?: number }>; error?: string };
        if (!response.ok) throw new Error(result.error || "Could not load course progress.");
        if (cancelled) return;
        const map: ProgressMap = {};
        for (const row of result.progress || []) {
          map[row.course_slug] = {
            completed: Array.isArray(row.completed_lessons) ? row.completed_lessons.length : 0,
            total: 0,
            quizScore: row.quiz_score || 0,
            quizTotal: row.quiz_total || 0,
          };
        }
        setProgress(map);
      } catch {
        if (!cancelled) setProgress({});
      }
    }

    void loadProgress();
    return () => {
      cancelled = true;
    };
  }, [getIdToken, user]);

  return (
    <ProtectedAppShell>
      <div className="max-w-5xl mx-auto px-5 py-8">
        <header className="mb-8">
          <p className="label-text text-[var(--patina)]">Learn</p>
          <h1 className="display-type mt-2 text-4xl sm:text-5xl">Courses</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)] max-w-2xl">
            Master MUN, debate, policy, and global affairs with structured courses.
            Each course has lessons, quizzes, and progress tracking.
          </p>
        </header>

        <div className="space-y-10">
          {categories.map((cat) => {
            const catCourses = courses.filter((c) => c.category === cat.id);
            if (catCourses.length === 0) return null;

            return (
              <section key={cat.id}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{cat.icon}</span>
                  <h2 className="display-type text-2xl">{cat.name}</h2>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {catCourses.map((course) => {
                    const p = progress[course.slug];
                    const completedCount = p?.completed || 0;
                    const totalLessons = course.lessons.length;
                    const percent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
                    const hasQuiz = p?.quizTotal && p.quizTotal > 0;
                    const quizPercent = hasQuiz ? Math.round((p.quizScore / p.quizTotal) * 100) : 0;

                    return (
                      <Link
                        key={course.slug}
                        href={`/app/courses/${course.slug}`}
                        className="surface rounded-xl p-4 hover:-translate-y-0.5 transition group"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xl shrink-0">{course.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-sm group-hover:text-[var(--patina)] transition truncate">
                                {course.title}
                              </h3>
                              <Lock className="h-3 w-3 text-[var(--brass)] shrink-0" />
                            </div>
                            <p className="mt-1 text-xs leading-5 text-[var(--muted)] line-clamp-2">
                              {course.description}
                            </p>

                            {/* Progress bar */}
                            <div className="mt-3">
                              <div className="mb-1 flex items-center justify-between text-xs">
                                <span className="text-[var(--muted)]">
                                  {completedCount}/{totalLessons} lessons
                                </span>
                                <span className="font-bold text-[var(--patina)]">{percent}% done</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-black/10">
                                <div
                                  className="h-full rounded-full bg-[var(--patina)] transition-all"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>

                            {/* Quiz score */}
                            {hasQuiz && (
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-xs text-[var(--muted)]">Quiz:</span>
                                <span className={`text-xs font-semibold ${quizPercent >= 70 ? "text-[var(--patina)]" : "text-[var(--oxblood)]"}`}>
                                  {p.quizScore}/{p.quizTotal} ({quizPercent}%)
                                </span>
                              </div>
                            )}

                            <p className="mt-2 text-xs text-[var(--brass)] font-semibold">
                              {course.lessons.length} lessons · Knowledge checks · Final review
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </ProtectedAppShell>
  );
}
