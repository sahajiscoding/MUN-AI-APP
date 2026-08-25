"use client";

import Link from "next/link";
import { ProtectedAppShell } from "@/components/protected-app-shell";
import { categories, courses } from "@/lib/courses";

export default function CoursesPage() {
  return (
    <ProtectedAppShell>
      <div className="max-w-5xl mx-auto px-5 py-8">
        <header className="mb-8">
          <p className="label-text text-[var(--patina)]">Learn</p>
          <h1 className="display-type mt-2 text-4xl sm:text-5xl">Courses</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)] max-w-2xl">
            Master MUN, debate, policy, and global affairs with structured courses.
            Each course has multiple lessons with detailed content.
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
                  {catCourses.map((course) => (
                    <Link
                      key={course.slug}
                      href={`/app/courses/${course.slug}`}
                      className="surface rounded-xl p-4 hover:-translate-y-0.5 transition group"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl shrink-0">{course.icon}</span>
                        <div>
                          <h3 className="font-semibold text-sm group-hover:text-[var(--patina)] transition">
                            {course.title}
                          </h3>
                          <p className="mt-1 text-xs leading-5 text-[var(--muted)] line-clamp-2">
                            {course.description}
                          </p>
                          <p className="mt-2 text-xs text-[var(--brass)] font-semibold">
                            {course.lessons.length} lessons
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </ProtectedAppShell>
  );
}
