"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { ProtectedAppShell } from "@/components/protected-app-shell";
import { getCourseBySlug } from "@/lib/courses";

export default function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const course = getCourseBySlug(slug);

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
          <p className="mt-2 text-xs text-[var(--brass)] font-semibold">
            {course.lessons.length} lessons
          </p>
        </header>

        <div className="space-y-6">
          {course.lessons.map((lesson, i) => (
            <article key={i} className="surface rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--ink)] text-[var(--paper)] text-sm font-bold">
                  {i + 1}
                </div>
                <h2 className="font-semibold text-lg">{lesson.title}</h2>
              </div>
              <div className="prose prose-sm prose-neutral max-w-none whitespace-pre-wrap leading-7">
                {lesson.content}
              </div>
            </article>
          ))}
        </div>

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
